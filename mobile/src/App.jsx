import { useEffect, useState } from 'react'
import { api } from './api.js'
import Invoices from './pages/Invoices.jsx'
import Ledger from './pages/Ledger.jsx'
import Receipts from './pages/Receipts.jsx'
import SelectCustomer from './pages/SelectCustomer.jsx'

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
const IconAdmin = () => <Icon d={<>
  <circle cx="12" cy="12" r="3.2" />
  <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9 19 19M19 5l-2.1 2.1M7.1 16.9 5 19" /></>} />
const IconReceipt = () => <Icon d={<>
  <path d="M5 2h14v18l-2.5-1.5L14 20l-2 -1.5L10 20l-2.5-1.5L5 20z" />
  <path d="M9 7h6M9 11h6M9 15h4" /></>} />

const ACTIVE_KEY = 'tact.activeCustomer'

export default function App() {
  const [me, setMe] = useState(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('invoices')
  const [active, setActive] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null') } catch { return null }
  })

  useEffect(() => {
    api.me().then((m) => {
      setMe(m)
      // מנהל בלי לקוח פעיל — פותחים ישר בלשונית הניהול לבחירת לקוח
      if (m?.is_admin && !active) setTab('admin')
    }).catch((e) => setErr(e.message))
  }, [])

  function selectCustomer(c) {
    const next = { custname: c.custname, name: c.name || c.custname }
    setActive(next)
    try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
    setTab('invoices')
  }

  if (err) return <Shell><div className="state"><h2>שגיאה</h2><p>{err}</p></div></Shell>
  if (!me) return <Shell><div className="state"><div className="spinner" />טוען…</div></Shell>

  // הקשר הלקוח: מנהל — הלקוח שנבחר בלשונית ניהול; לקוח רגיל — לפי המייל (backend).
  let ctx = null, custLabel = ''
  if (me.is_admin) {
    if (active) { ctx = { custname: active.custname, display_name: active.name }; custLabel = active.name }
  } else if (me.customer) {
    ctx = { custname: undefined, display_name: me.customer.display_name }
    custLabel = me.customer.display_name
  }

  const tabs = [
    { key: 'invoices', label: 'חשבוניות', Icon: IconInvoice },
    { key: 'ledger', label: 'כרטסת', Icon: IconLedger },
    { key: 'receipts', label: 'קבלות', Icon: IconReceipt },
  ]
  if (me.is_admin) tabs.push({ key: 'admin', label: 'ניהול', Icon: IconAdmin })

  return (
    <Shell custLabel={custLabel} isAdmin={me.is_admin}>
      <main className="content">
        {tab === 'admin' && me.is_admin
          ? <SelectCustomer active={active} onSelect={selectCustomer} />
          : !ctx ? (
            <div className="state">
              <h2>{me.is_admin ? 'לא נבחר לקוח' : 'לא זוהה לקוח'}</h2>
              <p>{me.is_admin
                ? 'עבור ללשונית "ניהול" ובחר לקוח כדי לראות את הנתונים.'
                : 'כתובת המייל שלך אינה משויכת ללקוח ב-Priority. פנה למנהל החשבון.'}</p>
            </div>
          ) : tab === 'invoices' ? <Invoices ctx={ctx} /> : tab === 'receipts' ? <Receipts ctx={ctx} /> : <Ledger ctx={ctx} />}
      </main>

      <nav className="tabbar">
        {tabs.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''}
            onClick={() => setTab(t.key)} aria-label={t.label}>
            <t.Icon /><span>{t.label}</span>
          </button>
        ))}
      </nav>
    </Shell>
  )
}

function Shell({ children, custLabel, isAdmin }) {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">T·A·C·T{isAdmin && <span className="role">מנהל</span>}</div>
        {custLabel
          ? <div className="cust"><b>{custLabel}</b><a className="logout" href="/logout">יציאה</a></div>
          : <a className="logout" href="/logout">יציאה</a>}
      </header>
      {children}
    </div>
  )
}
