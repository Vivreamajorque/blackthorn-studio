import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { appliquerProposition, refuserProposition } from '../src/lib/gestoria-propositions.mjs'
const require = createRequire(import.meta.url)
const { seedCrm, cleanCrm } = require('../server/crm.cjs')

function base() {
  const crm = seedCrm()
  const nisha = crm.clients.find(c => c.nom === 'Nisha')
  const p = crm.projets.find(x => x.clientId === nisha.id)
  p.questions = [{ id: 'qst_1', date: '2026-11-27', texte: 'Combien de vidéos ?', reponse: '', traitee: false }]
  crm.propositions = [
    { id: 'prp_a', agent: 'clients', type: 'reponse_question', clientId: nisha.id, projetId: p.id, titre: 'Répondre à Nisha', payload: { questionId: 'qst_1', texte: 'Cinq vidéos.' }, statut: 'a_valider' },
    { id: 'prp_b', agent: 'clients', type: 'creneaux', clientId: nisha.id, projetId: p.id, titre: 'Visio', payload: { titre: 'Visio de suivi', dates: ['2026-12-01T20:00', '2026-12-02T20:00'] }, statut: 'a_valider' },
    { id: 'prp_c', agent: 'clients', type: 'actions', clientId: nisha.id, projetId: p.id, titre: 'Actions', payload: { actions: [{ label: 'Noter les questions des parents', pour: 'client' }] }, statut: 'a_valider' },
  ]
  return { crm: cleanCrm(crm), projetId: p.id }
}

test('valider une réponse : la question est répondue avec le texte modifié par Amely', () => {
  const { crm, projetId } = base()
  const out = cleanCrm(appliquerProposition(crm, 'prp_a', { texte: 'Cinq vidéos courtes.' }))
  const q = out.projets.find(p => p.id === projetId).questions[0]
  assert.equal(q.reponse, 'Cinq vidéos courtes.'); assert.equal(q.traitee, true)
  assert.equal(out.propositions.find(p => p.id === 'prp_a').statut, 'validee')
  assert.throws(() => appliquerProposition(out, 'prp_a'), /déjà été traitée/)
})

test('valider des créneaux et des actions les publie dans le projet ; écarter ne publie rien', () => {
  const { crm, projetId } = base()
  let out = cleanCrm(appliquerProposition(crm, 'prp_b'))
  out = cleanCrm(appliquerProposition(out, 'prp_c'))
  const p = out.projets.find(x => x.id === projetId)
  assert.equal(p.creneaux.length, 2)
  assert.ok(p.actions.some(a => a.label === 'Noter les questions des parents' && a.pour === 'client' && !a.fait))
  const { crm: c2, projetId: id2 } = base()
  const r = cleanCrm(refuserProposition(c2, 'prp_b'))
  assert.equal(r.propositions.find(x => x.id === 'prp_b').statut, 'refusee')
  assert.equal(r.projets.find(x => x.id === id2).creneaux.length, 0)
})
