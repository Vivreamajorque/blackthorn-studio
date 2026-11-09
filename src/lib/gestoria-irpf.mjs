import { inActivityYear } from './gestoria-calendar.mjs'

const noFiling = { box07: 0, box15: 0, box16: 0, box19: 0 }
const emptyMonth = () => ({ income: 0, expenses: 0, withheld: 0, entries: 0 })

function minoracion(net) {
  if (net == null || net > 1200000) return 0
  if (net <= 900000) return 10000
  if (net <= 1000000) return 7500
  if (net <= 1100000) return 5000
  return 2500
}

function estimate({ income, expenses, withheld }, previous, credit, deduction) {
  const profit = income - expenses
  const allowance = Math.min(200000, Math.max(0, Math.round(profit * 0.05)))
  const box07 = Math.max(0, Math.round((profit - allowance) * 0.20)) - previous - withheld
  const box14 = Math.max(0, box07) - deduction
  const box15 = Math.min(Math.max(0, box14), credit)
  return { box07, box15, box16: 0, box19: box14 - box15 }
}

export function irpfForecast(rows, { year, startDate, today, settings = {} }) {
  const months = Array.from({ length: 12 }, emptyMonth)
  const excluded = { missingAmount: 0, missingDate: 0, awaitingPayment: 0 }
  const cash = settings.basis === 'cash'
  const deduction = minoracion(settings.priorNetCents)
  for (const row of rows) {
    const booked = row.taxDate || row.date
    const date = cash ? row.paymentDate : booked
    if (!inActivityYear(date || booked, year, startDate)) continue
    if (!date) {
      excluded[row.payment === 'pending' ? 'awaitingPayment' : 'missingDate']++
      continue
    }
    if (date > today) continue
    if (row.taxAmountCents == null) {
      excluded.missingAmount++
      continue
    }
    const month = months[Number(date.slice(5, 7)) - 1]
    month.entries++
    if (row.kind === 'invoice') {
      month.income += row.taxAmountCents
      month.withheld += row.withholdingCents || 0
    } else month.expenses += row.taxAmountCents
  }

  let previous = 0
  let credit = 0
  const totals = emptyMonth()
  const quarters = []
  let reserve = 0
  for (let i = 0; i < months.length; i++) {
    const month = months[i]
    const quarter = Math.floor(i / 3) + 1
    if (i % 3 === 0) reserve = 0
    for (const key of Object.keys(totals)) totals[key] += month[key]
    const estimated = totals.entries ? estimate(totals, previous, credit, deduction) : noFiling
    const due = Math.max(0, estimated.box19)
    month.hasData = totals.entries > 0
    month.change = due - reserve
    month.reserve = due
    reserve = due
    if (i % 3 !== 2) continue

    const filed = settings.filed?.[quarter]
    quarters.push({ quarter, due: totals.entries ? due : null, filed })
    const boxes = filed || estimated
    previous += Math.max(0, boxes.box07) - boxes.box16
    credit = Math.max(0, credit - boxes.box15) + Math.max(0, -boxes.box19)
  }
  return { months, quarters, excluded, deduction }
}
