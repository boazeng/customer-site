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
  ledger: (custname, accname) => {
    const p = new URLSearchParams()
    if (custname) p.set('custname', custname)
    if (accname) p.set('accname', accname)
    const qs = p.toString()
    return req('/api/ledger' + (qs ? `?${qs}` : ''))
  },
  adminLinks: () => req('/api/admin/links'),
  saveLink: (body) => post('/api/admin/links', body),
  deleteLink: (email) => post('/api/admin/links/delete', { email }),
  priorityCustomers: () => req('/api/admin/priority/customers'),
  priorityAccounts: () => req('/api/admin/priority/accounts'),
}

// עיצוב מספרים — מפריד אלפים, שליליים באדום בסוגריים (כמו בדוחות הנהח"ש)
export function fmtMoney(n) {
  const v = Number(n || 0)
  const abs = Math.abs(v).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return v < 0 ? `(${abs})` : abs
}
