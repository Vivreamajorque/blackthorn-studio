import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { cleanCrm } = require('../server/crm.cjs')

test('agenda importé : garde les événements valides, rejette le reste', () => {
  const crm = cleanCrm({ agenda: { importes: [
    { id: 'a', source: 'Decathlon', titre: 'Point com locale', debut: '2026-11-24T10:00', fin: '2026-11-24T11:00', lieu: 'Visio' },
    { titre: 'Séminaire', debut: '2026-11-26' },
    { titre: 'Sans date', debut: 'demain' },
    { titre: '', debut: '2026-11-25' },
  ], importesMaj: '2026-11-23T08:40' } })
  assert.equal(crm.agenda.importes.length, 2)
  assert.equal(crm.agenda.importes[0].journee, false)
  assert.equal(crm.agenda.importes[1].journee, true)
  assert.equal(crm.agenda.importes[1].source, 'Agenda entreprise')
  assert.equal(crm.agenda.importesMaj, '2026-11-23T08:40')
})

test('atelier : le carnet de construction est gardé et nettoyé', () => {
  const crm = cleanCrm({ clients: [{ id: 'cli_a', nom: 'A' }], projets: [{ id: 'prj_a', clientId: 'cli_a', nom: 'Outil', construction: {
    actif: true, cahier: 'Écrans…', repo: 'owner/outil', urlTest: 'http://pas-https', etapes: [{ titre: 'Catalogue', etat: 'a_tester', lienTest: 'https://test.example' }, { titre: '' }, { titre: 'X', etat: 'nimporte' }] } }] })
  const k = crm.projets[0].construction
  assert.equal(k.actif, true)
  assert.equal(k.urlTest, '')
  assert.equal(k.etapes.length, 2)
  assert.equal(k.etapes[0].etat, 'a_tester')
  assert.equal(k.etapes[1].etat, 'a_faire')
})

test('devis : nom de la personne qui accepte et lien de paiement gardés', () => {
  const crm = cleanCrm({ clients: [{ id: 'cli_a', nom: 'A' }], devis: [{ id: 'dev_a', clientId: 'cli_a', numero: 'D1', statut: 'signe', signeLe: '2026-11-23', signePar: 'Nisha', lienPaiement: 'https://buy.stripe.com/x', lignes: [{ description: 'x', quantite: 1, prixCents: 100 }] }] })
  assert.equal(crm.devis[0].signePar, 'Nisha')
  assert.equal(crm.devis[0].lienPaiement, 'https://buy.stripe.com/x')
})
