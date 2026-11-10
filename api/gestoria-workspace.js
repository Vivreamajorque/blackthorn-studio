const { validPortalChecks } = require('../src/lib/gestoria-portal.mjs')
const { requireSession } = require('../server/session.cjs')

const empty = { entries: [], records: {} }
const entryKeys = ['id', 'kind', 'date', 'label', 'reference', 'amountCents', 'payment']
const optionalEntryKeys = ['source', 'taxDate', 'paymentDate', 'taxAmountCents', 'withholdingCents', 'currency', 'vat', 'attachment', 'expectedPaymentDate']
const taskStatuses = ['unknown', 'in_progress', 'blocked', 'complete', 'not_applicable']
const filingKey = /^(?:T[1-4]:(?:303|130|115|111|349)|A:(?:390|100)|M(?:0[1-9]|1[0-2]):RETA)$/
const filingStatuses = ['unknown', 'missing', 'to_prepare', 'filed', 'not_applicable']

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function validDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(date)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

function validEntry(entry) {
  if (!isObject(entry) || Object.keys(entry).some(key => !entryKeys.includes(key) && !optionalEntryKeys.includes(key)) ||
      !entryKeys.every(key => Object.hasOwn(entry, key))) return false
  const { id, kind, date, label, reference, amountCents, payment, source, taxDate, paymentDate, taxAmountCents, withholdingCents, currency, vat, attachment, expectedPaymentDate } = entry
  return (source === undefined || ['direct', 'malt', 'livementor'].includes(source)) && validDate(date) && /^(2025|2026|2027)-/.test(date) &&
    (currency === undefined || ['EUR', 'USD'].includes(currency)) &&
    (vat === undefined || validVat(vat, kind)) &&
    (attachment === undefined || (isObject(attachment) && Object.keys(attachment).length === 3 &&
      /^[a-f0-9-]{36}$/.test(attachment.id) && typeof attachment.name === 'string' && attachment.name.length <= 160 &&
      ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(attachment.mime))) &&
    (taxDate === undefined || validDate(taxDate)) &&
    (paymentDate === undefined || (payment === 'paid' && validDate(paymentDate))) &&
    (expectedPaymentDate === undefined || (payment !== 'paid' && validDate(expectedPaymentDate))) &&
    (taxAmountCents === undefined || validAmount(taxAmountCents)) &&
    (withholdingCents === undefined || (kind === 'invoice' && validAmount(withholdingCents))) &&
    typeof id === 'string' && /^[\w-]{1,64}$/.test(id) &&
    ['invoice', 'expense'].includes(kind) && ['unknown', 'pending', 'paid'].includes(payment) &&
    typeof label === 'string' && label.trim().length > 0 && label.length <= 160 &&
    typeof reference === 'string' && reference.length <= 100 &&
    validAmount(amountCents)
}

function validAmount(value) {
  return Number.isSafeInteger(value) && Math.abs(value) <= 1e10
}

function validVat(vat, kind) {
  if (!isObject(vat) || Object.keys(vat).some(key => !['category', 'date', 'baseCents', 'quotaCents', 'deductibleCents', 'rate', 'country', 'id'].includes(key))) return false
  const { category, date, baseCents, quotaCents, deductibleCents, rate, country, id } = vat
  const allowed = kind === 'invoice' ? ['sale_es', 'sale_eu', 'sale_other'] : ['buy_es', 'buy_eu', 'buy_reverse']
  if (category === 'excluded') return Object.keys(vat).length === 1
  return allowed.includes(category) && validDate(date) && validAmount(baseCents) && validAmount(quotaCents) &&
    validAmount(deductibleCents) && Math.abs(deductibleCents) <= Math.abs(quotaCents) &&
    (!deductibleCents || Math.sign(deductibleCents) === Math.sign(quotaCents)) &&
    (category !== 'sale_es' || [0, 4, 10, 21].includes(rate)) &&
    (country === undefined || /^(AT|BE|BG|CY|CZ|DE|DK|EE|EL|FI|FR|HR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK)$/.test(country)) &&
    (id === undefined || /^[A-Z0-9]{2,20}$/.test(id))
}

function validIrpf(value) {
  return isObject(value) && Object.entries(value).every(([year, settings]) =>
    /^20(25|26|27)$/.test(year) && isObject(settings) &&
    Object.keys(settings).every(key => ['basis', 'priorNetCents', 'filed'].includes(key)) &&
    ['cash', 'accrual'].includes(settings.basis) &&
    (settings.priorNetCents === undefined || validAmount(settings.priorNetCents)) &&
    isObject(settings.filed) && Object.entries(settings.filed).every(([quarter, boxes]) =>
      /^[1-4]$/.test(quarter) && isObject(boxes) && Object.keys(boxes).length === 4 &&
      validAmount(boxes.box07) && validAmount(boxes.box19) &&
      validAmount(boxes.box15) && boxes.box15 >= 0 &&
      validAmount(boxes.box16) && boxes.box16 >= 0))
}

function validStatuses(values, keyPattern, statuses) {
  return isObject(values) && Object.entries(values).every(([key, value]) =>
    keyPattern.test(key) && statuses.includes(value))
}

function validNotices(notices) {
  return Array.isArray(notices) && notices.length <= 50 &&
    notices.every(notice => isObject(notice) &&
      Object.keys(notice).every(key => ['id', 'title', 'date', 'done', 'kind', 'amountCents'].includes(key)) &&
      (notice.kind === undefined || notice.kind === 'debt') &&
      (notice.amountCents === undefined || (notice.kind === 'debt' && validAmount(notice.amountCents) && notice.amountCents >= 0)) &&
      typeof notice.id === 'string' && /^[\w-]{1,64}$/.test(notice.id) &&
      typeof notice.title === 'string' && notice.title.trim().length > 0 && notice.title.length <= 140 &&
      (notice.date === '' || validDate(notice.date)) && typeof notice.done === 'boolean') &&
    new Set(notices.map(notice => notice.id)).size === notices.length
}

function validFilingDetails(details) {
  return isObject(details) && Object.entries(details).every(([key, item]) =>
    filingKey.test(key) && isObject(item) &&
    Object.keys(item).every(field => ['reference', 'amountCents'].includes(field)) &&
    typeof item.reference === 'string' && item.reference.length <= 120 &&
    (item.amountCents === undefined || validAmount(item.amountCents)))
}

function validWorkspace(data) {
  return isObject(data) && Object.keys(data).every(key => ['entries', 'records', 'irpf'].includes(key)) &&
    (data.irpf === undefined || validIrpf(data.irpf)) && isObject(data.records) &&
    Array.isArray(data.entries) && data.entries.length <= 1000 && data.entries.every(validEntry) &&
    new Set(data.entries.map(entry => entry.id)).size === data.entries.length &&
    Object.entries(data.records).every(([key, record]) =>
      /^(independent|blackthorn):20(25|26|27)$/.test(key) && isObject(record) &&
      Object.keys(record).every(field => ['tasks', 'filings', 'notices', 'filingDetails', 'portalChecks'].includes(field)) &&
      (record.filingDetails === undefined || validFilingDetails(record.filingDetails)) &&
      (record.portalChecks === undefined || validPortalChecks(record.portalChecks)) &&
      validNotices(record.notices) &&
      validStatuses(record.tasks, /^(census|residence|reta|sales|malt|expenses|filings|roi|annual)$/, taskStatuses) &&
      validStatuses(record.filings, filingKey, filingStatuses))
}

async function readWorkspace(blob, path) {
  const result = await blob.get(path, { access: 'private', useCache: false })
  if (!result) {
    const previous = await blob.get('mi-gestoria/preview/v1/workspace.json', { access: 'private', useCache: false })
    if (previous) {
      const data = await new Response(previous.stream).json()
      if (!validWorkspace(data)) throw new Error('Invalid previous workspace')
      return { revision: null, data }
    }
    const seed = process.env.GESTORIA_INITIAL_WORKSPACE
    const data = seed ? JSON.parse(seed) : empty
    if (!validWorkspace(data)) throw new Error('Invalid initial workspace')
    return { revision: null, data }
  }
  const normalizeEtag = value => value?.replace(/^W\//, '').replace(/^"|"$/g, '')
  const metadata = await blob.head(result.blob.url)
  if (!metadata.etag) throw new Error('Ledger revision unavailable')
  let content = result
  let revision = metadata.etag
  if (normalizeEtag(content.blob.etag) !== normalizeEtag(revision)) {
    // Private downloads can have a different HTTP ETag than the Blob API write token.
    // Re-read between two metadata checks before pairing the content with that token.
    let stable = false
    for (let attempt = 0; attempt < 3; attempt++) {
      content = await blob.get(path, { access: 'private', useCache: false })
      if (!content) throw new Error('Ledger disappeared while reading')
      const next = await blob.head(content.blob.url)
      if (next.etag === revision) { stable = true; break }
      revision = next.etag
    }
    if (!stable || !revision) throw new Error('Ledger changed while reading')
  }
  const data = await new Response(content.stream).json()
  if (!validWorkspace(data)) throw new Error('Invalid saved workspace')
  return { revision, data }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (!['GET', 'PUT'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PUT')
    return res.status(405).end()
  }
  try {
    const user = await requireSession(req, res)
    if (!user) return
    if (req.method === 'PUT' && (!req.headers.origin ||
        !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || ''))) {
      return res.status(403).json({ error: 'Origine de la sauvegarde non autorisée.' })
    }
    const { revision, data } = req.body || {}
    if (req.method === 'PUT' && ((revision !== null && (typeof revision !== 'string' || revision.length > 128)) ||
        !validWorkspace(data))) return res.status(400).json({ error: 'Saisie invalide ou limite de 1 000 écritures atteinte.' })

    const blob = await import('@vercel/blob')
    const path = 'mi-gestoria/personal/v1/workspace.json'
    const current = await readWorkspace(blob, path)
    const personalStart = process.env.GESTORIA_PERSONAL_START
    if (personalStart && !validDate(personalStart)) throw new Error('Invalid activity start')
    if (req.method === 'GET') return res.status(200).json({ ...current, personalStart })
    if (current.revision !== revision) return res.status(409).json({ ...current, personalStart })

    try {
      const saved = await blob.put(path, JSON.stringify(data), {
        access: 'private',
        addRandomSuffix: false,
        contentType: 'application/json',
        allowOverwrite: revision !== null,
        ...(revision !== null && { ifMatch: revision }),
      })
      return res.status(200).json({ revision: saved.etag, data, personalStart })
    } catch (error) {
      if (revision !== null && !(error instanceof blob.BlobPreconditionFailedError)) throw error
      const latest = await readWorkspace(blob, path)
      if (latest.revision !== revision) return res.status(409).json({ ...latest, personalStart })
      throw error
    }
  } catch {
    return res.status(503).json({ error: 'Le dossier privé est momentanément inaccessible. Réessaie dans un instant.' })
  }
}
