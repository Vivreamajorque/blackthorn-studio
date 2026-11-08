const calendar = {
  2025: ['2025-04-21', '2025-07-21', '2025-10-20'],
  2026: ['2026-04-20', '2026-07-20', '2026-10-20'],
}

export function filingDeadline(year, quarter, model) {
  if (quarter < 4) return { date: calendar[year][quarter - 1], indicative: false }
  const lateJanuary = ['303', '130'].includes(model)
  if (year === 2025) return { date: lateJanuary ? '2026-01-30' : '2026-01-20', indicative: false }
  return lateJanuary
    ? { date: '2027-02-01', indicative: model !== '303' }
    : { date: '2027-01-20', indicative: true }
}

export function todayInSpain(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const get = name => parts.find(part => part.type === name).value
  return [get('year'), get('month'), get('day')].join('-')
}

export function daysUntil(date, today) {
  return (Date.parse(date) - Date.parse(today)) / 86400000
}

export function formatDate(date) {
  return date.split('-').reverse().join('/')
}
