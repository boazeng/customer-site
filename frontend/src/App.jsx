import { useEffect, useState } from 'react'
import { api } from './api.js'
import Header from './components/Header.jsx'
import Invoices from './pages/Invoices.jsx'
import Ledger from './pages/Ledger.jsx'
import Admin from './pages/Admin.jsx'

export default function App() {
  const [me, setMe] = useState(null)
  const [err, setErr] = useState('')
  const [view, setView] = useState('invoices')
  const [links, setLinks] = useState([])      // למנהל: רשימת השיוכים
  const [selected, setSelected] = useState('') // למנהל: אימייל השיוך הנבחר

  useEffect(() => {
    api.me().then(setMe).catch((e) => setErr(e.message))
  }, [])

  useEffect(() => {
    if (me?.is_admin) {
      api.adminLinks().then((d) => {
        setLinks(d.links)
        if (!selected && d.links.length) setSelected(d.links[0].email)
      }).catch(() => {})
    }
  }, [me])

  if (err) return <div className="state"><h2>שגיאה</h2><p>{err}</p></div>
  if (!me) return <div className="state"><div className="spinner" />טוען…</div>

  // הקשר הלקוח הפעיל
  let ctx
  if (me.is_admin) {
    const link = links.find((l) => l.email === selected)
    ctx = link
      ? { custname: link.custname, accname: link.accname, display_name: link.display_name || link.custname, ready: true }
      : { ready: false, needPick: true }
  } else if (me.customer) {
    ctx = { custname: me.customer.custname, accname: me.customer.accname, display_name: me.customer.display_name, ready: true }
  } else {
    ctx = { ready: false, notLinked: true }
  }

  return (
    <div className="tact-aurora app-shell">
      <Header
        me={me} view={view} setView={setView}
        customers={links} selected={selected} setSelected={setSelected}
      />
      <main className="content">
        <div className="container">
          {view === 'admin' && me.is_admin && (
            <Admin links={links} reload={() => api.adminLinks().then((d) => setLinks(d.links))} />
          )}
          {view !== 'admin' && <ActiveView view={view} ctx={ctx} isAdmin={me.is_admin} />}
        </div>
      </main>
    </div>
  )
}

function ActiveView({ view, ctx, isAdmin }) {
  if (ctx.notLinked) {
    return (
      <div className="state">
        <h2>החשבון שלך עדיין לא חובר</h2>
        <p>פנה למנהל החשבון כדי לשייך את כתובת המייל שלך ללקוח במערכת.</p>
      </div>
    )
  }
  if (ctx.needPick) {
    return (
      <div className="state">
        <h2>בחר לקוח</h2>
        <p>בחר לקוח מהרשימה בראש העמוד כדי לצפות בנתונים. ניתן להוסיף לקוחות במסך הניהול.</p>
      </div>
    )
  }
  if (view === 'invoices') return <Invoices ctx={ctx} isAdmin={isAdmin} />
  return <Ledger ctx={ctx} isAdmin={isAdmin} />
}
