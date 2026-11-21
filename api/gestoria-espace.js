// Espace client public : accès uniquement par lien personnel. Le client ne voit que son propre dossier.
const { readCrm, writeCrm } = require('../server/crm.cjs')

const validToken = t => typeof t === 'string' && /^[A-Za-z0-9_-]{32}$/.test(t)

function invoicesFor(entries, crm, client) {
  return entries
    .filter(e => e.kind === 'invoice' && (e.entity || 'independent') === 'independent')
    .filter(e => crm.liens[e.id] ? crm.liens[e.id].clientId === client.id : (client.source && e.source === client.source))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(e => ({ reference: e.reference, date: e.date, amountCents: e.amountCents, payment: e.payment }))
}

function view(crm, client, entries) {
  return {
    client: { nom: client.nom, contact: client.contact },
    consultante: { nom: crm.emetteur?.nom || 'Amely', email: crm.emetteur?.email || '' },
    projets: crm.projets.filter(p => p.clientId === client.id && p.visibleClient).map(p => ({
      id: p.id, nom: p.nom, statut: p.statut, etape: p.etape, messageClient: p.messageClient,
      actions: p.actions.map(({ id, label, detail, groupe, pour, fait }) => ({ id, label, detail, groupe, pour, fait })),
      plan: p.plan, notes: p.notesPartagees, prochainRdv: p.prochainRdv, rythme: p.rythme,
      documents: p.documents.map(({ label, url }) => ({ label, url })),
    })),
    factures: invoicesFor(entries, crm, client),
  }
}

async function loadEntries(blob) {
  try {
    const { readWorkspace } = require('./gestoria-workspace.js')
    const { data } = await readWorkspace(blob, 'mi-gestoria/personal/v1/workspace.json')
    return data.entries
  } catch {
    return []
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).end()
  try {
    const body = req.method === 'POST' ? (req.body || {}) : {}
    const t = req.method === 'GET' ? req.query?.t : body.t
    if (!validToken(t)) return res.status(404).json({ error: 'Espace introuvable' })
    const blob = module.exports.blobForTests || await import('@vercel/blob')
    const { revision, data: crm } = await readCrm(blob)
    const client = revision !== null && crm.clients.find(c => c.portalToken === t && c.statut !== 'archive')
    if (!client) return res.status(404).json({ error: 'Espace introuvable' })

    if (req.method === 'POST') {
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return res.status(403).end()
      const projet = crm.projets.find(p => p.id === body.projetId && p.clientId === client.id && p.visibleClient)
      const action = projet?.actions.find(a => a.id === body.actionId)
      if (!action || action.pour !== 'client') return res.status(403).json({ error: 'Action non modifiable' })
      action.fait = body.fait === true
      action.faitLe = action.fait ? new Date().toISOString().slice(0, 10) : ''
      crm.journal = [{ date: new Date().toISOString(), texte: `${client.nom} a ${action.fait ? 'terminé' : 'rouvert'} « ${action.label} »` }, ...crm.journal].slice(0, 200)
      try { await writeCrm(blob, crm, revision) }
      catch { return res.status(409).json({ error: 'Modification en cours ailleurs, recharge la page.' }) }
    }
    return res.status(200).json(view(crm, client, await loadEntries(blob)))
  } catch {
    return res.status(503).json({ error: 'Espace momentanément indisponible' })
  }
}
