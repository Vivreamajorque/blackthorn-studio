import { daysUntil, filingDeadline } from './gestoria-calendar.mjs'

export const isComplete = status => ['complete', 'not_applicable'].includes(status)
const isFilingOpen = status => !['filed', 'not_applicable'].includes(status)
const isFilingFlagged = status => ['missing', 'to_prepare'].includes(status)

export function dossierFor(data, entity, year, tasks, filings) {
  const record = data.records[entity.id + ':' + year] || { tasks: {}, filings: {}, notices: [] }
  return {
    ...entity,
    record,
    tasks: tasks.filter(task => !task.entity || task.entity === entity.id)
      .map(task => ({ ...task, status: record.tasks[task.id] || 'unknown' })),
    filings: filings.map(filing => ({
      ...filing,
      ...filingDeadline(year, filing.quarter, filing.model),
      status: record.filings[filing.key] || 'unknown',
    })),
  }
}

export function overviewAgenda(dossiers, today) {
  const priorities = []
  const upcoming = []
  const track = item => {
    if (!item.date || item.days < 0 || item.days <= 7) priorities.push(item)
    if (item.date && item.days >= 0) upcoming.push(item)
  }
  for (const dossier of dossiers) {
    const entity = dossier.id
    for (const notice of dossier.record.notices) {
      if (notice.done) continue
      track({
        ...notice, key: entity + ':notice:' + notice.id, entity, entityName: dossier.name,
        tab: 'guide', kind: 'notice', days: notice.date ? daysUntil(notice.date, today) : null,
      })
    }
    for (const filing of dossier.filings) {
      if (!isFilingOpen(filing.status)) continue
      const item = {
        ...filing, key: entity + ':filing:' + filing.key, entity, entityName: dossier.name,
        tab: 'tasks', kind: 'filing', days: daysUntil(filing.date, today),
      }
      if (isFilingFlagged(filing.status)) track(item)
      else if (item.days >= 0) upcoming.push(item)
    }
    for (const task of dossier.tasks) {
      if (task.status !== 'blocked') continue
      priorities.push({
        ...task, key: entity + ':task:' + task.id, entity, entityName: dossier.name,
        tab: 'tasks', kind: 'task', date: '', days: null,
      })
    }
  }
  priorities.sort((a, b) => (a.days ?? -0.5) - (b.days ?? -0.5))
  upcoming.sort((a, b) => a.date.localeCompare(b.date) ||
    Number(a.status === 'unknown') - Number(b.status === 'unknown'))
  return { priorities, upcoming }
}

export function ledgerSummary(rows, year, studio) {
  const months = Array.from({ length: 12 }, () => ({ income: 0, expenses: 0 }))
  let pending = 0
  for (const row of rows) {
    if (!row.date.startsWith(year + '-')) continue
    const month = months[Number(row.date.slice(5, 7)) - 1]
    if (!month) continue
    const cents = studio ? Math.round(row.amount * 100) : row.amountCents
    if (row.kind === 'expense') month.expenses += cents
    else {
      month.income += cents
      if (!studio && row.payment !== 'paid') pending++
    }
  }
  return {
    months,
    income: months.reduce((sum, month) => sum + month.income, 0),
    expenses: months.reduce((sum, month) => sum + month.expenses, 0),
    pending,
  }
}
