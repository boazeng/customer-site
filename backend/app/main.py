"""אפליקציית FastAPI — אתר הלקוחות (חשבוניות + כרטסת).

מפעיל את shared-auth (כניסת Google + תפקידים), לקוח Priority, מאגר שיוכים,
ומגיש את ה-SPA הבנוי (frontend/dist) ב-production.
"""
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse, JSONResponse

from shared_auth import install_auth, current_user, require_role

from .settings import Settings
from .priority_client import PriorityClient
from .links_store import LinksStore
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
    public_prefixes=("/dev-login",),
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
links = LinksStore(settings.db_dir / "links.db")

app.include_router(build_router(priority, links, current_user, require_role))

# כניסה לבדיקות (פיתוח בלבד) — חייב להגיע אחרי יצירת links/auth ולפני ה-catch-all של ה-SPA
if settings.dev_login_enabled:
    install_dev_login(app, auth["sessions"], auth["db"], auth["config"], links)
    log.warning("DEV_LOGIN פעיל — /dev-login פתוח. לכבות בפרודקשן (DEV_LOGIN_ENABLED=false).")


@app.get("/healthz", include_in_schema=False)
async def healthz():
    return {"ok": True, "priority_env": settings.priority_env}


# ---------------- הגשת ה-SPA הבנוי ----------------
_dist = settings.frontend_dist
if (_dist / "assets").exists():
    app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")


@app.get("/{full_path:path}", include_in_schema=False)
async def spa(full_path: str, request: Request):
    """כל נתיב שאינו API/אימות — מחזיר את ה-SPA (ניתוב בצד-לקוח)."""
    index = _dist / "index.html"
    if index.exists():
        return FileResponse(index)
    return JSONResponse(
        {"detail": "ה-frontend עדיין לא נבנה. הריצו 'npm run build' בתיקיית frontend, "
                   "או השתמשו בשרת הפיתוח של Vite."},
        status_code=200,
    )
