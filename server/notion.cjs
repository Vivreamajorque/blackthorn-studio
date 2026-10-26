const DBS = {
  sessions: 'd5c3846e-3d3c-4eae-ade8-2e7efa3c896f',
  devis: 'b6d33466-c5db-4046-be2f-a242c8686a97',
  creneaux: 'adf23a19-e7d1-44c0-9f8a-8374d93a7983'
}
async function notion(path, method='GET', body) {
  const response = await fetch(`https://api.notion.com/v1/${path}`, {
    method, headers: {Authorization:`Bearer ${process.env.NOTION_KEY}`, 'Notion-Version':'2022-06-28','Content-Type':'application/json'},
    ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(20000)
  })
  const data = await response.json()
  if (!response.ok) throw new Error(`Données indisponibles (${response.status})`)
  return data
}
async function queryAll(database, body={}) {
  const results = [], cursors = new Set()
  let cursor
  do {
    const data = await notion(`databases/${database}/query`,'POST',{...body,page_size:100,...(cursor?{start_cursor:cursor}:{})})
    results.push(...(data.results || []))
    if (!data.has_more) break
    if (!data.next_cursor || cursors.has(data.next_cursor)) throw new Error('Historique incomplet')
    cursor = data.next_cursor; cursors.add(cursor)
  } while(true)
  return results
}
async function quoteForToken(token) {
  if (typeof token !== 'string' || !/^[a-zA-Z0-9-]{6,100}$/.test(token)) return null
  const data = await notion(`databases/${DBS.devis}/query`,'POST',{filter:{property:'Token',rich_text:{equals:token}},page_size:1})
  const quote = data.results?.[0]
  if (!quote || ['❌ Refusé','❌ Annulé'].includes(quote.properties.Statut?.select?.name)) return null
  return quote
}
module.exports = { notion, queryAll, quoteForToken, DBS }
