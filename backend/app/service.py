"""Loads the processed data and trained models once, and answers API questions."""
import json
from datetime import date

import lightgbm as lgb
import numpy as np
import pandas as pd

from ml.features import FEATURES, group_of, make_xy
from ml.paths import (DATASET, HOTSPOTS, HOURLY_PROFILE, META, METRICS, HORIZONS,
                      model_path, FIRE_BBOX, DELHI_LAT, DELHI_LON, CITY)

from .advice import advice as build_advice
from .aqi import category, compass

HISTORY_DAYS = 10
MAP_POINTS = 450


class NotReady(RuntimeError):
    pass


def _hour_label(h: int) -> str:
    h = h % 24
    if h == 0:
        return "midnight"
    if h == 12:
        return "noon"
    return f"{h % 12} {'am' if h < 12 else 'pm'}"


class Service:
    def __init__(self):
        missing = [p for p in (DATASET, METRICS, *(model_path(h) for h in HORIZONS)) if not p.exists()]
        if missing:
            raise NotReady(
                "The model isn't trained yet. Run setup.bat (or: python -m ml.make_demo_data, "
                "python -m ml.build_dataset, python -m ml.train) and restart the API.")
        self.df = pd.read_csv(DATASET, parse_dates=["date"]).set_index("date").asfreq("D")
        self.meta = json.loads(META.read_text()) if META.exists() else {"source": "unknown"}
        self.metrics = json.loads(METRICS.read_text())
        self.models = {h: lgb.Booster(model_file=str(model_path(h))) for h in HORIZONS}
        self.profile = json.loads(HOURLY_PROFILE.read_text()) if HOURLY_PROFILE.exists() else {}
        if HOTSPOTS.exists():
            hs = pd.read_csv(HOTSPOTS)
            self.hotspots = {d: g for d, g in hs.groupby("date")}
        else:
            self.hotspots = {}
        self.X = {h: make_xy(self.df, h)[0] for h in HORIZONS}
        self.min_date = (self.df.index.min() + pd.Timedelta(days=HISTORY_DAYS)).date()
        self.max_date = (self.df.index.max() - pd.Timedelta(days=max(HORIZONS))).date()

    # ---------- dates ----------
    def default_as_of(self) -> date:
        """The latest 2 November in the data: the heart of stubble-burning season."""
        for year in sorted(set(self.df.index.year), reverse=True):
            d = date(year, 11, 2)
            if self.min_date <= d <= self.max_date and not np.isnan(self.df.loc[pd.Timestamp(d), "aqi"]):
                return d
        return self.max_date

    def check_date(self, d: date) -> pd.Timestamp:
        if not (self.min_date <= d <= self.max_date):
            raise ValueError(f"Pick a date between {self.min_date} and {self.max_date}.")
        t = pd.Timestamp(d)
        if pd.isna(self.df.loc[t, "aqi"]):
            raise ValueError(f"There's no AQI reading for {d}. Try a nearby date.")
        return t

    # ---------- pieces ----------
    def forecast(self, t: pd.Timestamp):
        out, drivers = [], []
        for h in HORIZONS:
            row = self.X[h].loc[[t], FEATURES]
            pred = float(self.models[h].predict(row)[0])
            lo_off, hi_off = self.metrics.get("intervals", {}).get(str(h), [-30, 30])
            day = t + pd.Timedelta(days=h)
            actual = self.df["aqi"].get(day, np.nan)
            out.append({
                "date": day.strftime("%Y-%m-%d"),
                "aqi": round(pred),
                "low": max(0, round(pred + lo_off)),
                "high": round(pred + hi_off),
                "category": category(pred),
                "actual": None if pd.isna(actual) else round(float(actual)),
            })
            if h == 1:
                contrib = self.models[h].predict(row, pred_contrib=True)[0][:-1]
                groups = {}
                for f, v in zip(FEATURES, contrib):
                    groups[group_of(f)] = groups.get(group_of(f), 0.0) + float(v)
                pushing = {k: v for k, v in groups.items() if v > 0}
                if not pushing:
                    pushing = {k: abs(v) for k, v in groups.items()}
                total = sum(pushing.values()) or 1.0
                drivers = sorted(({"factor": k, "share": round(v / total, 3)} for k, v in pushing.items()),
                                 key=lambda d: -d["share"])[:4]
        return out, drivers

    def hourly(self, t: pd.Timestamp, aqi_today: float):
        shape = self.profile.get(str(t.month)) or [1.0] * 24
        values = [int(min(500, round(aqi_today * s))) for s in shape]
        best_start, best_mean = 14, float("inf")
        for s in range(7, 19):                       # windows that start 7 am .. 6 pm
            m = float(np.mean(values[s:s + 3]))
            if m < best_mean:
                best_start, best_mean = s, m
        window = {"start": best_start, "end": best_start + 3,
                  "label": f"{_hour_label(best_start)} and {_hour_label(best_start + 3)}"}
        return [{"hour": h, "aqi": v} for h, v in enumerate(values)], window

    def fires(self, t: pd.Timestamp):
        fc = self.df["fire_count"]
        last3 = fc.loc[t - pd.Timedelta(days=2): t]
        week_before = fc.loc[t - pd.Timedelta(days=9): t - pd.Timedelta(days=7)]
        count3, prev3 = int(last3.sum()), int(week_before.sum())
        change = round((count3 - prev3) / prev3 * 100) if prev3 > 0 else None
        daily = fc.loc[t - pd.Timedelta(days=HISTORY_DAYS - 1): t]
        pts = [self.hotspots[d.strftime("%Y-%m-%d")] for d in last3.index
               if d.strftime("%Y-%m-%d") in self.hotspots]
        if pts:
            p = pd.concat(pts)
            if len(p) > MAP_POINTS:
                p = p.sample(MAP_POINTS, random_state=1)
            points = p[["latitude", "longitude", "frp"]].rename(
                columns={"latitude": "lat", "longitude": "lon"}).to_dict("records")
        else:
            points = []
        w, s, e, n = FIRE_BBOX
        return {
            "count_3d": count3,
            "change_vs_last_week_pct": change,
            "daily": [{"date": d.strftime("%Y-%m-%d"), "count": int(v)} for d, v in daily.items()],
            "points": points,
            "bbox": {"west": w, "south": s, "east": e, "north": n},
            "delhi": {"lat": DELHI_LAT, "lon": DELHI_LON},
        }

    # ---------- public ----------
    def dashboard(self, d: date | None = None, profile: str = "child") -> dict:
        t = self.check_date(d or self.default_as_of())
        row = self.df.loc[t]
        aqi_today = float(row["aqi"])
        cat = category(aqi_today)
        forecast, drivers = self.forecast(t)
        hourly, window = self.hourly(t, aqi_today)
        hist = self.df["aqi"].loc[t - pd.Timedelta(days=HISTORY_DAYS - 1): t]
        return {
            "city": CITY,
            "as_of": t.strftime("%Y-%m-%d"),
            "date_range": {"min": str(self.min_date), "max": str(self.max_date)},
            "mode": "replay",
            "data_source": self.meta.get("source", "unknown"),
            "today": {
                "aqi": round(aqi_today), "category": cat,
                "pm25": None if pd.isna(row["pm25"]) else round(float(row["pm25"])),
                "pm10": None if pd.isna(row["pm10"]) else round(float(row["pm10"])),
            },
            "history": [{"date": k.strftime("%Y-%m-%d"), "aqi": None if pd.isna(v) else round(float(v))}
                        for k, v in hist.items()],
            "forecast": forecast,
            "drivers": drivers,
            "wind": {"speed_kmh": round(float(row["wind_speed"]), 1), "from_deg": round(float(row["wind_dir"])),
                     "from": compass(float(row["wind_dir"]))},
            "weather": {"tmin": round(float(row["tmin"]), 1), "tmax": round(float(row["tmax"]), 1)},
            "fires": self.fires(t),
            "hourly": hourly,
            "best_window": window,
            "advice": build_advice(profile, cat["level"], cat["impact"], window["label"]),
            "model": {
                "models": self.metrics["models"],
                "stubble_season_mae": self.metrics.get("stubble_season_mae", {}),
                "importance": self.metrics.get("importance", []),
                "test_period": [self.metrics.get("test_start"), self.metrics.get("test_end")],
                "trained_on": self.metrics.get("data_source", "unknown"),
                "fire_ablation": self.metrics.get("fire_ablation"),
            },
        }

    def advice(self, profile: str, d: date | None = None) -> dict:
        t = self.check_date(d or self.default_as_of())
        aqi_today = float(self.df.loc[t, "aqi"])
        cat = category(aqi_today)
        _, window = self.hourly(t, aqi_today)
        return build_advice(profile, cat["level"], cat["impact"], window["label"])
