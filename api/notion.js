import { createServer } from 'https'

const NOTION_KEY = process.env.NOTION_KEY
const BASE_HOST  = 'api.notion.com'

function notionRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null
    const options = {
      hostname: BASE_HOST,
      port: 443,
      path: `/v1/${path}`,
      method,
      headers: {
        'Authorization': `Bearer ${NOTION_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }
    const { request } = await import('https')
    const req = request(options, (res) => {
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

export default async function handler(req, res) {
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
    const { request } = await import('https')
    const r = await new Promise((resolve, reject) => {
      const payload = hasBody && req.body ? JSON.stringify(req.body) : null
      const opts = {
        hostname: BASE_HOST, port: 443,
        path: `/v1/${notionPath}`, method,
        headers: {
          'Authorization': `Bearer ${NOTION_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      }
      const req2 = request(opts, (res2) => {
        let d = ''
        res2.on('data', c => d += c)
        res2.on('end', () => {
          try { resolve({ status: res2.statusCode, body: JSON.parse(d) }) }
          catch(e) { resolve({ status: res2.statusCode, body: { error: d } }) }
        })
      })
      req2.on('error', reject)
      if (payload) req2.write(payload)
      req2.end()
    })
    return res.status(r.status).json(r.body)
  } catch(e) {
    return res.status(500).json({ error: e.message })
  }
}
