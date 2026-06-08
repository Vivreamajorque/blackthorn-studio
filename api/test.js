const https = require('https')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const key = process.env.NOTION_KEY
  if (!key) return res.status(500).json({ error: 'NOTION_KEY manquante', node: process.version })

  // Test Notion direct avec https natif
  const result = await new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.notion.com',
      port: 443,
      path: '/v1/databases/ce868414-a4a5-4450-ab3f-804be7fd5eb1',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Notion-Version': '2022-06-28'
      }
    }
    const req = https.request(opts, r => {
      let d = ''
      r.on('data', c => d += c)
      r.on('end', () => resolve({ status: r.statusCode, body: JSON.parse(d) }))
    })
    req.on('error', reject)
    req.end()
  })

  return res.status(result.status).json({
    node: process.version,
    status: result.status,
    title: result.body.title?.[0]?.plain_text || result.body.message || 'no title',
    ok: result.status === 200
  })
}
