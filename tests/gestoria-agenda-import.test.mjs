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
