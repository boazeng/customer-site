import { useEffect, useState } from 'react'
import { api, fmtMoney, fmtDate } from '../api.js'
import { Loading } from './Invoices.jsx'

export default function Receipts({ ctx }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true); setErr('')
    api.receipts(ctx.custname)
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [ctx.custname])

  if (loading) return <Loading text="טוען קבלות מ-Priority…" />
  if (err) return <div className="notice">{err}</div>

  const rows = data?.receipts || []
  return (
    <>
      <div className="page-head">
        <div>
          <h1>קבלות</h1>
          <div className="sub">{ctx.display_name || data?.display_name} · {rows.length} קבלות</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="state"><p>לא נמצאו קבלות ללקוח זה.</p></div>
      ) : (
        <div className="tbl-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>תאריך</th><th>מספר קבלה</th><th>אמצעי תשלום</th><th>פרטים</th><th>סטטוס</th>
                <th className="num">סכום</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.accnum}>
                  <td className="num">{fmtDate(r.date)}</td>
                  <td>{r.accnum}</td>
                  <td>{r.pay_method}</td>
                  <td className="muted">{r.details}</td>
                  <td>{r.status}</td>
                  <td className="num"><b>{fmtMoney(r.total)}</b></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>סה"כ</td>
                <td className="num">₪{fmtMoney(data?.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}
