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
  priorityCustomers: () => req('/api/admin/priority/customers'),
  priorityAccounts: () => req('/api/admin/priority/accounts'),
  // איתור לקוח ב-Priority לפי מייל או מספר לקוח
  customerLookup: ({ email, custname }) => {
    const p = new URLSearchParams()
    if (email) p.set('email', email)
    if (custname) p.set('custname', custname)
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
