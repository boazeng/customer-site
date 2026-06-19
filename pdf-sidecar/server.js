// שירות PDF — מפיק מסמך חשבונית מ-Priority דרך ה-Web SDK (procedure WWWSHOWAIV),
// בדיוק כמו "הדפסה והצגה" במסך. נשלף טרי בכל בקשה (אין שמירה). פנימי בלבד.
const express = require('express')
const priority = require('priority-web-sdk')

const CFG = {
  url: process.env.PRIORITY_SDK_URL || 'https://p.priority-connect.online/wcf/service.svc',
  tabulaini: process.env.PRIORITY_SDK_TABULAINI || 'tabz0qun.ini',
  language: parseInt(process.env.PRIORITY_SDK_LANG || '2', 10),
  profile: { company: process.env.PRIORITY_SDK_COMPANY || 'ebyael' },
  appname: process.env.PRIORITY_SDK_APPNAME || 'tact-customer',
  username: process.env.PRIORITY_SDK_TOKEN,   // טוקן REST (רישיון API)
  password: 'PAT',
  devicename: '',
}
const COMPANY = CFG.profile.company
const PORT = parseInt(process.env.PORT || '3001', 10)
// מיפוי סוג חשבונית (entity) → פרוצדורת הדפסה ב-Priority (WWWSHOW<אות>IV)
//   A=חשבונית מס · E=חשבונית מס קבלה · C=חשבונית לקוח מרכזת/זיכוי
const PROC_BY_SOURCE = {
  AINVOICES: process.env.PROC_AINVOICES || 'WWWSHOWAIV',
  EINVOICES: process.env.PROC_EINVOICES || 'WWWSHOWEIV',
  CINVOICES: process.env.PROC_CINVOICES || 'WWWSHOWCIV',
}

let loggedIn = false
let chain = Promise.resolve()   // serialize SDK access (session יחיד)

async function ensureLogin() {
  if (loggedIn) return
  await priority.login(CFG)
  loggedIn = true
  console.log('SDK login OK')
}

async function generatePdf(ivnum, procName) {
  await ensureLogin()
  let pd = await priority.procStart(procName, 'P', () => {}, COMPANY)
  let inputCount = 0, lastMsg = ''
  for (let i = 0; i < 20; i++) {
    switch (pd.type) {
      case 'inputFields': {
        if (++inputCount > 1) throw new Error('invoice rejected: ' + (lastMsg || 'not found'))
        const ret = pd.input.EditFields.map(f => ({
          field: f.field,
          op: f.field === 1 ? 0 : (f.operator || 0),       // 0 = equals (Invoice)
          value: f.field === 1 ? ivnum : (f.value || ''),  // שאר השדות — ערך ברירת מחדל
          op2: 0, value2: '',
        }))
        pd = await pd.proc.inputFields(1, { EditFields: ret })
        break
      }
      case 'client':
        pd = await pd.proc.continueProc(); break
      case 'documentOptions': {
        const fmt = (pd.formats || []).find(f => /Standard Format/i.test(f.title)) || pd.formats[0]
        pd = await pd.proc.documentOptions(1, fmt.format, 1); break  // pdf=1
      }
      case 'reportOptions':
        pd = await pd.proc.reportOptions(1, pd.formats[0].format); break
      case 'message':
        lastMsg = pd.message || ''
        pd = await pd.proc.message(1); break
      case 'displayUrl': {
        const u = (pd.Urls || [])[0] || {}
        const b64 = (u.datauri || '').split(',')[1]
        if (!b64) throw new Error('no PDF datauri in result')
        return Buffer.from(b64, 'base64')
      }
      case 'end':
        throw new Error('procedure ended without a document')
      default:
        throw new Error('unhandled step: ' + pd.type)
    }
  }
  throw new Error('too many steps (no document)')
}

// תור — פעולת SDK אחת בכל פעם (ה-session אינו בטוח למקביליות)
function enqueue(fn) {
  const run = chain.then(fn, fn)
  chain = run.then(() => {}, () => {})
  return run
}

const app = express()
app.get('/healthz', (req, res) => res.json({ ok: true, loggedIn }))

app.get('/invoice-pdf', async (req, res) => {
  const ivnum = String(req.query.ivnum || '').trim()
  const source = String(req.query.source || 'AINVOICES').trim()
  const proc = PROC_BY_SOURCE[source] || 'WWWSHOWAIV'
  if (!ivnum) return res.status(400).json({ error: 'missing ivnum' })
  try {
    const pdf = await enqueue(async () => {
      try { return await generatePdf(ivnum, proc) }
      catch (e) {
        // ייתכן session פג — נאפס ונ​נסה פעם נוספת
        loggedIn = false
        return await generatePdf(ivnum, proc)
      }
    })
    res.set('Content-Type', 'application/pdf')
       .set('Content-Disposition', `inline; filename="invoice-${ivnum}.pdf"`)
       .send(pdf)
  } catch (e) {
    console.error('pdf error:', ivnum, String(e && e.message || e))
    res.status(502).json({ error: String(e && e.message || e) })
  }
})

if (!CFG.username) { console.error('PRIORITY_SDK_TOKEN missing'); process.exit(1) }
app.listen(PORT, () => console.log('pdf-sidecar listening on', PORT))
