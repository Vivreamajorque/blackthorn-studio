const DBS = {
  sessions: 'd5c3846e-3d3c-4eae-ade8-2e7efa3c896f',
  expenses: '323d80c7-6418-4b25-a4c6-70cea0fd20a1'
}
async function queryPage(database, body) {
  const response = await fetch(`https://api.notion.com/v1/databases/${database}/query`, {
    method: 'POST', headers: {Authorization:`Bearer ${process.env.NOTION_KEY}`, 'Notion-Version':'2022-06-28','Content-Type':'application/json'},
    body: JSON.stringify(body), signal:AbortSignal.timeout(20000)
  })
  const data = await response.json()
  if (!response.ok) throw new Error(`Données indisponibles (${response.status})`)
  return data
}
async function queryAll(database, body={}) {
  const results = [], cursors = new Set()
  let cursor
  do {
    const data = await queryPage(database,{...body,page_size:100,...(cursor?{start_cursor:cursor}:{})})
    results.push(...(data.results || []))
    if (!data.has_more) break
    if (!data.next_cursor || cursors.has(data.next_cursor)) throw new Error('Historique incomplet')
    cursor = data.next_cursor; cursors.add(cursor)
  } while(true)
  return results
}
module.exports = { queryAll, DBS }
