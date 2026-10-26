const { getIronSession } = require('iron-session')
const crypto = require('node:crypto')

function options() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('Session non configurée')
  return { password: process.env.SESSION_SECRET, cookieName: 'bt_session', ttl: 8*3600,
    cookieOptions: { secure: process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development', httpOnly: true, sameSite: 'strict', path: '/' } }
}
const session = (req, res) => getIronSession(req, res, options())
const sameOrigin = req => { try { return !req.headers.origin || new URL(req.headers.origin).host === req.headers.host } catch (_) { return false } }
async function requireSession(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (!sameOrigin(req)) { res.status(403).json({error:'Origine non autorisée'}); return null }
  const user = await session(req, res)
  if (!['amely','tony'].includes(user.role)) { res.status(401).json({error:'Connexion requise'}); return null }
  return user
}
function pinRole(pin) {
  if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) return null
  for (const [role, configured] of [['amely',process.env.APP_PIN],['tony',process.env.TONY_PIN]]) {
    if (configured && configured.length === pin.length && crypto.timingSafeEqual(Buffer.from(pin),Buffer.from(configured))) return role
  }
  return null
}
module.exports = { session, requireSession, sameOrigin, pinRole }
