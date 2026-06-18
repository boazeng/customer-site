import { useEffect, useState } from 'react'
import { api } from '../api.js'
import TactIcon from '../components/TactIcon.jsx'

// ניהול מערכת — משתמשים מורשים והתפקידים שלהם. נגיש רק ל-admin (כולל super-admin).
const ROLE_HE = { admin: 'מנהל', approver: 'מאשר', user: 'משתמש / לקוח' }
const ROLE_BADGE = { admin: 'tact-badge-on', approver: 'tact-badge-soon', user: 'tact-badge-pos' }

export default function SysAdmin({ me }) {
  const [data, setData] = useState({ users: [], roles: [] })
  const [form, setForm] = useState({ email: '', name: '', role: 'user', active: true })
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)

  const load = () =>
    api.authUsers().then(setData).catch((e) => setMsg(e.message)).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const set = (k) => (e) =>
    setForm({ ...form, [k]: k === 'active' ? e.target.checked : e.target.value })

  async function save(e) {
    e.preventDefault(); setMsg('')
    try {
      await api.saveUser(form)
      setForm({ email: '', name: '', role: 'user', active: true })
      setMsg('נשמר בהצלחה'); load()
    } catch (err) { setMsg(err.message) }
  }

  function edit(u) {
    setForm({ email: u.email, name: u.name || '', role: u.role, active: !!u.active })
  }

  async function del(email) {
    if (!confirm(`למחוק את ההרשאה של ${email}?`)) return
    setMsg('')
    try { await api.deleteUser(email); load() } catch (err) { setMsg(err.message) }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ניהול מערכת</h1>
          <div className="sub">משתמשים מורשים והתפקידים שלהם. רק מנהל (admin ומעלה) רואה מסך זה.</div>
        </div>
      </div>

      <div className="kpi-row">
        <Kpi label="סה״כ משתמשים" value={data.users.length} />
        <Kpi label="מנהלים" value={data.users.filter((u) => u.role === 'admin' && u.active).length} />
        <Kpi label="פעילים" value={data.users.filter((u) => u.active).length} />
      </div>

      <div className="admin-grid">
        <form className="form-card" onSubmit={save}>
          <h3><TactIcon name="users" size={18} /> הוספה / עריכת משתמש</h3>
          <div className="notice" style={{ marginBottom: 14 }}>
            <b>תפקידים:</b> <b>מנהל</b> — גישה מלאה (כולל מסך זה). <b>מאשר</b> / <b>משתמש</b> — לקוח רגיל
            שרואה רק את הנתונים המשויכים אליו.
          </div>
          <div className="field">
            <label>אימייל (חשבון Google)</label>
            <input type="email" value={form.email} onChange={set('email')}
              placeholder="user@gmail.com" required />
          </div>
          <div className="field">
            <label>שם לתצוגה</label>
            <input value={form.name} onChange={set('name')} placeholder="שם המשתמש" />
          </div>
          <div className="field">
            <label>תפקיד</label>
            <select value={form.role} onChange={set('role')}>
              {(data.roles.length ? data.roles : ['admin', 'approver', 'user']).map((r) => (
                <option key={r} value={r}>{ROLE_HE[r] || r}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input id="active" type="checkbox" checked={form.active} onChange={set('active')}
              style={{ width: 'auto' }} />
            <label htmlFor="active" style={{ margin: 0 }}>פעיל</label>
          </div>
          <button className="tact-btn tact-btn-primary" type="submit">שמירה</button>
          {msg && <span style={{ marginRight: 12 }} className="sub">{msg}</span>}
        </form>

        <div className="tbl-wrap">
          {loading ? (
            <div className="state"><div className="spinner" />טוען…</div>
          ) : (
            <table className="data">
              <thead>
                <tr><th>אימייל</th><th>שם</th><th>תפקיד</th><th>סטטוס</th><th>כניסה אחרונה</th><th></th></tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.email}>
                    <td>{u.email}{u.email === me?.email && <span className="muted"> (אתה)</span>}</td>
                    <td>{u.name}</td>
                    <td><span className={'tact-badge ' + (ROLE_BADGE[u.role] || 'tact-badge-soon')}>{ROLE_HE[u.role] || u.role}</span></td>
                    <td>{u.active ? <span className="pos">פעיל</span> : <span className="neg">מושבת</span>}</td>
                    <td className="num muted">{(u.last_login_at || '').slice(0, 10) || '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button className="link-del" style={{ color: 'var(--color-primary)' }} onClick={() => edit(u)}>עריכה</button>
                        <button className="link-del" onClick={() => del(u.email)}>מחיקה</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}

function Kpi({ label, value }) {
  return (
    <div className="tact-kpi">
      <div className="tact-kpi-label">{label}</div>
      <div className="tact-kpi-val">{value}</div>
    </div>
  )
}
