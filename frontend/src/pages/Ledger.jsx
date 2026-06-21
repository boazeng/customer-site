import { useEffect, useState } from 'react'
import { api, fmtMoney, fmtDate, openLedgerDoc, downloadLedgerXlsx } from '../api.js'
import { Loading } from './Invoices.jsx'

// קודי סוג-תנועה (FNCPATNAME) → שם מלא. בכרטסת משאירים את הקיצור ומציגים שם מלא ב-tooltip.
const TXN_TYPE = {
  'חל': 'חשבונית מס',
  'חק': 'חשבונית מס קבלה',
  'חלמ': 'חשבונית לקוח מרכזת',
  'חלז': 'חשבונית זיכוי',
}

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
        {branches.length > 0 && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="tact-btn tact-btn-primary" onClick={() => openLedgerDoc(data)}>צפייה / הדפסה</button>
            <button className="tact-btn" onClick={() => downloadLedgerXlsx(data.custname)}>הורדה לאקסל</button>
          </div>
        )}
      </div>

      {branches.length === 0 ? (
        <div className="state"><p>אין תנועות בכרטסת ללקוח זה.</p></div>
      ) : (
        branches.map((b) => <BranchLedger key={b.accname} b={b} cust={data.custname} />)
      )}
    </>
  )
}

function BranchLedger({ b, cust }) {
  const lines = b.lines || []
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-primary)' }}>
          {b.company ? `חברת ${b.company}` : 'חשבון כללי'}{b.branch ? ` · סניף ${b.branch}` : ''}
          <span className="sub" style={{ fontWeight: 400, marginInlineStart: 10 }}>
            לקוח {cust}{b.name ? ` — ${b.name}` : ''}
          </span>
        </h2>
        <span className="sub" style={{ marginInlineStart: 'auto' }}>
          יתרה: <b className={b.balance < 0 ? 'neg' : 'pos'}>₪{fmtMoney(b.balance)}</b>
        </span>
      </div>

      <div className="tbl-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>תאריך</th><th>אסמכתא</th><th>סוג תנועה</th><th>פרטים</th>
              <th className="num">חובה</th><th className="num">זכות</th><th className="num">יתרה</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={`${l.fncnum}-${i}`}>
                <td className="num">{fmtDate(l.date)}</td>
                <td>{l.ivnum || l.fncnum}</td>
                <td title={TXN_TYPE[l.type] || ''}>{l.type}</td>
                <td className="muted">{l.details}</td>
                <td className="num">{l.debit ? fmtMoney(l.debit) : ''}</td>
                <td className="num">{l.credit ? fmtMoney(l.credit) : ''}</td>
                <td className={'num ' + (l.balance < 0 ? 'neg' : 'pos')}>{fmtMoney(l.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>סה"כ</td>
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
