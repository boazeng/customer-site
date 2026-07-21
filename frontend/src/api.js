// עטיפה דקה ל-fetch מול ה-API. שולח עוגיות (credentials) ומטפל בשגיאות.

async function req(url) {
  const r = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } })
  if (r.status === 401) {
    // לא מחובר — מפנים לכניסת Google דרך ה-backend
    window.location.href = '/login'
    throw new Error('redirecting')
  }
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const err = new Error(data.detail || `שגיאה ${r.status}`)
    err.status = r.status
    err.detail = data.detail
    throw err
  }
  return data
}

async function post(url, body) {
  const r = await fetch(url, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body || {}),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.detail || `שגיאה ${r.status}`)
  return data
}

export const api = {
  me: () => req('/api/me'),
  invoices: (custname) => req('/api/invoices' + (custname ? `?custname=${encodeURIComponent(custname)}` : '')),
  invoicePdfUrl: ({ ivnum, source, custname }) => {
    const p = new URLSearchParams({ ivnum })
    if (source) p.set('source', source)
    if (custname) p.set('custname', custname)
    return '/api/invoice-pdf?' + p.toString()
  },
  ledger: (custname) => req('/api/ledger' + (custname ? `?custname=${encodeURIComponent(custname)}` : '')),
  receipts: (custname) => req('/api/receipts' + (custname ? `?custname=${encodeURIComponent(custname)}` : '')),
  receiptPdfUrl: ({ accnum, custname }) => {
    const p = new URLSearchParams({ accnum })
    if (custname) p.set('custname', custname)
    return '/api/receipt-pdf?' + p.toString()
  },
  priorityCustomers: () => req('/api/admin/priority/customers'),
  priorityAccounts: () => req('/api/admin/priority/accounts'),
  // איתור לקוח ב-Priority לפי מייל / מספר לקוח / שם
  customerLookup: ({ email, custname, name }) => {
    const p = new URLSearchParams()
    if (email) p.set('email', email)
    if (custname) p.set('custname', custname)
    if (name) p.set('name', name)
    return req('/api/admin/priority/customer-lookup?' + p.toString())
  },
  // ניהול מערכת — משתמשים מורשים ותפקידים (shared-auth)
  authUsers: () => req('/auth/users'),
  saveUser: (body) => post('/auth/users', body),
  deleteUser: (email) => post('/auth/users/delete', { email }),
}

// עיצוב תאריך — תמיד dd-mm-yyyy (הקלט מ-Priority הוא yyyy-mm-dd)
export function fmtDate(s) {
  if (!s) return ''
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(s)
}

// עיצוב מספרים — מפריד אלפים, שליליים באדום בסוגריים (כמו בדוחות הנהח"ש)
export function fmtMoney(n) {
  const v = Number(n || 0)
  const abs = Math.abs(v).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return v < 0 ? `(${abs})` : abs
}

// מסך הטעינה בלשונית החדשה של החשבונית — פונט גדול + כפתור ביטול (סוגר את החלון)
export const INVOICE_LOADING_HTML = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>חשבונית בטעינה…</title></head><body style="font-family:Heebo,Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:88vh;text-align:center;color:#1F3A5F"><div style="font-size:1.5rem;font-weight:800">חשבונית בטעינה…</div><div style="font-size:1.2rem;font-weight:500;color:#706A60;margin-top:14px">התהליך עשוי לקחת עד כחצי דקה</div><button onclick="window.close()" style="margin-top:30px;font-family:Heebo,Arial,sans-serif;font-size:1.5rem;font-weight:600;background:#fff;color:#1F3A5F;border:1px solid #E7E2D6;padding:11px 40px;border-radius:999px;cursor:pointer">ביטול</button></body></html>`

const _esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// בונה מסמך כרטסת (HTML) מהנתונים — מעוצב לצפייה והדפסה, סניף-אחר-סניף.
export function buildLedgerHtml(data) {
  const branches = data?.branches || []
  const body = branches.map((b) => {
    const lines = (b.lines || []).map((l) => `<tr>
      <td class="num">${fmtDate(l.date)}</td><td>${_esc(l.type)}</td>
      <td>${_esc(l.details || l.ivnum || l.fncnum || '')}</td>
      <td class="num">${l.debit ? fmtMoney(l.debit) : ''}</td>
      <td class="num">${l.credit ? fmtMoney(l.credit) : ''}</td>
      <td class="num ${l.balance < 0 ? 'neg' : 'pos'}">${fmtMoney(l.balance)}</td></tr>`).join('')
    return `<section class="branch">
      <div class="bhead">${b.company ? 'חברת ' + _esc(b.company) : 'חשבון כללי'}${b.branch ? ' · סניף ' + _esc(b.branch) : ''}
        <span class="bsub">לקוח ${_esc(data.custname)}${b.name ? ' — ' + _esc(b.name) : ''} · ${(b.lines || []).length} תנועות</span></div>
      <table><thead><tr><th>תאריך</th><th>סוג תנועה</th><th>פרטים</th>
        <th class="num">חובה</th><th class="num">זכות</th><th class="num">יתרה</th></tr></thead>
        <tbody>${lines}</tbody>
        <tfoot><tr><td colspan="3">סה"כ</td><td class="num">${fmtMoney(b.total_debit)}</td>
          <td class="num">${fmtMoney(b.total_credit)}</td>
          <td class="num ${b.balance < 0 ? 'neg' : 'pos'}">₪${fmtMoney(b.balance)}</td></tr></tfoot></table>
    </section>`
  }).join('')
  return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
  <title>כרטסת — ${_esc(data?.display_name || '')}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700;800&family=Space+Grotesk:wght@500;600&display=swap');
    *{box-sizing:border-box} body{font-family:Heebo,Arial,sans-serif;color:#2A2A28;margin:0;padding:26px;background:#fff}
    h1{color:#1F3A5F;font-size:1.5rem;margin:0 0 2px} .sub{color:#706A60;font-size:.9rem;margin-bottom:20px}
    .branch{margin-bottom:24px;page-break-inside:avoid}
    .bhead{font-weight:700;color:#1F3A5F;font-size:1rem;margin-bottom:6px}
    .bhead .bsub{font-weight:400;color:#706A60;font-size:.82rem;margin-inline-start:8px}
    table{width:100%;border-collapse:collapse;font-size:.82rem}
    th{background:#eef2f8;color:#1F3A5F;text-align:right;font-weight:700;padding:7px 9px;border-bottom:1px solid #d9e0ec;white-space:nowrap}
    td{padding:5px 9px;border-bottom:1px solid #eee}
    .num{font-family:'Space Grotesk',monospace;text-align:left;white-space:nowrap}
    .neg{color:#D64A2E} .pos{color:#2F8F5B}
    tfoot td{font-weight:700;border-top:2px solid #cfd6e2;color:#1F3A5F;background:#f6f8fb}
    .grand{margin-top:14px;font-weight:800;color:#1F3A5F;font-size:1.05rem}
    .toolbar{margin-bottom:18px;display:flex;gap:12px} .toolbar button{font-family:inherit;font-weight:700;font-size:1.4rem;background:#1F3A5F;color:#fff;border:none;padding:13px 38px;border-radius:999px;cursor:pointer}
    .toolbar .sec{background:#fff;color:#1F3A5F;border:1px solid #E7E2D6}
    @media print{body{padding:0} .toolbar{display:none}}
  </style></head><body>
   <div class="toolbar"><button onclick="window.print()">הדפסה</button><button class="sec" onclick="window.close()">סגירה</button></div>
   <h1>כרטסת</h1>
   <div class="sub">${_esc(data?.display_name || '')} · לקוח ${_esc(data?.custname || '')} · ${branches.length} ${branches.length === 1 ? 'סניף' : 'סניפים'}</div>
   ${body}
   <div class="grand">יתרה כוללת: ₪${fmtMoney(data?.balance)}</div>
  </body></html>`
}

// הורדת הכרטסת כקובץ אקסל (.xlsx). שולח עוגיות; מוריד דרך blob כדי לתפוס שגיאות.
export async function downloadLedgerXlsx(custname) {
  const url = '/api/ledger.xlsx' + (custname ? `?custname=${encodeURIComponent(custname)}` : '')
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) { alert('הורדת האקסל נכשלה, נסה שוב'); return }
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `ledger-${custname || 'customer'}.xlsx`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}

// פותח את מסמך הכרטסת בלשונית חדשה
export function openLedgerDoc(data) {
  const win = window.open('', '_blank')
  if (!win) { alert('חוסם החלונות הקופצים מנע פתיחה — אפשר פתיחת חלונות לאתר'); return }
  win.document.write(buildLedgerHtml(data))
  win.document.close()
}

// פתיחת קבלה בלשונית חדשה — HTML מקומי מהנתונים (Priority לא מייצרת מסמך קבלה)
export function openReceiptPdf(receipt, onBusy) {
  const win = window.open('', '_blank')
  if (!win) { alert('חוסם החלונות הקופצים מנע פתיחה — אפשר פתיחת חלונות לאתר'); return }
  win.document.write(buildReceiptHtml(receipt))
  win.document.close()
  onBusy?.(false)
}

function buildReceiptHtml({ accnum, fncnum, date, pay_method, details, total, custname, display_name }) {
  const _e = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const num = fmtMoney(total)
  const dt = fmtDate(date)
  const ref = accnum || fncnum || ''
  return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<title>קבלה ${_e(ref)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800&family=Space+Grotesk:wght@500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Heebo,Arial,sans-serif;background:#f0f2f5;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:32px 16px}
  .toolbar{margin-bottom:24px;display:flex;gap:12px}
  .toolbar button{font-family:inherit;font-size:1rem;font-weight:700;padding:10px 32px;border-radius:999px;cursor:pointer;border:none}
  .btn-print{background:#1F3A5F;color:#fff}
  .btn-close{background:#fff;color:#1F3A5F;border:1px solid #d0d7e3!important}
  .card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.10);width:100%;max-width:480px;overflow:hidden}
  .card-header{background:#1F3A5F;color:#fff;padding:28px 32px 22px;text-align:center}
  .card-header h1{font-size:2rem;font-weight:800;letter-spacing:.03em}
  .card-header .ref{font-size:.95rem;opacity:.75;margin-top:4px;font-weight:400}
  .card-body{padding:28px 32px}
  .row{display:flex;justify-content:space-between;align-items:baseline;padding:11px 0;border-bottom:1px solid #f0f0f0}
  .row:last-child{border-bottom:none}
  .label{color:#8a8a7a;font-size:.88rem;font-weight:500}
  .value{font-size:.97rem;font-weight:600;color:#1a1a18;text-align:left}
  .amount-row{background:#f6f8fb;border-radius:10px;padding:16px 20px;margin:18px 0 0;display:flex;justify-content:space-between;align-items:center}
  .amount-row .label{font-size:1rem;font-weight:700;color:#1F3A5F}
  .amount-row .value{font-family:'Space Grotesk',monospace;font-size:1.7rem;font-weight:700;color:#1F3A5F}
  .stamp{margin-top:28px;border:2px dashed #c8d4e3;border-radius:10px;text-align:center;padding:14px;color:#8a8a7a;font-size:.82rem}
  @media print{body{background:#fff;padding:0} .toolbar{display:none} .card{box-shadow:none;border-radius:0;max-width:100%}}
</style></head><body>
<div class="toolbar">
  <button class="btn-print" onclick="window.print()">הדפסה</button>
  <button class="btn-close" onclick="window.close()">סגירה</button>
</div>
<div class="card">
  <div class="card-header">
    <h1>קבלה</h1>
    <div class="ref">מס׳ ${_e(ref)}</div>
  </div>
  <div class="card-body">
    <div class="row"><span class="label">לקוח</span><span class="value">${_e(display_name || custname)}</span></div>
    <div class="row"><span class="label">מספר לקוח</span><span class="value">${_e(custname)}</span></div>
    <div class="row"><span class="label">תאריך</span><span class="value">${_e(dt)}</span></div>
    <div class="row"><span class="label">אמצעי תשלום</span><span class="value">${_e(pay_method)}</span></div>
    ${details ? `<div class="row"><span class="label">פרטים</span><span class="value">${_e(details)}</span></div>` : ''}
    <div class="amount-row">
      <span class="label">סכום שהתקבל</span>
      <span class="value">₪${_e(num)}</span>
    </div>
    <div class="stamp">מסמך זה הופק ממערכת הלקוחות · ${_e(dt)}</div>
  </div>
</div>
</body></html>`
}
