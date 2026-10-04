# One container: builds the React site, then serves it and the API from FastAPI.
FROM node:20-slim AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
# Uses your committed model if present, otherwise trains on demo data so the app still starts
RUN test -f artifacts/lgbm_h1.txt || (python -m ml.make_demo_data && python -m ml.build_dataset && python -m ml.train)
COPY --from=web /web/dist ./static
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
