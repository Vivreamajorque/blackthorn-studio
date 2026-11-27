// Propositions des agents : appliquer une proposition validée par Amely au projet du client.
// Fonction pure : prend le CRM, renvoie le CRM modifié (ou lève une erreur lisible).
const rid = p => p + '_' + Math.random().toString(36).slice(2, 14)

export const TYPE_LABEL = {
  reponse_question: 'Réponse à sa question',
  compte_rendu: 'Compte rendu partagé',
  message_client: 'Mot d’accueil de l’espace',
  creneaux: 'Créneaux de visio',
  actions: 'Actions à faire',
  etapes: 'Étapes du plan',
}

export function appliquerProposition(crm, propId, edits = {}, now = new Date().toISOString().slice(0, 16)) {
  const prop = (crm.propositions || []).find(x => x.id === propId)
  if (!prop || prop.statut !== 'a_valider') throw new Error('Cette proposition a déjà été traitée.')
  const projet = crm.projets.find(p => p.id === prop.projetId)
  if (!projet) throw new Error('Le projet n’existe plus.')
  const x = { ...prop.payload, ...edits }
  const today = now.slice(0, 10)
  const p = { ...projet }
  if (prop.type === 'reponse_question') {
    if (!p.questions.some(q => q.id === x.questionId)) throw new Error('La question n’existe plus.')
    p.questions = p.questions.map(q => q.id === x.questionId ? { ...q, reponse: x.texte, traitee: true } : q)
  } else if (prop.type === 'compte_rendu') {
    p.notesPartagees = [...(p.notesPartagees || []), { id: rid('not'), date: x.date || today, titre: x.titre, texte: x.texte }]
  } else if (prop.type === 'message_client') {
    p.messageClient = x.texte
  } else if (prop.type === 'creneaux') {
    p.creneaux = [...(p.creneaux || []), ...(x.dates || []).map(d => ({ id: rid('crn'), titre: x.titre, date: d, lien: x.lien || '', reserve: false }))]
  } else if (prop.type === 'actions') {
    p.actions = [...p.actions, ...(x.actions || []).map(a => ({ id: rid('act'), label: a.label, detail: a.detail || '', pour: a.pour || 'client', fait: false }))]
  } else if (prop.type === 'etapes') {
    p.plan = [...(p.plan || []), ...(x.plan || []).map(e => ({ id: rid('etp'), ...e }))]
  }
  return {
    ...crm,
    projets: crm.projets.map(q => q.id === p.id ? p : q),
    propositions: crm.propositions.map(q => q.id === prop.id ? { ...q, payload: x, statut: 'validee', traiteLe: now } : q),
    journal: [{ date: new Date().toISOString(), texte: 'Validé : ' + (TYPE_LABEL[prop.type] || prop.type) + ' · ' + p.nom }, ...(crm.journal || [])].slice(0, 200),
  }
}

export function refuserProposition(crm, propId, now = new Date().toISOString().slice(0, 16)) {
  return { ...crm, propositions: (crm.propositions || []).map(q => q.id === propId ? { ...q, statut: 'refusee', traiteLe: now } : q) }
}
