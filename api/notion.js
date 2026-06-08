const { Client } = require('@notionhq/client')

const notion = new Client({ auth: process.env.NOTION_KEY })

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const rawPath = req.query.path
  if (!rawPath) return res.status(400).json({ error: 'path requis' })

  const notionPath = Array.isArray(rawPath) ? rawPath.join('/') : rawPath
  const method = req.method || 'GET'
  const body   = req.body || {}

  try {
    let result

    if (notionPath === 'pages' && method === 'POST') {
      result = await notion.pages.create(body)
    } else if (notionPath.startsWith('databases/') && notionPath.endsWith('/query') && method === 'POST') {
      const dbId = notionPath.split('/')[1]
      result = await notion.databases.query({ database_id: dbId, ...body })
    } else if (notionPath.startsWith('databases/') && method === 'GET') {
      const dbId = notionPath.split('/')[1]
      result = await notion.databases.retrieve({ database_id: dbId })
    } else if (notionPath.startsWith('pages/') && method === 'PATCH') {
      const pageId = notionPath.split('/')[1]
      result = await notion.pages.update({ page_id: pageId, ...body })
    } else {
      return res.status(400).json({ error: `Route non gérée: ${method} ${notionPath}` })
    }

    return res.status(200).json(result)
  } catch(e) {
    return res.status(e.status || 500).json({
      error: e.message,
      code: e.code,
      body: e.body
    })
  }
}
