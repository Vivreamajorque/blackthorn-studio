export const config = { runtime: 'edge' }

const NOTION_KEY = process.env.NOTION_KEY
const BASE = 'https://api.notion.com/v1'

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  }

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers })

  const url = new URL(req.url)
  const rawPath = url.searchParams.get('path')
  if (!rawPath) return new Response(JSON.stringify({ error: 'path requis' }), { status: 400, headers })
  if (!NOTION_KEY) return new Response(JSON.stringify({ error: 'NOTION_KEY manquante' }), { status: 500, headers })

  const method = req.method || 'GET'
  const hasBody = ['POST', 'PATCH', 'PUT'].includes(method)
  let body = null
  if (hasBody) {
    try { body = await req.json() } catch(e) {}
  }

  try {
    const r = await fetch(`${BASE}/${rawPath}`, {
      method,
      headers: {
        'Authorization': `Bearer ${NOTION_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    })
    const data = await r.json()
    return new Response(JSON.stringify(data), { status: r.status, headers })
  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers })
  }
}
