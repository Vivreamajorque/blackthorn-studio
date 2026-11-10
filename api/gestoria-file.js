const { requireSession } = require('../server/session.cjs')

const limit = 3 * 1024 * 1024
const signatures = {
  'application/pdf': file => file.subarray(0, 5).toString() === '%PDF-',
  'image/png': file => file.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  'image/jpeg': file => file.subarray(0, 3).equals(Buffer.from([255, 216, 255])),
  'image/webp': file => file.subarray(0, 4).toString() === 'RIFF' && file.subarray(8, 12).toString() === 'WEBP',
}
const fileId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).end()
  }
  try {
    if (!(await requireSession(req, res))) return
    const blob = await import('@vercel/blob')
    if (req.method === 'POST') {
      const { name, mime, base64 } = req.body || {}
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '') ||
          typeof name !== 'string' || !name.trim() || name.length > 160 ||
          !Object.hasOwn(signatures, mime) || typeof base64 !== 'string' || base64.length > Math.ceil(limit / 3) * 4) {
        return res.status(400).json({ error: 'Choisis un PDF, JPEG, PNG ou WebP de 3 Mo maximum.' })
      }
      const bytes = Buffer.from(base64, 'base64')
      if (bytes.length > limit || !signatures[mime](bytes)) return res.status(400).json({ error: 'Le format du fichier ne correspond pas à son contenu.' })
      const id = require('node:crypto').randomUUID()
      await blob.put('mi-gestoria/personal/v1/files/' + id, bytes, {
        access: 'private', addRandomSuffix: false, contentType: mime,
      })
      return res.status(201).json({ id, name: name.trim(), mime })
    }
    const { id, name } = req.query || {}
    if (typeof id !== 'string' || !fileId.test(id)) return res.status(400).end()
    const result = await blob.get('mi-gestoria/personal/v1/files/' + id, { access: 'private', useCache: false })
    if (!result || !result.stream) return res.status(404).end()
    const mime = result.blob.contentType
    if (!Object.hasOwn(signatures, mime)) return res.status(415).end()
    const safeName = (typeof name === 'string' ? name : 'justificatif').slice(0, 160).replace(/[^a-zA-Z0-9_.-]/g, '_')
    res.setHeader('Content-Type', mime)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Disposition', 'inline; filename="' + safeName + '"')
    res.end(Buffer.from(await new Response(result.stream).arrayBuffer()))
  } catch {
    return res.status(503).json({ error: 'Le stockage privé est momentanément inaccessible.' })
  }
}
