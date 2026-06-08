export const config = { runtime: 'edge' }

export default async function handler(req) {
  const key = process.env.NOTION_KEY
  return new Response(JSON.stringify({ 
    ok: true, 
    runtime: 'edge', 
    hasKey: !!key,
    keyLen: key?.length,
    keyStart: key?.substring(0, 4)
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  })
}
