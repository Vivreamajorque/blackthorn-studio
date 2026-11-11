const { createHash, randomBytes, timingSafeEqual } = require('node:crypto')
const { appOrigin, allowedRequest, session, renewSession } = require('../server/session.cjs')
const { readVersionedBlob } = require('../server/private-blob.cjs')

const path = 'mi-gestoria/personal/v1/access.json'
const hour = 3600 * 1000
const lifetime = 15 * 60 * 1000
const hash = value => createHash('sha256').update(value).digest('hex')

async function readAccess(blob) {
  const current = await readVersionedBlob(blob, path)
  return current
    ? { revision: current.revision, state: await new Response(current.content.stream).json() }
    : { revision: null, state: { sent: [], expires: 0, tokenHash: null } }
}

async function saveAccess(blob, revision, state) {
  try {
    await blob.put(path, JSON.stringify(state), {
      access: 'private', addRandomSuffix: false, contentType: 'application/json',
      allowOverwrite: revision !== null, ...(revision !== null && { ifMatch: revision }),
    })
    return true
  } catch (error) {
    if (error instanceof blob.BlobPreconditionFailedError) return false
    if (revision === null && (await readAccess(blob)).revision !== null) return false
    throw error
  }
}

async function emailLink(sender, recipient, token) {
  const link = new URL('/', appOrigin())
  link.hash = new URLSearchParams({ connexion: token }).toString()
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Mi Gestoría', email: sender },
      to: [{ email: recipient }],
      subject: 'Connexion à Mi Gestoría',
      textContent: 'Ouvre ce lien pour accéder à ton dossier privé Mi Gestoría. Il expire dans 15 minutes et ne fonctionne qu’une fois.\n\n' + link.href,
    }),
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    const message = typeof error?.message === 'string' ? error.message : ''
    const reason = /(?:unrecogni[sz]ed|unauthori[sz]ed|unknown|not allowed) ip|ip address.*(?:allowed|authori[sz]ed)/i.test(message)
      ? 'ip-restricted' : /api key|credential/i.test(message) ? 'credentials' : 'unspecified'
    console.warn('Mi Gestoría mail provider rejected the request', response.status, reason)
    throw new Error('Delivery unavailable')
  }
}

async function requestLink(res, email) {
  const owner = process.env.GESTORIA_OWNER_EMAIL
  if (!owner) throw new Error('Owner unavailable')
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  const recipient = [owner, process.env.GESTORIA_ALTERNATE_EMAIL]
    .find(address => address && address.toLowerCase() === normalizedEmail)
  if (!recipient) return res.status(200).json({ requested: true })
  const blob = await import('@vercel/blob')
  for (let attempt = 0; attempt < 3; attempt++) {
    const { revision, state } = await readAccess(blob)
    const now = Date.now()
    const sent = state.sent.filter(time => now - time < hour)
    if (sent.length >= 4 || sent.some(time => now - time < 2 * 60 * 1000)) {
      return res.status(200).json({ requested: true })
    }
    const token = randomBytes(32).toString('base64url')
    const saved = await saveAccess(blob, revision, { sent: [...sent, now], expires: now + lifetime, tokenHash: hash(token) })
    if (!saved) continue
    await emailLink(owner, recipient, token)
    return res.status(200).json({ requested: true })
  }
  throw new Error('Sign-in state changed while requesting a link')
}

async function consumeRecovery(blob, digest) {
  const [expected, expires] = (process.env.GESTORIA_RECOVERY_LINK || '').split('.')
  if (expected !== digest || !Number.isSafeInteger(Number(expires)) || Date.now() >= Number(expires)) return false

  const usedPath = 'mi-gestoria/personal/v1/recovery/' + digest + '.used'
  const readOptions = { access: 'private', useCache: false }
  if (await blob.get(usedPath, readOptions)) return false
  try {
    await blob.put(usedPath, 'used', { access: 'private', addRandomSuffix: false, allowOverwrite: false })
    return true
  } catch (error) {
    if (error instanceof blob.BlobPreconditionFailedError || await blob.get(usedPath, readOptions)) return false
    throw error
  }
}

async function consumeEmailToken(blob, digest) {
  const { revision, state } = await readAccess(blob)
  return !!state.tokenHash && state.expires >= Date.now() &&
    timingSafeEqual(Buffer.from(digest), Buffer.from(state.tokenHash)) &&
    await saveAccess(blob, revision, { ...state, tokenHash: null, expires: 0 })
}

async function signIn(req, res, token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return res.status(401).json({ error: 'Lien invalide ou expiré. Demande un nouveau lien.' })
  }
  const blob = await import('@vercel/blob')
  const digest = hash(token)
  if (!await consumeRecovery(blob, digest) && !await consumeEmailToken(blob, digest)) {
    return res.status(401).json({ error: 'Lien invalide ou expiré. Demande un nouveau lien.' })
  }
  const user = await session(req, res)
  user.role = 'owner'
  user.renewedAt = Date.now()
  await user.save()
  return res.status(200).json({ connected: true })
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  try {
    if (!allowedRequest(req)) return res.status(403).json({ error: 'Origine non autorisée' })
    if (req.method === 'GET') {
      const user = await session(req, res)
      await renewSession(user)
      return res.status(200).json({ connected: user.role === 'owner' })
    }
    if (req.method === 'DELETE') {
      const user = await session(req, res)
      user.destroy()
      return res.status(200).json({ connected: false })
    }
    if (req.method !== 'POST') return res.status(405).end()
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
      return res.status(415).json({ error: 'Format de connexion invalide.' })
    }
    if (req.body?.action === 'request') return await requestLink(res, req.body.email)
    if (req.body?.action === 'verify') return await signIn(req, res, req.body.token)
    return res.status(400).json({ error: 'Action inconnue.' })
  } catch {
    return res.status(503).json({ error: 'Connexion momentanément indisponible. Réessaie dans quelques minutes.' })
  }
}
