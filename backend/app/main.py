"""AirSentinel API.

Run locally:  uvicorn app.main:app --reload --port 8000
Docs:         http://localhost:8000/docs
"""
import os
from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from .advice import PROFILES
from .service import NotReady, Service

app = FastAPI(title="AirSentinel API", version="1.0.0",
              description="Stubble burning-aware AQI forecasts and health alerts for Delhi-NCR.")

origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET"], allow_headers=["*"])

_service: Service | None = None
_error: str | None = None


def service() -> Service:
    global _service, _error
    if _service is None:
        try:
            _service = Service()
            _error = None
        except NotReady as exc:
            _error = str(exc)
            raise HTTPException(status_code=503, detail=_error)
    return _service


def _parse(as_of: str | None) -> date | None:
    if not as_of:
        env = os.getenv("AS_OF", "").strip()
        return date.fromisoformat(env) if env else None
    try:
        return date.fromisoformat(as_of)
    except ValueError:
        raise HTTPException(status_code=422, detail="Use the date format YYYY-MM-DD, for example 2019-11-02.")


@app.get("/api/health")
def health():
    try:
        s = service()
        return {"status": "ok", "data_source": s.meta.get("source"), "default_date": str(s.default_as_of())}
    except HTTPException as exc:
        return {"status": "not_ready", "detail": exc.detail}


@app.get("/api/dashboard")
def dashboard(as_of: str | None = Query(None, description="Replay date, YYYY-MM-DD"),
              profile: str = Query("child", description=f"One of: {', '.join(PROFILES)}")):
    s = service()
    try:
        return s.dashboard(_parse(as_of), profile)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@app.get("/api/advice")
def advice(profile: str = Query("child", description=f"One of: {', '.join(PROFILES)}"),
           as_of: str | None = Query(None, description="Replay date, YYYY-MM-DD")):
    s = service()
    try:
        return s.advice(profile, _parse(as_of))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# Serve the built React app from the same server when it's present (single-service deploys)
STATIC_DIR = Path(os.getenv("STATIC_DIR", Path(__file__).resolve().parents[1] / "static"))
if STATIC_DIR.is_dir() and (STATIC_DIR / "index.html").exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="web")
