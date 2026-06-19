import { useEffect, useState } from 'react'
import { api } from './api.js'
import Header from './components/Header.jsx'
import Invoices from './pages/Invoices.jsx'
import Ledger from './pages/Ledger.jsx'
import SysAdmin from './pages/SysAdmin.jsx'

const ACTIVE_KEY = 'tact.activeCustomer'  // הלקוח שהמנהל בחר — נשמר מקומית

export default function App() {
  const [me, setMe] = useState(null)
  const [err, setErr] = useState('')
  const [view, setView] = useState('invoices')
  // למנהל: הלקוח הפעיל שנבחר במסך "בחירת לקוח" — { custname, name, accname }
  const [active, setActive] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null') } catch { return null }
  })

  useEffect(() => {
    api.me().then((m) => {
      // לקוח (לא מנהל) במסך צר — מפנים לאפליקציית המובייל (אם הוגדרה כתובת)
      const isNarrow = window.matchMedia('(max-width: 768px)').matches
      if (m && !m.is_admin && isNarrow && m.mobile_url) {
        window.location.replace(m.mobile_url)
        return
      }
      setMe(m)
    }).catch((e) => setErr(e.message))
  }, [])

  // קביעת הלקוח הפעיל מתוך מסך הבחירה — נשמר מקומית ועובר למסך החשבוניות
  function selectCustomer(c) {
    const next = { custname: c.custname, name: c.name || c.custname, accname: c.accname || '' }
    setActive(next)
    try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
    setView('invoices')
  }

  if (err) return <div className="state"><h2>שגיאה</h2><p>{err}</p></div>
  if (!me) return <div className="state"><div className="spinner" />טוען…</div>

  // הקשר הלקוח הפעיל
  let ctx
  if (me.is_admin) {
    ctx = active
      ? { custname: active.custname, accname: active.accname, display_name: active.name, ready: true }
      : { ready: false, needPick: true }
  } else if (me.customer) {
    ctx = { custname: me.customer.custname, accname: me.customer.accname, display_name: me.customer.display_name, ready: true }
  } else {
    ctx = { ready: false, notLinked: true }
  }

  return (
    <div className="tact-aurora app-shell">
      <Header me={me} view={view} setView={setView} active={active} />
      <main className="content">
        <div className="container">
          {view === 'sysadmin' && me.is_admin && (
            <SysAdmin me={me} active={active} onSelectCustomer={selectCustomer} />
          )}
          {(view === 'invoices' || view === 'ledger') && (
            <ActiveView view={view} ctx={ctx} isAdmin={me.is_admin} />
          )}
        </div>
      </main>
    </div>
  )
}

function ActiveView({ view, ctx, isAdmin }) {
  if (ctx.notLinked) {
    return (
      <div className="state">
        <h2>לא זוהה לקוח עבור המייל שלך</h2>
        <p>כתובת המייל שאיתה נכנסת אינה מופיעה (או מופיעה ביותר מלקוח אחד) בכרטיסי הלקוחות ב-Priority. פנה למנהל החשבון כדי לעדכן את המייל בכרטיס הלקוח.</p>
      </div>
    )
  }
  if (ctx.needPick) {
    return (
      <div className="state">
        <h2>לא נבחר לקוח</h2>
        <p>עבור ל"ניהול מערכת" → "בחירת לקוח", אתר לקוח לפי מייל או מספר לקוח, ולחץ "הצג נתונים עבור לקוח זה".</p>
      </div>
    )
  }
  if (view === 'invoices') return <Invoices ctx={ctx} isAdmin={isAdmin} />
  return <Ledger ctx={ctx} isAdmin={isAdmin} />
}
