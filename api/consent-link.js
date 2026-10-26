const { requireSession } = require('../server/session.cjs')
const { notion, DBS } = require('../server/notion.cjs')
const { sealData } = require('iron-session')
module.exports = async (req,res) => {
  if (!await requireSession(req,res)) return
  if (req.method !== 'POST') return res.status(405).end()
  const id=req.body?.sessionId
  if (!/^[a-f0-9-]{32,36}$/.test(id || '')) return res.status(400).json({error:'Séance invalide'})
  try {
    const page=await notion(`pages/${id}`)
    if (page.parent?.database_id?.replace(/-/g,'') !== DBS.sessions.replace(/-/g,'')) return res.status(404).end()
    const access=await sealData({scope:'consent',sessionId:id},{password:process.env.SESSION_SECRET,ttl:24*3600})
    return res.status(200).json({access})
  } catch (_) { return res.status(502).json({error:'Lien indisponible'}) }
}
