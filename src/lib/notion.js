const SESSIONS_DB = 'ce868414-a4a5-4450-ab3f-804be7fd5eb1'
const CLIENTS_DB  = '3bbdc6c0-6e3a-4b59-987e-97056eac6d22'
const KPIS_DB     = '61f7823f-c723-4203-b1d7-0fdc74312dd3'

const call = async (notionPath, method = 'POST', body = null) => {
  const url = `/api/notion?path=${encodeURIComponent(notionPath)}`
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!r.ok) throw new Error(`Notion API error ${r.status}`)
  return r.json()
}

export const notion = {
  getSessions: () => call(`databases/${SESSIONS_DB}/query`, 'POST', {
    sorts: [{ property: 'Date', direction: 'descending' }],
    page_size: 50
  }),

  addSession: (data) => call('pages', 'POST', {
    parent: { database_id: SESSIONS_DB },
    properties: {
      Session: { title: [{ text: { content: data.session || `Session ${data.date}` } }] },
      Type: { select: { name: data.type } },
      'Client prénom': { rich_text: [{ text: { content: data.client || '' } }] },
      Nationalité: { select: { name: data.natio || '🇫🇷 FR' } },
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

  addKPI: (data) => call('pages', 'POST', {
    parent: { database_id: KPIS_DB },
    properties: {
      Semaine: { title: [{ text: { content: data.semaine } }] },
      Période: { rich_text: [{ text: { content: data.periode || '' } }] },
      'CA tattoo Tony': { number: parseFloat(data.ca_tattoo) || 0 },
      'CA piercing Amely': { number: parseFloat(data.ca_piercing) || 0 },
      'CA bijoux': { number: parseFloat(data.ca_bijoux) || 0 },
      'CA parallèle': { number: parseFloat(data.ca_parallele) || 0 },
      'TOTAL CA': { number: parseFloat(data.total) || 0 },
      'Objectif semaine': { number: 1055 },
      'Sessions tattoo': { number: parseInt(data.sessions) || 0 },
      Piercings: { number: parseInt(data.piercings) || 0 },
      'Prix moyen tattoo': { number: parseFloat(data.prix_moyen) || 0 },
      'Capital accumulé': { number: parseFloat(data.capital) || 0 }
    }
  })
}
