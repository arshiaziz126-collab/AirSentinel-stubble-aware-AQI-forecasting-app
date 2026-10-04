"""Download REAL data into data/raw/.

    python -m ml.download_data weather            # Open-Meteo, no key needed
    python -m ml.download_data fires              # NASA FIRMS, needs FIRMS_MAP_KEY in .env
    python -m ml.download_data aqi                # Kaggle CPCB data, needs the kaggle CLI (or download by hand)
    python -m ml.download_data all

Dates default to 2015-01-01 .. 2020-07-01, the range the CPCB Kaggle data covers.
"""
import argparse
import io
import json
import os
import shutil
import subprocess
import time
import zipfile
from datetime import date, timedelta

import pandas as pd
import requests

from .paths import (RAW, RAW_AQI, RAW_AQI_HOUR, RAW_FIRES, RAW_WEATHER, DEMO_MARKER,
                    DELHI_LAT, DELHI_LON, FIRE_BBOX)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

START, END = "2015-01-01", "2020-07-01"


def _mark_real(filename: str):
    """Remove a file from the list of synthetic files once real data replaces it."""
    if not DEMO_MARKER.exists():
        return
    try:
        names = set(json.loads(DEMO_MARKER.read_text()))
    except (ValueError, TypeError):
        names = {"city_day.csv", "city_hour.csv", "fires.csv", "weather.csv"}
    names.discard(filename)
    if names:
        DEMO_MARKER.write_text(json.dumps(sorted(names)))
    else:
        DEMO_MARKER.unlink()


def weather(start=START, end=END):
    print(f"Downloading Delhi weather {start} .. {end} from Open-Meteo")
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": DELHI_LAT, "longitude": DELHI_LON, "start_date": start, "end_date": end,
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,"
                 "wind_speed_10m_max,wind_direction_10m_dominant",
        "timezone": "Asia/Kolkata",
    }
    r = requests.get(url, params=params, timeout=120)
    r.raise_for_status()
    d = r.json()["daily"]
    df = pd.DataFrame({
        "date": d["time"],
        "tmax": d["temperature_2m_max"], "tmin": d["temperature_2m_min"],
        "precip": d["precipitation_sum"], "wind_speed": d["wind_speed_10m_max"],
        "wind_dir": d["wind_direction_10m_dominant"],
    })
    df.to_csv(RAW_WEATHER, index=False)
    _mark_real("weather.csv")
    print(f"  saved {len(df)} days to {RAW_WEATHER}")


def fires(start=START, end=END, source="VIIRS_SNPP_SP", chunk_days=5):
    key = os.getenv("FIRMS_MAP_KEY", "").strip()
    if not key:
        raise SystemExit(
            "FIRMS_MAP_KEY is missing. Get a free key at "
            "https://firms.modaps.eosdis.nasa.gov/api/map_key/ and add it to backend/.env")
    w, s, e, n = FIRE_BBOX
    area = f"{w},{s},{e},{n}"
    d0 = date.fromisoformat(start)
    d1 = date.fromisoformat(end)
    parts = []
    print(f"Downloading {source} fire hotspots {start} .. {end} from NASA FIRMS (this takes a few minutes)")
    while d0 <= d1:
        days = min(chunk_days, (d1 - d0).days + 1)
        url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{source}/{area}/{days}/{d0.isoformat()}"
        for attempt in range(3):
            try:
                r = requests.get(url, timeout=120)
                r.raise_for_status()
                break
            except requests.RequestException as exc:
                if attempt == 2:
                    raise
                print(f"  retrying {d0} ({exc})")
                time.sleep(5)
        text = r.text.strip()
        if text and not text.lower().startswith("invalid"):
            chunk = pd.read_csv(io.StringIO(text))
            if len(chunk):
                parts.append(chunk[["latitude", "longitude", "acq_date", "frp", "confidence"]])
        print(f"  {d0} +{days}d: {0 if not parts else len(parts[-1])} points", end="\r")
        d0 += timedelta(days=days)
        time.sleep(0.4)
    df = pd.concat(parts, ignore_index=True) if parts else pd.DataFrame(
        columns=["latitude", "longitude", "acq_date", "frp", "confidence"])
    df.to_csv(RAW_FIRES, index=False)
    _mark_real("fires.csv")
    print(f"\n  saved {len(df):,} hotspots to {RAW_FIRES}")


def aqi():
    """Kaggle: 'Air Quality Data in India (2015 - 2020)' by Vopani (rohanrao/air-quality-data-in-india)."""
    if shutil.which("kaggle") is None:
        raise SystemExit(
            "The kaggle CLI is not installed. Either run `pip install kaggle` and set up your Kaggle API token,\n"
            "or download the dataset by hand from\n"
            "  https://www.kaggle.com/datasets/rohanrao/air-quality-data-in-india\n"
            f"and put city_day.csv (and optionally city_hour.csv) in {RAW}")
    zip_path = RAW / "air-quality-data-in-india.zip"
    subprocess.run(["kaggle", "datasets", "download", "-d", "rohanrao/air-quality-data-in-india",
                    "-p", str(RAW), "--force"], check=True)
    with zipfile.ZipFile(zip_path) as z:
        for name in ("city_day.csv", "city_hour.csv"):
            if name in z.namelist():
                z.extract(name, RAW)
                _mark_real(name)
    zip_path.unlink(missing_ok=True)
    print(f"  saved {RAW_AQI.name} and {RAW_AQI_HOUR.name}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("what", choices=["weather", "fires", "aqi", "all"])
    ap.add_argument("--start", default=START)
    ap.add_argument("--end", default=END)
    a = ap.parse_args()
    if a.what in ("weather", "all"):
        weather(a.start, a.end)
    if a.what in ("fires", "all"):
        fires(a.start, a.end)
    if a.what in ("aqi", "all"):
        aqi()
    print("Next: python -m ml.build_dataset  then  python -m ml.train")


if __name__ == "__main__":
    main()
