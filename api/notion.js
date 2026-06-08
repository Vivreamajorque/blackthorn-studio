const https = require('https')
const NOTION_KEY = process.env.NOTION_KEY

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const rawPath = req.query.path
  if (!rawPath) return res.status(400).json({ error: 'path requis' })
  if (!NOTION_KEY) return res.status(500).json({ error: 'NOTION_KEY manquante' })

  const notionPath = Array.isArray(rawPath) ? rawPath.join('/') : rawPath
  const method = req.method || 'GET'
  const hasBody = ['POST', 'PATCH', 'PUT'].includes(method)

  return new Promise((resolve) => {
    const payload = hasBody && req.body ? JSON.stringify(req.body) : null
    const opts = {
      hostname: 'api.notion.com', port: 443,
      path: `/v1/${notionPath}`, method,
      headers: {
        'Authorization': `Bearer ${NOTION_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }
    const req2 = https.request(opts, (r) => {
      let d = ''
      r.on('data', c => d += c)
      r.on('end', () => {
        try { res.status(r.statusCode).json(JSON.parse(d)); resolve() }
        catch(e) { res.status(r.statusCode).json({ error: d }); resolve() }
      })
    })
    req2.on('error', (e) => { res.status(500).json({ error: e.message }); resolve() })
    if (payload) req2.write(payload)
    req2.end()
  })
}
