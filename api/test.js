export const config = { runtime: 'edge' }

export default async function handler(req) {
  return new Response(JSON.stringify({ ok: true, runtime: 'edge', ts: Date.now() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  })
}
