"""אפליקציית FastAPI — אתר הלקוחות (חשבוניות + כרטסת).

מפעיל את shared-auth (כניסת Google + תפקידים), לקוח Priority, מאגר שיוכים,
ומגיש את ה-SPA הבנוי (frontend/dist) ב-production.
"""
import logging
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse, JSONResponse

from shared_auth import install_auth, current_user, require_role

from .settings import Settings
from .priority_client import PriorityClient
from .routes import build_router
from .dev_login import install_dev_login

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("customer-site")

settings = Settings.load()
app = FastAPI(title="אתר לקוחות", docs_url=None, redoc_url=None)

# אימות והרשאות (DB נפרד לאתר זה — לא משתף את רשימת המשתמשים עם אפליקציות אחרות)
auth = install_auth(
    app,
    db_path=settings.db_dir / "auth.db",
    redirect_uri=settings.redirect_uri,
    initial_users=[
        {"email": "boazen@gmail.com", "role": "admin", "name": "Boaz"},
        {"email": "yael.israel303@gmail.com", "role": "admin", "name": "Yael"},
    ],
    public_prefixes=("/dev-login", "/healthz"),
)

# CORS — נחוץ רק בפיתוח כשהפרונט רץ במקור נפרד (Vite). נוסף אחרי האימות כדי שיעטוף אותו.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.dev_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

priority = PriorityClient(settings.priority_base_url, settings.priority_user,
                          settings.priority_password, cache_ttl=settings.priority_cache_ttl)

app.include_router(build_router(priority, current_user, require_role,
                                mobile_url=settings.mobile_public_url))

# כניסה לבדיקות (פיתוח בלבד) — חייב להגיע אחרי האימות ולפני ה-catch-all של ה-SPA
if settings.dev_login_enabled:
    install_dev_login(app, auth["sessions"], auth["db"], auth["config"])
    log.warning("DEV_LOGIN פעיל — /dev-login פתוח. לכבות בפרודקשן (DEV_LOGIN_ENABLED=false).")


@app.get("/healthz", include_in_schema=False)
async def healthz():
    return {"ok": True, "priority_env": settings.priority_env}


# ---------------- הגשת ה-SPA הבנוי ----------------
# שני "פרצופים" לאותו backend, נבחר ע"י APP_MODE:
#   ברירת מחדל  → מגיש את אתר הדסקטופ (frontend/dist) בשורש.
#   APP_MODE=mobile → מגיש את אפליקציית המובייל (mobile/dist) בשורש (לתת-דומיין m).
# שני המצבים חולקים את אותם /api ו-/auth.
_mobile_dist = Path(os.getenv(
    "MOBILE_DIST", str(Path(__file__).resolve().parents[2] / "mobile" / "dist")))
_is_mobile = settings.app_mode == "mobile"
_dist = _mobile_dist if _is_mobile else settings.frontend_dist
log.info("מצב הגשה: %s (%s)", "mobile" if _is_mobile else "desktop", _dist)

if (_dist / "assets").exists():
    app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")


@app.get("/{full_path:path}", include_in_schema=False)
async def spa(full_path: str, request: Request):
    """כל נתיב שאינו API/אימות — מחזיר את ה-SPA (ניתוב בצד-לקוח)."""
    # קבצים סטטיים שיושבים בשורש ה-dist (favicon.svg, manifest, sw, icon...) —
    # מגישים את הקובץ האמיתי, אחרת ה-catch-all היה מחזיר index.html והדפדפן לא היה
    # מקבל את הלוגו/מניפסט. שמירה מפני path traversal: הקובץ חייב להיות בתוך _dist.
    if full_path:
        candidate = (_dist / full_path).resolve()
        if candidate.is_file() and _dist.resolve() in candidate.parents:
            return FileResponse(candidate)
    index = _dist / "index.html"
    if index.exists():
        return FileResponse(index)
    return JSONResponse(
        {"detail": "ה-frontend עדיין לא נבנה. הריצו 'npm run build', "
                   "או השתמשו בשרת הפיתוח של Vite."},
        status_code=200,
    )
