// Matrice d'Eisenhower du QG : ce qui remonte tout seul (factures, échéances, clients, messages…)
// + les tâches ajoutées par Amely ou par Alfred. Utilisée par l'accueil et par le connecteur Claude.

export const QUADRANTS = [
  { id: 'faire', titre: 'À faire maintenant', sous: 'Urgent et important' },
  { id: 'planifier', titre: 'À planifier', sous: 'Important, pas urgent' },
  { id: 'deleguer', titre: 'À confier', sous: 'Urgent, pas important · un agent s’en charge' },
  { id: 'plus_tard', titre: 'Plus tard', sous: 'Ni urgent ni important' },
]

export const AGENTS = [
  { id: 'alfred', nom: 'Alfred', role: 'Majordome et chef de cabinet', mission: 'Reçoit tout ce que tu lui donnes, le classe, remplit ta matrice et te donne ta priorité du jour.' },
  { id: 'courrier', nom: 'Courrier', role: 'Tri des mails', mission: 'Trie ta boîte pro, résume et prépare des brouillons. N’envoie jamais rien seul.' },
  { id: 'clients', nom: 'Clients & projets', role: 'Suivi des clients', mission: 'Surveille les espaces partagés, prépare les comptes rendus, signale un client qui bloque.' },
  { id: 'commercial', nom: 'Prospection', role: 'Nouvelles pistes et relances', mission: 'Cherche des pistes qui collent à ton offre, prépare les premiers messages et les relances.' },
  { id: 'communication', nom: 'Communication', role: 'Contenus et canaux', mission: 'Prépare tes contenus de la semaine et te rappelle tes actions Instagram, LinkedIn, page web.' },
  { id: 'compta', nom: 'Compta & fiscal', role: 'Factures et déclarations', mission: 'Factures, dépenses, 303/130, alertes de trésorerie.' },
  { id: 'plateformes', nom: 'Plateformes', role: 'LiveMentor et Malt', mission: 'Relève les gains LiveMentor et les messages Malt/LiveMentor.' },
]

const DAY = 864e5
const days = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / DAY)
const addDays = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * DAY).toISOString().slice(0, 10)
const fr = d => d ? new Date(d.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''
const eur = c => ((c || 0) / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

function taxDates(y) {
  return [[y + '-01-30', 'T4 ' + (y - 1)], [y + '-04-20', 'T1'], [y + '-07-20', 'T2'], [y + '-10-20', 'T3']]
    .map(([date, t]) => ({ date, label: 'Déclarations 303 et 130 · ' + t }))
}

// Éléments automatiques. Chacun a un id stable pour pouvoir être déplacé ou écarté.
export function autoItems({ entries = [], crm, today }) {
  const out = []
  const add = (id, quadrant, titre, extra = {}) => out.push({ id: 'auto:' + id, auto: true, quadrant, titre, ...extra })
  const client = id => crm.clients.find(c => c.id === id)
  const mine = entries.filter(e => (e.entity || 'independent') === 'independent')

  for (const e of mine.filter(e => e.kind === 'invoice' && e.payment !== 'paid')) {
    if (e.expectedPaymentDate && e.expectedPaymentDate < today) add('retard:' + e.id, 'faire', 'Relancer le paiement de la facture ' + e.reference, { detail: eur(e.amountCents) + ' · attendu le ' + fr(e.expectedPaymentDate), domaine: 'compta', go: 'clients' })
  }
  const y = Number(today.slice(0, 4))
  for (const t of [...taxDates(y), ...taxDates(y + 1)]) {
    const n = days(today, t.date)
    if (n >= 0 && n <= 30) add('tax:' + t.date, n <= 10 ? 'faire' : 'planifier', t.label, { detail: n === 0 ? 'aujourd’hui' : 'dans ' + n + ' jours · ' + fr(t.date), echeance: t.date, domaine: 'compta', go: 'tasks' })
  }
  if (Number(today.slice(8, 10)) <= 5) {
    const prev = new Date(Date.parse(today.slice(0, 7) + '-01T12:00:00Z') - DAY).toISOString().slice(0, 7)
    const done = mine.some(e => e.kind === 'invoice' && e.source === 'livementor' && e.date >= today.slice(0, 7) + '-01') ||
      mine.some(e => e.kind === 'invoice' && /livementor/i.test(e.label || '') && e.date.slice(0, 7) === today.slice(0, 7))
    if (!done) add('lm:' + prev, 'faire', 'Envoyer ta facture LiveMentor de ' + MOIS[Number(prev.slice(5, 7)) - 1], { detail: 'Le montant est sur ton tableau de facturation LiveMentor.', domaine: 'compta', go: 'clients' })
  }
  for (const e of (crm.echeances || []).filter(e => !e.factureId && e.date)) {
    const n = days(today, e.date), c = client(e.clientId)
    if (n <= 3) add('ech:' + e.id, 'faire', 'Facturer ' + (c ? c.nom : '') + ' · ' + e.label, { detail: eur(e.montantCents) + ' · prévu le ' + fr(e.date), domaine: 'compta', go: 'clients', clientId: e.clientId })
    else if (n <= 14) add('ech:' + e.id, 'planifier', 'Facturer ' + (c ? c.nom : '') + ' · ' + e.label, { detail: eur(e.montantCents) + ' · le ' + fr(e.date), echeance: e.date, domaine: 'compta', go: 'clients', clientId: e.clientId })
  }
  for (const p of crm.projets) {
    const c = client(p.clientId)
    if (!c || c.statut === 'archive') continue
    if (p.prochainRdv) {
      const n = days(today, p.prochainRdv.slice(0, 10))
      if (n >= 0 && n <= 1) add('rdv:' + p.id + ':' + p.prochainRdv, 'faire', 'Préparer le rendez-vous ' + c.nom, { detail: (n === 0 ? 'aujourd’hui' : 'demain') + (p.prochainRdv.length > 10 ? ' à ' + p.prochainRdv.slice(11, 16) : '') + ' · ' + p.nom, domaine: 'clients', go: 'clients', clientId: c.id })
    }
    const q = (p.questions || []).filter(q => !q.traitee).length
    const l = (p.lecons || []).filter(l => l.statut === 'a_valider').length
    if (q || l) add('espace:' + p.id + ':' + q + ':' + l, 'faire', c.nom + ' attend ta réponse', { detail: [q && q + ' question' + (q > 1 ? 's' : ''), l && l + ' leçon' + (l > 1 ? 's' : '') + ' à relire'].filter(Boolean).join(' · ') + ' · ' + p.nom, domaine: 'clients', go: 'clients', clientId: c.id })
    if (['en_cours', 'a_demarrer'].includes(p.statut)) {
      const a = p.actions.find(a => a.pour === 'amely' && !a.fait)
      if (a) add('act:' + a.id, 'planifier', a.label, { detail: c.nom + ' · ' + p.nom, domaine: 'clients', go: 'clients', clientId: c.id })
    } else if (p.statut === 'en_pause') {
      const a = p.actions.find(a => a.pour === 'amely' && !a.fait)
      if (a) add('act:' + a.id, 'plus_tard', a.label, { detail: c.nom + ' · ' + p.nom + ' (en pause)', domaine: 'clients', go: 'clients', clientId: c.id })
    }
  }
  for (const d of crm.devis || []) {
    const c = client(d.clientId)
    if (!c) continue
    if (d.statut === 'brouillon') add('devis:' + d.id, 'planifier', 'Finaliser et envoyer le devis ' + d.numero, { detail: c.nom, domaine: 'commercial', go: 'clients', clientId: c.id })
    if (d.statut === 'envoye' && d.date && days(d.date, today) >= 7) add('devisrel:' + d.id, 'deleguer', 'Relancer ' + c.nom + ' sur le devis ' + d.numero, { detail: 'envoyé le ' + fr(d.date), domaine: 'commercial', go: 'clients', clientId: c.id, agent: 'commercial' })
  }
  for (const p of crm.prospects.filter(p => !['gagne', 'perdu'].includes(p.statut))) {
    if (p.relance && p.relance <= addDays(today, 1)) add('rel:' + p.id + ':' + p.relance, 'deleguer', 'Relancer ' + p.nom + (p.entreprise ? ' (' + p.entreprise + ')' : ''), { detail: p.relance < today ? 'prévu le ' + fr(p.relance) : p.relance === today ? 'aujourd’hui' : 'demain', domaine: 'commercial', go: 'prospection', agent: 'commercial' })
    else if (!p.relance && p.statut === 'nouveau') add('pro:' + p.id, 'plus_tard', 'Qualifier la piste ' + p.nom, { detail: p.entreprise || p.source || '', domaine: 'commercial', go: 'prospection' })
  }
  for (const [key, name] of [['instagram', 'Instagram'], ['linkedin', 'LinkedIn'], ['indeed', 'Indeed'], ['site', 'Page web']]) {
    const c = (crm.canaux || {})[key]
    if (c && c.action) add('canal:' + key + ':' + (c.date || ''), c.date && c.date <= today ? 'planifier' : 'plus_tard', name + ' · ' + c.action, { detail: c.date ? 'prévu le ' + fr(c.date) : '', domaine: 'communication', go: 'prospection', agent: 'communication' })
  }
  for (const m of (crm.messages?.items || []).filter(m => !m.vu)) {
    const important = m.source === 'client' || m.source === 'malt' || !!m.clientId
    add('msg:' + m.id, important ? 'faire' : 'deleguer', 'Répondre · ' + m.sujet, { detail: m.de + (m.date ? ' · ' + fr(m.date) : ''), domaine: 'messages', lien: m.lien, agent: important ? undefined : 'courrier' })
  }
  return out
}

// Matrice complète : automatiques (moins les écartés, avec les déplacements) + tâches.
export function matrice({ entries, crm, today }) {
  const al = crm.alfred || {}
  const items = autoItems({ entries, crm, today })
    .filter(i => !al.ecartes?.[i.id])
    .map(i => al.deplaces?.[i.id] ? { ...i, quadrant: al.deplaces[i.id] } : i)
  for (const t of crm.taches || []) if (!t.fait) {
    const late = t.echeance && t.echeance <= today && t.quadrant === 'planifier'
    items.push({ ...t, quadrant: late ? 'faire' : t.quadrant, detail: [t.detail, t.echeance && 'pour le ' + fr(t.echeance)].filter(Boolean).join(' · ') })
  }
  const by = Object.fromEntries(QUADRANTS.map(q => [q.id, []]))
  for (const i of items) by[i.quadrant]?.push(i)
  return by
}

export { fr as dateCourte, eur as euros }
