const { createHash, randomBytes, timingSafeEqual } = require('node:crypto')
const { requireSession, appOrigin } = require('../server/session.cjs')
const { readVersionedBlob } = require('../server/private-blob.cjs')
const { fileId, parseAttachment, storeAttachment } = require('../server/gestoria-attachments.cjs')
const { readWorkspace, validEntry } = require('./gestoria-workspace.js')
const { receiveInboxFile } = require('../server/gestoria-inbox.cjs')
const { readStudioSales, supportedYear } = require('./gestoria-studio.js')

const accessPath = 'mi-gestoria/personal/v1/blackthorn-access.json'
const ledgerPath = 'mi-gestoria/personal/v1/workspace.json'
const options = { access: 'private', addRandomSuffix: false, contentType: 'application/json' }
const makeToken = () => randomBytes(32).toString('base64url')
const digest = value => createHash('sha256').update(value).digest()
const validToken = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)
const matches = (a, b) => typeof a === 'string' && typeof b === 'string' && timingSafeEqual(digest(a), digest(b))
const isBlackthorn = row => row.entity === 'blackthorn' && row.kind === 'expense'
const maxAge = 30 * 24 * 60 * 60

async function readAccess(blob) {
  const current = await readVersionedBlob(blob, accessPath)
  return current ? { revision: current.revision, value: await new Response(current.content.stream).json() } : { revision: null }
}

async function writeJson(blob, path, revision, data) {
  try {
    await blob.put(path, JSON.stringify(data), { ...options, allowOverwrite: revision !== null,
      ...(revision !== null && { ifMatch: revision }) })
    return true
  } catch (error) {
    if (error instanceof blob.BlobPreconditionFailedError ||
        (revision === null && await blob.get(path, { access: 'private', useCache: false }))) return false
    throw error
  }
}

function tokenRecord(token, kind, lifetime) {
  return { kind, hash: digest(token).toString('hex'), expires: Date.now() + lifetime }
}

function authorized(token, access, kind) {
  return validToken(token) && access?.kind === kind && access.expires > Date.now() &&
    matches(digest(token).toString('hex'), access.hash)
}

async function replaceAccess(blob, kind) {
  const token = kind === 'invite' ? makeToken() : null
  for (let attempt = 0; attempt < 4; attempt++) {
    const { revision } = await readAccess(blob)
    const value = token ? tokenRecord(token, 'invite', 48 * 3600000) : { kind: 'revoked' }
    if (await writeJson(blob, accessPath, revision, value)) return token
  }
  throw new Error('Concurrent access change')
}

async function addExpense(blob, form) {
  if (!form || typeof form.label !== 'string' || !fileId.test(form.id) || typeof form.date !== 'string' ||
      !supportedYear(form.date.slice(0, 4)) || !Number.isSafeInteger(form.amountCents) || form.amountCents <= 0 ||
      (form.file && !parseAttachment(form.file))) return null
  const entry = { id: 'tony-' + form.id, kind: 'expense', entity: 'blackthorn', source: 'direct',
    label: form.label.trim(), reference: '', date: form.date, amountCents: form.amountCents, currency: 'EUR',
    payment: form.paymentDate ? 'paid' : 'unknown', ...(form.paymentDate && { paymentDate: form.paymentDate }) }
  if (!validEntry(entry)) return null
  for (let attempt = 0; attempt < 4; attempt++) {
    const { revision, data } = await readWorkspace(blob, ledgerPath)
    const existing = data.entries.find(row => row.id === entry.id)
    if (existing) return isBlackthorn(existing) && existing.date === entry.date &&
      existing.label === entry.label && existing.amountCents === entry.amountCents ? existing.id : null
    if (data.entries.length >= 1000) return null
    if (form.file && !entry.attachment) entry.attachment = await storeAttachment(blob, form.file, form.id)
    if (await writeJson(blob, ledgerPath, revision, { ...data, entries: [...data.entries, entry] })) return entry.id
  }
  throw new Error('Concurrent ledger change')
}

async function monthlyReport(blob, year) {
  const [workspace, sales] = await Promise.all([
    readWorkspace(blob, ledgerPath), readStudioSales(year).catch(() => null),
  ])
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: year + '-' + String(i + 1).padStart(2, '0'), salesCents: sales ? 0 : null, expensesCents: 0,
  }))
  for (const row of sales?.receipts || []) months[Number(row.date.slice(5, 7)) - 1].salesCents += Math.round(row.amount * 100)
  for (const row of workspace.data.entries) {
    if (!isBlackthorn(row) || !row.date.startsWith(year + '-') || (row.currency && row.currency !== 'EUR')) continue
    months[Number(row.date.slice(5, 7)) - 1].expensesCents += row.amountCents
  }
  return { months }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'POST') return res.status(405).end()
  try {
    if (req.headers.host !== appOrigin().host ||
        !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return res.status(403).end()
    const { action, token, year, expense, file } = req.body || {}
    const ownerAction = ['invite', 'revoke'].includes(action)
    if (ownerAction) {
      if (!(await requireSession(req, res))) return
    } else if (!process.env.GESTORIA_TONY_BRIDGE_SECRET || !matches(req.headers['x-gestoria-bridge'], process.env.GESTORIA_TONY_BRIDGE_SECRET)) {
      return res.status(403).json({ error: 'Accès refusé.' })
    }
    const blob = await import('@vercel/blob')
    if (ownerAction) return res.status(200).json({ code: await replaceAccess(blob, action) })
    const access = await readAccess(blob)
    if (action === 'activate') {
      if (!authorized(token, access.value, 'invite')) return res.status(401).json({ error: 'Code expiré, déjà utilisé ou invalide.' })
      const sessionToken = makeToken()
      if (!await writeJson(blob, accessPath, access.revision, tokenRecord(sessionToken, 'session', maxAge * 1000))) {
        return res.status(409).json({ error: 'Ce code a déjà été utilisé.' })
      }
      return res.status(200).json({ sessionToken, maxAge })
    }
    if (!authorized(token, access.value, 'session')) return res.status(401).json({ error: 'Active l’accès Mi Gestoría de ce navigateur.' })
    if (action === 'load' && supportedYear(year)) return res.status(200).json(await monthlyReport(blob, year))
    if (action === 'inbox') {
      const result = await receiveInboxFile(blob, file)
      return res.status(result.error ? 400 : result.duplicate ? 200 : 201).json(result)
    }
    if (action === 'expense') {
      const id = await addExpense(blob, expense)
      return id ? res.status(201).json({ id }) : res.status(400).json({ error: 'Vérifie la date, le montant et le justificatif.' })
    }
    return res.status(400).json({ error: 'Action non reconnue.' })
  } catch {
    return res.status(503).json({ error: 'Mi Gestoría est momentanément inaccessible.' })
  }
}
