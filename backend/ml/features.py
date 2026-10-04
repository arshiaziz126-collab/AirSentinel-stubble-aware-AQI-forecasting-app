"""Feature engineering shared by training and the API, so both always agree."""
import numpy as np
import pandas as pd

# Columns the daily dataset must contain
BASE_COLUMNS = ["aqi", "pm25", "pm10", "fire_count", "frp_sum",
                "tmax", "tmin", "precip", "wind_speed", "wind_dir"]

FEATURES = (
    [f"aqi_lag{l}" for l in range(7)]
    + ["aqi_roll3", "aqi_roll7", "pm25_lag0", "pm10_lag0"]
    + [f"fire_lag{l}" for l in range(4)]
    + ["fire_3d", "fire_7d", "frp_3d"]
    + ["wind_speed_0", "wind_nw_0", "tmin_0", "tmax_0", "precip_0"]
    + ["wind_speed_h", "wind_nw_h", "tmin_h", "tmax_h", "precip_h"]
    + ["doy_sin_h", "doy_cos_h"]
)

# Groups used to explain a forecast in plain language
GROUPS = {
    "Stubble fires": ("fire_", "frp_"),
    "Wind": ("wind_",),
    "Temperature": ("tmin", "tmax"),
    "Rain": ("precip",),
    "Recent pollution": ("aqi_", "pm25", "pm10"),
    "Season": ("doy_",),
}


def group_of(feature: str) -> str:
    for name, prefixes in GROUPS.items():
        if feature.startswith(prefixes):
            return name
    return "Other"


def _nw(direction: pd.Series) -> pd.Series:
    """1.0 when the wind blows from the north-west (315 degrees), -1.0 from the south-east."""
    return np.cos(np.radians(direction - 315.0))


def make_xy(df: pd.DataFrame, h: int):
    """Build features known on day t, weather for target day t+h, and target AQI at t+h.

    df must be indexed by consecutive dates and contain BASE_COLUMNS.
    Weather on day t+h stands in for a weather forecast: actual weather is used
    when training and replaying history; a live version would call a forecast API.
    """
    X = pd.DataFrame(index=df.index)
    for l in range(7):
        X[f"aqi_lag{l}"] = df["aqi"].shift(l)
    X["aqi_roll3"] = df["aqi"].rolling(3).mean()
    X["aqi_roll7"] = df["aqi"].rolling(7).mean()
    X["pm25_lag0"] = df["pm25"]
    X["pm10_lag0"] = df["pm10"]
    for l in range(4):
        X[f"fire_lag{l}"] = df["fire_count"].shift(l)
    X["fire_3d"] = df["fire_count"].rolling(3).sum()
    X["fire_7d"] = df["fire_count"].rolling(7).sum()
    X["frp_3d"] = df["frp_sum"].rolling(3).sum()
    X["wind_speed_0"] = df["wind_speed"]
    X["wind_nw_0"] = _nw(df["wind_dir"])
    X["tmin_0"] = df["tmin"]
    X["tmax_0"] = df["tmax"]
    X["precip_0"] = df["precip"]
    X["wind_speed_h"] = df["wind_speed"].shift(-h)
    X["wind_nw_h"] = _nw(df["wind_dir"].shift(-h))
    X["tmin_h"] = df["tmin"].shift(-h)
    X["tmax_h"] = df["tmax"].shift(-h)
    X["precip_h"] = df["precip"].shift(-h)
    target_day = pd.Series(df.index + pd.Timedelta(days=h), index=df.index)
    doy = target_day.dt.dayofyear
    X["doy_sin_h"] = np.sin(2 * np.pi * doy / 365.25)
    X["doy_cos_h"] = np.cos(2 * np.pi * doy / 365.25)
    y = df["aqi"].shift(-h)
    return X[FEATURES], y
