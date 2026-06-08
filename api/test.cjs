module.exports = function handler(req, res) {
  const key = process.env.NOTION_KEY
  res.status(200).json({ ok: true, node: process.version, hasKey: !!key, keyLen: key?.length })
}
