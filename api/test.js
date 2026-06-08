const getFetch = () => {
  if (typeof fetch !== 'undefined') return fetch
  try { return require('node-fetch') } catch(e) {}
  return null
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const NOTION_KEY = process.env.NOTION_KEY
  const fetchFn = getFetch()

  if (!fetchFn) return res.status(500).json({ error: 'fetch unavailable', nodeVersion: process.version })
  if (!NOTION_KEY) return res.status(500).json({ error: 'NOTION_KEY missing', nodeVersion: process.version })

  try {
    const r = await fetchFn('https://api.notion.com/v1/databases/ce868414-a4a5-4450-ab3f-804be7fd5eb1', {
      headers: {
        'Authorization': `Bearer ${NOTION_KEY}`,
        'Notion-Version': '2022-06-28'
      }
    })
    const d = await r.json()
    return res.status(r.status).json({
      nodeVersion: process.version,
      status: r.status,
      notion_title: d.title?.[0]?.plain_text || d.message || 'unknown',
      key_length: NOTION_KEY.length,
      ok: r.ok
    })
  } catch(e) {
    return res.status(500).json({ error: e.message, nodeVersion: process.version })
  }
}
