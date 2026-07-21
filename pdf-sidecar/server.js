// שירות PDF — מפיק מסמך חשבונית מ-Priority דרך ה-Web SDK (procedure WWWSHOWAIV),
// בדיוק כמו "הדפסה והצגה" במסך. נשלף טרי בכל בקשה (אין שמירה). פנימי בלבד.
const express = require('express')
const priority = require('priority-web-sdk')

const CFG = {
  url: process.env.PRIORITY_SDK_URL || 'https://p.priority-connect.online/wcf/service.svc',
  tabulaini: process.env.PRIORITY_SDK_TABULAINI || 'tabz0qun.ini',
  language: parseInt(process.env.PRIORITY_SDK_LANG || '1', 10),   // 1=עברית
  profile: { company: process.env.PRIORITY_SDK_COMPANY || 'ebyael' },
  appname: process.env.PRIORITY_SDK_APPNAME || 'tact-customer',
  username: process.env.PRIORITY_SDK_TOKEN,   // טוקן REST (רישיון API)
  password: 'PAT',
  devicename: '',
}
const COMPANY = CFG.profile.company
const PORT = parseInt(process.env.PORT || '3001', 10)
// מיפוי entity → פרוצדורת הדפסה ב-Priority
const PROC_BY_SOURCE = {
  AINVOICES: process.env.PROC_AINVOICES || 'WWWSHOWAIV',
  EINVOICES: process.env.PROC_EINVOICES || 'WWWSHOWEIV',
  CINVOICES: process.env.PROC_CINVOICES || 'WWWSHOWCIV',
  RECEIPTS:  process.env.PROC_RECEIPTS  || 'WWWSHOWTIV',
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
        const fields = pd.input?.EditFields || []
        console.log('[inputFields] proc=%s fields=%s', procName,
          JSON.stringify(fields.map(f => ({ field: f.field, title: f.title, value: f.value }))))
        const firstField = fields[0]?.field ?? 1
        const ret = fields.map(f => ({
          field: f.field,
          op: f.field === firstField ? 0 : (f.operator || 0),
          value: f.field === firstField ? ivnum : (f.value || ''),
          op2: 0, value2: '',
        }))
        console.log('[inputFields-send] proc=%s firstField=%s value=%s', procName, firstField, ivnum)
        pd = await pd.proc.inputFields(1, { EditFields: ret })
        break
      }
      case 'client':
        pd = await pd.proc.continueProc(); break
      case 'documentOptions': {
        // פורמט מועדף: "עם תאור מוצר מורחב" (הרגיל, לא כולל מע"מ/דולר); אחרת Standard; אחרת הראשון.
        // ניתן לעקוף ב-PDF_FORMAT (התאמת מחרוזת בכותרת הפורמט).
        const f = pd.formats || []
        console.log('formats:', JSON.stringify(f.map((x, i) => ({ i, title: x.title, format: x.format }))))
        const pref = (process.env.PDF_FORMAT || '').trim()
        const fmt = (pref && f.find((x) => (x.title || '').includes(pref)))
          || f.find((x) => /(Extended Part Desc|תאור מוצר מורחב)/i.test(x.title) && !/(VAT|USD|מע|דולר)/i.test(x.title))
          || f.find((x) => /Standard Format/i.test(x.title))
          || f[0]
        console.log('chosen format:', JSON.stringify({ title: fmt.title, format: fmt.format }))
        pd = await pd.proc.documentOptions(1, fmt.format, 1); break  // pdf=1
      }
      case 'reportOptions':
        pd = await pd.proc.reportOptions(1, pd.formats[0].format); break
      case 'message':
        lastMsg = pd.message || ''
        console.log('[message] proc=%s msg=%s', procName, lastMsg)
        pd = await pd.proc.message(1); break
      case 'displayUrl': {
        const u = (pd.Urls || [])[0] || {}
        const b64 = (u.datauri || '').split(',')[1]
        if (!b64) throw new Error('no PDF datauri in result')
        return Buffer.from(b64, 'base64')
      }
      case 'end':
        throw new Error(`procedure ended without a document (proc=${procName} value=${ivnum})`)
      default:
        throw new Error('unhandled step: ' + pd.type)
    }
  }
  throw new Error('too many steps (no document)')
}

// תור — פעולת SDK אחת בכל פעם (ה-session אינו בטוח למקביליות)
// כל פעולה מוגבלת ל-50 שניות כדי שהתור לא ייתקע אם Priority לא עונה
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ])
}
function enqueue(fn, timeoutMs = 80000) {
  const run = chain.then(
    () => withTimeout(fn(), timeoutMs, 'pdf generation'),
    () => withTimeout(fn(), timeoutMs, 'pdf generation'),
  )
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

app.get('/receipt-pdf', async (req, res) => {
  const fncnum = String(req.query.fncnum || '').trim()
  if (!fncnum) return res.status(400).json({ error: 'missing fncnum' })
  try {
    const pdf = await enqueue(async () => {
      try { return await generatePdf(fncnum, PROC_RECEIPT) }
      catch (e) {
        loggedIn = false
        return await generatePdf(fncnum, PROC_RECEIPT)
      }
    }, 10000)
    res.set('Content-Type', 'application/pdf')
       .set('Content-Disposition', `inline; filename="receipt-${fncnum}.pdf"`)
       .send(pdf)
  } catch (e) {
    console.error('receipt pdf error:', fncnum, String(e && e.message || e))
    res.status(502).json({ error: String(e && e.message || e) })
  }
})

// endpoint אבחוני — מחזיר את שדות הקלט של פרוצדורה (ללא הפקת מסמך)
app.get('/debug-proc-fields', async (req, res) => {
  const proc = String(req.query.proc || 'WWWSHOWTIV').trim()
  try {
    await ensureLogin()
    const pd = await priority.procStart(proc, 'P', () => {}, COMPANY)
    if (pd.type === 'inputFields') {
      // בטל את הפרוצדורה מיד — רק מעיינים בשדות
      try { await pd.proc.cancel() } catch {}
      return res.json({ proc, type: 'inputFields', fields: pd.input?.EditFields || [] })
    }
    try { await pd.proc.cancel() } catch {}
    return res.json({ proc, type: pd.type, message: pd.message || '' })
  } catch (e) {
    return res.status(500).json({ proc, error: String(e && e.message || e) })
  }
})

if (!CFG.username) { console.error('PRIORITY_SDK_TOKEN missing'); process.exit(1) }
app.listen(PORT, () => console.log('pdf-sidecar listening on', PORT))
