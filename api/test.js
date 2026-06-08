module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const NOTION_KEY = process.env.NOTION_KEY
  
  // Test simple : lire la DB Sessions
  try {
    const r = await fetch('https://api.notion.com/v1/databases/ce868414-a4a5-4450-ab3f-804be7fd5eb1', {
      headers: {
        'Authorization': `Bearer ${NOTION_KEY}`,
        'Notion-Version': '2022-06-28'
      }
    })
    const d = await r.json()
    return res.status(r.status).json({
      status: r.status,
      key_present: !!NOTION_KEY,
      key_length: NOTION_KEY?.length,
      notion_title: d.title?.[0]?.plain_text || d.message || 'unknown',
      error: d.message || null
    })
  } catch(e) {
    return res.status(500).json({ error: e.message, key_present: !!NOTION_KEY })
  }
}
