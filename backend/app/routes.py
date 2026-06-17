"""נתיבי ה-API של אתר הלקוחות.

הרשאות:
  - לקוח (role=user/approver): רואה רק את הלקוח המשויך לאימייל שלו.
  - מנהל (role=admin): יכול לבחור כל לקוח (custname/accname ב-query) ולנהל שיוכים.
"""
from fastapi import APIRouter, Request, Depends, HTTPException, Query

from .priority_client import PriorityClient, PriorityError
from .links_store import LinksStore


def build_router(priority: PriorityClient, links: LinksStore,
                 current_user, require_role) -> APIRouter:
    router = APIRouter(prefix="/api")
    admin_only = Depends(require_role("admin"))

    def _resolve(request: Request, custname: str | None, accname: str | None):
        """מחזיר (custname, accname, display, is_admin) בהתאם להרשאה."""
        user = current_user(request)
        if not user:
            raise HTTPException(401, "לא מחובר")
        is_admin = user.get("role") == "admin"
        if is_admin:
            link = None
            if custname and not accname:
                # אם יש שיוך תואם — נשלים ממנו את שם-החשבון
                for l in links.list_all():
                    if l["custname"] == custname:
                        link = l
                        break
            return (custname, accname or (link["accname"] if link else ""),
                    (link["display_name"] if link else custname) or custname, True)
        link = links.get_by_email(user["email"])
        if not link:
            raise HTTPException(403, "אין-שיוך")
        return (link["custname"], link["accname"],
                link["display_name"] or link["custname"], False)

    def _wrap(fn):
        try:
            return fn()
        except PriorityError as exc:
            raise HTTPException(exc.status, exc.message) from exc

    # ---------------- זהות והקשר ----------------
    @router.get("/me")
    async def me(request: Request):
        user = current_user(request) or {}
        is_admin = user.get("role") == "admin"
        link = None if is_admin else links.get_by_email(user.get("email", ""))
        return {
            "email": user.get("email"),
            "name": user.get("name"),
            "role": user.get("role"),
            "is_admin": is_admin,
            "linked": bool(link) or is_admin,
            "customer": None if is_admin else {
                "custname": link["custname"], "accname": link["accname"],
                "display_name": link["display_name"] or link["custname"],
            } if link else None,
        }

    # ---------------- חשבוניות ----------------
    @router.get("/invoices")
    async def invoices(request: Request, custname: str | None = Query(None)):
        cust, _acc, display, _is_admin = _resolve(request, custname, None)
        if not cust:
            raise HTTPException(400, "לא נבחר לקוח")
        rows = _wrap(lambda: priority.get_invoices(cust))
        return {"custname": cust, "display_name": display, "invoices": rows,
                "count": len(rows), "total": round(sum(r["total"] for r in rows), 2)}

    # ---------------- כרטסת ----------------
    @router.get("/ledger")
    async def ledger(request: Request, custname: str | None = Query(None),
                     accname: str | None = Query(None)):
        cust, acc, display, _is_admin = _resolve(request, custname, accname)
        if not acc:
            raise HTTPException(409, "לא-הוגדר-חשבון")
        data = _wrap(lambda: priority.get_ledger(acc))
        data["display_name"] = display
        data["custname"] = cust
        return data

    # ---------------- ניהול (admin) ----------------
    @router.get("/admin/links", dependencies=[admin_only])
    async def list_links():
        return {"links": links.list_all()}

    @router.post("/admin/links", dependencies=[admin_only])
    async def save_link(body: dict):
        email = (body.get("email") or "").strip()
        custname = (body.get("custname") or "").strip()
        if not email or "@" not in email:
            raise HTTPException(400, "אימייל לא תקין")
        if not custname:
            raise HTTPException(400, "חובה לבחור לקוח (custname)")
        links.upsert(email, custname, body.get("accname", ""),
                     body.get("display_name", ""))
        return {"ok": True}

    @router.post("/admin/links/delete", dependencies=[admin_only])
    async def delete_link(body: dict):
        links.delete((body.get("email") or "").strip())
        return {"ok": True}

    @router.get("/admin/priority/customers", dependencies=[admin_only])
    async def priority_customers():
        return {"customers": _wrap(lambda: priority.search_customers())}

    @router.get("/admin/priority/accounts", dependencies=[admin_only])
    async def priority_accounts():
        return {"accounts": _wrap(lambda: priority.search_accounts())}

    @router.get("/admin/priority/ping", dependencies=[admin_only])
    async def priority_ping():
        return _wrap(lambda: priority.ping())

    return router
