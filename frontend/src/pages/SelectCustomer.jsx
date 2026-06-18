import { useState } from 'react'
import { api } from '../api.js'
import TactIcon from '../components/TactIcon.jsx'

// בחירת לקוח: איתור לפי מייל או לפי מספר לקוח מתוך Priority, והצגת פרטי הלקוח.
export default function SelectCustomer() {
  const [mode, setMode] = useState('email')   // 'email' | 'custname'
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)  // { status, count, customers }
  const [err, setErr] = useState('')

  async function search(e) {
    e?.preventDefault()
    const v = value.trim()
    if (!v) return
    setErr(''); setResult(null); setLoading(true)
    try {
      const q = mode === 'email' ? { email: v } : { custname: v }
      setResult(await api.customerLookup(q))
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>בחירת לקוח</h1>
          <div className="sub">איתור לקוח ב-Priority לפי כתובת מייל או לפי מספר לקוח, והצגת פרטיו.</div>
        </div>
      </div>

      <form className="form-card" onSubmit={search} style={{ marginBottom: 22 }}>
        <div className="tact-nav" style={{ width: 'fit-content', marginBottom: 16 }}>
          <button type="button" className={mode === 'email' ? 'active' : ''}
            onClick={() => { setMode('email'); setValue(''); setResult(null); setErr('') }}>לפי מייל</button>
          <button type="button" className={mode === 'custname' ? 'active' : ''}
            onClick={() => { setMode('custname'); setValue(''); setResult(null); setErr('') }}>לפי מספר לקוח</button>
        </div>

        <div className="field">
          <label>{mode === 'email' ? 'כתובת מייל של הלקוח' : 'מספר לקוח (custname)'}</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type={mode === 'email' ? 'email' : 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === 'email' ? 'customer@example.com' : 'לדוגמה: 50003'}
              style={{ flex: 1 }}
              autoFocus
            />
            <button className="tact-btn tact-btn-primary" type="submit" disabled={loading || !value.trim()}>
              {loading ? 'מחפש…' : 'איתור'}
            </button>
          </div>
        </div>
        {err && <div className="sub neg" style={{ marginTop: 8 }}>{err}</div>}
      </form>

      {loading && <div className="state"><div className="spinner" />מאתר ב-Priority… (הקריאה הראשונה עשויה להימשך עד חצי דקה)</div>}

      {!loading && result?.status === 'none' && (
        <div className="state"><h2>לא נמצא לקוח</h2><p>אין לקוח ב-Priority התואם {mode === 'email' ? 'למייל' : 'למספר'} שהוזן.</p></div>
      )}

      {!loading && result?.status === 'many' && (
        <div className="sub" style={{ marginBottom: 14 }}>נמצאו {result.count} לקוחות עם אותו מייל — בחר את הלקוח הנכון:</div>
      )}

      {!loading && result?.customers?.length > 0 && (
        <div className="admin-grid">
          {result.customers.map((c) => <CustomerCard key={c.custname} c={c} />)}
        </div>
      )}
    </>
  )
}

function CustomerCard({ c }) {
  const rows = [
    ['מספר לקוח', c.custname],
    ['שם', c.name],
    ['ח.פ. / ע.מ.', c.tax_id],
    ['כתובת', c.address],
    ['עיר', c.city],
    ['טלפון', c.phone],
    ['מייל', c.email],
    ['מטבע', c.currency],
    ['מנהל תיק', c.owner],
    ['סטטוס', c.status],
  ].filter(([, v]) => v)

  return (
    <div className="tact-card">
      <div className="tact-card-cap">
        <h3 style={{ margin: 0 }}>{c.name || c.custname}</h3>
        <div className="tact-card-ico"><TactIcon name="clients" size={18} /></div>
      </div>
      <div className="tact-card-body">
        <table className="data">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <th style={{ textAlign: 'right', whiteSpace: 'nowrap', width: '40%' }}>{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
