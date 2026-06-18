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
      <form onSubmit={search} style={{ marginBottom: 18 }}>
        <div className="tact-nav" style={{ width: 'fit-content', marginBottom: 12 }}>
          <button type="button" className={mode === 'email' ? 'active' : ''}
            onClick={() => { setMode('email'); setValue(''); setResult(null); setErr('') }}>לפי מייל</button>
          <button type="button" className={mode === 'custname' ? 'active' : ''}
            onClick={() => { setMode('custname'); setValue(''); setResult(null); setErr('') }}>לפי מספר לקוח</button>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type={mode === 'email' ? 'email' : 'text'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={mode === 'email' ? 'customer@example.com' : 'לדוגמה: 50003'}
            style={{ width: 320, maxWidth: '100%', fontSize: '1.15rem', padding: '10px 14px' }}
            autoFocus
          />
          <button className="tact-btn tact-btn-primary" type="submit" disabled={loading || !value.trim()}
            style={{ fontSize: '1.05rem' }}>
            {loading ? 'מחפש…' : 'איתור'}
          </button>
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
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
    <div className="tact-card" style={{ width: 'fit-content', minWidth: 340 }}>
      <div className="tact-card-cap" style={{ padding: '12px 16px' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{c.name || c.custname}</h3>
        <div className="tact-card-ico"><TactIcon name="clients" size={18} /></div>
      </div>
      <div className="tact-card-body" style={{ padding: '6px 16px 12px' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '1.05rem' }}>
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <th style={{ textAlign: 'right', whiteSpace: 'nowrap', padding: '5px 0',
                  color: 'var(--color-accent)', fontWeight: 600, verticalAlign: 'top' }}>{k}</th>
                <td style={{ padding: '5px 0 5px 18px', fontWeight: 500 }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
