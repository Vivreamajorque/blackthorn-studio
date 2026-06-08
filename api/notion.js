const NOTION_KEY = process.env.NOTION_KEY
const BASE = 'https://api.notion.com/v1'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { path } = req.query
  if (!path) return res.status(400).json({ error: 'path requis' })

  const notionPath = Array.isArray(path) ? path.join('/') : path
  const url = `${BASE}/${notionPath}`

  try {
    const r = await fetch(url, {
      method: req.method === 'GET' ? 'POST' : req.method,
      headers: {
        'Authorization': `Bearer ${NOTION_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: ['GET'].includes(req.method) ? undefined : JSON.stringify(req.body)
    })
    const data = await r.json()
    return res.status(r.status).json(data)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
