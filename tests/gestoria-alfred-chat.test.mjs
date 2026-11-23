import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const chat = require('../api/gestoria-alfred.js')

test('historique : commence par Amely et finit par elle', () => {
  assert.equal(chat.cleanHistory([{ role: 'assistant', content: 'x' }]), null)
  const h = chat.cleanHistory([{ role: 'assistant', content: 'a' }, { role: 'user', content: 'b' }])
  assert.deepEqual(h, [{ role: 'user', content: 'b' }])
})

test('jamais d’émission ni de paiement depuis la bulle', () => {
  for (const t of ['emettre_facture', 'pointer_paiement', 'ajouter_depense', 'enregistrer_devis', 'changer_statut_devis', 'atelier_ecrire'])
    assert.ok(!chat.ALLOWED.includes(t), t)
})

test('un outil interdit demandé par le modèle est refusé, puis la réponse revient', async () => {
  let calls = 0, seen
  const fake = async body => {
    calls++
    assert.ok(!body.tools.some(t => t.name === 'emettre_facture'))
    if (calls === 1) return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'u1', name: 'emettre_facture', input: {} }] }
    seen = body.messages.at(-1).content[0]
    return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Fais-le dans le QG.' }] }
  }
  const r = await chat.converse({ agent: 'compta', messages: [{ role: 'user', content: 'émet la facture' }] }, {}, fake)
  assert.equal(r.reponse, 'Fais-le dans le QG.')
  assert.equal(seen.is_error, true)
  assert.deepEqual(r.actions, [])
})
