// api/sumup-webhook.js
// Reçoit les webhooks SumUp après paiement confirmé
// Crée le RDV dans Notion + marque le devis Réservé automatiquement
//
// IMPORTANT: SumUp envoie un payload MINIMAL sur le webhook:
//   { "event_type": "CHECKOUT_STATUS_CHANGED", "id": "..." }
// Il ne contient PAS le status, le checkout_reference ni le amount.
// Il faut donc rappeler l'API SumUp (GET /v0.1/checkouts/{id}) pour
// récupérer les vraies infos. Voir https://developer.sumup.com/online-payments/webhooks

const https = require('https')

const NOTION_KEY = process.env.NOTION_KEY
const SUMUP_KEY = process.env.CLESUMUP || process.env.SUMUP_KEY
const DEVIS_DB = 'b6d33466-c5db-4046-be2f-a242c8686a97'
const SESSIONS_DB = 'd5c3846e-3d3c-4eae-ade8-2e7efa3c896f'

// Appel Notion
const notion = (path, method = 'GET', body = null) => new Promise((resolve, reject) => {
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
  const r = https.request(opts, (resp) => {
    let d = ''
    resp.on('data', c => d += c)
    resp.on('end', () => {
      try { resolve(JSON.parse(d)) } catch(e) { reject(e) }
    })
  })
  r.on('error', reject)
  if (payload) r.write(payload)
  r.end()
})

// Appel SumUp — récupère le checkout complet (status, checkout_reference, amount...)
// à partir du seul champ fiable du webhook: l'id.
const getSumUpCheckout = (checkoutId) => new Promise((resolve, reject) => {
  const opts = {
    hostname: 'api.sumup.com', port: 443,
    path: `/v0.1/checkouts/${checkoutId}`, method: 'GET',
    headers: { 'Authorization': `Bearer ${SUMUP_KEY}` }
  }
  const r = https.request(opts, (resp) => {
    let d = ''
    resp.on('data', c => d += c)
    resp.on('end', () => {
      try { resolve({ statusCode: resp.statusCode, body: JSON.parse(d) }) }
      catch(e) { reject(e) }
    })
  })
  r.on('error', reject)
  r.end()
})

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // SumUp peut envoyer GET pour vérifier l'URL, OPTIONS pour CORS
  if (req.method === 'GET') return res.status(200).json({ ok: true, service: 'blackthorn-webhook' })
  if (req.method !== 'POST') return res.status(200).end() // 200 au lieu de 405 pour ne pas bloquer SumUp

  try {
    const rawEvent = req.body
    console.log('[SumUp Webhook] Payload reçu:', JSON.stringify(rawEvent).substring(0, 200))

  if (!SUMUP_KEY) {
    console.error('[SumUp Webhook] SUMUP_KEY manquante — impossible de vérifier le checkout')
    return res.status(200).json({ received: true, error: 'sumup_key_missing' })
  }

  // Le webhook ne contient fiablement que l'id du checkout (+ event_type).
  // On ignore tout event_type inconnu (recommandation officielle SumUp).
  const checkoutId = rawEvent?.id
    if (!checkoutId) {
      console.log('[SumUp Webhook] Pas d\'id de checkout dans le payload, ignoré')
      return res.status(200).json({ received: true, ignored: true, reason: 'no_checkout_id' })
    }

  // Toujours vérifier le vrai statut auprès de SumUp avant d'agir
  const { statusCode, body: checkout } = await getSumUpCheckout(checkoutId)
    if (statusCode !== 200) {
      console.log('[SumUp Webhook] Impossible de récupérer le checkout:', checkoutId, statusCode, JSON.stringify(checkout).substring(0,200))
      return res.status(200).json({ received: true, ignored: true, reason: 'checkout_fetch_failed' })
    }

  const event = checkout // à partir d'ici, event = objet checkout complet renvoyé par SumUp

  // On ne traite que les paiements réussis
  const status = event?.status
    const isPaid = ['PAID', 'SUCCESSFUL', 'paid', 'successful'].includes(status)
    if (!isPaid) {
      console.log('[SumUp Webhook] Statut ignoré:', status, '| checkout:', checkoutId)
      return res.status(200).json({ received: true, ignored: true, status })
    }

  // Extraire le token depuis la référence (format: BT-TOKEN-TIMESTAMP)
  const reference = event?.checkout_reference || ''
    const match = reference.match(/^BT-([A-Z0-9]+)-\d+$/)
    if (!match) {
      console.log('[SumUp Webhook] Référence non reconnue:', reference)
      return res.status(200).json({ received: true, ignored: true, reason: 'ref_format' })
    }
    const token = match[1]
    const amount = event?.amount || 0

  // Chercher le devis par token
  const devisResult = await notion(
    `databases/${DEVIS_DB}/query`, 'POST',
    { filter: { property: 'Token', rich_text: { equals: token } }, page_size: 1 }
    )
    const devis = devisResult?.results?.[0]
    if (!devis) {
      console.log('[SumUp Webhook] Devis non trouvé pour token:', token)
      return res.status(200).json({ received: true, ignored: true, reason: 'devis_not_found' })
    }

  // Vérifier si déjà traité (session Planning déjà créée) pour éviter les doublons
  // On vérifie l'existence d'un [RDV] pour ce token plutôt que le statut du devis
  // car le statut peut être Réservé sans que le paiement soit confirmé (bug ancien flow)
  const existingRdv = await notion(
    `databases/${SESSIONS_DB}/query`, 'POST',
    { filter: { property: 'Session', title: { contains: `SUMUP-${token}` } }, page_size: 1 }
    )
    if (existingRdv?.results?.length > 0) {
      console.log('[SumUp Webhook] Déjà traité pour token:', token)
      return res.status(200).json({ received: true, ignored: true, reason: 'already_processed' })
    }

  // Lire les infos du devis
  const client = devis.properties.Client?.rich_text?.[0]?.plain_text || 'Client'
    const desc = devis.properties.Description?.rich_text?.[0]?.plain_text || ''
    const prix = devis.properties.Prix?.number || 0
    const acompte = devis.properties.Acompte?.number || amount || 0
    const duree = devis.properties['Durée']?.number || 120
    const notes = devis.properties.Notes?.rich_text?.[0]?.plain_text || ''

  // Extraire date et heure depuis plusieurs formats possibles
  // Format devis: "RDV: 2026-06-25 à 17:30"
  // Format booking: "Acompte tatouage — Tanja — 2026-06-25 17:30"
  const descEvent = event?.description || ''
    const rdvMatch = notes.match(/RDV:\s*(\d{4}-\d{2}-\d{2})\s*à\s*(\d{2}:\d{2})/)
    || descEvent.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/)
    const rdvDate = rdvMatch?.[1] || ''
    const rdvHeure = rdvMatch?.[2] || ''
    // Extraire le client depuis la description si pas dans le devis
  const clientFinal = client || descEvent.split('—')[1]?.trim() || 'Client'

  // Créer le RDV dans Sessions si on a une date
  const today = new Date().toISOString().split('T')[0]
    if (rdvDate && rdvHeure) {
      const dateStart = `${rdvDate}T${rdvHeure}:00`
      await notion('pages', 'POST', {
        parent: { database_id: SESSIONS_DB },
        properties: {
          Session: { title: [{ text: { content: `[RDV] ${clientFinal} · ${rdvDate} · SUMUP-${token}` } }] },
          Type: { select: { name: '🖤 Tattoo Tony' } },
          Prix: { number: prix },
          'Acompte reçu': { number: acompte },
          'Solde reçu': { number: 0 },
          Nationalité: { select: { name: 'Autre' } },
          Date: { date: { start: dateStart } },
          Notes: { rich_text: [{ text: { content: `1 session(s) · Acompte SumUp payé: ${acompte}€` } }] },
          Statut: { select: { name: '🗓 Prévu' } },
          Source: { select: { name: '🔗 Lien réservation' } },
          'Client prénom':{ rich_text: [{ text: { content: clientFinal } }] },
          'Style / Type': { rich_text: [{ text: { content: desc.substring(0, 200) } }] },
        }
      })
    }

  // Créer systématiquement le [VERSEMENT] pour comptabiliser l'acompte
  await notion('pages', 'POST', {
    parent: { database_id: SESSIONS_DB },
    properties: {
      Session: { title: [{ text: { content: `[VERSEMENT] ${clientFinal} · ${acompte}€` } }] },
      Type: { select: { name: '💰 Versement client' } },
      'Acompte reçu': { number: acompte },
      'Solde reçu': { number: 0 },
      Prix: { number: acompte },
      Nationalité: { select: { name: 'Autre' } },
      Date: { date: { start: today } },
      Notes: { rich_text: [{ text: { content: `Acompte SumUp ${reference}${rdvDate ? ` · RDV ${rdvDate} ${rdvHeure}` : ''}` } }] },
      Statut: { select: { name: '✅ Confirmé' } },
      Source: { select: { name: '🔗 Lien réservation' } },
      'Client prénom':{ rich_text: [{ text: { content: clientFinal } }] },
      'Style / Type': { rich_text: [{ text: { content: desc.substring(0, 200) } }] },
    }
  })

  // Marquer le devis comme Réservé
  await notion(`pages/${devis.id}`, 'PATCH', {
    properties: {
      Statut: { select: { name: '✅ Réservé' } },
      Notes: { rich_text: [{ text: { content: `${notes} · Acompte SumUp payé: ${acompte}€` } }] }
    }
  })

  console.log('[SumUp Webhook] ✅ Devis réservé:', token, '| Client:', client, '| Acompte:', acompte)
    return res.status(200).json({ received: true, success: true, token, client })

  } catch(e) {
    console.error('[SumUp Webhook] Erreur:', e.message)
    return res.status(200).json({ received: true, error: e.message })
    // On retourne 200 pour éviter que SumUp retry indéfiniment
  }
}
