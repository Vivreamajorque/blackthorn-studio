// api/consent-submit.js
const https   = require('https')
const NOTION_KEY  = process.env.NOTION_KEY
const SESSIONS_DB = 'd5c3846e-3d3c-4eae-ade8-2e7efa3c896f'
const DRIVE_FOLDER_ID = '1hKI1f8Ur7oVQ4PF6WMjwoSAhDttQB-Z2'

const notion = (path, method, body) => new Promise((resolve, reject) => {
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

const uploadToBlob = async (pdfBase64, filename) => {
  try {
    const { put } = await import('@vercel/blob')
    const buffer = Buffer.from(pdfBase64.split(',')[1] || pdfBase64, 'base64')
    const blob = await put(`consentements/${filename}`, buffer, {
      access: 'private',
      contentType: 'application/pdf',
    })
    return blob.url
  } catch(e) {
    console.warn('[consent-submit] Blob upload failed:', e.message)
    return null
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { sessionId, data, signature, lang, pdfData } = req.body || {}
  if (!sessionId || !data) return res.status(400).json({ error: 'sessionId et data requis' })

  try {
    const now = new Date().toLocaleString('fr-FR')
    const contraStr = Object.entries(data.contras || {})
      .filter(([,v]) => v === true).map(([k]) => k).join(', ') || 'Aucune'
    const autreDetail = data.contras?.autre && data.autreDetail
      ? ` (Précision : ${data.autreDetail})`
      : ''

    // Upload PDF
    let pdfUrl = null
    const filename = `${data.nom?.replace(/\s+/g,'-') || 'client'}-${Date.now()}.pdf`
    if (pdfData) {
      pdfUrl = await uploadToBlob(pdfData, filename)
      console.log('[consent-submit] PDF URL:', pdfUrl)
    }

    const newConsent = [
      `📋 CONSENTEMENT SIGNÉ — ${now}`,
      `Nom : ${data.nom || '—'} | DNI/Passeport : ${data.dni || '—'}`,
      `Né(e) le : ${data.dateNaissance || '—'} | Nationalité : ${data.nationalite || '—'}`,
      `Email : ${data.email || '—'} | Tél : ${data.telephone || '—'}`,
      `Majeur(e) : ${data.majeur ? 'OUI' : 'NON'}`,
      `Contre-indications : ${contraStr}${autreDetail}`,
      `Photo réseaux : ${data.photoOk ? 'OUI' : 'NON'}`,
      `RGPD : OUI | Langue : ${lang || 'fr'}`,
      signature ? '✍️ Signature numérique : OUI' : '',
      pdfUrl ? `📄 PDF : ${pdfUrl}` : '',
    ].filter(Boolean).join('\n')

    // Lire les Notes existantes pour NE PAS écraser les fiches précédentes
    let existingNotes = ''
    try {
      const page = await notion(`pages/${sessionId}`, 'GET')
      existingNotes = page?.properties?.Notes?.rich_text?.[0]?.plain_text || ''
    } catch(_) {}

    // Concatener : si Notes existantes contiennent déjà un consentement, on ajoute séparateur
    const hasExistingConsent = existingNotes.includes('📋 CONSENTEMENT SIGNÉ')
    const nbExisting = (existingNotes.match(/📋 CONSENTEMENT SIGNÉ/g) || []).length
    const separator = hasExistingConsent ? `\n\n--- FICHE ${nbExisting + 1} ---\n` : ''
    const finalNotes = (existingNotes + separator + newConsent).substring(0, 1900)

    // Mise à jour — on préserve le Client prénom de la première fiche si déjà rempli
    const clientPrenom = nbExisting === 0 ? (data.nom || '').substring(0, 200) : undefined

    await notion(`pages/${sessionId}`, 'PATCH', {
      properties: {
        'Fiche signée': { checkbox: true },
        'Notes':        { rich_text: [{ text: { content: finalNotes } }] },
        ...(clientPrenom ? { 'Client prénom': { rich_text: [{ text: { content: clientPrenom } }] } } : {}),
      }
    })

    console.log(`[consent-submit] ✅ Fiche ${nbExisting + 1} ajoutée pour session ${sessionId}`)
    return res.status(200).json({ success: true, pdfUrl, ficheNum: nbExisting + 1 })
  } catch(e) {
    console.error('[consent-submit]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
