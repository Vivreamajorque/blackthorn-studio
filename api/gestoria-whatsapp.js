// Webhook WhatsApp (Meta Cloud API) pour parler à Alfred.
// GET : vérification du webhook par Meta. POST : messages entrants, signés par Meta.
const wa = require('../server/whatsapp.cjs')

async function rawBody(req) {
  if (typeof req.rawBody === 'string' || Buffer.isBuffer(req.rawBody)) return Buffer.from(req.rawBody)
  const chunks = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (!wa.ready()) return res.status(503).json({ error: 'WhatsApp n’est pas encore configuré.' })
  const e = wa.env()

  if (req.method === 'GET') {
    const q = req.query || {}
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === e.verify) return res.status(200).send(String(q['hub.challenge'] || ''))
    return res.status(403).end()
  }
  if (req.method !== 'POST') return res.status(405).end()

  const raw = await rawBody(req)
  if (!wa.validSignature(raw, req.headers['x-hub-signature-256'], e.secret)) return res.status(401).end()
  let payload
  try { payload = JSON.parse(raw.toString('utf8')) } catch { return res.status(400).end() }

  try {
    const blob = module.exports.blobForTests || await import('@vercel/blob')
    await wa.handleMessages(blob, payload, module.exports.depsForTests)
  } catch (err) { console.error('whatsapp webhook', err) }
  // Toujours 200 : sinon Meta renvoie le même message en boucle.
  return res.status(200).json({ ok: true })
}

// Corps brut nécessaire pour vérifier la signature de Meta.
module.exports.config = { api: { bodyParser: false } }
