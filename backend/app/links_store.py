"""מאגר שיוך לקוחות — ממפה אימייל מחובר ללקוח ב-Priority.

email  → custname (לחשבוניות) + accname (לכרטסת) + display_name (תצוגה).
DB נפרד מטבלת המשתמשים של shared-auth, אך באותה תיקיית database.
"""
import sqlite3
from pathlib import Path


def _norm(email: str) -> str:
    return (email or "").strip().lower()


class LinksStore:
    def __init__(self, db_path) -> None:
        self.db_path = str(db_path)
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init(self) -> None:
        with self._conn() as c:
            c.execute("""
                CREATE TABLE IF NOT EXISTS customer_links (
                    email        TEXT PRIMARY KEY,
                    custname     TEXT NOT NULL,
                    accname      TEXT NOT NULL DEFAULT '',
                    display_name TEXT NOT NULL DEFAULT '',
                    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

    def get_by_email(self, email: str) -> dict | None:
        with self._conn() as c:
            row = c.execute("SELECT * FROM customer_links WHERE email = ?",
                            (_norm(email),)).fetchone()
        return dict(row) if row else None

    def list_all(self) -> list[dict]:
        with self._conn() as c:
            rows = c.execute(
                "SELECT * FROM customer_links ORDER BY display_name, custname").fetchall()
        return [dict(r) for r in rows]

    def upsert(self, email: str, custname: str, accname: str = "",
               display_name: str = "") -> None:
        with self._conn() as c:
            c.execute("""
                INSERT INTO customer_links (email, custname, accname, display_name)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                    custname = excluded.custname,
                    accname = excluded.accname,
                    display_name = excluded.display_name
            """, (_norm(email), custname.strip(), accname.strip(), display_name.strip()))

    def delete(self, email: str) -> None:
        with self._conn() as c:
            c.execute("DELETE FROM customer_links WHERE email = ?", (_norm(email),))
