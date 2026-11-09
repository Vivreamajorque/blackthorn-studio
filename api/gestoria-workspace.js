const { requireSession } = require('../server/session.cjs')

const empty = { entries: [], records: {} }
const entryKeys = ['id', 'kind', 'date', 'label', 'reference', 'amountCents', 'payment']
const taskStatuses = ['unknown', 'in_progress', 'blocked', 'complete', 'not_applicable']
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
  if (!isObject(entry) || Object.keys(entry).some(key => !entryKeys.includes(key) && key !== 'source') ||
      !entryKeys.every(key => Object.hasOwn(entry, key))) return false
  const { id, kind, date, label, reference, amountCents, payment, source } = entry
  return (source === undefined || ['direct', 'malt', 'livementor'].includes(source)) && validDate(date) && /^(2025|2026)-/.test(date) &&
    typeof id === 'string' && /^[\w-]{1,64}$/.test(id) &&
    ['invoice', 'expense'].includes(kind) && ['unknown', 'pending', 'paid'].includes(payment) &&
    typeof label === 'string' && label.trim().length > 0 && label.length <= 160 &&
    typeof reference === 'string' && reference.length <= 100 &&
    Number.isSafeInteger(amountCents) && Math.abs(amountCents) <= 1e10
}

function validStatuses(values, keyPattern, statuses) {
  return isObject(values) && Object.entries(values).every(([key, value]) =>
    keyPattern.test(key) && statuses.includes(value))
}

function validNotices(notices) {
  return Array.isArray(notices) && notices.length <= 50 &&
    notices.every(notice => isObject(notice) && Object.keys(notice).length === 4 &&
      typeof notice.id === 'string' && /^[\w-]{1,64}$/.test(notice.id) &&
      typeof notice.title === 'string' && notice.title.trim().length > 0 && notice.title.length <= 140 &&
      (notice.date === '' || validDate(notice.date)) && typeof notice.done === 'boolean') &&
    new Set(notices.map(notice => notice.id)).size === notices.length
}

function validWorkspace(data) {
  return isObject(data) && Object.keys(data).length === 2 && isObject(data.records) &&
    Array.isArray(data.entries) && data.entries.length <= 1000 && data.entries.every(validEntry) &&
    new Set(data.entries.map(entry => entry.id)).size === data.entries.length &&
    Object.entries(data.records).every(([key, record]) =>
      /^(independent|blackthorn):20(25|26)$/.test(key) && isObject(record) &&
      Object.keys(record).length === 3 && validNotices(record.notices) &&
      validStatuses(record.tasks, /^(census|residence|reta|sales|malt|expenses|filings|roi|annual)$/, taskStatuses) &&
      validStatuses(record.filings, /^T[1-4]:(303|130|115|111)$/, filingStatuses))
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
  const data = await new Response(result.stream).json()
  if (!validWorkspace(data)) throw new Error('Invalid saved workspace')
  return { revision: result.blob.etag, data }
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
