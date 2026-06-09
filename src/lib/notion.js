const SESSIONS_DB  = 'd5c3846e-3d3c-4eae-ade8-2e7efa3c896f'
const CLIENTS_DB   = '53149c61-3639-45a2-ab49-c2ea77a7c088'
const KPIS_DB      = '450c0c95-33e0-47c6-ae27-3c9540162cd2'
const DEPENSES_DB  = '323d80c7-6418-4b25-a4c6-70cea0fd20a1'

const call = async (path, method = 'POST', body = null) => {
  const url = `/api/notion?path=${encodeURIComponent(path)}`
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(`Notion ${r.status}: ${err.message || err.error || JSON.stringify(err).substring(0,100)}`)
  }
  return r.json()
}

export const notion = {
  getSessions: () => call(`databases/${SESSIONS_DB}/query`, 'POST', {
    sorts: [{ property: 'Date', direction: 'descending' }],
    page_size: 100
  }),

  addSession: (data) => call('pages', 'POST', {
    parent: { database_id: SESSIONS_DB },
    properties: {
      Session: { title: [{ text: { content: `[${(data.paiement||'CASH').toUpperCase()}] ${data.session || `Session ${data.date}`}` } }] },
      Type: { select: { name: data.type && ['🖤 Tattoo Tony','💎 Piercing Amely','🛍️ Bijou vendu','🎨 Tattoo Amely','🎁 Gift Voucher','💚 Revenu Amely'].includes(data.type) ? data.type : '🖤 Tattoo Tony' } },
      'Client prénom': { rich_text: [{ text: { content: data.client || '' } }] },
      Nationalité: { select: { name: (data.natio && data.natio !== '—' ? data.natio : 'Autre') } },
      'Style / Type': { rich_text: [{ text: { content: data.style || '' } }] },
      Prix: { number: parseFloat(data.prix) || 0 },
      'Acompte reçu': { number: parseFloat(data.acompte) || 0 },
      'Solde reçu': { number: parseFloat(data.solde) || 0 },
      'Avis Google': { checkbox: !!data.avis },
      Notes: { rich_text: [{ text: { content: data.notes || '' } }] },
      Date: { date: { start: data.date } }
    }
  }),

  getClients: () => call(`databases/${CLIENTS_DB}/query`, 'POST', {
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    page_size: 100
  }),

  addClient: (data) => call('pages', 'POST', {
    parent: { database_id: CLIENTS_DB },
    properties: {
      Client: { title: [{ text: { content: data.nom } }] },
      Langue: { select: { name: data.langue || '🇫🇷 FR' } },
      WhatsApp: { phone_number: data.whatsapp || '' },
      Instagram: { rich_text: [{ text: { content: data.instagram || '' } }] },
      'Type client': { select: { name: data.type || '🖤 Tattoo' } },
      Projet: { rich_text: [{ text: { content: data.projet || '' } }] },
      Statut: { select: { name: data.statut || '💬 Premier contact' } },
      Acompte: { number: parseFloat(data.acompte) || 0 },
      Notes: { rich_text: [{ text: { content: data.notes || '' } }] }
    }
  }),

  getDepenses: () => call(`databases/${DEPENSES_DB}/query`, 'POST', {
    sorts: [{ property: 'Date', direction: 'descending' }],
    page_size: 50
  }),

  addDepense: (data) => call('pages', 'POST', {
    parent: { database_id: DEPENSES_DB },
    properties: {
      Achat: { title: [{ text: { content: data.description || data.fournisseur || 'Achat' } }] },
      Date: { date: { start: data.date } },
      Montant: { number: parseFloat(data.montant) || 0 },
      Catégorie: { select: { name: data.categorie || '📦 Autre' } },
      Fournisseur: { rich_text: [{ text: { content: data.fournisseur || '' } }] },
      'IVA récupérable': { checkbox: !!data.iva_recuperable },
      'Montant IVA': { number: parseFloat(data.montant_iva) || 0 },
      'Saisi par': { select: { name: data.saisi_par || 'Tony' } },
      Notes: { rich_text: [{ text: { content: data.notes || '' } }] }
    }
  }),

  getKPIs: () => call(`databases/${KPIS_DB}/query`, 'POST', {
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    page_size: 12
  }),

  addKPI: (data) => call('pages', 'POST', {
    parent: { database_id: KPIS_DB },
    properties: {
      Semaine: { title: [{ text: { content: data.semaine || '' } }] },
      'CA tattoo Tony': { number: parseFloat(data.ca_tattoo) || 0 },
      'CA piercing Amely': { number: parseFloat(data.ca_piercing) || 0 },
      'CA bijoux': { number: parseFloat(data.ca_bijoux) || 0 },
      'CA parallèle': { number: parseFloat(data.ca_parallele) || 0 },
      'TOTAL CA': { number: parseFloat(data.total) || 0 },
      'Objectif semaine': { number: 1250 },
      'Sessions tattoo': { number: parseInt(data.sessions) || 0 },
      'Prix moyen tattoo': { number: parseFloat(data.prix_moyen) || 0 },
      'Insta abonnés': { number: parseInt(data.insta_abonnes) || 0 },
      'TikTok vues': { number: parseInt(data.tiktok_vues) || 0 },
      'Google clics appel': { number: parseInt(data.google_clics) || 0 },
      'Avis reçus': { number: parseInt(data.avis_recus) || 0 },
      'DM reçus': { number: parseInt(data.dm_recus) || 0 },
      'DM convertis RDV': { number: parseInt(data.dm_convertis) || 0 },
      'Capital accumulé': { number: parseFloat(data.capital) || 0 },
      'Notes stratégie': { rich_text: [{ text: { content: data.notes || '' } }] }
    }
  })
}

export const parsePaiement = (s) => {
  const title = s.properties.Session?.title?.[0]?.plain_text || ''
  const notes = s.properties.Notes?.rich_text?.[0]?.plain_text || ''
  if (title.startsWith('[CASH]') || notes.includes('PAIEMENT:CASH')) return 'cash'
  if (title.startsWith('[CARTE]') || notes.includes('PAIEMENT:CARTE')) return 'carte'
  return 'cash' // par défaut cash si pas renseigné
}
