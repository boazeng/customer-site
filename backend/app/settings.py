"""טעינת הגדרות — קודם ה-.env המשותף, ואז .env מקומי של ה-backend (דורס).

הקובץ המשותף (C:\\Users\\User\\Aiprojects\\env\\.env) מחזיק את פרטי Priority
ואת מפתחות ה-OAuth של shared-auth. ה-.env המקומי מחזיק הגדרות ספציפיות לאתר.
חשוב: טוענים ל-os.environ כי shared-auth קורא משם ישירות.
"""
import os
from pathlib import Path
from dataclasses import dataclass

from dotenv import load_dotenv

# שורש ה-backend: .../customer-site/backend
BACKEND_DIR = Path(__file__).resolve().parent.parent
# מיקום ברירת-מחדל של ה-.env המשותף (ניתן לעקיפה ב-SHARED_ENV_PATH)
DEFAULT_SHARED_ENV = Path(r"C:\Users\User\Aiprojects\env\.env")


def load_environment() -> None:
    """טוען את שני קבצי ה-env לתוך os.environ (משותף, ואז מקומי שדורס)."""
    shared = Path(os.getenv("SHARED_ENV_PATH", str(DEFAULT_SHARED_ENV)))
    if shared.exists():
        load_dotenv(shared, override=False)
    local = BACKEND_DIR / ".env"
    if local.exists():
        load_dotenv(local, override=True)


@dataclass
class Settings:
    priority_env: str            # "real" | "demo"
    priority_base_url: str
    priority_user: str
    priority_password: str
    redirect_uri: str
    db_dir: Path
    frontend_dist: Path
    dev_origins: list[str]
    priority_cache_ttl: int      # שניות מטמון לתשובות Priority
    dev_login_enabled: bool      # מסך "כניסה לבדיקות" (פיתוח בלבד!)

    @classmethod
    def load(cls) -> "Settings":
        load_environment()
        env = os.getenv("PRIORITY_ENV", "real").strip().lower()
        base = os.getenv(
            "PRIORITY_URL_REAL" if env != "demo" else "PRIORITY_URL_DEMO", ""
        ).strip().rstrip("/")
        db_dir = Path(os.getenv("CUSTOMER_SITE_DB_DIR", str(BACKEND_DIR / "database")))
        dist = Path(os.getenv("FRONTEND_DIST", str(BACKEND_DIR.parent / "frontend" / "dist")))
        origins = [o.strip() for o in os.getenv(
            "DEV_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",") if o.strip()]
        return cls(
            priority_env=env,
            priority_base_url=base,
            priority_user=os.getenv("PRIORITY_USERNAME", "").strip(),
            priority_password=os.getenv("PRIORITY_PASSWORD", "").strip(),
            redirect_uri=os.getenv(
                "CUSTOMER_SITE_REDIRECT_URI", "http://localhost:8000/auth/callback"
            ).strip(),
            db_dir=db_dir,
            frontend_dist=dist,
            dev_origins=origins,
            priority_cache_ttl=int(os.getenv("PRIORITY_CACHE_TTL", "120")),
            dev_login_enabled=os.getenv("DEV_LOGIN_ENABLED", "true").strip().lower()
            in ("1", "true", "yes"),
        )
