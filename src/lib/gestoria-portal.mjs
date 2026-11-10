export const captureKey = 'mi-gestoria-portal-capture-v1'
export const portalKinds = ['debts', 'receipts', 'filings', 'notifications']
const periodPattern = /^(?:20\d{2}-(?:0[1-9]|1[0-2])(?: à 20\d{2}-(?:0[1-9]|1[0-2]))?|20\d{2}(?: · (?:[1-4]T|0[1-9]|1[0-2]))?)$/
const datePattern = /^20\d{2}-\d{2}-\d{2}$/
const referencePattern = /^[A-Z0-9][A-Z0-9/-]{3,39}$/

export function validPortalRow(row, kind) {
  if (!row || typeof row !== 'object' || Array.isArray(row) ||
    !Object.keys(row).every(key => ['period', 'date', 'amountCents', 'reference', 'model', 'subject', 'read'].includes(key)) ||
    (row.period !== undefined && (typeof row.period !== 'string' || !periodPattern.test(row.period))) ||
    (row.date !== undefined && (typeof row.date !== 'string' || !datePattern.test(row.date) || !Number.isFinite(Date.parse(row.date)) || new Date(row.date).toISOString().slice(0, 10) !== row.date)) ||
    (row.reference !== undefined && (typeof row.reference !== 'string' || !referencePattern.test(row.reference))) ||
    (row.amountCents !== undefined && (!Number.isSafeInteger(row.amountCents) || row.amountCents < 0 || row.amountCents > 1e10))) return false
  if (kind === 'debts' || kind === 'receipts') return Boolean(row.period) && row.amountCents !== undefined &&
    row.model === undefined && row.subject === undefined && row.read === undefined &&
    (kind !== 'debts' || Boolean(row.reference))
  if (kind === 'filings') return Boolean(row.period && row.reference && typeof row.model === 'string' && /^\d{3}$/.test(row.model)) &&
    row.amountCents === undefined && row.subject === undefined && row.read === undefined
  return Boolean(row.reference && typeof row.subject === 'string' && row.subject.trim() && row.subject.length <= 90) &&
    row.period === undefined && row.model === undefined && row.amountCents === undefined &&
    (row.read === undefined || typeof row.read === 'boolean')
}

export function validPortalCheck(check, kind) {
  return Boolean(check && typeof check === 'object' && !Array.isArray(check) &&
    Object.keys(check).every(key => ['capturedAt', 'rows'].includes(key)) &&
    typeof check.capturedAt === 'string' && /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(check.capturedAt) &&
    Number.isFinite(Date.parse(check.capturedAt)) && Array.isArray(check.rows) &&
    check.rows.length > 0 && check.rows.length <= 60 && check.rows.every(row => validPortalRow(row, kind)))
}

export function validPortalChecks(checks) {
  return Boolean(checks && typeof checks === 'object' && !Array.isArray(checks) &&
    Object.entries(checks).every(([kind, check]) => portalKinds.includes(kind) && validPortalCheck(check, kind)))
}

export function readPortalCapture() {
  try {
    const raw = sessionStorage.getItem(captureKey)
    if (!raw || raw.length > 50000) return null
    const { kind, capturedAt, rows } = JSON.parse(raw)
    const check = { capturedAt, rows }
    return portalKinds.includes(kind) && validPortalCheck(check, kind) &&
      Date.now() - Date.parse(capturedAt) < 30 * 60 * 1000 &&
      Date.parse(capturedAt) <= Date.now() + 60 * 1000 ? { kind, ...check } : null
  } catch {
    return null
  }
}

export function portalRowsForYear(rows, year) {
  return rows.filter(row => (row.period || row.date)?.startsWith(String(year)))
}

export function applyPortalCheck(record, kind, check) {
  const previous = record.portalChecks?.[kind]
  const keyFor = row => row.reference || row.period + ':' + row.amountCents
  const references = new Set(check.rows.map(keyFor))
  const rows = kind === 'debts' ? check.rows : [
    ...check.rows, ...(previous?.rows || []).filter(row => !references.has(keyFor(row))),
  ].slice(0, 60)
  const notices = [...record.notices]
  if (kind === 'debts') {
    for (const row of rows) {
      const id = 'portal-debt-' + row.reference.replaceAll('/', '-')
      const existing = notices.findIndex(item => item.kind === 'debt' &&
        (item.id === id || item.title.endsWith('Réf. ' + row.reference)))
      if (existing < 0 && notices.length < 50) {
        notices.push({ id, kind: 'debt', date: '', done: false, amountCents: row.amountCents,
          title: 'Importass · ' + row.period + ' · Réf. ' + row.reference })
      } else if (existing >= 0 && !notices[existing].done) {
        notices[existing] = { ...notices[existing], amountCents: row.amountCents }
      }
    }
  }
  return { ...record, notices, portalChecks: { ...record.portalChecks, [kind]: { ...check, rows } } }
}
