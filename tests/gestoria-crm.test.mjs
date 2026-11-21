import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { cleanCrm, seedCrm } = require('../server/crm.cjs')
const { validEntry } = require('../api/gestoria-workspace.js')

test('le dossier clients de départ contient les 4 clients et leurs projets', () => {
  const crm = seedCrm()
  assert.equal(crm.clients.length, 4)
  assert.ok(crm.projets.every(p => crm.clients.some(c => c.id === p.clientId)))
  assert.ok(crm.clients.every(c => /^[A-Za-z0-9_-]{32}$/.test(c.portalToken)))
  assert.equal(crm.clients.find(c => c.nom === 'Decathlon').source, 'malt')
})

test('le nettoyage écarte les champs inconnus, les liens non https et les projets orphelins', () => {
  const crm = cleanCrm({
    clients: [{ id: 'cli_a', nom: 'A', pirate: 'x', portalToken: '' }],
    projets: [
      { id: 'prj_1', clientId: 'cli_a', nom: 'P', documents: [{ label: 'ok', url: 'https://drive.google.com/x' }, { label: 'ko', url: 'javascript:alert(1)' }] },
      { id: 'prj_2', clientId: 'cli_inconnu', nom: 'Orphelin' },
    ],
    liens: { inv_1: { clientId: 'cli_a', projetId: 'prj_1' }, inv_2: { clientId: 'cli_inconnu' } },
  })
  assert.equal(crm.clients[0].pirate, undefined)
  assert.equal(crm.clients[0].portalToken.length, 32, 'un lien vide est remplacé par un nouveau lien')
  assert.equal(crm.projets.length, 1)
  assert.deepEqual(crm.projets[0].documents.map(d => d.label), ['ok'])
  assert.deepEqual(Object.keys(crm.liens), ['inv_1'])
})

test('une facture créée depuis une fiche client est acceptée par le registre fiscal', () => {
  const base = { id: 'inv_abc123', kind: 'invoice', date: '2026-11-21', label: 'Nisha · Première formation', reference: 'A-2026-001',
    payment: 'pending', source: 'direct', taxAmountCents: 77500, expectedPaymentDate: '2026-12-06' }
  assert.ok(validEntry({ ...base, amountCents: 93775, vat: { category: 'sale_es', date: '2026-11-21', baseCents: 77500, quotaCents: 16275, deductibleCents: 0, rate: 21 } }))
  assert.ok(validEntry({ ...base, amountCents: 82150, withholdingCents: 11625, vat: { category: 'sale_es', date: '2026-11-21', baseCents: 77500, quotaCents: 16275, deductibleCents: 0, rate: 21 } }))
  assert.ok(validEntry({ ...base, source: 'malt', amountCents: 77500, vat: { category: 'sale_eu', date: '2026-11-21', baseCents: 77500, quotaCents: 0, deductibleCents: 0, country: 'FR' } }))
  assert.ok(validEntry({ ...base, amountCents: 77500, vat: { category: 'sale_other', date: '2026-11-21', baseCents: 77500, quotaCents: 0, deductibleCents: 0 } }))
  const { expectedPaymentDate, ...rest } = base
  assert.ok(validEntry({ ...rest, amountCents: 93775, payment: 'paid', paymentDate: '2026-11-25' }), 'pointage payé valide')
})
