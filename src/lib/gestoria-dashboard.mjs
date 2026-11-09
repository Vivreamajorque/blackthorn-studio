import { daysUntil, inActivityYear, monthEnd, trackedFilingDeadline } from './gestoria-calendar.mjs'

export const isComplete = status => ['complete', 'not_applicable'].includes(status)
const isFilingOpen = status => !['filed', 'not_applicable'].includes(status)
const isFilingFlagged = status => ['missing', 'to_prepare'].includes(status)

const commonReviewModels = ['303', '130', '349', '390', '100']
export const needsFilingReview = (row, today) => row.status === 'unknown' &&
  commonReviewModels.includes(row.model) && (!row.date || row.date < today)

export function dossierFor(data, entity, year, tasks, filings) {
  const record = data.records[entity.id + ':' + year] || { tasks: {}, filings: {}, notices: [] }
  const filingDetails = record.filingDetails || {}
  return {
    ...entity,
    record,
    notices: record.notices.filter(notice => !notice.date || !entity.startDate || notice.date >= entity.startDate),
    tasks: tasks.filter(task => !task.entity || task.entity === entity.id)
      .map(task => ({ ...task, status: record.tasks[task.id] || 'unknown' })),
    filings: filings.filter(filing => !entity.startDate ||
      monthEnd(year, filing.month || (filing.quarter ? filing.quarter * 3 : 12)) >= entity.startDate).map(filing => ({
      ...filing,
      ...trackedFilingDeadline(year, filing),
      status: record.filings[filing.key] || 'unknown',
      evidence: filingDetails[filing.key],
    })),
  }
}

export function overviewAgenda(dossiers, today) {
  const priorities = []
  const upcoming = []
  const track = item => {
    if (!item.date || item.days < 0 || item.days <= 7) priorities.push(item)
    if (item.date && item.days !== null && item.days >= 0) upcoming.push(item)
  }
  for (const dossier of dossiers) {
    const entity = dossier.id
    for (const notice of dossier.notices) {
      if (notice.done) continue
      track({
        ...notice, key: entity + ':notice:' + notice.id, entity, entityName: dossier.name,
        tab: 'guide', kind: 'notice', days: notice.date ? daysUntil(notice.date, today) : null,
      })
    }
    for (const filing of dossier.filings) {
      if (!isFilingOpen(filing.status)) continue
      const reviewOnly = needsFilingReview(filing, today)
      const item = {
        ...filing, reviewOnly, key: entity + ':filing:' + filing.key, entity, entityName: dossier.name,
        tab: 'tasks', kind: filing.model === 'RETA' ? 'contribution' : 'filing',
        days: filing.date ? daysUntil(filing.date, today) : null,
      }
      if (isFilingFlagged(filing.status) || reviewOnly) track(item)
      else if (item.days !== null && item.days >= 0) upcoming.push(item)
    }
    for (const task of dossier.tasks) {
      if (task.status !== 'blocked') continue
      priorities.push({
        ...task, key: entity + ':task:' + task.id, entity, entityName: dossier.name,
        tab: 'tasks', kind: 'task', date: '', days: null,
      })
    }
  }
  priorities.sort((a, b) => Number(Boolean(a.reviewOnly)) - Number(Boolean(b.reviewOnly)) ||
    (a.days ?? -0.5) - (b.days ?? -0.5))
  upcoming.sort((a, b) => a.date.localeCompare(b.date) ||
    Number(a.status === 'unknown') - Number(b.status === 'unknown'))
  return { priorities, upcoming }
}

export function ledgerSummary(rows, year, studio, startDate) {
  const months = Array.from({ length: 12 }, () => ({ income: 0, expenses: 0 }))
  let pending = 0
  for (const row of rows) {
    if (!inActivityYear(row.date, year, startDate)) continue
    const month = months[Number(row.date.slice(5, 7)) - 1]
    if (!month) continue
    if (!studio && row.currency && row.currency !== 'EUR') continue
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
