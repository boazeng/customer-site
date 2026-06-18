import { useEffect, useState } from 'react'
import { api, fmtMoney } from '../api.js'
import { Kpi, Loading } from './Invoices.jsx'

export default function Ledger({ ctx, isAdmin }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true); setErr(null)
    api.ledger(ctx.custname, ctx.accname)
      .then(setData)
      .catch((e) => setErr(e))
      .finally(() => setLoading(false))
  }, [ctx.custname, ctx.accname])

  if (loading) return <Loading text="טוען כרטסת מ-Priority…" />

  if (err) {
    // לא הוגדר חשבון לכרטסת
    if (err.detail === 'לא-הוגדר-חשבון') {
      return (
        <div className="notice">
          {isAdmin
            ? 'לא הוגדר שם-חשבון (accname) ללקוח זה. הגדר אותו במסך הניהול כדי להציג כרטסת.'
            : 'הכרטסת עדיין לא זמינה. פנה למנהל החשבון.'}
        </div>
      )
    }
    return <div className="notice">{err.message}</div>
  }

  const lines = data?.lines || []
  return (
    <>
      <div className="page-head">
        <div>
          <h1>כרטסת</h1>
          <div className="sub">
            {ctx.display_name || data?.display_name} · חשבון {data?.account} {data?.account_desc ? `— ${data.account_desc}` : ''}
          </div>
        </div>
      </div>

      <div className="kpi-row">
        <Kpi label='סה"כ חובה' value={`₪${fmtMoney(data?.total_debit)}`} />
        <Kpi label='סה"כ זכות' value={`₪${fmtMoney(data?.total_credit)}`} />
        <Kpi label="יתרה" value={`₪${fmtMoney(data?.balance)}`} />
      </div>

      {lines.length === 0 ? (
        <div className="state"><p>אין תנועות בכרטסת.</p></div>
      ) : (
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
                  <td className="num">{l.date}</td>
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
                <td className="num">{fmtMoney(data?.total_debit)}</td>
                <td className="num">{fmtMoney(data?.total_credit)}</td>
                <td className={'num ' + (data?.balance < 0 ? 'neg' : 'pos')}>₪{fmtMoney(data?.balance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}
