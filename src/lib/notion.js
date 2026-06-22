const SESSIONS_DB  = 'd5c3846e-3d3c-4eae-ade8-2e7efa3c896f'
const DEVIS_DB     = 'b6d33466-c5db-4046-be2f-a242c8686a97'
const CRENEAUX_DB  = 'adf23a19-e7d1-44c0-9f8a-8374d93a7983'
const DEPENSES_DB = '323d80c7-6418-4b25-a4c6-70cea0fd20a1'
const CLIENTS_DB  = '53149c61-3639-45a2-ab49-c2ea77a7c088'
const KPIS_DB     = '450c0c95-33e0-47c6-ae27-3c9540162cd2'
const METRIQUES_RS_DB = '55a61a2b-04ba-4eb6-ad58-02e041ad7b54'

const call = async (path, method = 'POST', body = null) => {
  const url = `/api/notion?path=${encodeURIComponent(path)}`
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(`Notion ${r.status}: ${err.message || err.code || JSON.stringify(err).substring(0,120)}`)
  }
  return r.json()
}

export const notion = {
  getSessions: () => call(`databases/${SESSIONS_DB}/query`, 'POST', {
    sorts: [{ property: 'Date', direction: 'descending' }],
    page_size: 300
  }),

  getSessionsPrevu: () => call(`databases/${SESSIONS_DB}/query`, 'POST', {
    filter: { and: [
      { property: 'Statut', select: { equals: '🗓 Prévu' } },
    ]},
    sorts: [{ property: 'Date', direction: 'ascending' }],
    page_size: 100
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
  addAppointment: (data) => {
    const dateStart = data.heure && data.date
      ? `${data.date}T${data.heure}:00`
      : (data.date || new Date().toISOString().split('T')[0])
    return call('pages', 'POST', {
      parent: { database_id: SESSIONS_DB },
      properties: {
        Session:        { title: [{ text: { content: `[RDV] ${data.client || 'Client'} · ${data.date}` } }] },
        Type:           { select: { name: '🖤 Tattoo Tony' } },
        Prix:           { number: parseFloat(data.prixEstime) || 0 },
        'Acompte reçu': { number: parseFloat(data.acompte) || 0 },
        'Solde reçu':   { number: 0 },
        Nationalité:    { select: { name: data.natio || 'Autre' } },
        Date:           { date: { start: dateStart } },
        Notes:          { rich_text: [{ text: { content: `${data.sessions||1} session(s)` } }] },
        'Statut':       { select: { name: '🗓 Prévu' } },
        ...(data.source ? { 'Source': { select: { name: data.source } } } : {}),
        'Client prénom':{ rich_text: [{ text: { content: data.client || '' } }] },
        'Style / Type': { rich_text: [{ text: { content: data.style || '' } }] },
      }
    })
  },

  confirmAppointment: async (pageId, data) => {
    // Lire les Notes existantes avant de confirmer
    let notesExist = ''
    try {
      const page = await call(`pages/${pageId}`, 'GET')
      notesExist = page?.properties?.Notes?.rich_text?.[0]?.plain_text || ''
    } catch(_) {}
    // Préserver les Notes si elles contiennent un consentement signé
    const newNotes = notesExist.includes('CONSENTEMENT') || notesExist.includes('Email')
      ? notesExist
      : `${data.sessions||1} session(s)`

    const solde = Math.max(0, (parseFloat(data.prix)||0) - (parseFloat(data.acompte)||0))
    const today = new Date().toISOString().split('T')[0]
    const client = data.client || 'Client'

    // Mettre à jour le RDV existant (prévisionnel / historique)
    await call(`pages/${pageId}`, 'PATCH', {
      properties: {
        Session:        { title: [{ text: { content: `[${data.paiement==='carte'?'CARTE':'CASH'}] Tony · ${data.date} · ${data.prix}€` } }] },
        Prix:           { number: parseFloat(data.prix) || 0 },
        'Solde reçu':   { number: solde },
        'Acompte reçu': { number: parseFloat(data.acompte) || 0 },
        Statut:         { select: { name: '✅ Confirmé' } },
        Notes:          { rich_text: [{ text: { content: newNotes } }] },
      }
    })

    // Créer un [VERSEMENT] pour le solde encaissé aujourd'hui
    if (solde > 0) {
      await call('pages', 'POST', {
        parent: { database_id: SESSIONS_DB },
        properties: {
          Session:        { title: [{ text: { content: `[VERSEMENT] ${client} · ${solde}€` } }] },
          Type:           { select: { name: '💰 Versement client' } },
          Prix:           { number: solde },
          'Acompte reçu': { number: 0 },
          'Solde reçu':   { number: solde },
          Nationalité:    { select: { name: data.natio || 'Autre' } },
          Date:           { date: { start: today } },
          Notes:          { rich_text: [{ text: { content: `Solde · ${data.paiement==='carte'?'carte':'cash'} · tattoo ${data.date}` } }] },
          Statut:         { select: { name: '✅ Confirmé' } },
          Source:         { select: { name: '📸 Instagram' } },
          'Client prénom':{ rich_text: [{ text: { content: client } }] },
          'Style / Type': { rich_text: [{ text: { content: data.style || '' } }] },
        }
      })
    }
  },

  updateRdv: (pageId, data) => {
    const natio = data.natio || 'Autre'
    const dateStart = data.heure && data.date ? `${data.date}T${data.heure}:00` : (data.date || new Date().toISOString().split('T')[0])
    return call(`pages/${pageId}`, 'PATCH', {
      properties: {
        Session:        { title: [{ text: { content: `[RDV] ${data.client || 'Client'} · ${data.date || ''}` } }] },
        Prix:           { number: parseFloat(data.prixEstime) || 0 },
        'Acompte reçu': { number: parseFloat(data.acompte) || 0 },
        Nationalité:    { select: { name: natio } },
        Date:           { date: { start: dateStart } },
        'Client prénom':{ rich_text: [{ text: { content: data.client || '' } }] },
        'Style / Type': { rich_text: [{ text: { content: data.style || '' } }] },
        ...(data.source ? { Source: { select: { name: data.source } } } : {})
      }
    })
  },

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



  // ── BRIEFS POSTS ─────────────────────────────────
  getBriefs: () => call('databases/0956d966df9941afb3ae8937c459f6b4/query', 'POST', {
    sorts: [{ property: 'Date', direction: 'ascending' }],
    page_size: 60
  }),

  updateBriefCheckbox: (pageId, field, value) => call(`pages/${pageId}`, 'PATCH', {
    properties: { [field]: { checkbox: value } }
  }),

  // ── COMMUNICATION ────────────────────────────────
  getCalendrierEditorial: () => call(`databases/df7169664f7e46e9b5d2cc14d81c002a/query`, 'POST', {
    sorts: [{ property: 'Date', direction: 'ascending' }],
    page_size: 100
  }),

  addContenu: (data) => call('pages', 'POST', {
    parent: { database_id: 'df7169664f7e46e9b5d2cc14d81c002a' },
    properties: {
      Contenu:    { title: [{ text: { content: data.contenu || 'Nouveau contenu' } }] },
      Date:       { date: { start: data.date } },
      Statut:     { select: { name: data.statut || '💡 Idée' } },
      Pilier:     { select: { name: data.pilier || "🎨 L'Art" } },
      Format:     { select: { name: data.format || 'Post photo' } },
      Caption:    { rich_text: [{ text: { content: data.caption || '' } }] },
      Hashtags:   { rich_text: [{ text: { content: data.hashtags || '' } }] },
      Notes:      { rich_text: [{ text: { content: data.notes || '' } }] },
      ...(data.plateformes?.length ? { Plateforme: { multi_select: data.plateformes.map(p=>({name:p})) } } : {})
    }
  }),

  updateContenuStatut: (pageId, statut) => call(`pages/${pageId}`, 'PATCH', {
    properties: { Statut: { select: { name: statut } } }
  }),

  getPromos: () => call(`databases/c7625e2be6c8441895c523315721a217/query`, 'POST', {
    sorts: [{ property: 'Date début', direction: 'ascending' }],
    page_size: 50
  }),

  addPromo: (data) => call('pages', 'POST', {
    parent: { database_id: 'c7625e2be6c8441895c523315721a217' },
    properties: {
      Promotion:        { title: [{ text: { content: data.nom || 'Nouvelle promo' } }] },
      Type:             { select: { name: data.type || '📢 Autre' } },
      Statut:           { select: { name: data.statut || '📋 Planifiée' } },
      'Réduction / Offre': { rich_text: [{ text: { content: data.offre || '' } }] },
      Cible:            { rich_text: [{ text: { content: data.cible || '' } }] },
      Notes:            { rich_text: [{ text: { content: data.notes || '' } }] },
      ...(data.dateDebut ? { 'Date début': { date: { start: data.dateDebut } } } : {}),
      ...(data.dateFin   ? { 'Date fin':   { date: { start: data.dateFin } } } : {}),
    }
  }),

  getEvenements: () => call(`databases/b2428071dba343f89a54cca1eaea82b6/query`, 'POST', {
    sorts: [{ property: 'Date', direction: 'ascending' }],
    page_size: 50
  }),

  addEvenement: (data) => call('pages', 'POST', {
    parent: { database_id: 'b2428071dba343f89a54cca1eaea82b6' },
    properties: {
      'Événement':       { title: [{ text: { content: data.nom || 'Événement' } }] },
      Type:             { select: { name: data.type || '🎉 Fête locale' } },
      Statut:           { select: { name: data.statut || '📋 À préparer' } },
      Lieu:             { rich_text: [{ text: { content: data.lieu || '' } }] },
      'Action Blackthorn': { rich_text: [{ text: { content: data.action || '' } }] },
      Notes:            { rich_text: [{ text: { content: data.notes || '' } }] },
      ...(data.date ? { Date: { date: { start: data.date } } } : {}),
    }
  }),

  getMetriquesRS: () => call(`databases/${METRIQUES_RS_DB}/query`, 'POST', {
    sorts: [{ property: 'Date', direction: 'descending' }],
    page_size: 52
  }),

  addMetriqueRS: (data) => call('pages', 'POST', {
    parent: { database_id: METRIQUES_RS_DB },
    properties: {
      Semaine: { title: [{ text: { content: `${data.plateforme} · ${data.date}` } }] },
      Plateforme: { select: { name: data.plateforme } },
      Date: { date: { start: data.date } },
      Abonnés: { number: parseInt(data.abonnes)||0 },
      'Abonnés +/-': { number: parseInt(data.abonnesDelta)||0 },
      Impressions: { number: parseInt(data.impressions)||0 },
      Reach: { number: parseInt(data.reach)||0 },
      Interactions: { number: parseInt(data.interactions)||0 },
      'Taux engagement': { number: parseFloat(data.tauxEngagement)||0 },
      'Posts publiés': { number: parseInt(data.posts)||0 },
      'Avis Google': { number: parseInt(data.avisGoogle)||0 },
      'DMs reçus': { number: parseInt(data.dms)||0 },
      'RDV pris via RS': { number: parseInt(data.rdvRS)||0 },
      Notes: { rich_text: [{ text: { content: data.notes||'' } }] }
    }
  }),

  getDepenses: () => call(`databases/${DEPENSES_DB}/query`, 'POST', {
    sorts: [{ property: 'Date', direction: 'descending' }],
    page_size: 100
  }),

  // ── DEVIS ────────────────────────────────
  getDevis: () => call(`databases/${DEVIS_DB}/query`, 'POST', {
    sorts: [{ property: 'Date création', direction: 'descending' }],
    page_size: 50
  }),

  addDevis: (data) => call('pages', 'POST', {
    parent: { database_id: DEVIS_DB },
    properties: {
      Devis:       { title: [{ text: { content: `Devis · ${data.client || '?'} · ${data.prix || 0}€` } }] },
      Client:      { rich_text: [{ text: { content: String(data.client || '').substring(0, 200) } }] },
      Description: { rich_text: [{ text: { content: String(data.description || '').substring(0, 1900) } }] },
      Prix:        { number: parseFloat(data.prix) || 0 },
      Acompte:     { number: parseFloat(data.acompte) || 0 },
      Statut:      { select: { name: '⏳ En attente' } },
      Token:       { rich_text: [{ text: { content: String(data.token || '') } }] },
      Tatouages:   { rich_text: [{ text: { content: String(data.tatouages || '').substring(0, 1900) } }] },
      'Durée':     { number: parseInt(data.duree) || 120 },
      Notes:       { rich_text: [{ text: { content: String(data.notes || '').substring(0, 500) } }] },
    }
  }),

  patchPage: (pageId, properties) => call(`pages/${pageId}`, 'PATCH', { properties }),

  markFicheSigned: (pageId) => call(`pages/${pageId}`, 'PATCH', {
    properties: { 'Fiche signée': { checkbox: true } }
  }),

  // Enregistre un versement client comme session CA dans la DB Sessions
  addVersementSession: (data) => call('pages', 'POST', {
    parent: { database_id: SESSIONS_DB },
    properties: {
      Session:        { title: [{ text: { content: `[VERSEMENT] ${data.client} · ${data.montant}€` } }] },
      Type:           { select: { name: '💰 Versement client' } },
      Prix:           { number: parseFloat(data.montant) || 0 },
      'Acompte reçu': { number: 0 },
      'Solde reçu':   { number: parseFloat(data.montant) || 0 },
      Nationalité:    { select: { name: 'Autre' } },
      Date:           { date: { start: data.date || new Date().toISOString().split('T')[0] } },
      Notes:          { rich_text: [{ text: { content: `Versement progressif · ${data.mode} · Devis: ${data.devisDesc || ''}`.substring(0, 500) } }] },
      Statut:         { select: { name: '✅ Confirmé' } },
      'Client prénom':{ rich_text: [{ text: { content: String(data.client || '').substring(0, 200) } }] },
      'Style / Type': { rich_text: [{ text: { content: String(data.devisDesc || '').substring(0, 200) } }] },
    }
  }),

  updateDevisStatut: (pageId, statut) => call(`pages/${pageId}`, 'PATCH', {
    properties: { Statut: { select: { name: statut } } }
  }),

  updateDevisLienEnvoye: (pageId) => call(`pages/${pageId}`, 'PATCH', {
    properties: { Statut: { select: { name: '🔗 Lien envoyé' } } }
  }),

  getDevisByToken: (token) => call(`databases/${DEVIS_DB}/query`, 'POST', {
    filter: { property: 'Token', rich_text: { equals: token } },
    page_size: 1
  }),

  markDevisReserve: (pageId, dateRdv, heureRdv) => call(`pages/${pageId}`, 'PATCH', {
    properties: {
      Statut: { select: { name: '✅ Réservé' } },
      Notes:  { rich_text: [{ text: { content: `RDV: ${dateRdv} à ${heureRdv}` } }] }
    }
  }),

  // ── CRÉNEAUX ─────────────────────────────────────────────
  getCreneauxRange: (dateMin, dateMax) => call(`databases/${CRENEAUX_DB}/query`, 'POST', {
    filter: { and: [
      { property: 'Date', date: { on_or_after: dateMin } },
      { property: 'Date', date: { on_or_before: dateMax } },
    ]},
    sorts: [{ property: 'Date', direction: 'ascending' }],
    page_size: 200
  }),

  addCreneau: (data) => call('pages', 'POST', {
    parent: { database_id: CRENEAUX_DB },
    properties: {
      'Créneau': { title: [{ text: { content: `${data.date} ${data.heure}${data.notes?' — '+data.notes:''}` } }] },
      'Date':    { date: { start: data.date } },
      'Heure':   { rich_text: [{ text: { content: data.heure || '' } }] },
      'Statut':  { select: { name: data.statut || '🟢 Ouvert' } },
      'Notes':   { rich_text: [{ text: { content: data.notes || '' } }] },
    }
  }),

  updateCreneauStatut: (pageId, statut) => call(`pages/${pageId}`, 'PATCH', {
    properties: { 'Statut': { select: { name: statut } } }
  }),

  deleteCreneau: (pageId) => call(`pages/${pageId}`, 'PATCH', { archived: true }),

  deleteVersementsSessions: async (client) => {
    // Cherche toutes les sessions versement pour ce client et les archive
    const r = await call(`databases/${SESSIONS_DB}/query`, 'POST', {
      filter: { and: [
        { property: 'Type',           select:    { equals: '💰 Versement client' } },
        { property: 'Client prénom',  rich_text: { equals: client } },
      ]},
      page_size: 50
    })
    const ids = (r.results || []).map(p => p.id)
    await Promise.all(ids.map(id => call(`pages/${id}`, 'PATCH', { archived: true })))
    return ids.length
  },

  deleteRdvPrevu: async (client) => {
    // Archive le RDV prévu lié à ce client (source = Lien réservation)
    const r = await call(`databases/${SESSIONS_DB}/query`, 'POST', {
      filter: { and: [
        { property: 'Statut',         select:    { equals: '🗓 Prévu' } },
        { property: 'Client prénom',  rich_text: { equals: client } },
        { property: 'Source',         select:    { equals: '🔗 Lien réservation' } },
      ]},
      page_size: 10
    })
    const ids = (r.results || []).map(p => p.id)
    await Promise.all(ids.map(id => call(`pages/${id}`, 'PATCH', { archived: true })))
    return ids.length
  },
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

// ── DEVIS ────────────────────────────────
