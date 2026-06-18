import { useEffect, useState } from 'react'
import { api, fmtMoney } from '../api.js'
import TactIcon from '../components/TactIcon.jsx'

export default function Invoices({ ctx }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true); setErr('')
    api.invoices(ctx.custname)
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [ctx.custname])

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

      <div className="kpi-row">
        <Kpi label="מספר חשבוניות" value={rows.length} />
        <Kpi label='סה"כ כולל מע"מ' value={`₪${fmtMoney(data?.total)}`} />
      </div>

      {rows.length === 0 ? (
        <div className="state"><p>לא נמצאו חשבוניות ללקוח זה.</p></div>
      ) : (
        <div className="tbl-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>תאריך</th><th>מספר חשבונית</th><th>פרטים</th><th>סטטוס</th>
                <th className="num">לפני מע"מ</th><th className="num">מע"מ</th><th className="num">סה"כ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.ivnum}-${r.fncnum}`}>
                  <td className="num">{r.date}</td>
                  <td>{r.ivnum}</td>
                  <td className="muted">{r.details}</td>
                  <td>{r.status}</td>
                  <td className="num">{fmtMoney(r.before_vat)}</td>
                  <td className="num">{fmtMoney(r.vat)}</td>
                  <td className="num"><b>{fmtMoney(r.total)}</b></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6}>סה"כ</td>
                <td className="num">₪{fmtMoney(data?.total)}</td>
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
