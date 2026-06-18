import { useEffect, useState } from 'react'
import { api, fmtMoney, fmtDate } from '../api.js'
import { Kpi, Loading } from './Invoices.jsx'

export default function Ledger({ ctx }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true); setErr(null)
    api.ledger(ctx.custname)
      .then(setData)
      .catch((e) => setErr(e))
      .finally(() => setLoading(false))
  }, [ctx.custname])

  if (loading) return <Loading text="טוען כרטסת מ-Priority…" />
  if (err) return <div className="notice">{err.message}</div>

  const branches = data?.branches || []
  return (
    <>
      <div className="page-head">
        <div>
          <h1>כרטסת</h1>
          <div className="sub">
            {ctx.display_name || data?.display_name} · {branches.length} {branches.length === 1 ? 'סניף' : 'סניפים'}
          </div>
        </div>
      </div>

      <div className="kpi-row">
        <Kpi label="מספר סניפים" value={branches.length} />
        <Kpi label="יתרה כוללת" value={`₪${fmtMoney(data?.balance)}`} />
      </div>

      {branches.length === 0 ? (
        <div className="state"><p>אין תנועות בכרטסת ללקוח זה.</p></div>
      ) : (
        branches.map((b) => <BranchLedger key={b.accname} b={b} />)
      )}
    </>
  )
}

function BranchLedger({ b }) {
  const lines = b.lines || []
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-primary)' }}>
          {b.branch ? `סניף ${b.branch}` : 'חשבון ראשי'}
        </h2>
        <span className="sub">חשבון {b.accname}{b.name ? ` — ${b.name}` : ''}</span>
        <span className="sub" style={{ marginInlineStart: 'auto' }}>
          יתרה: <b className={b.balance < 0 ? 'neg' : 'pos'}>₪{fmtMoney(b.balance)}</b>
        </span>
      </div>

      <div className="tbl-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>תאריך</th><th>אסמכתא</th><th>פרטים</th>
              <th className="num">חובה</th><th className="num">זכות</th><th className="num">יתרה</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={`${l.fncnum}-${i}`}>
                <td className="num">{fmtDate(l.date)}</td>
                <td>{l.ivnum || l.fncnum}</td>
                <td className="muted">{l.details}</td>
                <td className="num">{l.debit ? fmtMoney(l.debit) : ''}</td>
                <td className="num">{l.credit ? fmtMoney(l.credit) : ''}</td>
                <td className={'num ' + (l.balance < 0 ? 'neg' : 'pos')}>{fmtMoney(l.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>סה"כ</td>
              <td className="num">{fmtMoney(b.total_debit)}</td>
              <td className="num">{fmtMoney(b.total_credit)}</td>
              <td className={'num ' + (b.balance < 0 ? 'neg' : 'pos')}>₪{fmtMoney(b.balance)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
