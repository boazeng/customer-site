import { useEffect, useState } from 'react'
import { api, fmtMoney, fmtDate, INVOICE_LOADING_HTML } from '../api.js'
import { Loading } from './Invoices.jsx'

export default function Receipts({ ctx }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')

  useEffect(() => {
    setLoading(true); setErr('')
    api.receipts(ctx.custname).then(setData).catch((e) => setErr(e.message)).finally(() => setLoading(false))
  }, [ctx.custname])

  async function viewPdf(r) {
    setBusy(r.accnum)
    const win = window.open('', '_blank')
    if (win) win.document.write(INVOICE_LOADING_HTML)
    try {
      const res = await fetch(api.receiptPdfUrl({ accnum: r.accnum, custname: ctx.custname }), { credentials: 'include' })
      if (win && win.closed) return
      if (!res.ok) {
        win?.close()
        const raw = await res.text().catch(() => '')
        let detail = ''
        try { detail = JSON.parse(raw)?.detail || '' } catch { detail = raw.slice(0, 300) }
        alert(res.status === 404 ? 'אין מסמך PDF זמין לקבלה זו' : (detail || 'המסמך אינו זמין כרגע'))
        return
      }
      const url = URL.createObjectURL(await res.blob())
      if (win && win.closed) { URL.revokeObjectURL(url); return }
      if (win) win.location = url; else window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch { win?.close(); alert('שגיאה בטעינת המסמך') } finally { setBusy('') }
  }

  if (loading) return <Loading text="טוען קבלות…" />
  if (err) return <div className="notice">{err}</div>

  const rows = data?.receipts || []
  return (
    <>
      <h1 className="page-title">קבלות<small>{data?.display_name} · {rows.length} קבלות</small></h1>

      <div className="summary">
        <div className="box"><div className="label">מספר קבלות</div><div className="val">{rows.length}</div></div>
        <div className="box"><div className="label">סה"כ</div><div className="val">₪{fmtMoney(data?.total)}</div></div>
      </div>

      {rows.length === 0 ? (
        <div className="state"><p>לא נמצאו קבלות.</p></div>
      ) : rows.map((r) => (
        <div className="inv-card" key={r.accnum}>
          <div className="inv-row1">
            <span className="inv-type">{r.pay_method || 'קבלה'}</span>
            <span className="inv-total">₪{fmtMoney(r.total)}</span>
          </div>
          {r.details && <div className="inv-details">{r.details}</div>}
          <div className="inv-row2">
            <span className="inv-meta">
              <span className="ivnum">{r.accnum}</span> · {fmtDate(r.date)}{r.status ? ` · ${r.status}` : ''}
            </span>
            <button className="btn btn-primary" disabled={busy === r.accnum}
              onClick={() => viewPdf(r)}>
              {busy === r.accnum ? '…' : 'צפייה'}
            </button>
          </div>
        </div>
      ))}
    </>
  )
}
