const origin = 'https://mi-gestoria-amely.vercel.app'
const cookieName = '__Host-blackthorn-gestoria'
const validToken = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)
const sessionCookie = (value, age) => cookieName + '=' + value + '; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=' + age

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'POST') return res.status(405).end()
  if (!req.headers.host || req.headers.origin !== 'https://' + req.headers.host ||
      !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return res.status(403).end()
  const { action, code, year, expense, file } = req.body || {}
  if (action === 'logout') {
    res.setHeader('Set-Cookie', sessionCookie('', 0))
    return res.status(200).json({ connected: false })
  }
  if (!['activate', 'load', 'expense', 'inbox'].includes(action)) return res.status(400).end()
  const stored = (req.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith(cookieName + '='))?.slice(cookieName.length + 1)
  const token = action === 'activate' ? code : stored
  if (!validToken(token)) return res.status(401).json({ error: 'Saisis le code Mi Gestoría pour activer cet accès.' })
  const key = process.env.GESTORIA_TONY_BRIDGE_SECRET
  if (!key) return res.status(503).json({ error: 'La liaison Mi Gestoría est momentanément indisponible.' })
  try {
    const response = await fetch(origin + '/api/gestoria-tony', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Gestoria-Bridge': key },
      body: JSON.stringify({ action, token, year, expense, file }), signal: AbortSignal.timeout(action === 'inbox' ? 50000 : 20000),
    })
    const data = await response.json()
    if (!response.ok) {
      if (response.status === 401 && action !== 'activate') res.setHeader('Set-Cookie', sessionCookie('', 0))
      return res.status(response.status).json({ error: data.error || 'Mi Gestoría est momentanément inaccessible.' })
    }
    if (action === 'activate') {
      if (!validToken(data.sessionToken) || !Number.isSafeInteger(data.maxAge) || data.maxAge <= 0 || data.maxAge > 30 * 86400) throw new Error()
      res.setHeader('Set-Cookie', sessionCookie(data.sessionToken, data.maxAge))
      return res.status(200).json({ connected: true })
    }
    return res.status(response.status).json(action === 'load' ? { months: data.months } : action === 'inbox' ? { received: data.received, duplicate: data.duplicate } : { id: data.id })
  } catch {
    return res.status(503).json({ error: 'La liaison Mi Gestoría est momentanément indisponible.' })
  }
}
