import { useEffect, useState } from 'react'
import { api, fmtMoney, fmtDate, openInvoicePdf } from '../api.js'

export default function Invoices({ ctx }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')

  useEffect(() => {
    setLoading(true); setErr('')
    api.invoices(ctx.custname).then(setData).catch((e) => setErr(e.message)).finally(() => setLoading(false))
  }, [ctx.custname])

  if (loading) return <Loading text="טוען חשבוניות…" />
  if (err) return <div className="notice">{err}</div>

  const rows = data?.invoices || []
  return (
    <>
      <h1 className="page-title">חשבוניות<small>{data?.display_name} · {rows.length} חשבוניות</small></h1>

      <div className="summary">
        <div className="box"><div className="label">מספר חשבוניות</div><div className="val">{rows.length}</div></div>
        <div className="box"><div className="label">סה"כ כולל מע"מ</div><div className="val">₪{fmtMoney(data?.total)}</div></div>
      </div>

      {rows.length === 0 ? (
        <div className="state"><p>לא נמצאו חשבוניות.</p></div>
      ) : rows.map((r) => (
        <div className="inv-card" key={`${r.ivnum}-${r.source}`}>
          <div className="inv-row1">
            <span className="inv-type">{r.type}</span>
            <span className={'inv-total ' + (r.total < 0 ? 'neg' : '')}>₪{fmtMoney(r.total)}</span>
          </div>
          {r.details && <div className="inv-details">{r.details}</div>}
          <div className="inv-row2">
            <span className="inv-meta"><span className="ivnum">{r.ivnum}</span> · {fmtDate(r.date)}{r.status ? ` · ${r.status}` : ''}</span>
            <button className="btn btn-primary" disabled={busy === r.ivnum}
              onClick={() => openInvoicePdf({ ivnum: r.ivnum, source: r.source, custname: ctx.custname }, (b) => setBusy(b ? r.ivnum : ''))}>
              {busy === r.ivnum ? '…' : 'צפייה / הדפסה'}
            </button>
          </div>
        </div>
      ))}
    </>
  )
}

export function Loading({ text }) {
  return <div className="state"><div className="spinner" /><p>{text}</p>
    <p className="muted" style={{ fontSize: '.78rem' }}>הקריאה הראשונה עשויה להימשך כחצי דקה</p></div>
}
