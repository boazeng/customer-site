# ---- שלב 1: בניית ה-frontend (React/Vite) ----
FROM node:20-slim AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build          # פלט: /fe/dist

# ---- שלב 1ב: בניית אפליקציית המובייל (PWA, base=/m/) ----
FROM node:20-slim AS mobile
WORKDIR /m
COPY mobile/package.json mobile/package-lock.json ./
RUN npm ci
COPY mobile/ ./
RUN npm run build          # פלט: /m/dist

# ---- שלב 2: ה-backend (FastAPI) מגיש את ה-SPA הבנוי ----
FROM python:3.12-slim
WORKDIR /app

COPY backend/requirements.txt ./
# git נדרש כדי להתקין את shared-auth מ-GitHub; מתקינים, משתמשים, ומסירים (אימג' רזה)
RUN apt-get update && apt-get install -y --no-install-recommends git \
 && pip install --no-cache-dir -r requirements.txt \
        "git+https://github.com/boazeng/shared-auth.git" \
        tzdata \
 && apt-get purge -y git && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

COPY backend/ ./backend/
COPY --from=frontend /fe/dist ./frontend/dist
COPY --from=mobile /m/dist ./mobile/dist

ENV PYTHONUNBUFFERED=1 \
    CUSTOMER_SITE_DB_DIR=/app/database \
    FRONTEND_DIST=/app/frontend/dist \
    MOBILE_DIST=/app/mobile/dist

EXPOSE 8000
# --app-dir מוסיף את backend/ ל-sys.path כך ש-"app.main" נפתר
CMD ["uvicorn", "app.main:app", "--app-dir", "/app/backend", \
     "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
