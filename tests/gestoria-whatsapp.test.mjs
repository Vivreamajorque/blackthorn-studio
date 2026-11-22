import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { createRequire } from 'node:module'
import { Readable } from 'node:stream'
const require = createRequire(import.meta.url)
process.env.GESTORIA_URL = 'https://mi-gestoria.test'
process.env.GESTORIA_SESSION_SECRET = 'x'.repeat(40)
Object.assign(process.env, { WHATSAPP_VERIFY_TOKEN: 'verif', WHATSAPP_APP_SECRET: 'secret', WHATSAPP_TOKEN: 'tok', WHATSAPP_PHONE_NUMBER_ID: '123',
  WHATSAPP_ALLOWED_NUMBERS: '+34 600 000 000', ANTHROPIC_API_KEY: 'k' })
const { seedCrm, CRM_PATH } = require('../server/crm.cjs')
const wa = require('../server/whatsapp.cjs')
const hook = require('../api/gestoria-whatsapp.js')

function fakeBlob(files) {
  let n = 0
  const store = new Map(Object.entries(files).map(([k, v]) => [k, { body: JSON.stringify(v), etag: 'e' + (n++) }]))
  return { store,
    async get(p) { const f = store.get(p); return f && { stream: new Response(f.body).body, blob: { url: p, etag: f.etag } } },
    async head(u) { return { etag: store.get(u).etag } },
    async put(p, body, o) { const f = store.get(p); if (o.ifMatch && f?.etag !== o.ifMatch) throw new Error('412'); if (!o.allowOverwrite && f) throw new Error('412')
      const etag = 'e' + (n++); store.set(p, { body, etag }); return { etag } } }
}
const msg = (id, from, body) => ({ entry: [{ changes: [{ value: { messages: [{ id, from, type: 'text', text: { body } }] } }] }] })
function call(method, { query, payload, sign = true } = {}) {
  const raw = payload ? JSON.stringify(payload) : ''
  const req = Readable.from(raw ? [Buffer.from(raw)] : [])
  req.method = method; req.query = query || {}
  req.headers = sign && raw ? { 'x-hub-signature-256': 'sha256=' + createHmac('sha256', 'secret').update(raw).digest('hex') } : {}
  return new Promise(resolve => {
    const res = { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v }, status(c) { this.code = c; return this },
      send(b) { resolve({ status: this.code, body: b }) }, json(b) { resolve({ status: this.code, body: b }) }, end() { resolve({ status: this.code }) } }
    hook(req, res)
  })
}

test('webhook WhatsApp : vérification Meta, signature, numéro autorisé, doublons', async () => {
  const blob = fakeBlob({ [CRM_PATH]: seedCrm() })
  const sent = []
  hook.blobForTests = blob
  hook.depsForTests = { send: async (to, text) => sent.push([to, text]), claude: async messages => 'Bien reçu : ' + messages.at(-1).content }
  assert.equal((await call('GET', { query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'verif', 'hub.challenge': '42' } })).body, '42')
  assert.equal((await call('GET', { query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'faux' } })).status, 403)
  assert.equal((await call('POST', { payload: msg('m1', '34600000000', 'salut'), sign: false })).status, 401)
  await call('POST', { payload: msg('m1', '34600000000', 'salut') })
  await call('POST', { payload: msg('m1', '34600000000', 'salut') })
  await call('POST', { payload: msg('m2', '33611111111', 'intrus') })
  assert.deepEqual(sent, [['34600000000', 'Bien reçu : salut']], 'une seule réponse, et pas à un inconnu')
  const thread = JSON.parse(blob.store.get(wa.THREAD_PATH).body)
  assert.equal(thread.messages.at(-1).content, 'salut')
})

test('Alfred WhatsApp : la boucle appelle les outils du QG puis répond', async () => {
  const blob = fakeBlob({ [CRM_PATH]: seedCrm(), 'mi-gestoria/personal/v1/workspace.json': { entries: [], records: {} } })
  const calls = []
  const realFetch = global.fetch
  let step = 0
  global.fetch = async (url, init) => {
    assert.match(url, /api\.anthropic\.com/)
    const body = JSON.parse(init.body)
    assert.ok(body.tools.some(t => t.name === 'alfred_noter'))
    step++
    const content = step === 1 ? [{ type: 'tool_use', id: 't1', name: 'alfred_noter', input: { titre: 'Rappeler l’assurance', quadrant: 'faire' } }]
      : [{ type: 'text', text: 'C’est noté dans *À faire maintenant*.' }]
    return new Response(JSON.stringify({ content, stop_reason: step === 1 ? 'tool_use' : 'end_turn' }))
  }
  try {
    const sent = []
    await wa.handleMessages(blob, msg('m9', '34600000000', 'note : rappeler l’assurance'), { send: async (to, t) => sent.push(t) })
    assert.deepEqual(sent, ['C’est noté dans *À faire maintenant*.'])
    const crm = JSON.parse(blob.store.get(CRM_PATH).body)
    assert.equal(crm.taches[0].titre, 'Rappeler l’assurance')
  } finally { global.fetch = realFetch }
})

test('vocal : réponse polie sans appel à Claude', async () => {
  const blob = fakeBlob({})
  const sent = []
  await wa.handleMessages(blob, { entry: [{ changes: [{ value: { messages: [{ id: 'a1', from: '34600000000', type: 'audio' }] } }] }] },
    { send: async (to, t) => sent.push(t), claude: async () => { throw new Error('ne doit pas être appelé') } })
  assert.match(sent[0], /vocaux/)
})
