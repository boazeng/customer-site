# פריסה — Mac mini (OrbStack + Cloudflare Tunnel)

תת-דומיין: **customer.newavera.co.il** · פורט מקומי: **8094** · container: **customer-site**

> נגזר מ-`env/MAC-MINI-APP-INSTALL.md`. ה-TLS מסופק ע"י Cloudflare (https בקצה),
> ולכן כניסת Google ועוגיות `Secure` עובדות כמו שצריך בפרודקשן.

---

## 1. DNS ב-Cloudflare (חד-פעמי)
לוח הבקרה של Cloudflare → אזור `newavera.co.il` → **DNS**:
1. אם קיימת רשומה ל-`customer` → **מחק** (אי אפשר לשנות Type קיים).
2. **Add record:**
   - Type = `CNAME`
   - Name = `customer`
   - Target = `ae8d8404-c382-475e-a31d-ad5ee34387e1.cfargotunnel.com`
   - Proxy = 🟠 **Proxied**

## 2. Cloudflare Tunnel — ingress (על ה-Mac)
ערוך `~/.cloudflared/config.yml`, הוסף **לפני** ה-catch-all 404:
```yaml
  - hostname: customer.newavera.co.il
    service: http://localhost:8094
```
ולדציה + restart (דורש sudo, על ה-Mac עצמו):
```bash
/opt/homebrew/bin/cloudflared tunnel ingress validate
sudo launchctl stop com.cloudflare.cloudflared && sudo launchctl start com.cloudflare.cloudflared
```

## 3. Google OAuth — redirect URI (חד-פעמי)
Google Cloud Console → Credentials → ה-OAuth client
`30184743393-98ci46q3hnfo6d7uf82l7ribr2dp0jgl...` → **Authorized redirect URIs** → הוסף:
```
https://customer.newavera.co.il/auth/callback
```

## 4. פריסה על ה-Mac
```bash
cd ~/server
git clone https://github.com/boazeng/customer-site.git customer-site
cd customer-site

# צור .env (chmod 600, לעולם לא ב-git). הערכים מתוך ה-.env המשותף שלך.
nano .env          # ראה "מפתחות ה-.env" למטה
chmod 600 .env

~/.orbstack/bin/docker compose up -d --build
curl -s -o /dev/null -w "local=%{http_code}\n" http://127.0.0.1:8094/healthz   # 200
```

### מפתחות ה-.env (פרודקשן)
```dotenv
# Priority (מתוך ה-.env המשותף)
PRIORITY_ENV=real
PRIORITY_URL_REAL=https://p.priority-connect.online/odata/Priority/tabz0qun.ini/ebyael/
PRIORITY_USERNAME=<מה-.env המשותף>
PRIORITY_PASSWORD=<מה-.env המשותף>

# אימות Google (shared-auth) — מתוך ה-.env המשותף
GOOGLE_OAUTH_CLIENT_ID=<מה-.env המשותף>
GOOGLE_OAUTH_CLIENT_SECRET=<מה-.env המשותף>
AUTH_SESSION_SECRET=<מה-.env המשותף>
AUTH_SUPER_ADMIN_EMAIL=boazen@gmail.com
# AUTH_EMERGENCY_TOKEN=<אופציונלי, לכניסת חירום>

# ספציפי לאתר — פרודקשן
CUSTOMER_SITE_REDIRECT_URI=https://customer.newavera.co.il/auth/callback
DEV_LOGIN_ENABLED=false
```
⚠️ בפרודקשן **חובה** `DEV_LOGIN_ENABLED=false` ו-`AUTH_DISABLED` לא מוגדר.

## 5. אימות
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://customer.newavera.co.il/healthz   # 200
~/.orbstack/bin/docker logs customer-site --since 30s
```
פתח בדפדפן https://customer.newavera.co.il → תופנה לכניסת Google.
מנהלים מורשים: `boazen@gmail.com`, `yael.israel303@gmail.com`.
להוספת לקוח: היכנס כמנהל → ניהול → שייך אימייל ללקוח (+ accname לכרטסת), והוסף את האימייל
כמשתמש מורשה (תפקיד `user`) ב-`/auth/users`.

## 6. אוטו-deploy (git push → פרודקשן)
1. ב-`~/server/deployer/deploy.sh` הוסף `case` שממפה `customer-site` → `~/server/customer-site`.
2. ב-GitHub: repo → Settings → Webhooks → Payload URL `https://deploy.newavera.co.il`,
   content-type `application/json`, push event.
3. מעכשיו `git push` ל-`main` → פריסה תוך ~30ש'. לוג: `tail ~/server/deployer/deploy.log`.

## הערות
- שקול להפוך את הריפו ל-**Private** (פורטל עסקי). אין בו סודות או נתוני לקוחות (הכל מ-Priority בזמן ריצה).
- ה-DB (auth.db + links.db) שורד restart דרך ה-volume `./database`.
