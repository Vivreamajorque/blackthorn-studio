const https = require('https')

const NOTION_KEY = process.env.NOTION_KEY
const BASE_HOST  = 'api.notion.com'

function notionRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null
    const options = {
      hostname: BASE_HOST,
      port: 443,
      path: `/v1/${path}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${NOTION_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch(e) { resolve({ status: res.statusCode, body: { error: data } }) }
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

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

  try {
    const r = await notionRequest(method, notionPath, hasBody ? req.body : null)
    return res.status(r.status).json(r.body)
  } catch(e) {
    return res.status(500).json({ error: e.message })
  }
}
