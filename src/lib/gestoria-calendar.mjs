const calendar = {
  2025: ['2025-04-21', '2025-07-21', '2025-10-20'],
  2026: ['2026-04-20', '2026-07-20', '2026-10-20'],
}

export function filingDeadline(year, quarter, model) {
  if (quarter < 4 && calendar[year]) return { date: calendar[year][quarter - 1], indicative: false }
  if (quarter < 4) return { date: businessDay(year, quarter * 3, 20), indicative: true }
  const lateJanuary = ['303', '130', '349', '390'].includes(model)
  if (year === 2025) return { date: lateJanuary ? '2026-01-30' : '2026-01-20', indicative: false }
  return lateJanuary
    ? { date: businessDay(year + 1, 0, 30), indicative: year !== 2026 || model !== '303' }
    : { date: businessDay(year + 1, 0, 20), indicative: true }
}

function businessDay(year, month, day) {
  const date = new Date(Date.UTC(year, month, day))
  const weekday = date.getUTCDay()
  date.setUTCDate(day + (weekday === 0 ? 1 : weekday === 6 ? 2 : 0))
  return date.toISOString().slice(0, 10)
}

export function monthEnd(year, month) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

export function trackedFilingDeadline(year, filing) {
  if (filing.model === '100') {
    return year === 2025 ? { date: '2026-06-30', indicative: false } : { date: '', indicative: true }
  }
  if (filing.model === 'RETA') {
    const day = new Date(Date.UTC(year, filing.month, 0))
    const weekday = day.getUTCDay()
    day.setUTCDate(day.getUTCDate() - (weekday === 0 ? 2 : weekday === 6 ? 1 : 0))
    return { date: day.toISOString().slice(0, 10), indicative: true }
  }
  return filingDeadline(year, filing.quarter || 4, filing.model)
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

export function inActivityYear(date, year, startDate) {
  return date.startsWith(year + '-') && (!startDate || date >= startDate)
}
