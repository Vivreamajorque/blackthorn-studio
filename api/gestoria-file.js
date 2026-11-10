const { requireSession } = require('../server/session.cjs')

const { signatures, fileId, storeAttachment } = require('../server/gestoria-attachments.cjs')

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).end()
  }
  try {
    if (!(await requireSession(req, res))) return
    const blob = await import('@vercel/blob')
    if (req.method === 'POST') {
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
        return res.status(400).json({ error: 'Format du justificatif invalide.' })
      }
      if (req.body?.inbox === true) {
        const { receiveInboxFile } = require('../server/gestoria-inbox.cjs')
        const result = await receiveInboxFile(blob, req.body)
        return res.status(result.error ? 400 : result.duplicate ? 200 : 201).json(result)
      }
      const attachment = await storeAttachment(blob, req.body)
      if (!attachment) return res.status(400).json({ error: 'Choisis un PDF, JPEG, PNG ou WebP de 3 Mo maximum.' })
      return res.status(201).json(attachment)
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
    res.setHeader('Content-Disposition', (mime === 'text/csv' ? 'attachment' : 'inline') + '; filename="' + safeName + '"')
    res.end(Buffer.from(await new Response(result.stream).arrayBuffer()))
  } catch {
    return res.status(503).json({ error: 'Le stockage privé est momentanément inaccessible.' })
  }
}
