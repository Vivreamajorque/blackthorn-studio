// Agenda du QG : vue combinée (connectée) et flux iCal d'abonnement pour Google Agenda (lien secret).
const { requireSession, appOrigin } = require('../server/session.cjs')
const { readCrm, writeCrm } = require('../server/crm.cjs')
const { qgEvents, fetchSource, toIcs, dayAdd, nommerLivementor } = require('../server/agenda.cjs')
const { readLivementor } = require('../server/livementor.cjs')

const validDay = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d))
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())

async function entriesOf(blob) {
  try {
    const { readWorkspace } = require('./gestoria-workspace.js')
    return (await readWorkspace(blob, 'mi-gestoria/personal/v1/workspace.json')).data.entries
  } catch { return [] }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).end() }
  try {
    const blob = module.exports.blobForTests || await import('@vercel/blob')

    // Flux d'abonnement : aucun cookie, seulement le lien secret.
    if (req.query?.feed !== undefined) {
      const token = req.query.feed
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(token)) return res.status(404).end()
      const { data: crm, feedTokenSaved } = await readCrm(blob)
      if (!feedTokenSaved || crm.agenda.feedToken !== token) return res.status(404).end()
      const from = dayAdd(today(), -31), to = dayAdd(today(), 400)
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
      res.setHeader('Content-Disposition', 'inline; filename="le-qg.ics"')
      const own = (crm.agenda.importes || []).filter(e => e.source === 'Le QG' && e.debut.slice(0, 10) >= from && e.debut.slice(0, 10) <= to)
        .map(e => ({ id: 'rdv-qg-' + e.id.replace(/[^A-Za-z0-9_-]/g, ''), type: 'perso', title: e.titre, start: e.debut, end: e.fin, allDay: e.journee }))
      return res.status(200).send(toIcs([...qgEvents(crm, await entriesOf(blob), from, to), ...own]))
    }

    const user = await requireSession(req, res)
    if (!user) return
    const from = validDay(req.query?.from) ? req.query.from : dayAdd(today(), -7)
    let to = validDay(req.query?.to) ? req.query.to : dayAdd(today(), 42)
    if (to < from) return res.status(400).json({ error: 'Période invalide.' })
    if (to > dayAdd(from, 120)) to = dayAdd(from, 120)

    let { revision, data: crm, feedTokenSaved } = await readCrm(blob)
    if (!feedTokenSaved) {
      // Fixe une fois pour toutes le lien d'abonnement (sinon il changerait à chaque lecture).
      try { await writeCrm(blob, crm, revision) } catch { /* une autre fenêtre vient d'enregistrer : le lien sera fixé au prochain passage */ }
    }
    const events = qgEvents(crm, await entriesOf(blob), from, to)
    for (const e of crm.agenda.importes || []) {
      if (e.debut.slice(0, 10) > to || (e.fin || e.debut).slice(0, 10) < from) continue
      events.push({ id: 'imp-' + e.id, type: e.source === 'Le QG' ? 'perso' : 'entreprise', title: e.titre, start: e.debut, end: e.fin, allDay: e.journee, lieu: e.lieu, source: e.source })
    }
    const sources = await Promise.all(crm.agenda.sources.map(async source => {
      try {
        const list = await fetchSource(source, from, to)
        events.push(...list)
        return { id: source.id, label: source.label, ok: true, count: list.length }
      } catch {
        return { id: source.id, label: source.label, ok: false }
      }
    }))
    let apprenants = []
    try { apprenants = (await readLivementor(blob)).data.apprenants } catch { /* suivi LiveMentor illisible : titres d'origine */ }
    nommerLivementor(events, apprenants)
    events.sort((a, b) => a.start.localeCompare(b.start))
    return res.status(200).json({
      from, to, events, sources, importesMaj: crm.agenda.importesMaj || '',
      feedUrl: appOrigin().origin + '/api/gestoria-agenda?feed=' + crm.agenda.feedToken,
    })
  } catch {
    return res.status(503).json({ error: 'Agenda momentanément indisponible.' })
  }
}
