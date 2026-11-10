import { inActivityYear, monthEnd } from './gestoria-calendar.mjs'

export function inTaxPeriod(date, { year, quarter, startDate }) {
  return Boolean(date) && inActivityYear(date, year, startDate) &&
    (!quarter || Math.ceil(Number(date.slice(5, 7)) / 3) === quarter)
}

export function rentWithholdings(entries, period) {
  const result = { documented: 0, confirmed: 0, pending: 0, missing: 0 }
  for (const row of entries) {
    if (row.kind !== 'expense') continue
    const amount = row.documentAmounts?.rentWithholdingCents
    if (amount == null && !row.id.startsWith('blackthorn-rent-')) continue
    const paid = row.payment === 'paid' && Boolean(row.paymentDate) && (!period.today || row.paymentDate <= period.today)
    if (!inTaxPeriod(paid ? row.paymentDate : row.date, period)) continue
    if (amount == null || !row.attachment) {
      result.missing++
      continue
    }
    result.documented += amount
    if (paid) result.confirmed += amount
    else result.pending += amount
  }
  return result
}

export function preparationChecks({ row, year, entries, startDate, settings, filings = [], vat, today }) {
  if (row.status === 'not_applicable') return ['Ce modèle est classé non applicable dans ce dossier.']
  const checks = []
  if (row.status === 'unknown' || row.status === 'missing') {
    checks.push('Rapproche l’obligation et le statut du dépôt avec Hacienda pour ce dossier et cet exercice.')
  }
  if (row.model === '130') {
    const end = monthEnd(year, row.quarter * 3)
    const accrual = settings?.basis !== 'cash'
    const pending = entries.filter(entry => {
      const booked = entry.taxDate || entry.date
      const date = accrual ? booked : entry.paymentDate || booked
      return inTaxPeriod(date, { year, startDate }) && date <= end && date <= today &&
        (entry.taxAmountCents == null || entry.taxReview || (!accrual && !entry.paymentDate))
    })
    if (pending.length) checks.push(pending.length + ' écriture(s) IRPF à compléter ou à rapprocher du registre.')
    if (!settings?.basis) checks.push('Confirme le critère IRPF utilisé dans la déclaration annuelle.')
    if (settings?.priorNetCents == null) checks.push('Vérifie le bénéfice net fiscal de l’année précédente pour la case 13.')
    const previous = filings.filter(item => item.model === '130' && item.quarter < row.quarter &&
      item.status !== 'not_applicable' && !settings?.filed?.[item.quarter])
    if (previous.length) checks.push('Recopie les cases des 130 précédents ou confirme leur non-applicabilité. Périodes à revoir · ' +
      previous.map(item => 'T' + item.quarter).join(', ') + '.')
  }
  if (['303', '349', '390'].includes(row.model) && vat) {
    if (vat.missing.length) checks.push(vat.missing.length + ' écriture(s) TVA à qualifier ou à vérifier.')
    if (!vat.count) checks.push('Confirme les opérations de la période avec le registre et les données Hacienda.')
    if (row.model === '349') {
      if (vat.missingIds.length) checks.push(vat.missingIds.length + ' opération(s) avec pays ou NIF TVA à compléter.')
      checks.push('Confirme la périodicité et les NIF TVA des opérateurs dans VIES avant de reprendre le récapitulatif.')
    }
  }
  return checks
}
