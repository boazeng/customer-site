import { useEffect, useState } from 'react'
import { api, fmtMoney, fmtDate } from '../api.js'
import { Loading } from './Invoices.jsx'

export default function Ledger({ ctx }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState({})   // accname -> פתוח/סגור

  useEffect(() => {
    setLoading(true); setErr(null)
    api.ledger(ctx.custname)
      .then((d) => {
        setData(d)
        const all = {}; (d.branches || []).forEach((b) => { all[b.accname] = true })
        setOpen(all)   // ברירת מחדל — כל הסניפים פתוחים
      })
      .catch((e) => setErr(e)).finally(() => setLoading(false))
  }, [ctx.custname])

  function printLedger() {
    const all = {}; (data?.branches || []).forEach((b) => { all[b.accname] = true })
    setOpen(all)
    setTimeout(() => window.print(), 120)   // לפתוח הכל ואז להדפיס
  }

  if (loading) return <Loading text="טוען כרטסת…" />
  if (err) return <div className="notice">{err.message}</div>

  const branches = data?.branches || []
  return (
    <>
      <h1 className="page-title">כרטסת
        <small>{data?.display_name} · {branches.length} {branches.length === 1 ? 'סניף' : 'סניפים'}</small>
      </h1>

      <div className="summary">
        <div className="box"><div className="label">יתרה כוללת</div>
          <div className={'val ' + (data?.balance < 0 ? 'neg' : 'pos')}>₪{fmtMoney(data?.balance)}</div></div>
        <button className="btn" style={{ alignSelf: 'center' }} onClick={printLedger}
          disabled={!branches.length}>הדפסת כרטסת</button>
      </div>

      {branches.length === 0 ? (
        <div className="state"><p>אין תנועות בכרטסת.</p></div>
      ) : branches.map((b) => {
        const isOpen = open[b.accname]
        return (
          <section className="branch" key={b.accname}>
            <button className={'branch-head' + (isOpen ? ' open' : '')}
              onClick={() => setOpen((o) => ({ ...o, [b.accname]: !o[b.accname] }))}>
              <span className="ttl">
                <div className="name">{b.company ? `חברת ${b.company}` : 'חשבון כללי'}{b.branch ? ` · סניף ${b.branch}` : ''}</div>
                <div className="sub">לקוח {data.custname}{b.name ? ` — ${b.name}` : ''} · {b.lines.length} תנועות</div>
              </span>
              <span className={'bal ' + (b.balance < 0 ? 'neg' : 'pos')}>₪{fmtMoney(b.balance)}</span>
              <svg className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>

            {isOpen && (<>
              {b.lines.map((l, i) => (
                <div className="ledger-line" key={`${l.fncnum}-${i}`}>
                  <div className="l-date">{fmtDate(l.date)} · <span className="l-type">{l.type}</span></div>
                  <div className={'l-amt ' + (l.credit ? 'pos' : '')}>
                    {l.debit ? fmtMoney(l.debit) : `(${fmtMoney(l.credit)})`}
                  </div>
                  <div className="l-details">{l.details || l.ivnum || l.fncnum}</div>
                  <div className="l-run muted">יתרה {fmtMoney(l.balance)}</div>
                </div>
              ))}
              <div className="branch-foot">
                <span>חובה {fmtMoney(b.total_debit)} · זכות {fmtMoney(b.total_credit)}</span>
                <span className={b.balance < 0 ? 'neg' : 'pos'}>יתרה ₪{fmtMoney(b.balance)}</span>
              </div>
            </>)}
          </section>
        )
      })}
    </>
  )
}
