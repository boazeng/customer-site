import { useState } from 'react'
import { api } from '../api.js'

// ניהול (admin) — איתור לקוח לפי מייל/מספר ובחירתו כלקוח הפעיל לבדיקה.
export default function SelectCustomer({ active, onSelect }) {
  const [mode, setMode] = useState('email')   // 'email' | 'custname'
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')

  async function search(e) {
    e?.preventDefault()
    const v = value.trim()
    if (!v) return
    setErr(''); setResult(null); setLoading(true)
    try {
      setResult(await api.customerLookup(mode === 'email' ? { email: v } : { custname: v }))
    } catch (e2) { setErr(e2.message) } finally { setLoading(false) }
  }

  return (
    <>
      <h1 className="page-title">ניהול מערכת<small>בחירת לקוח לבדיקה</small></h1>

      {active && (
        <div className="inv-card" style={{ borderColor: 'var(--primary)' }}>
          <div className="inv-meta">לקוח פעיל כעת:</div>
          <div className="inv-row1"><span className="inv-type">{active.name}</span>
            <span className="badge">{active.custname}</span></div>
        </div>
      )}

      <form onSubmit={search} className="inv-card">
        <div className="seg">
          <button type="button" className={mode === 'email' ? 'on' : ''}
            onClick={() => { setMode('email'); setValue(''); setResult(null) }}>לפי מייל</button>
          <button type="button" className={mode === 'custname' ? 'on' : ''}
            onClick={() => { setMode('custname'); setValue(''); setResult(null) }}>לפי מספר</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input className="fld" type={mode === 'email' ? 'email' : 'text'} value={value}
            onChange={(e) => setValue(e.target.value)} inputMode={mode === 'email' ? 'email' : 'numeric'}
            placeholder={mode === 'email' ? 'customer@example.com' : 'לדוגמה: 50245'} />
          <button className="btn btn-primary" type="submit" disabled={loading || !value.trim()}>
            {loading ? '…' : 'איתור'}
          </button>
        </div>
        {err && <div className="sub neg" style={{ marginTop: 8, fontSize: '.82rem' }}>{err}</div>}
      </form>

      {result?.status === 'none' && <div className="state"><p>לא נמצא לקוח תואם.</p></div>}
      {result?.status === 'many' && <div className="inv-meta" style={{ margin: '4px 2px 8px' }}>נמצאו {result.count} לקוחות — בחר:</div>}

      {result?.customers?.map((c) => (
        <div className="inv-card" key={c.custname}>
          <div className="inv-row1"><span className="inv-type">{c.name || c.custname}</span>
            <span className="badge">{c.custname}</span></div>
          <div className="inv-details">
            {[c.tax_id && `ח.פ ${c.tax_id}`, c.city, c.phone].filter(Boolean).join(' · ')}
          </div>
          <div className="inv-row2">
            <span className="inv-meta">{c.email}</span>
            {active?.custname === c.custname
              ? <span className="badge" style={{ background: 'var(--pos)', color: '#fff' }}>✓ פעיל</span>
              : <button className="btn btn-primary" onClick={() => onSelect(c)}>הצג נתונים</button>}
          </div>
        </div>
      ))}
    </>
  )
}
