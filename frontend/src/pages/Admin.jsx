import { useEffect, useState } from 'react'
import { api } from '../api.js'
import TactIcon from '../components/TactIcon.jsx'

// ניהול שיוכי לקוחות: מיפוי אימייל מחובר -> לקוח (custname) + חשבון כרטסת (accname).
export default function Admin({ links, reload }) {
  const [form, setForm] = useState({ email: '', custname: '', accname: '', display_name: '' })
  const [customers, setCustomers] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loadingP, setLoadingP] = useState(false)
  const [msg, setMsg] = useState('')

  // טוען רשימות מ-Priority פעם אחת (איטי) — לבחירה בטופס
  useEffect(() => {
    setLoadingP(true)
    Promise.all([api.priorityCustomers(), api.priorityAccounts()])
      .then(([c, a]) => { setCustomers(c.customers || []); setAccounts(a.accounts || []) })
      .catch((e) => setMsg('טעינת רשימות Priority נכשלה: ' + e.message))
      .finally(() => setLoadingP(false))
  }, [])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  function pickCustomer(e) {
    const custname = e.target.value
    const c = customers.find((x) => x.custname === custname)
    setForm((f) => ({ ...f, custname, display_name: f.display_name || (c?.name || '') }))
  }

  async function save(e) {
    e.preventDefault()
    setMsg('')
    try {
      await api.saveLink(form)
      setForm({ email: '', custname: '', accname: '', display_name: '' })
      reload()
      setMsg('נשמר בהצלחה')
    } catch (err) { setMsg(err.message) }
  }

  async function edit(l) {
    setForm({ email: l.email, custname: l.custname, accname: l.accname, display_name: l.display_name })
  }

  async function del(email) {
    if (!confirm(`למחוק את השיוך של ${email}?`)) return
    await api.deleteLink(email); reload()
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ניהול שיוכי לקוחות</h1>
          <div className="sub">כל אימייל מחובר משויך ללקוח ב-Priority. החשבוניות לפי הלקוח, הכרטסת לפי החשבון.</div>
        </div>
      </div>

      <div className="admin-grid">
        <form className="form-card" onSubmit={save}>
          <h3><TactIcon name="plus" size={18} /> הוספה / עריכת שיוך</h3>
          {loadingP && <div className="sub" style={{ marginBottom: 12 }}>טוען רשימות מ-Priority… (עד חצי דקה)</div>}

          <div className="field">
            <label>אימייל הלקוח (כפי שמתחבר עם Google)</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="customer@example.com" required />
          </div>

          <div className="field">
            <label>לקוח ב-Priority (custname)</label>
            <select value={form.custname} onChange={pickCustomer} required>
              <option value="">— בחר לקוח —</option>
              {customers.map((c) => (
                <option key={c.custname} value={c.custname}>{c.name} ({c.custname})</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>חשבון לכרטסת (accname) — אופציונלי</label>
            <input list="acc-list" value={form.accname} onChange={set('accname')}
              placeholder="שם חשבון הנהלת-חשבונות של הלקוח" />
            <datalist id="acc-list">
              {accounts.map((a) => (
                <option key={a.accname} value={a.accname}>{a.desc}</option>
              ))}
            </datalist>
          </div>

          <div className="field">
            <label>שם לתצוגה</label>
            <input value={form.display_name} onChange={set('display_name')} placeholder="שם הלקוח לתצוגה" />
          </div>

          <button className="tact-btn tact-btn-primary" type="submit">שמירה</button>
          {msg && <span style={{ marginRight: 12 }} className="sub">{msg}</span>}
        </form>

        <div className="tbl-wrap">
          <table className="data">
            <thead>
              <tr><th>אימייל</th><th>שם לתצוגה</th><th>לקוח</th><th>חשבון כרטסת</th><th></th></tr>
            </thead>
            <tbody>
              {links.length === 0 && (
                <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 28 }}>אין שיוכים עדיין</td></tr>
              )}
              {links.map((l) => (
                <tr key={l.email}>
                  <td>{l.email}</td>
                  <td>{l.display_name}</td>
                  <td className="num">{l.custname}</td>
                  <td className="num">{l.accname || <span className="muted">—</span>}</td>
                  <td>
                    <div className="row-actions">
                      <button className="link-del" style={{ color: 'var(--color-primary)' }} onClick={() => edit(l)}>עריכה</button>
                      <button className="link-del" onClick={() => del(l.email)}>מחיקה</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
