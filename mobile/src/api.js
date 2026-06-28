// עטיפה דקה ל-fetch מול ה-API (אותו backend). שולח עוגיות ומטפל בשגיאות.
// אין שמירת נתונים — כל קריאה נשלפת טרי מ-Priority דרך השרת.

async function req(url) {
  const r = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } })
  if (r.status === 401) {
    window.location.href = '/login'   // לא מחובר — כניסת Google דרך ה-backend
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

export const api = {
  me: () => req('/api/me'),
  invoices: (custname) => req('/api/invoices' + (custname ? `?custname=${encodeURIComponent(custname)}` : '')),
  ledger: (custname) => req('/api/ledger' + (custname ? `?custname=${encodeURIComponent(custname)}` : '')),
  receipts: (custname) => req('/api/receipts' + (custname ? `?custname=${encodeURIComponent(custname)}` : '')),
  invoicePdfUrl: ({ ivnum, source, custname }) => {
    const p = new URLSearchParams({ ivnum })
    if (source) p.set('source', source)
    if (custname) p.set('custname', custname)
    return '/api/invoice-pdf?' + p.toString()
  },
  // ניהול (admin) — איתור לקוח לפי מייל / מספר לקוח / שם
  customerLookup: ({ email, custname, name }) => {
    const p = new URLSearchParams()
    if (email) p.set('email', email)
    if (custname) p.set('custname', custname)
    if (name) p.set('name', name)
    return req('/api/admin/priority/customer-lookup?' + p.toString())
  },
}

// תאריך תמיד dd-mm-yyyy (הקלט yyyy-mm-dd)
export function fmtDate(s) {
  if (!s) return ''
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(s)
}

// מספרים — מפריד אלפים, שליליים בסוגריים (כמו בדוחות הנהח"ש)
export function fmtMoney(n) {
  const v = Number(n || 0)
  const abs = Math.abs(v).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return v < 0 ? `(${abs})` : abs
}

const _esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// מסך הטעינה בלשונית החדשה של החשבונית — פונט גדול + כפתור ביטול (סוגר את החלון)
export const INVOICE_LOADING_HTML = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>חשבונית בטעינה…</title></head><body style="font-family:Heebo,Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:88vh;text-align:center;color:#1F3A5F"><div style="font-size:2.4rem;font-weight:800">חשבונית בטעינה…</div><div style="font-size:2.4rem;font-weight:500;color:#706A60;margin-top:20px">התהליך עשוי לקחת עד כחצי דקה</div><button onclick="window.close()" style="margin-top:46px;font-family:Heebo,Arial,sans-serif;font-size:2.4rem;font-weight:600;background:#fff;color:#1F3A5F;border:1px solid #E7E2D6;padding:14px 52px;border-radius:999px;cursor:pointer">ביטול</button></body></html>`

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
    *{box-sizing:border-box} body{font-family:Heebo,Arial,sans-serif;color:#2A2A28;margin:0;padding:16px;background:#fff}
    h1{color:#1F3A5F;font-size:1.4rem;margin:0 0 2px} .sub{color:#706A60;font-size:.85rem;margin-bottom:16px}
    .branch{margin-bottom:22px;page-break-inside:avoid}
    .bhead{font-weight:700;color:#1F3A5F;font-size:.95rem;margin-bottom:6px}
    .bhead .bsub{display:block;font-weight:400;color:#706A60;font-size:.78rem;margin-top:2px}
    table{width:100%;border-collapse:collapse;font-size:.78rem}
    th{background:#eef2f8;color:#1F3A5F;text-align:right;font-weight:700;padding:6px 7px;border-bottom:1px solid #d9e0ec;white-space:nowrap}
    td{padding:5px 7px;border-bottom:1px solid #eee}
    .num{font-family:'Space Grotesk',monospace;text-align:left;white-space:nowrap}
    .neg{color:#D64A2E} .pos{color:#2F8F5B}
    tfoot td{font-weight:700;border-top:2px solid #cfd6e2;color:#1F3A5F;background:#f6f8fb}
    .grand{margin-top:12px;font-weight:800;color:#1F3A5F;font-size:1rem}
    .toolbar{margin-bottom:16px;display:flex;gap:12px} .toolbar button{font-family:inherit;font-weight:700;font-size:1.4rem;background:#1F3A5F;color:#fff;border:none;padding:13px 36px;border-radius:999px;cursor:pointer}
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
  if (!win) { alert('חוסם החלונות הקופצים מנע פתיחה'); return }
  win.document.write(buildLedgerHtml(data))
  win.document.close()
}

// פתיחת PDF של חשבונית בלשונית חדשה לצפייה/הדפסה. בקשה אחת ללחיצה, חשבונית אחת.
export async function openInvoicePdf({ ivnum, source, custname }, onBusy) {
  onBusy?.(true)
  const win = window.open('', '_blank')
  if (win) win.document.write(INVOICE_LOADING_HTML)
  try {
    const res = await fetch(api.invoicePdfUrl({ ivnum, source, custname }), { credentials: 'include' })
    if (win && win.closed) return   // המשתמש ביטל/סגר
    if (!res.ok) {
      win?.close()
      alert(res.status === 404 ? 'אין מסמך PDF זמין לחשבונית זו' : 'המסמך אינו זמין כרגע, נסה שוב')
      return
    }
    const url = URL.createObjectURL(await res.blob())
    if (win && win.closed) { URL.revokeObjectURL(url); return }
    if (win) win.location = url; else window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch {
    win?.close(); alert('שגיאה בטעינת המסמך')
  } finally { onBusy?.(false) }
}
