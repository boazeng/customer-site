"""כניסה לבדיקות (פיתוח בלבד!) — מאפשר "להתחבר" כאימייל כלשהו בלי Google.

מזהה את התפקיד מטבלת המשתמשים (admin/approver), ואחרת מתייחס לאימייל כלקוח (user).
מגדיר את אותה עוגיית session של shared-auth (אך secure=False כדי שתעבוד על http מקומי).
אסור להפעיל בפרודקשן — נשלט ע"י DEV_LOGIN_ENABLED.
"""
from fastapi import Request
from starlette.responses import RedirectResponse, HTMLResponse

from shared_auth.sessions import COOKIE_NAME
from shared_auth.db import norm_email


def install_dev_login(app, sessions, db, config) -> None:

    def _resolve_role(email: str):
        if email and email == config.super_admin_email:
            return "admin", "super-admin"
        rec = db.get(email)
        if rec and rec["active"]:
            return rec["role"], rec["name"]
        return "user", ""   # לקוח לבדיקה (גם אם אינו בטבלת המשתמשים)

    @app.get("/dev-login", include_in_schema=False)
    async def dev_login(request: Request, email: str = ""):
        email = norm_email(email)
        if email:
            role, name = _resolve_role(email)
            resp = RedirectResponse("/", status_code=302)
            resp.set_cookie(COOKIE_NAME, sessions.sign({"email": email, "role": role, "name": name}),
                            max_age=sessions.max_age, httponly=True, secure=False, samesite="lax")
            return resp
        return HTMLResponse(_render(db))


def _chip(email: str, label: str, kind: str) -> str:
    return (f'<a class="chip {kind}" href="/dev-login?email={email}">'
            f'<b>{label}</b><span>{email}</span></a>')


def _render(db) -> str:
    admins = [u for u in db.list_all() if u["role"] == "admin" and u["active"]]
    admin_html = "".join(_chip(u["email"], u["name"] or "מנהל", "admin") for u in admins) \
        or '<p class="muted">אין מנהלים מוגדרים עדיין</p>'
    return _PAGE.replace("{{ADMINS}}", admin_html)


_PAGE = """<!DOCTYPE html>
<html lang="he" dir="rtl"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>כניסה לבדיקות</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Heebo,Arial,sans-serif;background:#FAF9F5;color:#2A2A28;
 min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{background:#FFFEFB;border:1px solid #E7E2D6;border-radius:18px;
 box-shadow:0 8px 30px rgba(28,27,25,.10);max-width:560px;width:100%;padding:34px 38px}
h1{color:#1F3A5F;font-size:1.7rem;margin-bottom:4px}
.lead{color:#706A60;font-size:.95rem;margin-bottom:22px}
.warn{background:rgba(214,74,46,.08);border:1px solid rgba(214,74,46,.25);color:#9a3115;
 border-radius:8px;padding:9px 13px;font-size:.82rem;margin-bottom:22px}
h2{color:#1F3A5F;font-size:1rem;margin:18px 0 10px}
form{display:flex;gap:8px;margin-bottom:8px}
input{flex:1;font:inherit;padding:11px 13px;border:1px solid #E7E2D6;border-radius:10px;background:#FAF9F5}
input:focus{outline:none;border-color:#1F3A5F;box-shadow:0 0 0 3px rgba(31,58,95,.07);background:#fff}
button{font:inherit;font-weight:600;background:#1F3A5F;color:#F4F1EA;border:none;
 padding:11px 22px;border-radius:10px;cursor:pointer}
button:hover{filter:brightness(1.08)}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{display:flex;flex-direction:column;text-decoration:none;border:1px solid #E7E2D6;
 border-radius:12px;padding:9px 14px;background:#FAF9F5;transition:.15s}
.chip:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(28,27,25,.10)}
.chip b{color:#1F3A5F;font-size:.9rem}
.chip span{color:#706A60;font-size:.76rem}
.chip.admin{border-color:#C9D8FB;background:#F2F6FE}
.chip.cust{border-color:#CFE2D4;background:#F4F8F5}
.muted{color:#706A60;font-size:.85rem}
.google{display:inline-block;margin-top:20px;text-align:center;width:100%;
 padding:11px;border:1px solid #E7E2D6;border-radius:10px;color:#1F3A5F;text-decoration:none;font-weight:600}
.google:hover{border-color:#1F3A5F}
</style></head>
<body><div class="card">
 <h1>כניסה לבדיקות</h1>
 <p class="lead">בחר משתמש קיים או הזן אימייל — המערכת תתנהג כאילו אותו משתמש נכנס.</p>
 <div class="warn">⚠️ מצב פיתוח בלבד. בפרודקשן יש לכבות (DEV_LOGIN_ENABLED=false) ולהשתמש בכניסת Google.</div>

 <form method="get" action="/dev-login">
   <input name="email" type="email" placeholder="הזן אימייל כלשהו (לקוח חדש ייכנס כ-user)" required>
   <button type="submit">כניסה</button>
 </form>

 <h2>מנהלים</h2>
 <div class="chips">{{ADMINS}}</div>
 <p class="muted" style="margin-top:14px">לקוח: הזן מייל שמופיע בכרטיס הלקוח ב-Priority — הזיהוי נעשה אוטומטית.</p>

 <a class="google" href="/login">או התחבר עם Google ›</a>
</div></body></html>"""
