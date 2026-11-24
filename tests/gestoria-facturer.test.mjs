import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { matrice } from '../src/lib/gestoria-matrice.mjs'
const require = createRequire(import.meta.url)
const { cleanCrm } = require('../server/crm.cjs')

test('une échéance proche et un mois LiveMentor à facturer donnent un bouton Facturer', () => {
  const crm = cleanCrm({ clients: [{ id: 'c1', nom: 'Nisha' }, { id: 'lm', nom: 'LiveMentor', source: 'livementor' }],
    echeances: [{ id: 'e1', clientId: 'c1', label: 'Échéance 1/3', date: '2026-12-05', montantCents: 60000 }],
    livementor: { aFacturer: { mois: '2026-10', montantCents: 56070 } } })
  assert.deepEqual(crm.livementor.aFacturer, { mois: '2026-10', montantCents: 56070 })
  const m = matrice({ entries: [], crm, today: '2026-12-03' })
  const all = [...m.faire, ...m.planifier]
  const ech = all.find(i => i.id === 'auto:ech:e1')
  assert.deepEqual(ech.facturer, { echeanceId: 'e1' })
  const lm = all.find(i => i.id === 'auto:lmfact:2026-10')
  assert.equal(lm.clientId, 'lm')
  assert.equal(lm.facturer.montantCents, 56070)
  assert.match(lm.facturer.label, /octobre 2026/)
})

test('LiveMentor : rien à facturer si la facture du mois est déjà émise, ni avant le 1er du mois suivant', () => {
  const crm = cleanCrm({ clients: [{ id: 'lm', nom: 'LiveMentor', source: 'livementor' }],
    livementor: { aFacturer: { mois: '2026-10', montantCents: 56070 } } })
  const facture = { id: 'f2', kind: 'invoice', entity: 'independent', source: 'livementor', date: '2026-11-01', reference: 'LL-2026-002',
    label: 'LiveMentor · Mentorat octobre 2026', amountCents: 56070, payment: 'pending' }
  const ids = m => [...m.faire, ...m.planifier].map(i => i.id)
  assert.ok(!ids(matrice({ entries: [facture], crm, today: '2026-11-24' })).includes('auto:lmfact:2026-10'))
  const nov = cleanCrm({ ...crm, livementor: { aFacturer: { mois: '2026-11', montantCents: 51646 } } })
  assert.ok(!ids(matrice({ entries: [facture], crm: nov, today: '2026-11-24' })).includes('auto:lmfact:2026-11'))
  assert.ok(ids(matrice({ entries: [facture], crm: nov, today: '2026-12-01' })).includes('auto:lmfact:2026-11'))
})
