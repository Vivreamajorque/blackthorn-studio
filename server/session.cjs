const { getIronSession } = require('iron-session')

function appOrigin() {
  return new URL(process.env.GESTORIA_URL)
}

function allowedRequest(req) {
  const expected = appOrigin()
  if (req.headers.host !== expected.host) return false
  if (req.method === 'GET') return !req.headers.origin || req.headers.origin === expected.origin
  return req.headers.origin === expected.origin
}

function session(req, res) {
  return getIronSession(req, res, {
    password: process.env.GESTORIA_SESSION_SECRET,
    cookieName: '__Host-gestoria-session',
    ttl: 8 * 3600,
    cookieOptions: { secure: true, httpOnly: true, sameSite: 'strict', path: '/' },
  })
}

async function requireSession(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (!allowedRequest(req)) {
    res.status(403).json({ error: 'Origine non autorisée' })
    return null
  }
  const user = await session(req, res)
  if (user.role !== 'owner') {
    res.status(401).json({ error: 'Connexion requise' })
    return null
  }
  return user
}

module.exports = { appOrigin, allowedRequest, session, requireSession }
