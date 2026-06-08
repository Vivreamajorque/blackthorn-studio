const NOTION_KEY = process.env.NOTION_KEY
const BASE = 'https://api.notion.com/v1'

// Compatibilité Node.js < 18
const getFetch = () => {
  if (typeof fetch !== 'undefined') return fetch
  try { return require('node-fetch') } catch(e) {}
  return null
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const rawPath = req.query.path
  if (!rawPath) return res.status(400).json({ error: 'path requis' })

  const notionPath = Array.isArray(rawPath) ? rawPath.join('/') : rawPath
  const url = `${BASE}/${notionPath}`
  const method = req.method || 'GET'
  const hasBody = ['POST', 'PATCH', 'PUT'].includes(method)

  if (!NOTION_KEY) return res.status(500).json({ error: 'NOTION_KEY non configurée' })

  try {
    const fetchFn = getFetch()
    if (!fetchFn) return res.status(500).json({ error: 'fetch non disponible' })

    const r = await fetchFn(url, {
      method,
      headers: {
        'Authorization': `Bearer ${NOTION_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: hasBody && req.body ? JSON.stringify(req.body) : undefined
    })
    const data = await r.json()
    return res.status(r.status).json(data)
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack?.substring(0,200) })
  }
}
