// Alfred sur WhatsApp : un message d'Amely arrive (webhook Meta), Claude répond en jouant Alfred
// avec les mêmes outils que le connecteur « Mi Gestoria », puis la réponse repart sur WhatsApp.
const { createHmac, timingSafeEqual } = require('node:crypto')
const { readVersionedBlob } = require('./private-blob.cjs')
const mcp = require('./mcp.cjs')

const THREAD_PATH = 'mi-gestoria/whatsapp/v1/thread.json'
const GRAPH = 'https://graph.facebook.com/v21.0'
const MAX_TURNS = 8
const KEEP = 40
const RESET_AFTER_MS = 6 * 3600e3

const env = () => ({
  verify: process.env.WHATSAPP_VERIFY_TOKEN, secret: process.env.WHATSAPP_APP_SECRET, token: process.env.WHATSAPP_TOKEN,
  phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID, allowed: String(process.env.WHATSAPP_ALLOWED_NUMBERS || '').split(/[,;]+/).map(d => d.replace(/\D/g, '')).filter(Boolean),
  apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.WHATSAPP_MODEL || 'claude-sonnet-5-5',
})
const ready = () => { const e = env(); return !!(e.verify && e.secret && e.token && e.phoneId && e.allowed.length && e.apiKey) }

// Signature Meta : HMAC-SHA256 du corps brut avec le secret de l'app.
function validSignature(raw, header, secret) {
  if (!raw || !header || !secret || !header.startsWith('sha256=')) return false
  const expected = Buffer.from(createHmac('sha256', secret).update(raw).digest('hex'))
  const given = Buffer.from(header.slice(7))
  return expected.length === given.length && timingSafeEqual(expected, given)
}

// Messages entrants utiles : texte (et réponses à boutons) venant d'un numéro autorisé.
function incoming(payload, allowed) {
  const out = []
  for (const entry of payload?.entry || []) for (const change of entry.changes || []) {
    for (const m of change.value?.messages || []) {
      const from = String(m.from || '').replace(/\D/g, '')
      if (!allowed.includes(from)) continue
      const text = m.type === 'text' ? m.text?.body : m.type === 'button' ? m.button?.text : m.type === 'interactive' ? (m.interactive?.button_reply?.title || m.interactive?.list_reply?.title) : null
      out.push({ id: m.id, from, type: m.type, text: text ? String(text).slice(0, 4000) : null })
    }
  }
  return out
}

async function readThread(blob) {
  const r = await readVersionedBlob(blob, THREAD_PATH)
  if (!r) return { revision: null, data: { messages: [], seen: [], updatedAt: 0 } }
  const data = JSON.parse(await new Response(r.content.stream).text())
  return { revision: r.revision, data }
}
async function writeThread(blob, data, revision) {
  await blob.put(THREAD_PATH, JSON.stringify(data), { access: 'private', addRandomSuffix: false, contentType: 'application/json',
    allowOverwrite: revision !== null, ...(revision !== null && { ifMatch: revision }) })
}

// Garde la fin de la conversation sans couper une paire outil / résultat : on repart d'un message texte d'Amely.
function trim(messages) {
  if (messages.length <= KEEP) return messages
  let start = messages.length - KEEP
  while (start < messages.length && !(messages[start].role === 'user' && typeof messages[start].content === 'string')) start++
  return messages.slice(start)
}

const today = () => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Madrid', dateStyle: 'full', timeStyle: 'short' }).format(new Date())
const system = () => 'Tu es Alfred, le majordome et chef de cabinet d’Amely (consultante indépendante à Majorque, objectif 200 000 € de CA en 2027). ' +
  'Tu lui parles sur WhatsApp : réponses courtes, chaleureuses, tutoiement, en français, sans tableau ni titre. Tu peux mettre un mot en *gras* (syntaxe WhatsApp). ' +
  'Amely est TDAH : une seule chose à la fois, jamais de longue liste (3 points maximum). ' +
  'Quand elle te demande quoi faire, appelle d’abord alfred_point. Quand elle te confie quelque chose, range-le avec alfred_noter (avec un titre et le bon quadrant si c’est clair, sinon dans ta boîte). ' +
  'Pour un devis ou une facture : prépare, montre le récapitulatif, et n’enregistre qu’après son « oui » explicite dans un message suivant. ' +
  'Ne pointe jamais un paiement et n’ajoute jamais une dépense sans son oui explicite. Tu n’envoies rien à personne d’autre qu’Amely. ' +
  'Nous sommes le ' + today() + '. ' + mcp.INSTRUCTIONS

const toolDefs = () => mcp.TOOLS.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema }))

async function claude(messages, e) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': e.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: e.model, max_tokens: 1500, system: system(), tools: toolDefs(), messages }),
  })
  if (!r.ok) throw new Error('Claude ' + r.status + ' ' + (await r.text()).slice(0, 300))
  return r.json()
}

// Boucle agent : Claude appelle les outils du QG jusqu'à donner sa réponse.
async function reply(blob, messages, e, call = mcp.callTool) {
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await claude(messages, e)
    messages.push({ role: 'assistant', content: res.content })
    const uses = res.content.filter(c => c.type === 'tool_use')
    if (res.stop_reason !== 'tool_use' || !uses.length) return res.content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim()
    const results = []
    for (const u of uses) {
      try { results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(await call(u.name, u.input || {}, blob)).slice(0, 20000) }) }
      catch (err) { results.push({ type: 'tool_result', tool_use_id: u.id, is_error: true, content: String(err.message || err).slice(0, 500) }) }
    }
    messages.push({ role: 'user', content: results })
  }
  return 'Je me suis un peu perdu en chemin. Tu peux reformuler ?'
}

async function send(to, text, e) {
  const parts = []
  for (let s = text || '…'; s.length; s = s.slice(4000)) parts.push(s.slice(0, 4000))
  for (const body of parts) {
    const r = await fetch(`${GRAPH}/${e.phoneId}/messages`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + e.token },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body, preview_url: false } }),
    })
    if (!r.ok) throw new Error('WhatsApp ' + r.status + ' ' + (await r.text()).slice(0, 300))
  }
}

async function handleMessages(blob, payload, deps = {}) {
  const e = { ...env(), ...deps.env }
  const sendFn = deps.send || send
  const callFn = deps.call || mcp.callTool
  const claudeFn = deps.claude
  const handled = []
  for (const m of incoming(payload, e.allowed)) {
    const { revision, data } = await readThread(blob)
    if (data.seen.includes(m.id)) continue // Meta renvoie parfois le même message
    data.seen = [...data.seen, m.id].slice(-200)
    if (Date.now() - (data.updatedAt || 0) > RESET_AFTER_MS) data.messages = []
    let answer
    if (!m.text) answer = 'Je ne sais pas encore écouter les vocaux 🙈 Utilise la dictée de ton clavier (le micro) et envoie-moi le texte.'
    else {
      const messages = trim([...data.messages, { role: 'user', content: m.text }])
      try {
        answer = claudeFn ? await claudeFn(messages) : await reply(blob, messages, e, callFn)
        data.messages = trim(messages)
      } catch (err) {
        console.error('alfred whatsapp', err)
        answer = 'Petit souci technique de mon côté, réessaie dans une minute.'
      }
    }
    data.updatedAt = Date.now()
    await writeThread(blob, data, revision).catch(err => console.error('thread', err))
    await sendFn(m.from, answer, e)
    handled.push(m.id)
  }
  return handled
}

module.exports = { ready, env, validSignature, incoming, handleMessages, reply, trim, THREAD_PATH }
