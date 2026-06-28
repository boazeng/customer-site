import { useEffect, useState } from 'react'
import { api, fmtMoney, fmtDate, INVOICE_LOADING_HTML } from '../api.js'
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

  async function viewPdf(r) {
    setBusy(r.accnum)
    const win = window.open('', '_blank')
    if (win) win.document.write(INVOICE_LOADING_HTML)
    try {
      const res = await fetch(
        api.receiptPdfUrl({ fncnum: r.accnum, custname: ctx.custname }),
        { credentials: 'include' })
      if (win && win.closed) return
      if (!res.ok) {
        win?.close()
        const body = await res.json().catch(() => ({}))
        alert(res.status === 404 ? 'אין מסמך PDF זמין לקבלה זו' : (body.detail || 'המסמך אינו זמין כרגע'))
        return
      }
      const url = URL.createObjectURL(await res.blob())
      if (win && win.closed) { URL.revokeObjectURL(url); return }
      if (win) win.location = url; else window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch { win?.close(); alert('שגיאה בטעינת המסמך') } finally { setBusy('') }
  }

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
