// Espace client public : accès uniquement par lien personnel. Le client ne voit que son propre dossier.
const { readCrm, writeCrm, cleanCrm } = require('../server/crm.cjs')

const validToken = t => typeof t === 'string' && /^[A-Za-z0-9_-]{32}$/.test(t)

function invoicesFor(entries, crm, client) {
  return entries
    .filter(e => e.kind === 'invoice' && (e.entity || 'independent') === 'independent')
    .filter(e => crm.liens[e.id] ? crm.liens[e.id].clientId === client.id : (client.source && e.source === client.source))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(e => ({ reference: e.reference, date: e.date, amountCents: e.amountCents, payment: e.payment }))
}

function echeancesFor(crm, client, entries) {
  return (crm.echeances || []).filter(e => e.clientId === client.id)
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
    .map(e => {
      const facture = e.factureId && entries.find(x => x.id === e.factureId)
      return { label: e.label, date: e.date, montantCents: e.montantCents, statut: !facture ? 'a_venir' : facture.payment === 'paid' ? 'payee' : 'facturee' }
    })
}

// Devis montrés au client : seulement ceux envoyés ou signés (jamais les brouillons).
function devisFor(crm, client) {
  return (crm.devis || []).filter(d => d.clientId === client.id && (d.statut === 'envoye' || d.statut === 'signe'))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .map(d => ({ id: d.id, numero: d.numero, date: d.date, validite: d.validite, statut: d.statut, regime: d.regime,
      lignes: d.lignes, intro: d.intro, perimetre: d.perimetre, note: d.note, outils: d.outils,
      echeances: (crm.echeances || []).filter(e => e.devisId ? e.devisId === d.id : e.clientId === client.id).map(e => ({ label: e.label, date: e.date, montantCents: e.montantCents })) }))
}

function view(crm, client, entries) {
  return {
    client: { nom: client.nom, contact: client.contact, raisonSociale: client.raisonSociale, adresse: client.adresse, nif: client.nif, pays: client.pays, type: client.type },
    consultante: { nom: crm.emetteur?.nom || 'Amely', email: crm.emetteur?.email || '' },
    emetteur: crm.emetteur || {},
    devis: devisFor(crm, client),
    projets: crm.projets.filter(p => p.clientId === client.id && p.visibleClient).map(p => ({
      id: p.id, nom: p.nom, statut: p.statut, etape: p.etape, messageClient: p.messageClient,
      actions: p.actions.map(({ id, label, detail, groupe, pour, fait }) => ({ id, label, detail, groupe, pour, fait })),
      plan: p.plan, notes: p.notesPartagees, prochainRdv: p.prochainRdv, rythme: p.rythme,
      documents: p.documents.map(({ label, url }) => ({ label, url })),
      type: p.type, brief: p.brief, lecons: p.lecons, questions: p.questions, creneaux: p.creneaux,
    })),
    factures: invoicesFor(entries, crm, client),
    echeancier: echeancesFor(crm, client, entries),
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
    let { revision, data: crm } = await readCrm(blob)
    const client = revision !== null && crm.clients.find(c => c.portalToken === t && c.statut !== 'archive')
    if (!client) return res.status(404).json({ error: 'Espace introuvable' })

    if (req.method === 'POST') {
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return res.status(403).end()
      const projet = crm.projets.find(p => p.id === body.projetId && p.clientId === client.id && p.visibleClient)
      if (!projet) return res.status(403).json({ error: 'Projet introuvable' })
      const today = new Date().toISOString().slice(0, 10)
      const log = texte => { crm.journal = [{ date: new Date().toISOString(), texte: client.nom + ' ' + texte }, ...crm.journal].slice(0, 200) }
      const op = body.op || 'action'
      if (op === 'action') {
        const action = projet.actions.find(a => a.id === body.actionId)
        if (!action || action.pour !== 'client') return res.status(403).json({ error: 'Action non modifiable' })
        action.fait = body.fait === true
        action.faitLe = action.fait ? today : ''
        log(`a ${action.fait ? 'terminé' : 'rouvert'} « ${action.label} »`)
      } else if (op === 'brief') {
        const rep = body.reponses && typeof body.reponses === 'object' ? body.reponses : {}
        projet.brief = projet.brief.map(b => typeof rep[b.id] === 'string' ? { ...b, r: rep[b.id] } : b)
        log('a mis à jour son brief')
      } else if (op === 'lecon') {
        const l = body.lecon && typeof body.lecon === 'object' ? body.lecon : {}
        const existing = l.id && projet.lecons.find(x => x.id === l.id)
        const fields = { titre: l.titre, objectif: l.objectif, points: l.points, video: l.video, statut: l.statut === 'a_valider' ? 'a_valider' : 'brouillon' }
        if (existing) {
          if (existing.statut === 'validee') return res.status(403).json({ error: 'Leçon déjà validée' })
          Object.assign(existing, fields)
        } else projet.lecons.push({ ...fields })
        log(`a ${existing ? 'modifié' : 'ajouté'} la leçon « ${String(l.titre || '').slice(0, 80)} »`)
      } else if (op === 'question') {
        const texte = String(body.texte || '').trim()
        if (!texte) return res.status(400).json({ error: 'Question vide' })
        projet.questions.push({ date: today, texte })
        log('a posé une question')
      } else if (op === 'creneau') {
        const c = projet.creneaux.find(x => x.id === body.creneauId)
        if (!c) return res.status(404).json({ error: 'Créneau introuvable' })
        // Un seul créneau réservé par intitulé : réserver l'un libère les autres horaires de la même visio.
        const reserve = body.reserve !== false
        projet.creneaux = projet.creneaux.map(x => x.titre === c.titre ? { ...x, reserve: reserve && x.id === c.id } : x)
        log(`a ${reserve ? 'réservé' : 'libéré'} le créneau « ${c.titre} » (${c.date})`)
      } else return res.status(400).json({ error: 'Opération inconnue' })
      crm = cleanCrm(crm)
      try { await writeCrm(blob, crm, revision) }
      catch { return res.status(409).json({ error: 'Modification en cours ailleurs, recharge la page.' }) }
    }
    return res.status(200).json(view(crm, client, await loadEntries(blob)))
  } catch {
    return res.status(503).json({ error: 'Espace momentanément indisponible' })
  }
}
