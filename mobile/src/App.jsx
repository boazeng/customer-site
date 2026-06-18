import { useEffect, useState } from 'react'
import { api } from './api.js'
import Invoices from './pages/Invoices.jsx'
import Ledger from './pages/Ledger.jsx'

// אייקוני קו פשוטים (24x24)
const Icon = ({ d, fill }) => (
  <svg className="ic" viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)
const IconInvoice = () => <Icon d={<>
  <path d="M6 2.5h12v19l-2.5-1.5L13 21l-1.5-1.5L10 21l-2.5-1.5L6 21z" />
  <path d="M9 7h6M9 11h6M9 15h4" /></>} />
const IconLedger = () => <Icon d={<>
  <rect x="3.5" y="4" width="17" height="16" rx="2" />
  <path d="M3.5 9h17M9 4v16" /></>} />

// הטאבים — בעתיד אפשר להוסיף עוד
const TABS = [
  { key: 'invoices', label: 'חשבוניות', Icon: IconInvoice },
  { key: 'ledger', label: 'כרטסת', Icon: IconLedger },
]

const ACTIVE_KEY = 'tact.activeCustomer'  // לקוח שמנהל בחר במסך המחשב (אותו origin)

export default function App() {
  const [me, setMe] = useState(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('invoices')

  useEffect(() => { api.me().then(setMe).catch((e) => setErr(e.message)) }, [])

  if (err) return <Shell><div className="state"><h2>שגיאה</h2><p>{err}</p></div></Shell>
  if (!me) return <Shell><div className="state"><div className="spinner" />טוען…</div></Shell>

  // הקשר הלקוח: לקוח רגיל — מ-/me (זוהה לפי המייל). מנהל — מהלקוח שנבחר במחשב.
  let ctx = null, custLabel = ''
  if (me.is_admin) {
    let active = null
    try { active = JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null') } catch { /* ignore */ }
    if (active?.custname) {
      ctx = { custname: active.custname, display_name: active.name || active.custname }
      custLabel = ctx.display_name
    }
  } else if (me.customer) {
    ctx = { custname: undefined, display_name: me.customer.display_name }  // backend מזהה לפי מייל
    custLabel = me.customer.display_name
  }

  return (
    <Shell custLabel={custLabel}>
      <main className="content">
        {!ctx ? (
          <div className="state">
            <h2>{me.is_admin ? 'לא נבחר לקוח' : 'לא זוהה לקוח'}</h2>
            <p>{me.is_admin
              ? 'בחר לקוח במערכת במחשב — והוא יוצג כאן.'
              : 'כתובת המייל שלך אינה משויכת ללקוח ב-Priority. פנה למנהל החשבון.'}</p>
          </div>
        ) : tab === 'invoices'
          ? <Invoices ctx={ctx} />
          : <Ledger ctx={ctx} />}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''}
            onClick={() => setTab(t.key)} aria-label={t.label}>
            <t.Icon /><span>{t.label}</span>
          </button>
        ))}
      </nav>
    </Shell>
  )
}

function Shell({ children, custLabel }) {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">T·A·C·T</div>
        {custLabel
          ? <div className="cust"><b>{custLabel}</b><a className="logout" href="/logout">יציאה</a></div>
          : <a className="logout" href="/logout">יציאה</a>}
      </header>
      {children}
    </div>
  )
}
