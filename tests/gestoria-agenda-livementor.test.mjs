import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { parseIcal, nommerLivementor } = require('../server/agenda.cjs')

const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:a1', 'DTSTART:20261125T180000Z', 'DTEND:20261125T183000Z',
  'SUMMARY:Rendez-vous de suivi', 'LOCATION:livementor.com', 'ATTENDEE;CN=x:mailto:Stu.Artatoo76@gmail.com', 'ATTENDEE:mailto:amely.attias@gmail.com', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:a2', 'DTSTART:20261126T180000Z', 'DTEND:20261126T183000Z', 'SUMMARY:Rendez-vous de suivi', 'LOCATION:livementor.com',
  'ATTENDEE:mailto:inconnu.tattoo@gmail.com', 'ATTENDEE:mailto:amely.attias@gmail.com', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')

test('les RDV LiveMentor prennent le nom de l’apprenant, sans exposer les e-mails', () => {
  const events = parseIcal(ics, { id: 's', label: 'Mon agenda', type: 'google' }, '2026-11-20', '2026-11-30')
  nommerLivementor(events, [{ id: 'stuart', nom: 'Stuart Maljean', email: 'stu.artatoo76@gmail.com' }])
  assert.equal(events[0].title, 'Stuart Maljean · Rendez-vous de suivi')
  assert.equal(events[0].apprenantId, 'stuart')
  assert.match(events[1].title, /inconnu\.tattoo \(à relier à une fiche\)$/)
  assert.ok(events.every(e => !('invites' in e)))
})
