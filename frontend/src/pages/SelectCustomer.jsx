import { useState } from 'react'
import { api } from '../api.js'
import TactIcon from '../components/TactIcon.jsx'

// בחירת לקוח: איתור לפי מייל או לפי מספר לקוח מתוך Priority, והצגת פרטי הלקוח.
export default function SelectCustomer({ active, onSelectCustomer }) {
  const [mode, setMode] = useState('email')   // 'email' | 'custname' | 'name'
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)  // { status, count, customers }
  const [err, setErr] = useState('')

  const LABEL = { email: 'מייל', custname: 'מספר לקוח', name: 'שם' }
  const PH = { email: 'customer@example.com', custname: 'לדוגמה: 50003', name: 'חלק משם הלקוח' }

  async function search(e) {
    e?.preventDefault()
    const v = value.trim()
    if (!v) return
    setErr(''); setResult(null); setLoading(true)
    try {
      const q = { [mode]: v }
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
          {['email', 'custname', 'name'].map((m) => (
            <button key={m} type="button" className={mode === m ? 'active' : ''}
              onClick={() => { setMode(m); setValue(''); setResult(null); setErr('') }}>לפי {LABEL[m]}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type={mode === 'email' ? 'email' : 'text'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={PH[mode]}
            style={{ width: 280, maxWidth: '100%', fontSize: '.95rem', padding: '8px 12px' }}
            autoFocus
          />
          <button className="tact-btn tact-btn-primary" type="submit" disabled={loading || !value.trim()}>
            {loading ? 'מחפש…' : 'איתור'}
          </button>
        </div>
        {err && <div className="sub neg" style={{ marginTop: 8 }}>{err}</div>}
      </form>

      {loading && <div className="state"><div className="spinner" />מאתר ב-Priority… (הקריאה הראשונה עשויה להימשך עד חצי דקה)</div>}

      {!loading && result?.status === 'none' && (
        <div className="state"><h2>לא נמצא לקוח</h2><p>אין לקוח ב-Priority התואם ל{LABEL[mode]} שהוזן.</p></div>
      )}

      {!loading && result?.status === 'many' && (
        <div className="sub" style={{ marginBottom: 14 }}>נמצאו {result.count} לקוחות — בחר את הלקוח הנכון:</div>
      )}

      {!loading && result?.customers?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {result.customers.map((c) => (
            <CustomerCard key={c.custname} c={c}
              isActive={active?.custname === c.custname}
              onSelect={() => onSelectCustomer?.(c)} />
          ))}
        </div>
      )}
    </>
  )
}

function CustomerCard({ c, isActive, onSelect }) {
  const rows = [
    ['מספר לקוח', c.custname],
    ['שם', c.name],
    ['ח.פ. / ע.מ.', c.tax_id],
    ['כתובת', c.address],
    ['עיר', c.city],
    ['טלפון', c.phone],
    ['מייל', c.email],
    ['סטטוס', c.status],
  ].filter(([, v]) => v)

  return (
    <div className="tact-card" style={{ width: 'fit-content', minWidth: 320 }}>
      <div className="tact-card-cap" style={{ padding: '10px 14px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{c.name || c.custname}</h3>
        <div className="tact-card-ico"><TactIcon name="clients" size={16} /></div>
      </div>
      <div className="tact-card-body" style={{ padding: '4px 14px 12px' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '.85rem' }}>
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <th style={{ textAlign: 'right', whiteSpace: 'nowrap', padding: '4px 0 4px 28px',
                  color: 'var(--color-accent)', fontWeight: 600, verticalAlign: 'top' }}>{k}</th>
                <td style={{ padding: '4px 0', fontWeight: 500 }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 14 }}>
          {isActive ? (
            <span className="tact-badge tact-badge-pos" style={{ fontSize: '.95rem' }}>✓ הלקוח הפעיל</span>
          ) : (
            <button className="tact-btn tact-btn-primary" onClick={onSelect} style={{ width: '100%' }}>
              הצג נתונים עבור לקוח זה
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
