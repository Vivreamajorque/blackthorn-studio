const SESSIONS_DB = 'd5c3846e-3d3c-4eae-ade8-2e7efa3c896f'
const DEPENSES_DB = '323d80c7-6418-4b25-a4c6-70cea0fd20a1'
const CLIENTS_DB  = '53149c61-3639-45a2-ab49-c2ea77a7c088'
const KPIS_DB     = '450c0c95-33e0-47c6-ae27-3c9540162cd2'

const call = async (path, method = 'POST', body = null) => {
  const url = `/api/notion?path=${encodeURIComponent(path)}`
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(`Notion ${r.status}: ${err.message || ''}`)
  }
  return r.json()
}

export const notion = {
  getSessions: () => call(`databases/${SESSIONS_DB}/query`, 'POST', {
    sorts: [{ property: 'Date', direction: 'descending' }],
    page_size: 200
  }),

  addSession: (data) => call('pages', 'POST', {
    parent: { database_id: SESSIONS_DB },
    properties: {
      Session:        { title: [{ text: { content: (data.paiement==='carte'?'[CARTE] ':'[CASH] ') + `Tony · ${data.date} · ${data.prix}€` } }] },
      Type:           { select: { name: '🖤 Tattoo Tony' } },
      Prix:           { number: parseFloat(data.prix) || 0 },
      'Acompte reçu': { number: parseFloat(data.acompte) || 0 },
      'Solde reçu':   { number: parseFloat(data.solde)  || 0 },
      Nationalité:    { select: { name: data.natio || 'Autre' } },
      Date:           { date: { start: data.date } },
      Notes:          { rich_text: [{ text: { content: data.notes || '' } }] },
      'Avis Google':  { checkbox: !!data.avis },
      'Statut':       { select: { name: '✅ Confirmé' } },
      ...(data.source ? { 'Source': { select: { name: data.source } } } : {}),
      'Client prénom':{ rich_text: [{ text: { content: data.client || '' } }] },
      'Style / Type': { rich_text: [{ text: { content: data.style || '' } }] },
    }
  }),

  // RDV PRÉVISIONNEL
  addAppointment: (data) => call('pages', 'POST', {
    parent: { database_id: SESSIONS_DB },
    properties: {
      Session:        { title: [{ text: { content: `[RDV] ${data.client || 'Client'} · ${data.date}` } }] },
      Type:           { select: { name: '🖤 Tattoo Tony' } },
      Prix:           { number: parseFloat(data.prixEstime) || 0 },
      'Acompte reçu': { number: parseFloat(data.acompte) || 0 },
      'Solde reçu':   { number: 0 },
      Nationalité:    { select: { name: data.natio || 'Autre' } },
      Date:           { date: { start: data.date } },
      Notes:          { rich_text: [{ text: { content: '1 session' } }] },
      'Statut':       { select: { name: '🗓 Prévu' } },
      ...(data.source ? { 'Source': { select: { name: data.source } } } : {}),
      'Client prénom':{ rich_text: [{ text: { content: data.client || '' } }] },
      'Style / Type': { rich_text: [{ text: { content: data.style || '' } }] },
    }
  }),

  confirmAppointment: (pageId, data) => call(`pages/${pageId}`, 'PATCH', {
    properties: {
      Session:        { title: [{ text: { content: `[${data.paiement==='carte'?'CARTE':'CASH'}] Tony · ${data.date} · ${data.prix}€` } }] },
      Prix:           { number: parseFloat(data.prix) || 0 },
      'Solde reçu':   { number: Math.max(0, parseFloat(data.prix) - (parseFloat(data.acompte)||0)) },
      'Acompte reçu': { number: parseFloat(data.acompte) || 0 },
      Statut:         { select: { name: '✅ Confirmé' } },
      Notes:          { rich_text: [{ text: { content: `${data.sessions||1} session(s)` } }] },
    }
  }),

  noShowAppointment: (pageId) => call(`pages/${pageId}`, 'PATCH', {
    properties: { Statut: { select: { name: '👻 No-show' } } }
  }),

  updateSession: (pageId, data) => call(`pages/${pageId}`, 'PATCH', {
    properties: {
      Session:        { title: [{ text: { content: (data.paiement==='carte'?'[CARTE] ':'[CASH] ') + `Tony · ${data.date} · ${data.prix}€` } }] },
      Type:           { select: { name: data.type || '🖤 Tattoo Tony' } },
      Prix:           { number: parseFloat(data.prix) || 0 },
      'Solde reçu':   { number: parseFloat(data.prix) || 0 },
      Nationalité:    { select: { name: data.natio || 'Autre' } },
      Date:           { date: { start: data.date } },
      Notes:          { rich_text: [{ text: { content: `${data.sessions||1} session(s)${data.notes?' · '+data.notes:''}` } }] },
    }
  }),

  deleteSession: (pageId) => call(`pages/${pageId}`, 'PATCH', { archived: true }),

  addDepense: (data) => call('pages', 'POST', {
    parent: { database_id: DEPENSES_DB },
    properties: {
      Achat:              { title: [{ text: { content: `${data.categorie} · ${data.date}${data.fournisseur?' · '+data.fournisseur:''}` } }] },
      Date:               { date: { start: data.date } },
      Montant:            { number: parseFloat(data.montant) || 0 },
      'Montant IVA':      { number: Math.round(parseFloat(data.montant)*0.21*100)/100 || 0 },
      Catégorie:          { select: { name: data.categorie || '📦 Autre' } },
      Fournisseur:        { rich_text: [{ text: { content: data.fournisseur || '' } }] },
      'IVA récupérable':  { checkbox: !!data.iva_recuperable },
      'Saisi par':        { select: { name: data.saisi_par || 'Tony' } },
      Notes:              { rich_text: [{ text: { content: data.notes || '' } }] }
    },
    ...(data.photoUrl ? {
      children: [{ object:'block', type:'image', image:{ type:'external', external:{ url: data.photoUrl } } }]
    } : {})
  }),

  getDepenses: () => call(`databases/${DEPENSES_DB}/query`, 'POST', {
    sorts: [{ property: 'Date', direction: 'descending' }],
    page_size: 100
  }),
}

export const parsePaiement = (s) => {
  const title = s.properties.Session?.title?.[0]?.plain_text || ''
  if (title.startsWith('[CARTE]')) return 'carte'
  return 'cash'
}

// Nb sessions stocké dans Notes
export const getNbSess = (s) => {
  const txt = s.properties.Notes?.rich_text?.[0]?.plain_text || ''
  const m = txt.match(/^(\d+)\s*session/)
  return m ? parseInt(m[1]) : 1
}
