import { useEffect, useState } from 'react'
import { api, fmtMoney, fmtDate, openReceiptPdf } from '../api.js'
import TactIcon from '../components/TactIcon.jsx'
import { Loading } from './Invoices.jsx'

export default function Receipts({ ctx }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')

  useEffect(() => {
    setLoading(true); setErr('')
    api.receipts(ctx.custname)
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [ctx.custname])

  function viewPdf(r) {
    openReceiptPdf({ accnum: r.accnum, custname: ctx.custname },
      (b) => setBusy(b ? r.accnum : ''))
  }

  if (loading) return <Loading text="טוען קבלות מ-Priority…" />
  if (err) return <div className="notice">{err}</div>

  const rows = data?.receipts || []
  return (
    <>
      <div className="page-head">
        <div>
          <h1>קבלות <span style={{fontSize:'0.55em',color:'#aaa',fontWeight:400}}>v7</span></h1>
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
                <th>תאריך</th><th>מספר קבלה</th><th>אמצעי תשלום</th><th>פרטים</th>
                <th className="num">סכום</th><th>מסמך</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.accnum}>
                  <td className="num">{fmtDate(r.date)}</td>
                  <td>{r.accnum}</td>
                  <td>{r.pay_method}</td>
                  <td className="muted">{r.details}</td>
                  <td className="num"><b>{fmtMoney(r.total)}</b></td>
                  <td>
                    <button className="link-dl" disabled={busy === r.accnum}
                      onClick={() => viewPdf(r)} title="צפייה והדפסת הקבלה">
                      <TactIcon name="document" size={15} />
                      {busy === r.accnum ? '…' : 'צפייה'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>סה"כ</td>
                <td className="num">₪{fmtMoney(data?.total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}
