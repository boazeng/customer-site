import TactLogo from './TactLogo.jsx'
import TactIcon from './TactIcon.jsx'

// כותרת: לוגו, ניווט בטאבים, בורר לקוח (למנהל), פרטי משתמש ויציאה.
const TABS = [
  { key: 'invoices', label: 'חשבוניות', icon: 'invoices' },
  { key: 'ledger', label: 'כרטסת', icon: 'reports' },
  { key: 'service', label: 'קריאות שירות', icon: 'chat', soon: true },
]

export default function Header({ me, view, setView, customers, selected, setSelected }) {
  return (
    <header className="tact-bar topbar">
      <div className="topbar-side">
        <TactLogo word="לקוחות" size={0.95} />
        <nav className="tact-nav">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={view === t.key ? 'active' : ''}
              disabled={t.soon}
              title={t.soon ? 'בקרוב' : ''}
              onClick={() => !t.soon && setView(t.key)}
              style={t.soon ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <TactIcon name={t.icon} size={16} />
                {t.label}
                {t.soon && <span className="tact-badge tact-badge-soon">בקרוב</span>}
              </span>
            </button>
          ))}
          {me?.is_admin && (
            <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <TactIcon name="clients" size={16} /> שיוך לקוחות
              </span>
            </button>
          )}
          {me?.is_admin && (
            <button className={view === 'sysadmin' ? 'active' : ''} onClick={() => setView('sysadmin')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <TactIcon name="server" size={16} /> ניהול מערכת
              </span>
            </button>
          )}
        </nav>
      </div>

      <div className="topbar-side">
        {me?.is_admin && (view === 'invoices' || view === 'ledger') && (
          <div className="cust-picker">
            <TactIcon name="clients" size={16} />
            <select value={selected || ''} onChange={(e) => setSelected(e.target.value)}>
              <option value="">— בחר לקוח —</option>
              {customers.map((c) => (
                <option key={c.email} value={c.email}>
                  {c.display_name || c.custname} ({c.custname})
                </option>
              ))}
            </select>
          </div>
        )}
        <span className="who">
          {me?.is_admin ? 'מנהל' : 'לקוח'} · <b>{me?.name || me?.email}</b>
        </span>
        <a className="tact-btn tact-btn-ghost" style={{ padding: '8px 16px' }} href="/logout">יציאה</a>
      </div>
    </header>
  )
}
