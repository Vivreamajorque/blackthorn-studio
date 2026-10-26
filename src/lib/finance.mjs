// One recorded cash movement per Notion row. A session's Prix is its collected
// balance; deposits are separate rows. Never reconcile people by their name.
export const text = (row, key) => (row?.properties?.[key]?.rich_text || []).map(x => x.plain_text ?? x.text?.content ?? '').join('')
export const title = row => (row?.properties?.Session?.title || []).map(x => x.plain_text ?? x.text?.content ?? '').join('')
export const number = (row, key) => Number(row?.properties?.[key]?.number) || 0
export const status = row => row?.properties?.Statut?.select?.name || ''
export const dateOf = row => (row?.properties?.Date?.date?.start || '').slice(0, 10)
export const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date())
export const money = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100
export const sum = rows => rows.reduce((cents, row) => cents + Math.round(number(row, 'Prix') * 100), 0) / 100
export const unique = rows => [...new Map(rows.map((row, i) => [row.id || `row-${i}`, row])).values()]
export const isDeposit = row => row?.properties?.Type?.select?.name === '💰 Versement client'
export const isStudio = row => !(row?.properties?.Type?.select?.name || '').includes('Amely')
export const isConfirmed = row => ['', '✅ Confirmé'].includes(status(row))
export const receipts = (rows, asOf = today()) => {
  const seen = new Set()
  return unique(rows).filter(row => {
    if (!isStudio(row) || !isConfirmed(row) || !dateOf(row) || dateOf(row) > asOf) return false
    const paymentId = text(row,'Notes').match(/PAYMENT_ID:([a-zA-Z0-9-]+)/)?.[1]
    if (paymentId && seen.has(paymentId)) return false
    if (paymentId) seen.add(paymentId)
    return true
  })
}
export const inMonth = (rows, month) => rows.filter(row => dateOf(row).startsWith(month))
export const between = (rows, from, to) => rows.filter(row => dateOf(row) >= from && dateOf(row) <= to)
export const sessionCount = rows => rows.filter(row => !isDeposit(row)).reduce((n, row) => n + Math.max(1, Number(text(row, 'Notes').match(/^(\d+)\s*session/)?.[1]) || 1), 0)
export const paymentMethod = row => {
  const t = title(row), notes = text(row, 'Notes')
  if (t.startsWith('[CARTE]') || /SumUp|\bcarte\b/i.test(notes)) return 'carte'
  if (/virement/i.test(notes)) return 'virement'
  if (t.startsWith('[CASH]') || /\bcash\b|esp[eè]ces/i.test(notes)) return 'cash'
  return 'inconnu'
}
export const splitPayments = rows => {
  const totals = { cash: 0, carte: 0, virement: 0, inconnu: 0 }
  for (const row of rows) totals[paymentMethod(row)] = money(totals[paymentMethod(row)] + number(row, 'Prix'))
  return totals
}
export const bookingToken = row => (title(row) + ' ' + text(row, 'Notes')).match(/SUMUP-([a-zA-Z0-9-]+)/)?.[1] || text(row, 'Notes').match(/DEVIS_TOKEN:([a-zA-Z0-9-]+)/)?.[1] || ''
export const remaining = row => Math.max(0, money(number(row, 'Prix') - number(row, 'Acompte reçu')))
export const forecast = (sessions, quotes = [], asOf = today()) => {
  const planned = unique(sessions).filter(row => isStudio(row) && !isDeposit(row) && status(row) === '🗓 Prévu' && dateOf(row) >= asOf)
  const seen = new Set(), items = []
  for (const row of planned) {
    const token = bookingToken(row)
    if (token && seen.has(token)) continue
    if (token) seen.add(token)
    items.push({ id: row.id, date: dateOf(row), amount: remaining(row) })
  }
  const linked = new Set(sessions.map(bookingToken).filter(Boolean))
  let undated = 0
  for (const quote of unique(quotes)) {
    if (!['✅ Réservé', '✅ Validé'].includes(status(quote))) continue
    const token = text(quote, 'Token')
    if (token && (linked.has(token) || seen.has(token))) continue
    const day = text(quote, 'Notes').match(/RDV:\s*(\d{4}-\d{2}-\d{2})/)?.[1]
    const amount = Math.max(0, money(number(quote, 'Prix') - number(quote, 'Acompte')))
    if (!day) { undated = money(undated + amount); continue }
    if (day < asOf) continue
    if (token) seen.add(token)
    items.push({ id: quote.id, date: day, amount })
  }
  return { items, undated }
}
export const forecastSum = items => money(items.reduce((n, row) => n + row.amount, 0))
export const vatRate = row => Number(text(row, 'Notes').match(/\[IVA:(0|4|10|21)\]/)?.[1] ?? 21)
export const includedVat = (ttc, rate = 21) => money(ttc * rate / (100 + rate))
export const expenseVat = row => row?.properties?.['IVA récupérable']?.checkbox ? includedVat(number(row, 'Montant'), vatRate(row)) : 0
// Cash-based management estimate only, not an IRPF/IVA tax return.
export function financials(cashTtc, expenses = []) {
  const totalDep = money(expenses.reduce((n, row) => n + number(row, 'Montant'), 0))
  const ivaColl = includedVat(cashTtc)
  const ivaRecup = money(expenses.reduce((n, row) => n + expenseVat(row), 0))
  const caHt = money(cashTtc - ivaColl)
  const expenseHt = money(totalDep - ivaRecup)
  const ben = money(caHt - expenseHt)
  const irpf = Math.max(0, money(ben * 0.20))
  const ivaBalance = money(ivaColl - ivaRecup)
  const ivaNette = Math.max(0, ivaBalance)
  const cashBalance = money(cashTtc - totalDep)
  return { totalDep, caHt, ben, irpf, ivaColl, ivaRecup, ivaBalance, ivaNette, iva: ivaNette, cashBalance, net: money(cashBalance - irpf - ivaNette) }
}
export function dataWarnings(rows) {
  return rows.filter(row => !isDeposit(row) && isConfirmed(row) && number(row, 'Acompte reçu') > 0 && number(row, 'Solde reçu') !== number(row, 'Prix'))
}
