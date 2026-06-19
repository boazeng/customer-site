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
  invoicePdfUrl: ({ ivnum, source, custname }) => {
    const p = new URLSearchParams({ ivnum })
    if (source) p.set('source', source)
    if (custname) p.set('custname', custname)
    return '/api/invoice-pdf?' + p.toString()
  },
  // ניהול (admin) — איתור לקוח לפי מייל או מספר לקוח
  customerLookup: ({ email, custname }) => {
    const p = new URLSearchParams()
    if (email) p.set('email', email)
    if (custname) p.set('custname', custname)
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

// פתיחת PDF של חשבונית בלשונית חדשה לצפייה/הדפסה. בקשה אחת ללחיצה, חשבונית אחת.
export async function openInvoicePdf({ ivnum, source, custname }, onBusy) {
  onBusy?.(true)
  const win = window.open('', '_blank')
  if (win) win.document.write('<p style="font-family:sans-serif;padding:24px">טוען חשבונית…</p>')
  try {
    const res = await fetch(api.invoicePdfUrl({ ivnum, source, custname }), { credentials: 'include' })
    if (!res.ok) {
      win?.close()
      alert(res.status === 404 ? 'אין מסמך PDF זמין לחשבונית זו' : 'המסמך אינו זמין כרגע, נסה שוב')
      return
    }
    const url = URL.createObjectURL(await res.blob())
    if (win) win.location = url; else window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch {
    win?.close(); alert('שגיאה בטעינת המסמך')
  } finally { onBusy?.(false) }
}
