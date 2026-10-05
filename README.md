# AirSentinel

**Stubble burning-aware AQI forecasting and health alerts for Delhi-NCR.**

Every autumn, farmers in Punjab and Haryana burn rice stubble, and the smoke drifts to Delhi. AirSentinel watches those fires from NASA satellite data, combines them with weather and past air quality, and forecasts Delhi's AQI up to three days ahead. It then explains *why* the air is bad (SHAP) and turns the forecast into simple health advice for children, older adults and people with breathing conditions.

| Layer | Tech |
|---|---|
| Machine learning | Python, pandas, LightGBM (one model per horizon), scikit-learn baselines, TreeSHAP |
| API | FastAPI, Uvicorn |
| Frontend | React 18, Vite, GSAP ScrollTrigger, Lenis smooth scroll |
| Data | CPCB air quality (Kaggle), NASA FIRMS fire hotspots, Open-Meteo weather |
| Deploy | One Docker container (API + site), ready for Render |

---

## Run it on Windows

You need **Python 3.11 or 3.12** (tick "Add python.exe to PATH" while installing) and **Node.js LTS**.

1. Double-click **`setup.bat`**. It creates a virtual environment, installs everything, creates demo data and trains the models.
2. Double-click **`run.bat`**. Two windows open (API and website) and the browser opens http://localhost:5173.
3. Double-click **`stop.bat`** when you're done.

API docs are at http://localhost:8000/docs.

> The first run uses **synthetic demo data** so the app works immediately. The site says so on the first screen. Use real data (below) before you present any results.

### Run it by hand (any OS)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m ml.make_demo_data        # skip once you have real data
python -m ml.build_dataset
python -m ml.train
uvicorn app.main:app --reload --port 8000

# in a second terminal
cd frontend
npm install
npm run dev                        # http://localhost:5173
```

---

## Use real data

All commands run inside `backend` with the virtual environment active.

1. **Weather** (no key needed):
   `python -m ml.download_data weather`
2. **Fires**: get a free MAP_KEY at https://firms.modaps.eosdis.nasa.gov/api/map_key/, put it in `backend/.env` as `FIRMS_MAP_KEY=...`, then run
   `python -m ml.download_data fires`
   This downloads VIIRS hotspots for Punjab and Haryana, 2015 to mid-2020, and takes a few minutes.
3. **Air quality**: download *Air Quality Data in India (2015 - 2020)* from
   https://www.kaggle.com/datasets/rohanrao/air-quality-data-in-india
   and copy `city_day.csv` and `city_hour.csv` into `backend/data/raw/`.
   (If you have the Kaggle CLI set up, `python -m ml.download_data aqi` does it for you.)
4. Rebuild and retrain:
   `python -m ml.build_dataset` then `python -m ml.train`

`build_dataset` prints `source: real` once none of the raw files are synthetic. The site's demo notice then disappears.

---

## Deploy

### Option A: one service on Render (simplest)

1. Run the steps above with real data so `backend/data/processed/` and `backend/artifacts/` contain your dataset and models. Commit them (they are small; raw data is ignored by git).
2. Push the project to GitHub.
3. On https://render.com choose **New > Blueprint**, pick the repo. `render.yaml` creates a Docker web service.
4. Open the URL Render gives you. The same server serves the site and `/api`.

The Dockerfile builds the React site, installs the API, and serves both. If no trained model is committed, it trains on demo data during the build so the app still starts.

### Option B: frontend and API separately

* API: deploy `backend` anywhere that runs Python with
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, and set `ALLOWED_ORIGINS` to your site's URL.
* Site: deploy `frontend` to Vercel or Netlify (build `npm run build`, output `dist`) and set
  `VITE_API_URL` to the API's URL.

---

## API

| Endpoint | What it returns |
|---|---|
| `GET /api/health` | Whether the model is loaded, the data source, the default date |
| `GET /api/dashboard?as_of=2019-11-02&profile=child` | Everything the site shows: today's AQI, 10-day history, 3-day forecast with a likely range, fire stats and map points, wind, SHAP drivers, hourly pattern, cleanest window, advice, model scores |
| `GET /api/advice?profile=elderly&as_of=2019-11-02` | Advice for one profile: `adult`, `child`, `elderly`, `sensitive` |

The app **replays a past day** (by default 2 November of the latest year in the data, the middle of stubble season) and compares the forecast with what actually happened. You can pick any day from the date box in the header.

---

## How the model works

* **Target:** Delhi's daily AQI 1, 2 and 3 days ahead, with one LightGBM model for each horizon.
* **Features:** AQI for the last 7 days and rolling means, PM2.5 and PM10, fire counts and fire radiative power over the last 1 to 7 days, wind speed and a "wind from the north-west" signal, temperature, rain, and the time of year.
* **Weather for the target day:** training uses the weather that actually happened as a stand-in for a weather forecast. A live version would call a forecast API (Open-Meteo has one) instead.
* **Evaluation:** a strict time split. Everything before 1 July 2019 trains the model; the rest, including the 2019 stubble season, is the test set. Models are compared with a naive baseline (tomorrow equals today) and ridge regression, using MAE and RMSE. The stubble-season error is reported separately.
* **Likely range:** the 10th to 90th percentile of test errors, added around each forecast.
* **Explanations:** LightGBM's built-in TreeSHAP values, grouped into plain factors (stubble fires, wind, temperature, rain, recent pollution, season).
* **Health advice:** rules based on CPCB's AQI health statements, adjusted per profile. The cleanest hours come from Delhi's usual hour-by-hour pattern for that month.

### Limitations

* The CPCB Kaggle data ends in mid-2020, so the app replays history rather than forecasting today. Making it live needs a real-time AQI source (for example data.gov.in) and the FIRMS near-real-time feed.
* Fire counts cover a fixed box around Punjab and Haryana, not exact state borders.
* Hourly advice uses a typical daily pattern, not an hourly forecast.
* AirSentinel gives general information, not medical advice.

---

## Project structure

```
AirSentinel/
├── backend/
│   ├── app/            FastAPI app: routes, forecasting service, AQI bands, advice rules
│   ├── ml/             data download, demo data, dataset builder, features, training
│   ├── data/raw/       raw downloads (not committed)
│   ├── data/processed/ clean daily dataset, map points, hourly pattern
│   └── artifacts/      trained models and metrics.json
├── frontend/
│   └── src/            React app: Hero, Journey (pinned horizontal scroll), Health, Model, Footer
├── Dockerfile          builds the site and serves it with the API
├── render.yaml         Render blueprint
├── setup.bat / run.bat / stop.bat
└── .env.example
```
