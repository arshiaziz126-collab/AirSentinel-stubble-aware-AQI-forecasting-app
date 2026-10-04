"""Create realistic-looking SYNTHETIC raw files so the whole app runs end to end.

These are not real measurements. Replace them with real data by running
`python -m ml.download_data` (see README), then rebuild and retrain.

Usage:  python -m ml.make_demo_data
"""
import json

import numpy as np
import pandas as pd

from .paths import RAW_AQI, RAW_AQI_HOUR, RAW_FIRES, RAW_WEATHER, DEMO_MARKER, CITY

START, END = "2015-01-01", "2020-07-01"
rng = np.random.default_rng(42)


def seasonal(doy, peak_doy, low, high):
    """Smooth yearly curve that reaches `high` on peak_doy and `low` half a year away."""
    return low + (high - low) * (0.5 + 0.5 * np.cos(2 * np.pi * (doy - peak_doy) / 365.25))


def main():
    days = pd.date_range(START, END, freq="D")
    n = len(days)
    doy = days.dayofyear.values

    # ---- weather (Delhi) ----
    tmax = seasonal(doy, 150, 19, 41) + rng.normal(0, 1.6, n)
    tmin = seasonal(doy, 180, 6, 29) + rng.normal(0, 1.4, n)
    monsoon = ((doy > 180) & (doy < 270)).astype(float)
    precip = np.where(rng.random(n) < 0.08 + 0.45 * monsoon, rng.gamma(1.6, 6 + 10 * monsoon), 0.0)
    wind_speed = np.clip(seasonal(doy, 150, 7, 17) + rng.normal(0, 3, n), 2, 35)
    winter = ((doy > 275) | (doy < 60)).astype(float)
    wind_dir = np.where(rng.random(n) < 0.35 + 0.45 * winter,
                        rng.normal(305, 20, n), rng.uniform(0, 360, n)) % 360
    weather = pd.DataFrame({
        "date": days.strftime("%Y-%m-%d"), "tmax": tmax.round(1), "tmin": tmin.round(1),
        "precip": precip.round(1), "wind_speed": wind_speed.round(1), "wind_dir": wind_dir.round(0),
    })
    weather.to_csv(RAW_WEATHER, index=False)

    # ---- fires (Punjab + Haryana) ----
    autumn = np.exp(-0.5 * ((doy - 308) / 9.0) ** 2)    # peaks early November
    spring = np.exp(-0.5 * ((doy - 125) / 12.0) ** 2)   # wheat residue, early May
    year_factor = days.year.map({2015: 1.0, 2016: 1.25, 2017: 1.05, 2018: 0.95, 2019: 1.15, 2020: 1.1}).values
    expected = year_factor * (900 * autumn + 180 * spring) + 3
    counts = rng.poisson(expected)

    centers = np.array([[30.25, 75.85], [30.15, 74.95], [30.75, 74.65], [30.35, 76.40],
                        [29.80, 76.40], [29.95, 75.55], [31.35, 75.30], [29.45, 75.95]])
    weights = np.array([0.22, 0.17, 0.14, 0.12, 0.10, 0.11, 0.08, 0.06])
    rows = []
    for d, c in zip(days, counts):
        if c == 0:
            continue
        idx = rng.choice(len(centers), size=c, p=weights)
        lat = centers[idx, 0] + rng.normal(0, 0.22, c)
        lon = centers[idx, 1] + rng.normal(0, 0.28, c)
        frp = np.round(rng.gamma(1.8, 6.0, c), 1)
        conf = rng.choice(["n", "h", "l"], size=c, p=[0.7, 0.2, 0.1])
        for i in range(c):
            rows.append((round(lat[i], 4), round(lon[i], 4), d.strftime("%Y-%m-%d"), frp[i], conf[i]))
    fires = pd.DataFrame(rows, columns=["latitude", "longitude", "acq_date", "frp", "confidence"])
    fires.to_csv(RAW_FIRES, index=False)

    # ---- air quality (Delhi) ----
    base = seasonal(doy, 15, 95, 300)
    fire_series = pd.Series(counts, index=days, dtype=float)
    fire_effect = 0.16 * fire_series.shift(1).fillna(0) + 0.10 * fire_series.shift(2).fillna(0)
    nw = np.cos(np.radians(wind_dir - 315))
    calm = np.clip((12 - wind_speed) / 10, 0, 1)
    cold = np.clip((12 - tmin) / 8, 0, 1)
    driver = base + fire_effect.values * (0.6 + 0.4 * nw) + 70 * calm + 55 * cold - 3.5 * precip
    aqi = np.zeros(n)
    noise = 0.0
    for i in range(n):
        noise = 0.55 * noise + rng.normal(0, 22)
        prev = aqi[i - 1] if i else driver[0]
        aqi[i] = 0.35 * prev + 0.65 * driver[i] + noise
    aqi = np.clip(aqi, 30, 495)
    pm25 = np.clip(aqi * rng.normal(0.58, 0.05, n), 10, None)
    pm10 = np.clip(aqi * rng.normal(0.95, 0.07, n), 20, None)
    aq = pd.DataFrame({
        "City": CITY, "Date": days.strftime("%Y-%m-%d"),
        "PM2.5": pm25.round(1), "PM10": pm10.round(1), "AQI": aqi.round(0),
    })
    missing = rng.random(n) < 0.02          # a few gaps, like real sensor data
    aq.loc[missing, ["PM2.5", "PM10", "AQI"]] = np.nan
    aq.to_csv(RAW_AQI, index=False)

    # ---- hourly pattern (only a profile is needed, so one sample year is enough) ----
    hours = pd.date_range("2019-01-01", "2019-12-31 23:00", freq="h")
    shape = 1 + 0.22 * np.cos(2 * np.pi * (hours.hour - 4) / 24) + 0.05 * np.cos(2 * np.pi * (hours.hour - 21) / 12)
    day_aqi = pd.Series(aqi, index=days).reindex(hours.normalize()).values
    hourly = pd.DataFrame({"City": CITY, "Datetime": hours.strftime("%Y-%m-%d %H:%M:%S"),
                           "AQI": np.round(day_aqi * shape * rng.normal(1, 0.04, len(hours)), 0)})
    hourly.to_csv(RAW_AQI_HOUR, index=False)

    DEMO_MARKER.write_text(json.dumps(["city_day.csv", "city_hour.csv", "fires.csv", "weather.csv"]))
    print(f"Synthetic demo data written to {RAW_AQI.parent}")
    print(f"  {n} days, {len(fires):,} fire points. Replace with real data before you present results.")


if __name__ == "__main__":
    main()
