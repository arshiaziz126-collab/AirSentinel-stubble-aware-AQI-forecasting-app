"""Merge raw AQI, fire and weather files into one clean daily dataset.

Usage:  python -m ml.build_dataset
"""
import json

import numpy as np
import pandas as pd

from .features import BASE_COLUMNS
from .paths import (RAW_AQI, RAW_AQI_HOUR, RAW_FIRES, RAW_WEATHER, DEMO_MARKER, CITY, FIRE_BBOX,
                    DATASET, HOTSPOTS, HOURLY_PROFILE, META)

MAX_POINTS_PER_DAY = 400   # map points kept per day, so the API stays light


def _require(path, hint):
    if not path.exists():
        raise SystemExit(f"Missing {path}.\n{hint}")


def load_aqi() -> pd.DataFrame:
    _require(RAW_AQI, "Run `python -m ml.make_demo_data` for demo data, or `python -m ml.download_data aqi`.")
    raw = pd.read_csv(RAW_AQI)
    raw = raw[raw["City"].str.lower() == CITY.lower()].copy()
    raw["date"] = pd.to_datetime(raw["Date"])
    df = raw.set_index("date")[["AQI", "PM2.5", "PM10"]].rename(
        columns={"AQI": "aqi", "PM2.5": "pm25", "PM10": "pm10"})
    return df.sort_index()


def load_weather() -> pd.DataFrame:
    _require(RAW_WEATHER, "Run `python -m ml.download_data weather`.")
    w = pd.read_csv(RAW_WEATHER, parse_dates=["date"]).set_index("date").sort_index()
    return w[["tmax", "tmin", "precip", "wind_speed", "wind_dir"]]


def load_fires():
    _require(RAW_FIRES, "Run `python -m ml.download_data fires` (needs FIRMS_MAP_KEY).")
    f = pd.read_csv(RAW_FIRES)
    w, s, e, n = FIRE_BBOX
    f = f[(f.longitude.between(w, e)) & (f.latitude.between(s, n))].copy()
    conf = f["confidence"].astype(str).str.lower()
    numeric = pd.to_numeric(f["confidence"], errors="coerce")
    keep = (conf != "l") & ~(numeric.notna() & (numeric < 30))   # drop low-confidence detections
    f = f[keep]
    f["date"] = pd.to_datetime(f["acq_date"])
    daily = f.groupby("date").agg(fire_count=("frp", "size"), frp_sum=("frp", "sum"))
    return f, daily


def hourly_profile() -> dict:
    """Average shape of a day (24 multipliers) for each month, from hourly AQI if available."""
    default = (1 + 0.22 * np.cos(2 * np.pi * (np.arange(24) - 4) / 24)).round(3).tolist()
    if not RAW_AQI_HOUR.exists():
        return {str(m): default for m in range(1, 13)}
    h = pd.read_csv(RAW_AQI_HOUR, usecols=["City", "Datetime", "AQI"])
    h = h[h["City"].str.lower() == CITY.lower()].dropna(subset=["AQI"])
    h["dt"] = pd.to_datetime(h["Datetime"])
    h["day_mean"] = h.groupby(h["dt"].dt.date)["AQI"].transform("mean")
    h["ratio"] = h["AQI"] / h["day_mean"]
    prof = {}
    for m in range(1, 13):
        sub = h[h["dt"].dt.month == m]
        if len(sub) < 24 * 5:
            prof[str(m)] = default
            continue
        r = sub.groupby(sub["dt"].dt.hour)["ratio"].mean().reindex(range(24)).interpolate().bfill().ffill()
        prof[str(m)] = (r / r.mean()).round(3).tolist()
    return prof


def main():
    aqi = load_aqi()
    weather = load_weather()
    points, fires = load_fires()

    start, end = aqi.index.min(), aqi.index.max()
    idx = pd.date_range(start, end, freq="D")
    df = pd.DataFrame(index=idx)
    df = df.join(aqi).join(fires).join(weather)
    df[["fire_count", "frp_sum"]] = df[["fire_count", "frp_sum"]].fillna(0)
    df = df.interpolate(limit=3, limit_direction="both")
    df.index.name = "date"
    df = df[BASE_COLUMNS].round(2)
    df.to_csv(DATASET)

    # Map points: keep fire seasons only, at most MAX_POINTS_PER_DAY per day
    season = points["date"].dt.month.isin([4, 5, 9, 10, 11, 12])
    pts = points[season]
    pts = pts.sample(frac=1.0, random_state=0).groupby("date").head(MAX_POINTS_PER_DAY).sort_values("date")
    pts = pts.assign(date=pts["date"].dt.strftime("%Y-%m-%d"))[["date", "latitude", "longitude", "frp"]]
    pts.round({"latitude": 3, "longitude": 3, "frp": 1}).to_csv(HOTSPOTS, index=False)

    HOURLY_PROFILE.write_text(json.dumps(hourly_profile()))

    synthetic = []
    if DEMO_MARKER.exists():
        try:
            synthetic = json.loads(DEMO_MARKER.read_text())
        except ValueError:
            synthetic = ["all"]
    meta = {
        "source": "demo" if synthetic else "real",
        "synthetic_files": synthetic,
        "start": start.strftime("%Y-%m-%d"), "end": end.strftime("%Y-%m-%d"),
        "days": int(len(df)), "missing_aqi_days": int(df["aqi"].isna().sum()),
    }
    META.write_text(json.dumps(meta, indent=2))
    print(f"Dataset: {len(df)} days ({meta['start']} .. {meta['end']}), source: {meta['source']}")
    print(f"  {DATASET}\n  {HOTSPOTS} ({len(pts):,} map points)\n  {HOURLY_PROFILE}")


if __name__ == "__main__":
    main()
