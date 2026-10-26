export async function collectPages(query, body = {}) {
  const results = [], seen = new Set()
  let cursor
  do {
    const page = await query({ ...body, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) })
    if (!Array.isArray(page.results)) throw new Error('Réponse de données invalide')
    results.push(...page.results)
    if (!page.has_more) break
    if (!page.next_cursor || seen.has(page.next_cursor)) throw new Error('Historique incomplet : pagination interrompue')
    cursor = page.next_cursor
    seen.add(cursor)
  } while (true)
  return { results: [...new Map(results.map(row => [row.id, row])).values()], has_more: false, next_cursor: null }
}
