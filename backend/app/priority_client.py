"""לקוח OData ל-Priority — קריאה בלבד.

מה שעובד בסביבה (ebyael), כפי שאומת:
  - AINVOICES?$filter=CUSTNAME eq '<num>'                → חשבוניות הלקוח
  - CUSTOMERS('<num>')                                   → פרטי לקוח
  - ACCOUNTS('<accname>')?$expand=ACCFNCITEMS2_SUBFORM   → כרטסת (חובה/זכות/יתרה)
חסום ל-API בצד Priority: FNCCUST, ACCRECON (כרטסת לקוח ישירה).
מגבלות: רק eq בסינון; הקריאה הראשונה איטית (~30ש'), לכן יש מטמון קצר.
"""
import time
import threading
import httpx

# שגיאת Priority כשמסך אינו פתוח ל-API
SCREEN_BLOCKED_MSG = "לא ניתן להפעיל API למסך זה"


class PriorityError(Exception):
    def __init__(self, message: str, status: int = 502, blocked: bool = False):
        super().__init__(message)
        self.message = message
        self.status = status
        self.blocked = blocked


def _num(v):
    try:
        return round(float(v), 2) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


class PriorityClient:
    def __init__(self, base_url: str, user: str, password: str,
                 cache_ttl: int = 120, timeout: float = 90.0):
        if not base_url:
            raise RuntimeError("PRIORITY base URL חסר — בדוק את ה-.env")
        self.base_url = base_url.rstrip("/")
        self._auth = (user, password)
        self._ttl = cache_ttl
        self._timeout = timeout
        self._cache: dict[str, tuple[float, object]] = {}
        self._lock = threading.Lock()

    # ---------- תשתית ----------
    def _get(self, path: str, params: dict | None = None) -> dict:
        url = f"{self.base_url}/{path.lstrip('/')}"
        try:
            r = httpx.get(url, params=params or {}, auth=self._auth,
                          headers={"Accept": "application/json"}, timeout=self._timeout)
        except httpx.HTTPError as exc:
            raise PriorityError(f"שגיאת רשת מול Priority: {exc}", 504) from exc
        if r.status_code == 404:
            raise PriorityError("הרשומה לא נמצאה ב-Priority", 404)
        if r.status_code >= 400:
            msg = r.text[:300]
            if SCREEN_BLOCKED_MSG in msg:
                raise PriorityError(
                    "מסך זה אינו פתוח ל-API ב-Priority. יש להפעיל הרשאת API למסך.",
                    503, blocked=True)
            raise PriorityError(f"Priority החזיר שגיאה ({r.status_code})", 502)
        try:
            return r.json()
        except ValueError as exc:
            raise PriorityError("תשובת Priority אינה JSON תקין", 502) from exc

    def _cached(self, key: str, fn):
        now = time.time()
        with self._lock:
            hit = self._cache.get(key)
            if hit and now - hit[0] < self._ttl:
                return hit[1]
        value = fn()
        with self._lock:
            self._cache[key] = (now, value)
        return value

    @staticmethod
    def _q(value: str) -> str:
        """ערך מחרוזת ל-OData (eq) — בריחה של גרש בודד."""
        return value.replace("'", "''")

    # ---------- חשבוניות ----------
    def get_invoices(self, custname: str) -> list[dict]:
        def run():
            data = self._get("AINVOICES", {
                "$filter": f"CUSTNAME eq '{self._q(custname)}'",
                "$select": "IVNUM,IVDATE,IVTYPE,STATDES,QPRICE,VAT,TOTPRICE,DETAILS,CDES,FNCNUM",
                "$orderby": "IVDATE desc",
            })
            rows = data.get("value", [])
            return [{
                "ivnum": r.get("IVNUM"),
                "date": (r.get("IVDATE") or "")[:10],
                "type": r.get("IVTYPE"),
                "status": r.get("STATDES"),
                "before_vat": _num(r.get("QPRICE")),
                "vat": _num(r.get("VAT")),
                "total": _num(r.get("TOTPRICE")),
                "details": r.get("DETAILS") or "",
                "fncnum": r.get("FNCNUM"),
            } for r in rows]
        return self._cached(f"inv:{custname}", run)

    # ---------- פרטי לקוח ----------
    def get_customer(self, custname: str) -> dict:
        def run():
            d = self._get(f"CUSTOMERS('{self._q(custname)}')",
                          {"$select": "CUSTNAME,CUSTDES,EMAIL,PHONE"})
            return {"custname": d.get("CUSTNAME"), "name": d.get("CUSTDES"),
                    "email": d.get("EMAIL"), "phone": d.get("PHONE")}
        return self._cached(f"cust:{custname}", run)

    def find_customers_by_email(self, email: str) -> list[dict]:
        """איתור לקוח/ות לפי שדה EMAIL בכרטיס הלקוח (סינון eq בצד Priority).

        מחזיר רשימה: ריק = לא נמצא; אורך 1 = זיהוי חד-משמעי;
        יותר מ-1 = אותו מייל מופיע בכמה לקוחות (צריך הכרעה בהמשך).
        """
        email = (email or "").strip()

        def run():
            if not email:
                return []
            d = self._get("CUSTOMERS", {
                "$filter": f"EMAIL eq '{self._q(email)}'",
                "$select": "CUSTNAME,CUSTDES,EMAIL,PHONE",
            })
            return [{"custname": r.get("CUSTNAME"), "name": r.get("CUSTDES"),
                     "email": r.get("EMAIL"), "phone": r.get("PHONE")}
                    for r in d.get("value", [])]
        return self._cached(f"custbyemail:{email.lower()}", run)

    def search_customers(self, top: int = 300) -> list[dict]:
        """רשימת לקוחות לבחירה במסך הניהול (סינון בצד הלקוח)."""
        def run():
            d = self._get("CUSTOMERS", {
                "$select": "CUSTNAME,CUSTDES", "$top": str(top), "$orderby": "CUSTNAME"})
            return [{"custname": r.get("CUSTNAME"), "name": r.get("CUSTDES")}
                    for r in d.get("value", [])]
        return self._cached(f"custlist:{top}", run)

    # ---------- כרטסת (דרך חשבון ההנהלת-חשבונות) ----------
    def get_ledger(self, accname: str) -> dict:
        def run():
            # הערה: סינון/בחירת-שדות בתוך $expand אינם נתמכים כאן (400) — מרחיבים מלא.
            d = self._get(f"ACCOUNTS('{self._q(accname)}')", {
                "$select": "ACCNAME,ACCDES,BALANCE1",
                "$expand": "ACCFNCITEMS2_SUBFORM",
            })
            raw = d.get("ACCFNCITEMS2_SUBFORM", []) or []
            raw.sort(key=lambda r: (r.get("FNCDATE") or "", r.get("FNCNUM") or ""))
            lines, running = [], 0.0
            # שדה BAL מ-Priority אינו אמין כאן (חוזר 0) — מחשבים יתרה רצה בעצמנו.
            for r in raw:
                debit, credit = _num(r.get("DEBIT")), _num(r.get("CREDIT"))
                running += debit - credit
                lines.append({
                    "date": (r.get("FNCDATE") or "")[:10],
                    "ivnum": r.get("IVNUM"),
                    "fncnum": r.get("FNCNUM"),
                    "details": r.get("DETAILS") or r.get("FNCPATNAME") or "",
                    "debit": debit,
                    "credit": credit,
                    "balance": round(running, 2),
                })
            total_debit = round(sum(l["debit"] for l in lines), 2)
            total_credit = round(sum(l["credit"] for l in lines), 2)
            return {
                "account": d.get("ACCNAME"),
                "account_desc": d.get("ACCDES"),
                "lines": lines,
                "total_debit": total_debit,
                "total_credit": total_credit,
                "balance": round(total_debit - total_credit, 2),
            }
        return self._cached(f"led:{accname}", run)

    def search_accounts(self, top: int = 500) -> list[dict]:
        """רשימת חשבונות לבחירת שם-חשבון ללקוח (סינון בצד הלקוח)."""
        def run():
            d = self._get("ACCOUNTS", {
                "$select": "ACCNAME,ACCDES,BALANCE1", "$top": str(top), "$orderby": "ACCNAME"})
            return [{"accname": r.get("ACCNAME"), "desc": r.get("ACCDES"),
                     "balance": _num(r.get("BALANCE1"))} for r in d.get("value", [])]
        return self._cached(f"acclist:{top}", run)

    def ping(self) -> dict:
        """בדיקת חיבור — שולף ישות שירות."""
        self._get("", None)
        return {"ok": True, "base": self.base_url}
