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
    def _get(self, path: str, params: dict | None = None, retries: int = 3) -> dict:
        url = f"{self.base_url}/{path.lstrip('/')}"
        # Accept-Encoding: identity — תשובות גדולות (PDF ב-base64) נקטעות עם chunked+gzip
        # ("incomplete chunked read"); בלי דחיסה + ניסיון חוזר זה יציב.
        # retries=1 לניסיון בודד מהיר (משמש במירוץ המקבילי של שליפת ה-PDF).
        headers = {"Accept": "application/json", "Accept-Encoding": "identity"}
        last = None
        for attempt in range(max(1, retries)):
            try:
                r = httpx.get(url, params=params or {}, auth=self._auth,
                              headers=headers, timeout=self._timeout)
                break
            except httpx.RemoteProtocolError as exc:
                last = exc
                if attempt + 1 < retries:
                    time.sleep(0.4)
            except httpx.HTTPError as exc:
                raise PriorityError(f"שגיאת רשת מול Priority: {exc}", 504) from exc
        else:
            raise PriorityError(f"שגיאת רשת מול Priority: {last}", 504)
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

    # ---------- מיפוי שדות לקוח ----------
    # שדות שנשלפים מ-CUSTOMERS לתצוגת פרטי לקוח
    _CUST_SELECT = ("CUSTNAME,CUSTDES,EMAIL,PHONE,ADDRESS,STATE,STATDES,"
                    "WTAXNUM,CODE,OWNERLOGIN,CUST")

    @staticmethod
    def _map_customer(r: dict) -> dict:
        return {
            "custname": r.get("CUSTNAME"),
            "name": r.get("CUSTDES"),
            "email": r.get("EMAIL"),
            "phone": r.get("PHONE"),
            "address": r.get("ADDRESS"),
            "city": r.get("STATE") or r.get("STATEA"),
            "status": r.get("STATDES"),
            "tax_id": r.get("WTAXNUM"),
            "currency": r.get("CODE"),
            "owner": r.get("OWNERLOGIN"),
        }

    # מקורות חשבוניות הלקוח: כל סוג חשבונית יושב בישות נפרדת ב-Priority.
    #   AINVOICES=חשבונית מס · EINVOICES=חשבונית מס קבלה
    #   CINVOICES=מכיל גם חשבונית לקוח מרכזת (DEBIT=D) וגם חשבונית זיכוי (DEBIT=C)
    _INVOICE_ENTITIES = ("AINVOICES", "EINVOICES", "CINVOICES")

    @staticmethod
    def _invoice_label(entity: str, debit: str | None) -> str:
        if entity == "AINVOICES":
            return "חשבונית מס"
        if entity == "EINVOICES":
            return "חשבונית מס קבלה"
        return "חשבונית זיכוי" if debit == "C" else "חשבונית לקוח מרכזת"

    # ---------- חשבוניות ----------
    def get_invoices(self, custname: str) -> list[dict]:
        custname = (custname or "").strip()

        def fetch(entity: str) -> list[dict]:
            try:
                data = self._get(entity, {
                    "$filter": f"CUSTNAME eq '{self._q(custname)}'",
                    "$select": "IVNUM,IVDATE,STATDES,DEBIT,QPRICE,VAT,TOTPRICE,DETAILS",
                    "$orderby": "IVDATE desc",
                })
            except PriorityError:
                return []  # ישות לא זמינה/חסומה — מדלגים, לא מפילים את כל הרשימה
            out = []
            for r in data.get("value", []):
                if r.get("STATDES") != "סופית":
                    continue  # מציגים רק חשבוניות בסטטוס סופית (לא טיוטא/מבוטלת)
                # זיכוי (DEBIT=C) מקטין את החוב — מוצג בסכומים שליליים, וכך גם בסה"כ
                sign = -1 if r.get("DEBIT") == "C" else 1
                out.append({
                    "ivnum": r.get("IVNUM"),
                    "date": (r.get("IVDATE") or "")[:10],
                    "type": self._invoice_label(entity, r.get("DEBIT")),
                    "source": entity,   # הישות שממנה הגיעה — לשליפת ה-PDF
                    "status": r.get("STATDES"),
                    "before_vat": sign * _num(r.get("QPRICE")),
                    "vat": sign * _num(r.get("VAT")),
                    "total": sign * _num(r.get("TOTPRICE")),
                    "details": r.get("DETAILS") or "",
                })
            return out

        def run():
            from concurrent.futures import ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=len(self._INVOICE_ENTITIES)) as pool:
                parts = pool.map(fetch, self._INVOICE_ENTITIES)
            rows = [r for part in parts for r in part]
            rows.sort(key=lambda r: r["date"], reverse=True)
            return rows
        return self._cached(f"inv:{custname}", run)

    # ---------- PDF של חשבונית ----------
    # ה-PDF מופק על-פי דרישה דרך שירות ה-SDK (pdf-sidecar) שמריץ את WWWSHOWAIV
    # ב-Priority (כמו "הדפסה והצגה"). אין שמירה — נשלף טרי בכל בקשה.
    def get_invoice_pdf(self, custname: str, ivnum: str, source: str | None = None):
        """מחזיר (pdf_bytes, filename). מאמת שהחשבונית שייכת ללקוח, ומפיק דרך ה-sidecar."""
        custname = (custname or "").strip()
        ivnum = (ivnum or "").strip()
        if not custname or not ivnum:
            raise PriorityError("חסר מספר חשבונית או לקוח", 400)

        # 1) אבטחה — מאמתים שהחשבונית אכן שייכת ללקוח, ומזהים את הישות
        entities = ([source] if source in self._INVOICE_ENTITIES
                    else list(self._INVOICE_ENTITIES))
        owner_source = None
        for entity in entities:
            try:
                d = self._get(entity, {
                    "$filter": f"IVNUM eq '{self._q(ivnum)}'",
                    "$select": "IVNUM,CUSTNAME",
                })
            except PriorityError:
                continue
            if any((r.get("CUSTNAME") or "").strip() == custname for r in d.get("value", [])):
                owner_source = entity
                break
        if not owner_source:
            raise PriorityError("החשבונית לא נמצאה ללקוח זה", 404)

        # 2) הפקה דרך ה-sidecar (Web SDK → WWWSHOWAIV)
        import os
        base = os.getenv("PDF_SIDECAR_URL", "http://localhost:3001").rstrip("/")
        try:
            r = httpx.get(f"{base}/invoice-pdf",
                          params={"ivnum": ivnum, "source": owner_source}, timeout=90.0)
        except httpx.HTTPError as exc:
            raise PriorityError(f"שירות ה-PDF אינו זמין: {exc}", 502) from exc
        if r.status_code != 200 or r.content[:4] != b"%PDF":
            raise PriorityError("הפקת ה-PDF נכשלה", 502)
        return r.content, f"invoice-{ivnum}.pdf"

    # ---------- פרטי לקוח ----------
    def get_customer(self, custname: str) -> dict:
        """פרטי לקוח לפי מספר לקוח (CUSTNAME). 404 אם לא קיים."""
        def run():
            d = self._get(f"CUSTOMERS('{self._q(custname)}')",
                          {"$select": self._CUST_SELECT})
            return self._map_customer(d)
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
                "$select": self._CUST_SELECT,
            })
            return [self._map_customer(r) for r in d.get("value", [])]
        return self._cached(f"custbyemail:{email.lower()}", run)

    def search_customers(self, top: int = 300) -> list[dict]:
        """רשימת לקוחות לבחירה במסך הניהול (סינון בצד הלקוח)."""
        def run():
            d = self._get("CUSTOMERS", {
                "$select": "CUSTNAME,CUSTDES", "$top": str(top), "$orderby": "CUSTNAME"})
            return [{"custname": r.get("CUSTNAME"), "name": r.get("CUSTDES")}
                    for r in d.get("value", [])]
        return self._cached(f"custlist:{top}", run)

    def _all_customers(self, top: int = 4000) -> list[dict]:
        """רשימת לקוחות מלאה (פרטים) לחיפוש לפי שם — OData אינו תומך contains, אז מסננים בקוד."""
        def run():
            d = self._get("CUSTOMERS", {
                "$select": self._CUST_SELECT, "$orderby": "CUSTNAME", "$top": str(top)})
            return [self._map_customer(r) for r in d.get("value", [])]
        return self._cached(f"allcust:{top}", run)

    def find_customers_by_name(self, name: str, limit: int = 40) -> list[dict]:
        """איתור לקוחות ששמם מכיל את הטקסט (סינון בצד השרת על הרשימה המלאה)."""
        name = (name or "").strip().lower()
        if not name:
            return []
        out = [c for c in self._all_customers() if name in (c.get("name") or "").lower()]
        return out[:limit]

    # ---------- כרטסת לקוח ----------
    # חשבונות הלקוח יושבים ב-ACCOUNTS_RECEIVABLE בשם <מספר-לקוח> ו-<מספר-לקוח>-<סניף>.
    # (FNCCUST — הכרטסת הישירה — חסומה ל-API, ולכן עוברים דרך חשבון החייבים.)
    def _account_ledger(self, accname: str, entity: str = "ACCOUNTS_RECEIVABLE") -> dict:
        # הערה: סינון/בחירת-שדות בתוך $expand אינם נתמכים כאן (400) — מרחיבים מלא.
        d = self._get(f"{entity}('{self._q(accname)}')", {
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
                "type": r.get("FNCPATNAME") or "",   # סוג תנועה (תבנית התנועה)
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

    def list_receivable_accounts(self, custname: str) -> list[dict]:
        """כל חשבונות החייבים של הלקוח: הבסיס <custname> וחשבונות הסניפים <custname>-<סניף>."""
        custname = (custname or "").strip()

        def run():
            if not custname:
                return []
            try:
                hi = str(int(custname) + 1)
            except ValueError:
                hi = custname + "￿"
            d = self._get("ACCOUNTS_RECEIVABLE", {
                "$filter": f"ACCNAME ge '{self._q(custname)}' and ACCNAME lt '{self._q(hi)}'",
                "$select": "ACCNAME,ACCDES,BALANCE1",
                "$orderby": "ACCNAME",
            })
            out = []
            for r in d.get("value", []):
                acc = r.get("ACCNAME") or ""
                if acc != custname and not acc.startswith(custname + "-"):
                    continue  # לא חשבון של הלקוח הזה
                branch = acc[len(custname) + 1:] if acc.startswith(custname + "-") else ""
                out.append({"accname": acc, "branch": branch,
                            "name": r.get("ACCDES"), "balance": _num(r.get("BALANCE1"))})
            return out
        return self._cached(f"recvacc:{custname}", run)

    def get_companies(self) -> dict:
        """מיפוי קוד תת-חברה (סניף) → שם התת-חברה, מטבלת COMPANIES."""
        def run():
            d = self._get("COMPANIES", {"$select": "COMPANYNAME,COMPANYDES", "$top": "400"})
            return {r.get("COMPANYNAME"): r.get("COMPANYDES") for r in d.get("value", [])}
        return self._cached("companies", run)

    def get_customer_ledger(self, custname: str) -> dict:
        """כרטסת הלקוח, מופרדת לפי תת-חברות (סניפים). כל סניף עם תנועותיו ויתרתו."""
        custname = (custname or "").strip()

        def run():
            accounts = self.list_receivable_accounts(custname)
            companies = self.get_companies()
            # שולפים את הכרטסת של כל חשבונות הלקוח במקביל (יתרה אפס לא אומרת שאין
            # תנועות — סניף יכול להתקזז ל-0), ומציגים רק חשבונות עם תנועות בפועל.
            from concurrent.futures import ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=8) as pool:
                ledgers = list(pool.map(
                    lambda a: (a, self._account_ledger(a["accname"])), accounts))
            branches = []
            for a, led in ledgers:
                if not led["lines"]:
                    continue  # אין תנועות — לא מציגים
                branches.append({
                    "accname": a["accname"],
                    "branch": a["branch"],
                    "company": companies.get(a["branch"], "") if a["branch"] else "",
                    "name": a["name"] or led.get("account_desc"),
                    "lines": led["lines"],
                    "total_debit": led["total_debit"],
                    "total_credit": led["total_credit"],
                    "balance": led["balance"],
                })
            branches.sort(key=lambda b: b["accname"])
            return {
                "custname": custname,
                "branches": branches,
                "balance": round(sum(b["balance"] for b in branches), 2),
            }
        return self._cached(f"custled:{custname}", run)

    # ---------- קבלות לקוח ----------
    # ישויות ייעודיות (RECEIPTS, PAYED) חסומות ב-Priority — מסננים מהכרטסת:
    # כל שורה עם זכות > 0 היא תשלום/קבלה שהתקבל מהלקוח.
    def get_receipts(self, custname: str) -> list[dict]:
        custname = (custname or "").strip()

        def run():
            accounts = self.list_receivable_accounts(custname)
            from concurrent.futures import ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=8) as pool:
                ledgers = list(pool.map(lambda a: self._account_ledger(a["accname"]), accounts))
            out = []
            for led in ledgers:
                for line in led["lines"]:
                    if line["credit"] <= 0:
                        continue
                    out.append({
                        "accnum": line["ivnum"] or line["fncnum"] or "",
                        "fncnum": line["fncnum"] or "",
                        "date": line["date"],
                        "status": "",
                        "pay_method": line["type"],
                        "details": line["details"],
                        "total": line["credit"],
                    })
            out.sort(key=lambda r: r["date"], reverse=True)
            return out
        return self._cached(f"receipts:{custname}", run)

    def get_receipt_pdf(self, custname: str, accnum: str):
        """מחזיר (pdf_bytes, filename). מאמת שהקבלה שייכת ללקוח דרך הכרטסת."""
        custname = (custname or "").strip()
        accnum = (accnum or "").strip()
        if not custname or not accnum:
            raise PriorityError("חסר מספר קבלה או לקוח", 400)

        # אימות — מוודאים שה-accnum קיים בתנועות הזכות של הלקוח
        receipts = self.get_receipts(custname)
        match = next((r for r in receipts if r["accnum"] == accnum), None)
        if not match:
            raise PriorityError("הקבלה לא נמצאה ללקוח זה", 404)

        # מעבירים את מספר הקבלה לפרוצדורה; אם accnum הוא IVNUM — זה מה ש-WWWSHOWREC מצפה לו.
        # אם accnum הוא FNCNUM (כי IVNUM היה ריק), מנסים גם אותו.
        doc_num = accnum

        import os
        base = os.getenv("PDF_SIDECAR_URL", "http://localhost:3001").rstrip("/")
        try:
            r = httpx.get(f"{base}/receipt-pdf", params={"fncnum": doc_num}, timeout=90.0)
        except httpx.HTTPError as exc:
            raise PriorityError(f"שירות ה-PDF אינו זמין: {exc}", 502) from exc
        if r.status_code != 200 or r.content[:4] != b"%PDF":
            try:
                detail = r.json().get("error", "")
            except Exception:
                detail = r.text[:200]
            raise PriorityError(f"הפקת ה-PDF נכשלה: {detail}", 502)
        return r.content, f"receipt-{fncnum}.pdf"

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
