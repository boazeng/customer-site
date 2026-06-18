import { useEffect, useState } from 'react'
import { api } from '../api.js'
import SelectCustomer from './SelectCustomer.jsx'

// ניהול מערכת — לשוניות-משנה: ניהול משתמשי מערכת + בחירת לקוח. נגיש רק ל-admin.
const ROLE_HE = { admin: 'מנהל', approver: 'מאשר', user: 'משתמש / לקוח' }
const ROLE_BADGE = { admin: 'tact-badge-on', approver: 'tact-badge-soon', user: 'tact-badge-pos' }
const EMPTY = { name: '', email: '', role: 'user', active: true }

export default function SysAdmin({ me, active, onSelectCustomer }) {
  const [sub, setSub] = useState('users')
  return (
    <>
      <div className="page-head"><div><h1>ניהול מערכת</h1></div></div>
      <div className="tact-nav" style={{ width: 'fit-content', marginBottom: 22 }}>
        <button className={sub === 'users' ? 'active' : ''} onClick={() => setSub('users')}>ניהול משתמשי מערכת</button>
        <button className={sub === 'select' ? 'active' : ''} onClick={() => setSub('select')}>בחירת לקוח</button>
      </div>
      {sub === 'users'
        ? <ManageUsers me={me} />
        : <SelectCustomer active={active} onSelectCustomer={onSelectCustomer} />}
    </>
  )
}

function ManageUsers({ me }) {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState(['admin', 'approver', 'user'])
  const [draft, setDraft] = useState(EMPTY)        // שורת ההוספה
  const [editEmail, setEditEmail] = useState('')   // איזו שורה בעריכה
  const [edit, setEdit] = useState(EMPTY)
  const [msg, setMsg] = useState('')

  const load = () => api.authUsers()
    .then((d) => { setUsers(d.users || []); if (d.roles?.length) setRoles(d.roles) })
    .catch((e) => setMsg(e.message))
  useEffect(() => { load() }, [])

  async function add() {
    setMsg('')
    if (!draft.email) { setMsg('חסר אימייל'); return }
    try { await api.saveUser(draft); setDraft(EMPTY); load() } catch (e) { setMsg(e.message) }
  }
  async function saveEdit() {
    setMsg('')
    try { await api.saveUser(edit); setEditEmail(''); load() } catch (e) { setMsg(e.message) }
  }
  async function del(email) {
    if (!confirm(`למחוק את ${email}?`)) return
    setMsg('')
    try { await api.deleteUser(email); load() } catch (e) { setMsg(e.message) }
  }

  const roleOpts = roles.map((r) => <option key={r} value={r}>{ROLE_HE[r] || r}</option>)
  const Active = ({ v, on }) => (
    <label className="chk"><input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)} /> פעיל</label>
  )

  return (
    <div className="tbl-wrap">
      <table className="data">
        <thead>
          <tr><th>שם</th><th>אימייל</th><th>תפקיד</th><th>סטטוס</th><th>כניסה אחרונה</th><th></th></tr>
        </thead>
        <tbody>
          {/* שורת הוספה — חלק מהטבלה */}
          <tr className="add-row">
            <td><input className="cell" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="שם" /></td>
            <td><input className="cell" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="email@gmail.com" /></td>
            <td><select className="cell" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>{roleOpts}</select></td>
            <td><Active v={draft.active} on={(v) => setDraft({ ...draft, active: v })} /></td>
            <td className="muted">—</td>
            <td><button className="tact-btn tact-btn-primary btn-sm" onClick={add}>+ הוסף</button></td>
          </tr>

          {users.map((u) => editEmail === u.email ? (
            <tr key={u.email}>
              <td><input className="cell" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="שם" /></td>
              <td className="muted">{u.email}</td>
              <td><select className="cell" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>{roleOpts}</select></td>
              <td><Active v={edit.active} on={(v) => setEdit({ ...edit, active: v })} /></td>
              <td className="num muted">{(u.last_login_at || '').slice(0, 10) || '—'}</td>
              <td><div className="row-actions">
                <button className="link-del" style={{ color: 'var(--color-pos)' }} onClick={saveEdit}>שמור</button>
                <button className="link-del muted" onClick={() => setEditEmail('')}>בטל</button>
              </div></td>
            </tr>
          ) : (
            <tr key={u.email}>
              <td>{u.name}{u.email === me?.email && <span className="muted"> (אתה)</span>}</td>
              <td>{u.email}</td>
              <td><span className={'tact-badge ' + (ROLE_BADGE[u.role] || 'tact-badge-soon')}>{ROLE_HE[u.role] || u.role}</span></td>
              <td>{u.active ? <span className="pos">פעיל</span> : <span className="neg">מושבת</span>}</td>
              <td className="num muted">{(u.last_login_at || '').slice(0, 10) || '—'}</td>
              <td><div className="row-actions">
                <button className="link-del" style={{ color: 'var(--color-primary)' }}
                  onClick={() => { setEditEmail(u.email); setEdit({ name: u.name || '', email: u.email, role: u.role, active: !!u.active }) }}>עריכה</button>
                <button className="link-del" onClick={() => del(u.email)}>מחק</button>
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
      {msg && <div className="sub" style={{ padding: '10px 16px' }}>{msg}</div>}
    </div>
  )
}
