// Agenda du QG : événements tirés du QG (fiscal, rendez-vous, relances, paiements attendus)
// + calendriers Google lus par leur adresse secrète iCal, et flux iCal pour s'abonner depuis Google Agenda.
const ICAL = require('ical.js')

const TZ = 'Europe/Madrid'
const pad = n => String(n).padStart(2, '0')
const dayAdd = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }

// Heure locale de Majorque (AAAA-MM-JJTHH:MM) d'un instant.
function localStamp(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

function taxDates(year) {
  return [
    [year + '-01-30', 'T4 ' + (year - 1)], [year + '-04-20', 'T1'], [year + '-07-20', 'T2'], [year + '-10-20', 'T3'],
  ].map(([date, t]) => ({ date, label: 'Dépôt ' + t + ' · modelos 303 et 130' }))
}

// Événements produits par le QG. start/end : 'AAAA-MM-JJ' (journée) ou 'AAAA-MM-JJTHH:MM' (heure de Majorque).
function qgEvents(crm, entries, from, to) {
  const out = []
  const inRange = d => d && d.slice(0, 10) >= from && d.slice(0, 10) <= to
  const clientName = id => (crm.clients.find(c => c.id === id) || {}).nom || ''
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)) + 1; y++) {
    for (const t of taxDates(y)) if (inRange(t.date)) out.push({ id: 'tax-' + t.date, type: 'compta', title: t.label, start: t.date, allDay: true })
  }
  for (const p of crm.projets) {
    if (p.prochainRdv && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(p.prochainRdv) && inRange(p.prochainRdv)) {
      const start = p.prochainRdv.slice(0, 16)
      const end = new Date(start + ':00Z'); end.setUTCHours(end.getUTCHours() + 1)
      out.push({ id: 'rdv-' + p.id, type: 'client', title: 'Rendez-vous ' + clientName(p.clientId) + ' · ' + p.nom, start, end: end.toISOString().slice(0, 16), allDay: false })
    }
    if (p.echeance && inRange(p.echeance) && p.statut !== 'livre') out.push({ id: 'ech-' + p.id, type: 'client', title: 'Échéance projet · ' + clientName(p.clientId) + ' · ' + p.nom, start: p.echeance, allDay: true })
  }
  for (const p of crm.prospects) {
    if (p.relance && inRange(p.relance) && !['gagne', 'perdu'].includes(p.statut)) out.push({ id: 'rel-' + p.id, type: 'prospection', title: 'Relancer ' + p.nom + (p.entreprise ? ' (' + p.entreprise + ')' : ''), start: p.relance, allDay: true })
  }
  for (const e of (crm.echeances || [])) {
    if (!e.factureId && inRange(e.date)) out.push({ id: 'pay-' + e.id, type: 'compta', title: 'À facturer · ' + clientName(e.clientId) + ' · ' + e.label, start: e.date, allDay: true })
  }
  for (const e of entries) {
    if ((e.entity || 'independent') === 'independent' && e.kind === 'invoice' && e.payment !== 'paid' && inRange(e.expectedPaymentDate)) {
      out.push({ id: 'inv-' + e.id, type: 'compta', title: 'Paiement attendu · facture ' + e.reference, start: e.expectedPaymentDate, allDay: true })
    }
  }
  return out
}

// Lecture d'un calendrier iCal (Google…) et dépliage des événements récurrents sur la période.
function parseIcal(text, source, from, to) {
  const comp = new ICAL.Component(ICAL.parse(text))
  for (const tz of comp.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(tz)
  const rangeStart = ICAL.Time.fromDateString(from)
  const rangeEnd = ICAL.Time.fromDateString(dayAdd(to, 1))
  const out = []
  const vevents = comp.getAllSubcomponents('vevent')
  const overridden = new Set(vevents.filter(v => v.hasProperty('recurrence-id')).map(v => v.getFirstPropertyValue('uid') + '|' + v.getFirstPropertyValue('recurrence-id').toString()))
  const push = (event, startTime, endTime) => {
    if (event.component.getFirstPropertyValue('status') === 'CANCELLED') return
    const allDay = startTime.isDate
    // Heure « flottante » (fuseau non décrit) : on garde l'heure telle qu'écrite ; sinon conversion vers l'heure de Majorque.
    const stamp = t => !t.zone || t.zone.tzid === 'floating' ? t.toString().slice(0, 16) : localStamp(t.toJSDate())
    const start = allDay ? startTime.toString().slice(0, 10) : stamp(startTime)
    const end = endTime ? (allDay ? endTime.toString().slice(0, 10) : stamp(endTime)) : ''
    const title = (event.summary || '(sans titre)').slice(0, 200)
    const livementor = /live\s*mentor/i.test(title + ' ' + (event.description || '') + ' ' + (event.location || ''))
    // Invités (adresses e-mail) : servent à reconnaître l'apprenant LiveMentor d'un rendez-vous. Jamais renvoyés au navigateur.
    const invites = event.component.getAllProperties('attendee').map(a => String(a.getFirstValue() || '').replace(/^mailto:/i, '').trim().toLowerCase()).filter(x => x.includes('@')).slice(0, 12)
    out.push({ id: source.id + '-' + event.uid + '-' + start, type: livementor ? 'livementor' : source.type === 'livementor' ? 'livementor' : 'google',
      title, start, end: allDay && end ? dayAdd(end, -1) : end, allDay, lieu: (event.location || '').slice(0, 200), source: source.label, invites })
  }
  for (const v of vevents) {
    const event = new ICAL.Event(v)
    if (v.hasProperty('recurrence-id')) {
      if (event.startDate.compare(rangeEnd) < 0 && event.endDate.compare(rangeStart) > 0) push(event, event.startDate, event.endDate)
      continue
    }
    if (event.isRecurring()) {
      const it = event.iterator()
      let next, guard = 0
      while ((next = it.next()) && guard++ < 2000) {
        if (next.compare(rangeEnd) >= 0) break
        if (overridden.has(event.uid + '|' + next.toString())) continue
        const occ = event.getOccurrenceDetails(next)
        if (occ.endDate.compare(rangeStart) > 0) push(event, occ.startDate, occ.endDate)
      }
    } else if (event.startDate && event.startDate.compare(rangeEnd) < 0 && (event.endDate || event.startDate).compare(rangeStart) >= 0) {
      push(event, event.startDate, event.endDate)
    }
  }
  return out
}

const cache = new Map()
async function fetchSource(source, from, to) {
  const key = source.url
  const hit = cache.get(key)
  let text = hit && hit.at > Date.now() - 5 * 60000 ? hit.text : null
  if (!text) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch(source.url, { signal: controller.signal, redirect: 'error', headers: { Accept: 'text/calendar' } })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      text = (await res.text()).slice(0, 5_000_000)
      if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Pas un calendrier')
      cache.set(key, { at: Date.now(), text })
    } finally { clearTimeout(timer) }
  }
  return parseIcal(text, source, from, to)
}

// Flux iCal du QG, pour l'ajouter dans Google Agenda (« À partir de l'URL »).
function toIcs(events) {
  const esc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
  const fold = line => { const parts = []; let l = line; while (l.length > 74) { parts.push(l.slice(0, 74)); l = ' ' + l.slice(74) } parts.push(l); return parts.join('\r\n') }
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Le QG//Agenda//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Le QG', 'X-WR-TIMEZONE:' + TZ, 'REFRESH-INTERVAL;VALUE=DURATION:PT6H']
  for (const e of events) {
    lines.push('BEGIN:VEVENT', 'UID:' + e.id + '@le-qg', 'DTSTAMP:' + stamp, 'SUMMARY:' + esc(e.title))
    if (e.allDay) {
      lines.push('DTSTART;VALUE=DATE:' + e.start.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + dayAdd(e.start, 1).replace(/-/g, ''))
    } else {
      const f = s => s.replace(/[-:]/g, '') + '00'
      lines.push('DTSTART;TZID=' + TZ + ':' + f(e.start), 'DTEND;TZID=' + TZ + ':' + f(e.end || e.start))
    }
    lines.push('CATEGORIES:' + esc({ compta: 'Compta', client: 'Client', prospection: 'Prospection', perso: 'Rendez-vous' }[e.type] || 'QG'), 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

// Met le nom de l'apprenant LiveMentor dans le titre du rendez-vous (« Benjamin Leroy · Rendez-vous de suivi »).
const normEmail = e => String(e || '').trim().toLowerCase()
function nommerLivementor(events, apprenants) {
  const byEmail = new Map()
  for (const a of apprenants || []) for (const e of String(a.email || '').split(/[\s,;]+/)) if (e.includes('@')) byEmail.set(normEmail(e), a)
  for (const ev of events) {
    const invites = ev.invites || []
    delete ev.invites
    if (ev.type !== 'livementor' || !invites.length) continue
    const a = invites.map(e => byEmail.get(e)).find(Boolean)
    if (a) { ev.title = a.nom + ' · ' + ev.title; ev.apprenantId = a.id; continue }
    const autre = invites.find(e => !/amely\.attias@/.test(e))
    if (autre) ev.title = ev.title + ' · ' + autre.split('@')[0] + ' (à relier à une fiche)'
  }
  return events
}

module.exports = { nommerLivementor, qgEvents, parseIcal, fetchSource, toIcs, localStamp, dayAdd }
