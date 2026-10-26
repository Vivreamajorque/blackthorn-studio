const { session, sameOrigin, pinRole } = require('../server/session.cjs')
const attempts = new Map()

module.exports = async (req, res) => {
  res.setHeader('Cache-Control','private, no-store')
  if (!sameOrigin(req)) return res.status(403).json({error:'Origine non autorisée'})
  try {
    const user = await session(req,res)
    if (req.method === 'GET') return res.status(200).json({role: ['amely','tony'].includes(user.role) ? user.role : null})
    if (req.method === 'DELETE') { user.destroy(); return res.status(200).json({role:null}) }
    if (req.method !== 'POST') return res.status(405).end()
    // Local throttling; counters are scoped to this server instance.
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown'
    const now = Date.now(), entry = attempts.get(ip)
    if (entry && entry.until > now && entry.count >= 8) return res.status(429).json({error:'Trop de tentatives. Réessayez dans 15 minutes.'})
    const role = pinRole(req.body?.pin)
    if (!role) {
      const next = !entry || entry.until <= now ? {count:1,until:now+15*60*1000} : {...entry,count:entry.count+1}
      attempts.set(ip,next)
      if (attempts.size > 1000) for (const [key,value] of attempts) if (value.until < now) attempts.delete(key)
      return res.status(401).json({error:'Code incorrect'})
    }
    attempts.delete(ip)
    user.role = role
    await user.save()
    return res.status(200).json({role})
  } catch (_) { return res.status(503).json({error:'Connexion temporairement indisponible'}) }
}
