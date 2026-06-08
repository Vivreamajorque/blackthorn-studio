const { Client } = require('@notionhq/client')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  try {
    const notion = new Client({ auth: process.env.NOTION_KEY })
    const db = await notion.databases.retrieve({ database_id: 'ce868414-a4a5-4450-ab3f-804be7fd5eb1' })
    res.status(200).json({ ok: true, title: db.title?.[0]?.plain_text, node: process.version })
  } catch(e) {
    res.status(500).json({ error: e.message, node: process.version })
  }
}
