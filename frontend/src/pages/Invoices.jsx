import { useEffect, useState } from 'react'
import { api, fmtMoney, fmtDate } from '../api.js'
import TactIcon from '../components/TactIcon.jsx'

export default function Invoices({ ctx }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')   // ivnum שנטען כרגע לצפייה

  useEffect(() => {
    setLoading(true); setErr('')
    api.invoices(ctx.custname)
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [ctx.custname])

  // פותח את החשבונית (PDF) בלשונית חדשה לצפייה והדפסה — לא מוריד קובץ.
  async function viewPdf(r) {
    setBusy(r.ivnum)
    // פתיחת הלשונית סינכרונית (בתוך לחיצת המשתמש) כדי לא להיחסם ע"י חוסם הקופצים
    const win = window.open('', '_blank')
    if (win) win.document.write(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>טוען חשבונית…</title></head><body style="font-family:Heebo,Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:88vh;text-align:center;color:#1F3A5F"><div style="font-size:1.7rem;font-weight:700">טוען חשבונית…</div><div style="font-size:1.05rem;color:#706A60;margin-top:14px">התהליך עשוי לקחת עד כחצי דקה</div></body></html>`)
    try {
      const res = await fetch(
        api.invoicePdfUrl({ ivnum: r.ivnum, source: r.source, custname: ctx.custname }),
        { credentials: 'include' })
      if (!res.ok) {
        win?.close()
        alert(res.status === 404 ? 'אין מסמך PDF זמין לחשבונית זו' : 'המסמך אינו זמין כרגע, נסה שוב')
        return
      }
      const url = URL.createObjectURL(await res.blob())
      if (win) win.location = url; else window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)  // משחררים אחרי שהצופן נטען
    } catch { win?.close(); alert('שגיאה בטעינת המסמך') } finally { setBusy('') }
  }

  if (loading) return <Loading text="טוען חשבוניות מ-Priority…" />
  if (err) return <div className="notice">{err}</div>

  const rows = data?.invoices || []
  return (
    <>
      <div className="page-head">
        <div>
          <h1>חשבוניות</h1>
          <div className="sub">{ctx.display_name || data?.display_name} · {rows.length} חשבוניות</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="state"><p>לא נמצאו חשבוניות ללקוח זה.</p></div>
      ) : (
        <div className="tbl-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>תאריך</th><th>מספר חשבונית</th><th>סוג תנועה</th><th>פרטים</th><th>סטטוס</th>
                <th className="num">לפני מע"מ</th><th className="num">מע"מ</th><th className="num">סה"כ</th>
                <th>מסמך</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.ivnum}-${r.fncnum}`}>
                  <td className="num">{fmtDate(r.date)}</td>
                  <td>{r.ivnum}</td>
                  <td>{r.type}</td>
                  <td className="muted">{r.details}</td>
                  <td>{r.status}</td>
                  <td className="num">{fmtMoney(r.before_vat)}</td>
                  <td className="num">{fmtMoney(r.vat)}</td>
                  <td className="num"><b>{fmtMoney(r.total)}</b></td>
                  <td>
                    <button className="link-dl" disabled={busy === r.ivnum}
                      onClick={() => viewPdf(r)} title="צפייה והדפסת החשבונית">
                      <TactIcon name="document" size={15} />
                      {busy === r.ivnum ? '…' : 'צפייה'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7}>סה"כ</td>
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

export function Kpi({ label, value }) {
  return (
    <div className="tact-kpi">
      <div className="tact-kpi-label">{label}</div>
      <div className="tact-kpi-val">{value}</div>
    </div>
  )
}

export function Loading({ text }) {
  return (
    <div className="state">
      <div className="spinner" />
      <p>{text}</p>
      <p className="muted" style={{ fontSize: '.8rem' }}>
        <TactIcon name="clock" size={14} /> הקריאה הראשונה עשויה להימשך כחצי דקה
      </p>
    </div>
  )
}
