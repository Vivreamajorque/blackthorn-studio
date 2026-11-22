// Suivi des apprenants LiveMentor (« La Méthode Mentor ») : un fichier privé à part, avec un nettoyage générique
// et borné (les fiches ont une structure riche : diagnostic, coaching, journal, tâches, indicateurs…).
const { readVersionedBlob } = require('./private-blob.cjs')

const LM_PATH = 'mi-gestoria/livementor/v1/apprenants.json'
const ID = /^[\w-]{1,80}$/

function sanitize(v, depth = 0) {
  if (v === null || typeof v === 'boolean') return v
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') return v.slice(0, 20000)
  if (depth > 6) return null
  if (Array.isArray(v)) return v.slice(0, 300).map(x => sanitize(x, depth + 1))
  if (typeof v === 'object') {
    const out = {}
    for (const [k, x] of Object.entries(v).slice(0, 120)) if (/^[\w$-]{1,60}$/.test(k)) out[k] = sanitize(x, depth + 1)
    return out
  }
  return null
}

function cleanLivementor(data) {
  const list = Array.isArray(data?.apprenants) ? data.apprenants : []
  const seen = new Set()
  const apprenants = list.slice(0, 150).filter(a => a && ID.test(a.id) && typeof a.nom === 'string' && a.nom.trim() && !seen.has(a.id) && seen.add(a.id))
    .map(a => ({ ...sanitize(a), id: a.id, nom: a.nom.trim().slice(0, 120), archive: a.archive === true }))
  return { apprenants }
}

async function readLivementor(blob) {
  const r = await readVersionedBlob(blob, LM_PATH)
  if (!r) return { revision: null, data: { apprenants: [] } }
  return { revision: r.revision, data: cleanLivementor(await new Response(r.content.stream).json()) }
}

async function writeLivementor(blob, data, revision) {
  const saved = await blob.put(LM_PATH, JSON.stringify(data), {
    access: 'private', addRandomSuffix: false, contentType: 'application/json',
    allowOverwrite: revision !== null, ...(revision !== null && { ifMatch: revision }),
  })
  return saved.etag
}

async function updateLivementor(blob, fn) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { revision, data } = await readLivementor(blob)
    const next = cleanLivementor(fn(data))
    try { await writeLivementor(blob, next, revision); return next } catch (e) { if (attempt === 2) throw e }
  }
}

module.exports = { LM_PATH, cleanLivementor, readLivementor, writeLivementor, updateLivementor }
