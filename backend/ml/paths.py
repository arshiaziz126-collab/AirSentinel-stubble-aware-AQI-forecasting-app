"""Shared paths and constants for the AirSentinel ML pipeline."""
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
RAW = BASE / "data" / "raw"
PROCESSED = BASE / "data" / "processed"
ARTIFACTS = BASE / "artifacts"
for _p in (RAW, PROCESSED, ARTIFACTS):
    _p.mkdir(parents=True, exist_ok=True)

CITY = "Delhi"
DELHI_LAT, DELHI_LON = 28.6139, 77.2090

# Punjab + Haryana bounding box: west, south, east, north
FIRE_BBOX = (73.8, 27.6, 77.6, 32.6)

# Raw inputs
RAW_AQI = RAW / "city_day.csv"          # Kaggle: Air Quality Data in India (2015-2020)
RAW_AQI_HOUR = RAW / "city_hour.csv"    # optional, same Kaggle dataset
RAW_FIRES = RAW / "fires.csv"           # NASA FIRMS hotspots (FIRMS csv format)
RAW_WEATHER = RAW / "weather.csv"       # Open-Meteo daily archive for Delhi
DEMO_MARKER = RAW / ".demo"             # present when raw files are synthetic

# Processed outputs
DATASET = PROCESSED / "dataset.csv"
HOTSPOTS = PROCESSED / "hotspots.csv"
HOURLY_PROFILE = PROCESSED / "hourly_profile.json"
META = PROCESSED / "meta.json"

# Model outputs
METRICS = ARTIFACTS / "metrics.json"
HORIZONS = (1, 2, 3)


def model_path(h: int) -> Path:
    return ARTIFACTS / f"lgbm_h{h}.txt"
