const limit = 3 * 1024 * 1024
const signatures = {
  'application/pdf': file => file.subarray(0, 5).toString() === '%PDF-',
  'image/png': file => file.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  'image/jpeg': file => file.subarray(0, 3).equals(Buffer.from([255, 216, 255])),
  'image/webp': file => file.subarray(0, 4).toString() === 'RIFF' && file.subarray(8, 12).toString() === 'WEBP',
}
const fileId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/

const prefix = 'mi-gestoria/personal/v1/files/'

function parseAttachment(value) {
  const { name, mime, base64 } = value || {}
  if (typeof name !== 'string' || !name.trim() || name.length > 160 ||
      !Object.hasOwn(signatures, mime) || typeof base64 !== 'string' || base64.length > Math.ceil(limit / 3) * 4) return null
  const bytes = Buffer.from(base64, 'base64')
  return bytes.length <= limit && signatures[mime](bytes) ? { name: name.trim(), mime, bytes } : null
}

async function storeAttachment(blob, value, id = require('node:crypto').randomUUID()) {
  const attachment = parseAttachment(value)
  if (!attachment || !fileId.test(id)) return null
  const { name, mime, bytes } = attachment
  const path = prefix + id
  try {
    await blob.put(path, bytes, { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: mime })
  } catch (error) {
    const current = await blob.get(path, { access: 'private', useCache: false })
    if (current?.blob.contentType !== mime || !Buffer.from(await new Response(current.stream).arrayBuffer()).equals(bytes)) throw error
  }
  return { id, name, mime }
}

module.exports = { signatures, fileId, parseAttachment, storeAttachment }
