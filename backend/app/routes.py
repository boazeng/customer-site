"""נתיבי ה-API של אתר הלקוחות.

הרשאות:
  - לקוח (role=user/approver): רואה רק את הלקוח שלו, שמזוהה מ-Priority לפי המייל
    שאיתו נכנס (שדה EMAIL בכרטיס הלקוח). אין מאגר שיוכים — Priority הוא מקור האמת.
  - מנהל (role=admin): בוחר כל לקוח (custname ב-query) דרך מסך "בחירת לקוח".
"""
from fastapi import APIRouter, Request, Depends, HTTPException, Query
from fastapi.responses import Response

from .priority_client import PriorityClient, PriorityError


def build_router(priority: PriorityClient, current_user, require_role,
                 mobile_url: str = "") -> APIRouter:
    router = APIRouter(prefix="/api")
    admin_only = Depends(require_role("admin"))

    def _customer_for(email: str) -> dict | None:
        """זיהוי לקוח רגיל מ-Priority לפי המייל. רק התאמה יחידה נחשבת."""
        matches = priority.find_customers_by_email(email or "")
        return matches[0] if len(matches) == 1 else None

    def _resolve(request: Request, custname: str | None):
        """מחזיר (custname, display, is_admin) בהתאם להרשאה.

        מנהל — הלקוח מגיע ב-query. לקוח רגיל — מזוהה מ-Priority לפי המייל.
        """
        user = current_user(request)
        if not user:
            raise HTTPException(401, "לא מחובר")
        if user.get("role") == "admin":
            return custname, (custname or ""), True
        c = _customer_for(user.get("email"))
        if not c:
            raise HTTPException(403, "לא זוהה לקוח")
        return c["custname"], (c["name"] or c["custname"]), False

    def _wrap(fn):
        try:
            return fn()
        except PriorityError as exc:
            raise HTTPException(exc.status, exc.message) from exc

    # ---------------- זהות והקשר ----------------
    # def (לא async) — זיהוי הלקוח פונה ל-Priority (קריאה חוסמת) ולכן רץ ב-threadpool.
    @router.get("/me")
    def me(request: Request):
        user = current_user(request) or {}
        is_admin = user.get("role") == "admin"
        c = None if is_admin else _customer_for(user.get("email", ""))
        return {
            "email": user.get("email"),
            "name": user.get("name"),
            "role": user.get("role"),
            "is_admin": is_admin,
            "linked": is_admin or bool(c),
            "customer": None if (is_admin or not c) else {
                "custname": c["custname"],
                "display_name": c["name"] or c["custname"],
            },
            "mobile_url": mobile_url,   # כתובת אפליקציית המובייל (להפניית לקוח ממסך צר)
        }

    # ---------------- חשבוניות ----------------
    # הערה: ה-endpoints שפונים ל-Priority מוגדרים כ-def (לא async) כדי ש-Starlette
    # יריץ אותם ב-threadpool — קריאת httpx הסינכרונית לא תחסום את לולאת האירועים.
    @router.get("/invoices")
    def invoices(request: Request, custname: str | None = Query(None)):
        cust, display, _is_admin = _resolve(request, custname)
        if not cust:
            raise HTTPException(400, "לא נבחר לקוח")
        rows = _wrap(lambda: priority.get_invoices(cust))
        return {"custname": cust, "display_name": display, "invoices": rows,
                "count": len(rows), "total": round(sum(r["total"] for r in rows), 2)}

    @router.get("/invoice-pdf")
    def invoice_pdf(request: Request, ivnum: str = Query(...),
                    source: str | None = Query(None), custname: str | None = Query(None)):
        cust, _display, _is_admin = _resolve(request, custname)
        if not cust:
            raise HTTPException(400, "לא נבחר לקוח")
        pdf, fname = _wrap(lambda: priority.get_invoice_pdf(cust, ivnum, source))
        return Response(content=pdf, media_type="application/pdf",
                        headers={"Content-Disposition": f'inline; filename="{fname}"'})

    # ---------------- כרטסת ----------------
    @router.get("/ledger")
    def ledger(request: Request, custname: str | None = Query(None)):
        cust, display, _is_admin = _resolve(request, custname)
        if not cust:
            raise HTTPException(400, "לא נבחר לקוח")
        data = _wrap(lambda: priority.get_customer_ledger(cust))
        data["display_name"] = display
        return data

    # ---------------- ניהול (admin) ----------------
    @router.get("/admin/priority/customers", dependencies=[admin_only])
    def priority_customers():
        return {"customers": _wrap(lambda: priority.search_customers())}

    @router.get("/admin/priority/customer-lookup", dependencies=[admin_only])
    def priority_customer_lookup(
        email: str | None = Query(None, description="מייל הלקוח לאיתור"),
        custname: str | None = Query(None, description="מספר לקוח לאיתור"),
    ):
        """איתור לקוח ב-Priority לפי מייל או לפי מספר לקוח.

        מחזיר status: none / one / many, יחד עם רשימת הלקוחות שנמצאו.
        """
        email = (email or "").strip()
        custname = (custname or "").strip()
        if not email and not custname:
            raise HTTPException(400, "יש להזין מייל או מספר לקוח")

        if custname:
            try:
                matches = [_wrap(lambda: priority.get_customer(custname))]
            except HTTPException as exc:
                if exc.status_code == 404:
                    matches = []
                else:
                    raise
        else:
            matches = _wrap(lambda: priority.find_customers_by_email(email))

        status = "none" if not matches else ("one" if len(matches) == 1 else "many")
        return {"query": {"email": email, "custname": custname},
                "status": status, "count": len(matches), "customers": matches}

    @router.get("/admin/priority/accounts", dependencies=[admin_only])
    def priority_accounts():
        return {"accounts": _wrap(lambda: priority.search_accounts())}

    @router.get("/admin/priority/ping", dependencies=[admin_only])
    def priority_ping():
        return _wrap(lambda: priority.ping())

    return router
