const { requireSession } = require('../server/session.cjs')
const { cleanLivementor: cleanCrm, readLivementor: readCrm, writeLivementor: writeCrm } = require('../server/livementor.cjs')

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
    const blob = module.exports.blobForTests || await import('@vercel/blob')
    const current = await readCrm(blob)
    if (req.method === 'GET') return res.status(200).json(current)

    const { revision, data } = req.body || {}
    if (revision !== null && (typeof revision !== 'string' || revision.length > 128)) return res.status(400).json({ error: 'Saisie invalide.' })
    if (current.revision !== revision) return res.status(409).json(current)
    const clean = cleanCrm(data)
    try {
      const etag = await writeCrm(blob, clean, revision)
      return res.status(200).json({ revision: etag, data: clean })
    } catch (error) {
      if (revision !== null && !(error instanceof blob.BlobPreconditionFailedError)) throw error
      return res.status(409).json(await readCrm(blob))
    }
  } catch {
    return res.status(503).json({ error: 'Le suivi LiveMentor est momentanément inaccessibles. Réessaie dans un instant.' })
  }
}
