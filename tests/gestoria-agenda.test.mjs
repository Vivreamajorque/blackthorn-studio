import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { seedCrm, cleanCrm, CRM_PATH } = require('../server/crm.cjs')
const { qgEvents, parseIcal, toIcs } = require('../server/agenda.cjs')
const agenda = require('../api/gestoria-agenda.js')

function fakeBlob(files) {
  let n = 0
  const store = new Map(Object.entries(files).map(([k, v]) => [k, { body: JSON.stringify(v), etag: 'e' + (n++) }]))
  return { store, BlobPreconditionFailedError: class extends Error {},
    async get(p) { const f = store.get(p); return f && { stream: new Response(f.body).body, blob: { url: p, etag: f.etag } } },
    async head(u) { return { etag: store.get(u).etag } },
    async put(p, body) { const etag = 'e' + (n++); store.set(p, { body, etag }); return { etag } } }
}
const call = req => new Promise(resolve => {
  const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v }, status(c) { this.statusCode = c; return this },
    send(b) { resolve({ status: this.statusCode, body: b, headers: this.headers }) }, json(d) { resolve({ status: this.statusCode, data: d }) }, end() { resolve({ status: this.statusCode }) } }
  agenda({ method: 'GET', headers: {}, ...req }, res)
})

test('les adresses iCal non autorisées sont écartées', () => {
  const c = cleanCrm({ agenda: { sources: [{ url: 'https://evil.example/cal.ics' }, { url: 'http://calendar.google.com/x' }, { url: 'https://calendar.google.com/calendar/ical/a/private-b/basic.ics' }] } })
  assert.equal(c.agenda.sources.length, 1)
})

test('événements du QG : échéances, rendez-vous, relances, paiements attendus', () => {
  const crm = seedCrm()
  const nisha = crm.clients.find(c => c.nom === 'Nisha')
  crm.projets[0].prochainRdv = '2026-11-25T20:00'
  crm.prospects = [{ id: 'pro_1', nom: 'Laura', statut: 'rdv', relance: '2026-11-26', valeurCents: 0 }]
  crm.echeances = [{ id: 'ech_1', clientId: nisha.id, label: 'Acompte', date: '2026-12-01', montantCents: 50000, factureId: '' }]
  const entries = [{ id: 'inv_1', kind: 'invoice', reference: 'A-2026-001', payment: 'pending', expectedPaymentDate: '2026-11-30', amountCents: 1 }]
  const ev = qgEvents(crm, entries, '2026-11-20', '2027-02-01')
  const titles = ev.map(e => e.title)
  assert.ok(titles.some(t => t.startsWith('Rendez-vous Nisha')))
  assert.ok(titles.includes('Relancer Laura'))
  assert.ok(titles.some(t => t.includes('A-2026-001')))
  assert.ok(titles.some(t => t.startsWith('À facturer · Nisha')))
  assert.ok(ev.some(e => e.start === '2027-01-30' && e.type === 'compta'))
  const ics = toIcs(ev)
  assert.match(ics, /BEGIN:VCALENDAR[\s\S]*DTSTART;TZID=Europe\/Madrid:20261125T200000/)
})

test('flux d’abonnement : seulement avec le bon lien, une fois le lien enregistré', async () => {
  const crm = seedCrm()
  agenda.blobForTests = fakeBlob({})
  let r = await call({ query: { feed: crm.agenda.feedToken } })
  assert.equal(r.status, 404, 'rien tant que les fiches ne sont pas enregistrées')
  agenda.blobForTests = fakeBlob({ [CRM_PATH]: crm })
  r = await call({ query: { feed: 'x'.repeat(32) } })
  assert.equal(r.status, 404)
  r = await call({ query: { feed: crm.agenda.feedToken } })
  assert.equal(r.status, 200)
  assert.match(r.headers['Content-Type'], /text\/calendar/)
  assert.match(r.body, /X-WR-CALNAME:Le QG/)
})

test('agenda Google : récurrences, exceptions, LiveMentor reconnu', () => {
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:a', 'SUMMARY:Visio LiveMentor', 'DTSTART:20261103T090000Z', 'DTEND:20261103T100000Z',
    'RRULE:FREQ=WEEKLY;COUNT=6', 'EXDATE:20261124T090000Z', 'END:VEVENT', 'BEGIN:VEVENT', 'UID:b', 'SUMMARY:Annulé', 'STATUS:CANCELLED', 'DTSTART:20261125T090000Z', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
  const ev = parseIcal(ics, { id: 's', label: 'Pro', type: 'google' }, '2026-11-20', '2026-12-31')
  assert.deepEqual(ev.map(e => e.start), ['2026-12-01T10:00', '2026-12-08T10:00'])
  assert.ok(ev.every(e => e.type === 'livementor'))
})
