// api/sumup-checkout.js
const SUMUP_KEY = process.env.CLESUMUP || process.env.SUMUP_KEY

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!SUMUP_KEY) return res.status(500).json({ error: 'SUMUP_KEY manquante' })

  const { amount, currency = 'EUR', description, reference } = req.body || {}
  if (!amount || !description) return res.status(400).json({ error: 'amount et description requis' })

  const https = require('https')

  // Référence propre — max 90 chars, alphanumeric + tirets
  const cleanRef = (reference || `BT-${Date.now()}`)
    .replace(/[^a-zA-Z0-9-]/g, '')
    .substring(0, 90)

  // SumUp exige pay_to_email OU merchant_code
  const merchantCode = process.env.SUMUP_MERCHANT_CODE
  const payToEmail   = process.env.SUMUP_EMAIL

  const payload = JSON.stringify({
    checkout_reference: cleanRef,
    amount:             Math.round(parseFloat(amount) * 100) / 100,
    currency:           currency,
    description:        String(description).substring(0, 100),
    ...(merchantCode ? { merchant_code: merchantCode } : {}),
    ...(payToEmail   ? { pay_to_email:  payToEmail   } : {}),
    return_url:         'https://blackthorn-studio.vercel.app',
  })

  console.log('[SumUp] Payload:', payload)
  return new Promise((resolve) => {
    const opts = {
      hostname: 'api.sumup.com',
      port: 443,
      path: '/v0.1/checkouts',
      method: 'POST',
      headers: {
        'Authorization':  `Bearer ${SUMUP_KEY}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }

    const r = https.request(opts, (resp) => {
      let data = ''
      resp.on('data', chunk => data += chunk)
      resp.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          console.log('[SumUp] Status:', resp.statusCode, '| Response:', JSON.stringify(parsed).substring(0, 300))
          if (resp.statusCode !== 200 && resp.statusCode !== 201) {
            res.status(resp.statusCode).json({
              error:   parsed.message || parsed.error_code || 'Erreur SumUp',
              status:  resp.statusCode,
              details: parsed
            })
          } else {
            const checkoutId  = parsed.id
            // Format correct pour SumUp Checkout page publique
            const payUrl = `https://pay.sumup.com/b2c/${process.env.SUMUP_MERCHANT_CODE || 'MMARD3DJ'}?checkout_id=${checkoutId}`
            res.status(200).json({ checkoutId, payUrl, amount: parsed.amount })
          }
        } catch(e) {
          res.status(500).json({ error: 'Parse error', raw: data.substring(0, 200) })
        }
        resolve()
      })
    })

    r.on('error', (e) => { res.status(500).json({ error: e.message }); resolve() })
    r.write(payload)
    r.end()
  })
}
