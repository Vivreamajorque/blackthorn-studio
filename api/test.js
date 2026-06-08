module.exports = function handler(req, res) {
  res.status(200).json({ ok: true, node: process.version, key: !!process.env.NOTION_KEY })
}
