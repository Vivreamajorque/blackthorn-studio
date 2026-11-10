import { inActivityYear, monthEnd } from './gestoria-calendar.mjs'

export function contributionInputs(entries, dossier, year, today) {
  const social = entries.filter(row => row.expenseCategory === 'social' && (!row.currency || row.currency === 'EUR'))
  const manualByMonth = new Map()
  for (const row of social) {
    const period = (row.taxDate || row.date).slice(0, 7)
    const rows = manualByMonth.get(period) || []
    manualByMonth.set(period, [...rows, row])
  }

  const issued = new Map()
  for (const row of dossier.record.portalChecks?.receipts?.rows || []) {
    if (row.period?.startsWith(year + '-') && row.period.length === 7 && row.amountCents > 0 && !issued.has(row.period)) {
      issued.set(row.period, row.amountCents)
    }
  }
  const confirmedRows = []
  const months = dossier.filings.filter(row => row.model === 'RETA').map(row => {
    const period = year + '-' + String(row.month).padStart(2, '0')
    const manual = manualByMonth.get(period) || []
    const official = row.status === 'filed' && row.evidence?.amountCents > 0 ? row.evidence.amountCents : null
    const paid = manual.filter(item => item.payment === 'paid')
    const confirmed = official ?? (paid.length ? paid.reduce((sum, item) => sum + item.amountCents, 0) : null)
    if (official != null && !manual.length) {
      const taxDate = monthEnd(year, row.month)
      const paymentDate = row.evidence?.filedDate
      confirmedRows.push({
        id: 'reta:' + period, kind: 'expense', label: 'Cotisation RETA · ' + period,
        date: paymentDate || taxDate, taxDate, ...(paymentDate && { paymentDate }), payment: 'paid',
        amountCents: official, taxAmountCents: official, vat: { category: 'excluded' },
      })
    }
    return { period, month: row.month, confirmed, amount: issued.get(period) ?? row.evidence?.amountCents,
      applicable: row.status !== 'not_applicable', alreadyBooked: manual.length > 0 }
  })
  const currentPeriod = today.slice(0, 7)
  const latest = months.filter(row => row.period <= currentPeriod && (row.confirmed > 0 || row.amount > 0)).at(-1)
  const projectedRows = []
  const periods = months.map(row => {
    const projected = row.applicable && row.confirmed == null
      ? (row.amount > 0 ? row.amount : row.period >= currentPeriod ? latest?.confirmed ?? latest?.amount : null)
      : null
    if (projected > 0 && !row.alreadyBooked) {
      const date = monthEnd(year, row.month)
      projectedRows.push({
        id: 'reta-projected:' + row.period, kind: 'expense', label: 'Cotisation RETA estimée · ' + row.period,
        date, paymentDate: date, payment: 'pending', amountCents: projected, taxAmountCents: projected,
        vat: { category: 'excluded' },
      })
    }
    return { ...row, projected: projected > 0 ? projected : null }
  })
  return { confirmedRows, projectedRows, periods }
}

export function studioEstimateEntries(entries, receipts, { year, startDate, today }) {
  const sales = receipts?.filter(row => inActivityYear(row.date, year, startDate) &&
    row.date <= today && Number.isFinite(row.amount) && row.amount !== 0) || []
  if (!sales.length) return { entries, usingHub: false }
  const hubMonths = new Set(sales.map(row => row.date.slice(0, 7)))
  const expensesAndOtherSales = entries.filter(row => row.kind !== 'invoice' || !hubMonths.has(row.date.slice(0, 7)))
  const overlapping = entries.length - expensesAndOtherSales.length
  const hubRows = sales.map((row, index) => {
    const amountCents = Math.round(row.amount * 100)
    const baseCents = Math.round(amountCents * 100 / 121)
    return {
      id: 'hub-estimate:' + index, kind: 'invoice', label: row.label, date: row.date,
      payment: 'paid', paymentDate: row.date, amountCents, taxAmountCents: baseCents,
      vat: { category: 'sale_es', date: row.date, rate: 21, baseCents, quotaCents: amountCents - baseCents, deductibleCents: 0 },
    }
  })
  return { entries: [...expensesAndOtherSales, ...hubRows], usingHub: true, overlapping }
}


export function withTaxProjections(entries) {
  return entries.map(row => {
    const estimate = row.taxProjection
    if (!estimate || row.kind !== 'expense') return row
    return { ...row, taxAmountCents: row.taxAmountCents ?? estimate.irpfCents, vat: row.vat ?? estimate.vat }
  })
}
