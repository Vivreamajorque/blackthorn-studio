// api/sumup-check.js
// Vérifie le statut d'un checkout SumUp et finalise la réservation si payé
const https = require('https')
const SUMUP_KEY    = process.env.CLESUMUP || process.env.SUMUP_KEY
const NOTION_KEY   = process.env.NOTION_KEY
const DEVIS_DB     = 'b6d33466-c5db-4046-be2f-a242c8686a97'
const SESSIONS_DB  = 'd5c3846e-3d3c-4eae-ade8-2e7efa3c896f'

const notionCall = (path, method = 'GET', body = null) => new Promise((resolve, reject) => {
  const payload = body ? JSON.stringify(body) : null
  const opts = {
    hostname: 'api.notion.com', port: 443,
    path: `/v1/${path}`, method,
    headers: {
      'Authorization': `Bearer ${NOTION_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
    }
  }
  const r = https.request(opts, resp => {
    let d = ''; resp.on('data', c => d += c)
    resp.on('end', () => { try { resolve(JSON.parse(d)) } catch(e) { reject(e) } })
  })
  r.on('error', reject)
  if (payload) r.write(payload)
  r.end()
})

const sumupCall = (path) => new Promise((resolve, reject) => {
  const opts = {
    hostname: 'api.sumup.com', port: 443,
    path: `/v0.1/${path}`, method: 'GET',
    headers: { 'Authorization': `Bearer ${SUMUP_KEY}` }
  }
  const r = https.request(opts, resp => {
    let d = ''; resp.on('data', c => d += c)
    resp.on('end', () => { try { resolve(JSON.parse(d)) } catch(e) { reject(e) } })
  })
  r.on('error', reject)
  r.end()
})

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { checkoutId, token } = req.method === 'GET' ? req.query : (req.body || {})
  if (!checkoutId || !token) return res.status(400).json({ error: 'checkoutId et token requis' })

  try {
    // 1. Vérifier le statut du checkout SumUp
    const checkout = await sumupCall(`checkouts/${checkoutId}`)
    console.log('[SumUp Check] status:', checkout.status, 'id:', checkoutId)

    const paid = ['PAID', 'SUCCESSFUL'].includes(checkout.status)
    if (!paid) {
      return res.status(200).json({ paid: false, status: checkout.status })
    }

    // 2. Chercher le devis par token
    const devisResult = await notionCall(`databases/${DEVIS_DB}/query`, 'POST', {
      filter: { property: 'Token', rich_text: { equals: token } }, page_size: 1
    })
    const devis = devisResult?.results?.[0]
    if (!devis) return res.status(200).json({ paid: true, error: 'devis_not_found' })

    // Déjà réservé
    if (devis.properties.Statut?.select?.name === '✅ Réservé') {
      return res.status(200).json({ paid: true, alreadyReserved: true })
    }

    // 3. Lire les infos du devis
    const client  = devis.properties.Client?.rich_text?.[0]?.plain_text || 'Client'
    const prix    = devis.properties.Prix?.number || 0
    const acompte = devis.properties.Acompte?.number || checkout.amount || 0
    const duree   = devis.properties['Durée']?.number || 120
    const desc    = devis.properties.Description?.rich_text?.[0]?.plain_text || ''
    const notes   = devis.properties.Notes?.rich_text?.[0]?.plain_text || ''
    // Parser la date depuis les notes du devis OU depuis la description du checkout
    const checkoutDesc = checkout?.description || ''
    const rdvMatch = notes.match(/RDV:\s*(\d{4}-\d{2}-\d{2})\s*à\s*(\d{2}:\d{2})/)
                  || checkoutDesc.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/)
    // Client depuis description si pas dans devis
    const clientFinal = client || checkoutDesc.split('—')[1]?.trim() || 'Client'

    // 4. Créer le RDV si on a la date
    if (rdvMatch) {
      const [, dateRdv, heureRdv] = rdvMatch
      await notionCall('pages', 'POST', {
        parent: { database_id: SESSIONS_DB },
        properties: {
          Session:        { title: [{ text: { content: `[RDV] ${clientFinal} · ${dateRdv}` } }] },
          Type:           { select: { name: '🖤 Tattoo Tony' } },
          Prix:           { number: prix },
          'Acompte reçu': { number: acompte },
          'Solde reçu':   { number: 0 },
          Nationalité:    { select: { name: 'Autre' } },
          Date:           { date: { start: `${dateRdv}T${heureRdv}:00` } },
          Notes:          { rich_text: [{ text: { content: `Acompte SumUp payé: ${acompte}€` } }] },
          Statut:         { select: { name: '🗓 Prévu' } },
          Source:         { select: { name: '🔗 Lien réservation' } },
          'Client prénom':{ rich_text: [{ text: { content: clientFinal } }] },
          'Style / Type': { rich_text: [{ text: { content: desc.substring(0, 200) } }] },
        }
      })
    }

    // 5. Marquer le devis Réservé
    await notionCall(`pages/${devis.id}`, 'PATCH', {
      properties: { Statut: { select: { name: '✅ Réservé' } } }
    })

    return res.status(200).json({ paid: true, success: true, client, acompte })
  } catch(e) {
    console.error('[SumUp Check] error:', e.message)
    return res.status(500).json({ error: e.message })
  }
}
