// api/sumup-reconcile.js
// FILET DE SÉCURITÉ — indépendant du webhook SumUp et du navigateur du client.
//
// Pourquoi ce fichier existe :
// Le flux normal (client paie -> webhook SumUp appelle /api/sumup-webhook, OU
// le client revient sur l'onglet Booking -> /api/sumup-check) dépend soit de
// SumUp qui déclenche bien la notification, soit du navigateur du client qui
// reste ouvert et revient au premier plan. Si le client paie puis ferme
// l'onglet (très fréquent sur mobile), aucun des deux chemins ne se déclenche
// et le RDV + l'acompte n'apparaissent jamais dans le Hub.
//
// Ce endpoint scanne tous les devis "en attente de paiement" (Statut = 🔗 Lien
// envoyé + une date de RDV déjà choisie) et interroge SumUp DIRECTEMENT pour
// chaque checkout id stocké. Si SumUp confirme le paiement, on finalise
// exactement comme le webhook l'aurait fait. Aucune dépendance au navigateur
// du client ni à la fiabilité du webhook SumUp.
//
// Déclenché par :
//  1. Le Hub (TonyDashboard) à chaque chargement — usage naturel, plusieurs
//     fois par jour, donc quasi temps réel en pratique.
//  2. Un cron Vercel quotidien en filet de secours supplémentaire (voir vercel.json).

const https = require('https')

const NOTION_KEY  = process.env.NOTION_KEY
const SUMUP_KEY   = process.env.CLESUMUP || process.env.SUMUP_KEY
const DEVIS_DB    = 'b6d33466-c5db-4046-be2f-a242c8686a97'
const SESSIONS_DB = 'd5c3846e-3d3c-4eae-ade8-2e7efa3c896f'

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
    resp.on('end', () => { try { resolve(JSON.parse(d)) } catch(e) { reject(e) } })
  })
  r.on('error', reject)
  if (payload) r.write(payload)
  r.end()
})

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

  if (!NOTION_KEY || !SUMUP_KEY) {
    return res.status(200).json({ ok: false, error: 'NOTION_KEY ou SUMUP_KEY manquante' })
  }

  try {
    // Tous les devis avec un lien de paiement envoyé mais pas encore réservés
    const pending = await notion(`databases/${DEVIS_DB}/query`, 'POST', {
      filter: { property: 'Statut', select: { equals: '🔗 Lien envoyé' } },
      page_size: 50
    })

    const results = []

    for (const devis of (pending?.results || [])) {
      const notes = devis.properties?.Notes?.rich_text?.[0]?.plain_text || ''
      const checkoutMatch = notes.match(/CHECKOUT:([a-zA-Z0-9-]+)/)
      const rdvMatch = notes.match(/RDV:\s*(\d{4}-\d{2}-\d{2})\s*à\s*(\d{2}:\d{2})/)
      if (!checkoutMatch) continue // pas encore de paiement initié pour ce devis

      const checkoutId = checkoutMatch[1]
      const token = devis.properties?.Token?.rich_text?.[0]?.plain_text || ''

      // Cette devis a-t-elle déjà un RDV créé dans Sessions pour ce token ?
      const existingRdv = await notion(`databases/${SESSIONS_DB}/query`, 'POST', {
        filter: { property: 'Session', title: { contains: `SUMUP-${token}` } },
        page_size: 1
      })
      if (existingRdv?.results?.length > 0) { results.push({ token, skipped: 'already_processed' }); continue }

      const { statusCode, body: checkout } = await getSumUpCheckout(checkoutId)
      if (statusCode !== 200) { results.push({ token, skipped: 'checkout_fetch_failed', statusCode }); continue }

      const isPaid = ['PAID', 'SUCCESSFUL', 'paid', 'successful'].includes(checkout?.status)
      if (!isPaid) { results.push({ token, status: checkout?.status || 'unknown' }); continue }

      const client  = devis.properties?.Client?.rich_text?.[0]?.plain_text || 'Client'
      const desc    = devis.properties?.Description?.rich_text?.[0]?.plain_text || ''
      const prix    = devis.properties?.Prix?.number || 0
      const acompte = devis.properties?.Acompte?.number || checkout?.amount || 0
      const rdvDate = rdvMatch?.[1] || ''
      const rdvHeure = rdvMatch?.[2] || ''
      const today = new Date().toISOString().split('T')[0]

      if (rdvDate && rdvHeure) {
        await notion('pages', 'POST', {
          parent: { database_id: SESSIONS_DB },
          properties: {
            Session: { title: [{ text: { content: `[RDV] ${client} · ${rdvDate} · SUMUP-${token}` } }] },
            Type: { select: { name: '🖤 Tattoo Tony' } },
            Prix: { number: prix },
            'Acompte reçu': { number: acompte },
            'Solde reçu': { number: 0 },
            Nationalité: { select: { name: 'Autre' } },
            Date: { date: { start: `${rdvDate}T${rdvHeure}:00` } },
            Notes: { rich_text: [{ text: { content: `1 session(s) · Acompte SumUp payé (réconciliation auto): ${acompte}€` } }] },
            Statut: { select: { name: '🗓 Prévu' } },
            Source: { select: { name: '🔗 Lien réservation' } },
            'Client prénom': { rich_text: [{ text: { content: client } }] },
            'Style / Type': { rich_text: [{ text: { content: desc.substring(0, 200) } }] },
          }
        })
      }

      await notion('pages', 'POST', {
        parent: { database_id: SESSIONS_DB },
        properties: {
          Session: { title: [{ text: { content: `[VERSEMENT] ${client} · ${acompte}€` } }] },
          Type: { select: { name: '💰 Versement client' } },
          'Acompte reçu': { number: acompte },
          'Solde reçu': { number: 0 },
          Prix: { number: acompte },
          Nationalité: { select: { name: 'Autre' } },
          Date: { date: { start: today } },
          Notes: { rich_text: [{ text: { content: `Acompte SumUp (réconciliation auto)${rdvDate ? ` · RDV ${rdvDate} ${rdvHeure}` : ''}` } }] },
          Statut: { select: { name: '✅ Confirmé' } },
          Source: { select: { name: '🔗 Lien réservation' } },
          'Client prénom': { rich_text: [{ text: { content: client } }] },
          'Style / Type': { rich_text: [{ text: { content: desc.substring(0, 200) } }] },
        }
      })

      await notion(`pages/${devis.id}`, 'PATCH', {
        properties: {
          Statut: { select: { name: '✅ Réservé' } },
          Notes: { rich_text: [{ text: { content: `${notes} · Acompte SumUp payé (réconciliation auto): ${acompte}€` } }] }
        }
      })

      results.push({ token, client, acompte, reconciled: true })
    }

    return res.status(200).json({ ok: true, checked: pending?.results?.length || 0, results })
  } catch(e) {
    console.error('[SumUp Reconcile] erreur:', e.message)
    return res.status(200).json({ ok: false, error: e.message })
  }
}
