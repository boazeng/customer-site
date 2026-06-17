# ---- שלב 1: בניית ה-frontend (React/Vite) ----
FROM node:20-slim AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build          # פלט: /fe/dist

# ---- שלב 2: ה-backend (FastAPI) מגיש את ה-SPA הבנוי ----
FROM python:3.12-slim
WORKDIR /app

COPY backend/requirements.txt ./
# shared-auth מותקן מ-GitHub (ריפו ציבורי), tzdata לאזורי-זמן נכונים
RUN pip install --no-cache-dir -r requirements.txt \
    "git+https://github.com/boazeng/shared-auth.git" \
    tzdata

COPY backend/ ./backend/
COPY --from=frontend /fe/dist ./frontend/dist

ENV PYTHONUNBUFFERED=1 \
    CUSTOMER_SITE_DB_DIR=/app/database \
    FRONTEND_DIST=/app/frontend/dist

EXPOSE 8000
# --app-dir מוסיף את backend/ ל-sys.path כך ש-"app.main" נפתר
CMD ["uvicorn", "app.main:app", "--app-dir", "/app/backend", \
     "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
