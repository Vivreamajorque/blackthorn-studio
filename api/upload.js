const https = require('https')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { image, filename = 'ticket.jpg' } = req.body
    if (!image) return res.status(400).json({ error: 'image manquante' })

    // Base64 → buffer
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const mimeType = image.match(/^data:(image\/\w+);/)?.[1] || 'image/jpeg'

    // Upload vers tmpfiles.org (gratuit, sans compte, durée 24h)
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ])

    const result = await new Promise((resolve, reject) => {
      const opts = {
        hostname: 'tmpfiles.org', port: 443, path: '/api/v1/upload',
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length
        }
      }
      const r = https.request(opts, (resp) => {
        let d = ''
        resp.on('data', c => d += c)
        resp.on('end', () => {
          try { resolve(JSON.parse(d)) } catch(e) { resolve({ error: d }) }
        })
      })
      r.on('error', reject)
      r.write(body)
      r.end()
    })

    if (result.status === 'success' && result.data?.url) {
      // Convertir en URL directe
      const url = result.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
      return res.status(200).json({ url })
    } else {
      return res.status(500).json({ error: 'Upload échoué', detail: result })
    }
  } catch(e) {
    return res.status(500).json({ error: e.message })
  }
}
