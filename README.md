# אתר לקוחות — Customer Portal

אזור אישי ללקוחות. כל לקוח מתחבר עם Google ורואה את הנתונים שלו מתוך **Priority**:

1. **חשבוניות** — חשבוניות הלקוח (AINVOICES).
2. **כרטסת** — תנועות חובה/זכות ויתרה רצה.
3. **קריאות שירות** — *בקרוב* (שלב ב').

עיצוב בשפת TACT (קרם חם + כחול-פלדה, RTL). Backend: FastAPI. Frontend: React + Vite.

---

## ארכיטקטורה

```
customer-site/
├── backend/                FastAPI + לקוח Priority + אימות
│   ├── app/
│   │   ├── main.py         אפליקציה, אימות, הגשת ה-SPA
│   │   ├── settings.py     טעינת .env (משותף + מקומי)
│   │   ├── priority_client.py  לקוח OData ל-Priority (קריאה בלבד)
│   │   ├── links_store.py  מיפוי אימייל → לקוח/חשבון (SQLite)
│   │   └── routes.py       /api/*
│   ├── requirements.txt
│   └── .env.example
└── frontend/               React + Vite (עיצוב TACT)
    └── src/{components,pages,styles}
```

### זרימת ההרשאות
- **לקוח** (תפקיד `user`): רואה רק את הלקוח שמשויך לאימייל שלו (טבלת `customer_links`).
- **מנהל** (תפקיד `admin`): בוחר כל לקוח ומנהל שיוכים במסך "ניהול".

האימות הוא דרך מודול `shared-auth` המשותף (כניסת Google + תפקידים). טבלת המשתמשים
של האתר נפרדת (`backend/database/auth.db`) ואינה משותפת עם אפליקציות אחרות.

### מקור הנתונים (Priority)
- חשבוניות: `AINVOICES?$filter=CUSTNAME eq '<custname>'`
- כרטסת: `ACCOUNTS('<accname>')?$expand=ACCFNCITEMS2_SUBFORM` (יתרה רצה מחושבת בצד השרת)
- פרטי החיבור נלקחים מה-.env המשותף: `PRIORITY_URL_REAL/DEMO`, `PRIORITY_USERNAME`, `PRIORITY_PASSWORD`.

> **חשוב — שם החשבון לכרטסת:** לכל לקוח יש "שם חשבון" (accname) בהנהלת החשבונות.
> אותו מגדירים פעם אחת במסך הניהול (יש שם חיפוש חשבונות). החשבוניות לא דורשות זאת.
> *לחלופין*, אם תפעילו ב-Priority הרשאת API למסך **כרטסת לקוח** (FNCCUST/ACCRECON),
> ניתן יהיה לשלוף כרטסת לפי מספר הלקוח ישירות — כרגע מסכים אלו חסומים ל-API.

---

## הרצה מקומית (פיתוח)

### 1. Backend
```powershell
cd backend
python -m venv .venv ; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -e C:\Users\User\Aiprojects\shared-auth   # מודול האימות המשותף
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

#### כניסה לבדיקות (מקומי)
כניסת Google אמיתית דורשת HTTPS (עוגיית ה-session היא `Secure`), לכן בפיתוח מקומי
משתמשים במסך **כניסה לבדיקות**: פתחו **http://localhost:8000/dev-login**, בחרו משתמש
או הזינו אימייל כלשהו — המערכת תתנהג כאילו אותו משתמש נכנס (מנהל מזוהה מטבלת המשתמשים,
אחרת נכנס כלקוח). נשלט ע"י `DEV_LOGIN_ENABLED` ו**חובה לכבות בפרודקשן**.
מנהלים מוגדרים: `boazen@gmail.com`, `yael.israel303@gmail.com`.

### 2. Frontend
```powershell
cd frontend
npm install
npm run dev          # http://localhost:5173 (פרוקסי ל-/api מול 8000)
```

פיתחו את http://localhost:5173. עם `AUTH_DISABLED=true` תזוהו כמנהל ותוכלו לבחור לקוח.

---

## בנייה ל-Production (שרת יחיד)

```powershell
cd frontend ; npm run build         # יוצר frontend/dist
cd ..\backend ; uvicorn app.main:app --port 8000
```
ה-backend מגיש אוטומטית את ה-SPA מ-`frontend/dist`. הריצו מאחורי reverse-proxy עם **HTTPS**
(עוגיות ה-session הן `Secure`). הגדירו ב-`.env`:
- `AUTH_DISABLED` — **להסיר/false** (אימות אמיתי).
- `CUSTOMER_SITE_REDIRECT_URI=https://<דומיין>/auth/callback` — ולרשום אותו ב-Google Cloud Console.

### פריסה
- **Mac mini**: ראו `C:\Users\User\Aiprojects\env\MAC-MINI-APP-INSTALL.md`.
- **AWS EC2**: ראו `C:\Users\User\Aiprojects\env\EC2-DEPLOYMENT-RUNBOOK.md`.
בשני המקרים: uvicorn/gunicorn מאחורי nginx (TLS), והגשת `frontend/dist`.

---

## הוספת לקוח חדש (מנהל)
1. היכנסו כמנהל → לשונית **ניהול**.
2. הזינו את **אימייל ה-Google** של הלקוח, בחרו את הלקוח (custname), ואם רוצים כרטסת — בחרו **חשבון** (accname).
3. הוסיפו את אותו אימייל גם כמשתמש מורשה (`/auth/users`, תפקיד `user`).
4. הלקוח מתחבר עם Google ורואה רק את הנתונים שלו.
</content>
