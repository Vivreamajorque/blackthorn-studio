// Point d'entrée du connecteur Claude : métadonnées OAuth, autorisation, jetons et outils (JSON-RPC).
const { requireSession } = require('../server/session.cjs')
const mcp = require('../server/mcp.cjs')

const redirect = (res, url) => { res.setHeader('Location', url); return res.status(302).end() }

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  try {
    const action = req.query?.action
    const blob = module.exports.blobForTests || await import('@vercel/blob')

    // Approbation et révocation : depuis Mi Gestoría, connectée (cookie de session).
    if (action === 'approve' || action === 'revoke') {
      if (req.method !== 'POST') return res.status(405).end()
      const user = await requireSession(req, res)
      if (!user) return
      if (action === 'revoke') { await mcp.revokeAll(blob); return res.status(200).json({ revoked: true }) }
      return res.status(200).json({ redirect: mcp.approve(req.body?.request) })
    }

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, MCP-Protocol-Version, Accept')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.headers?.origin && ![mcp.origin(), 'https://claude.ai', 'https://claude.com'].includes(req.headers.origin)) {
      return res.status(403).json({ error: 'Origine non autorisée.' })
    }
    const resourceMetadataUrl = mcp.origin() + '/.well-known/oauth-protected-resource/api/gestoria-mcp'
    if (req.method === 'GET' && action === 'resource_metadata') return res.status(200).json({
      resource: mcp.resource(), authorization_servers: [mcp.origin()], scopes_supported: ['gestoria'],
      bearer_methods_supported: ['header'], resource_name: 'Mi Gestoría',
    })
    if (req.method === 'GET' && action === 'metadata') return res.status(200).json({
      issuer: mcp.origin(), authorization_endpoint: mcp.resource() + '?action=authorize',
      token_endpoint: mcp.resource() + '?action=token', registration_endpoint: mcp.resource() + '?action=register',
      response_types_supported: ['code'], grant_types_supported: ['authorization_code'],
      token_endpoint_auth_methods_supported: ['none'], code_challenge_methods_supported: ['S256'], scopes_supported: ['gestoria'],
    })
    if (req.method === 'POST' && action === 'register') return res.status(201).json(mcp.registerClient(req.body))
    if (req.method === 'GET' && action === 'authorize') return redirect(res, mcp.origin() + '/?connect_mcp=' + encodeURIComponent(mcp.authorize(req.query || {})))
    if (req.method === 'POST' && action === 'token') {
      const body = typeof req.body === 'string' ? Object.fromEntries(new URLSearchParams(req.body)) : req.body || {}
      try { return res.status(200).json(await mcp.exchange(body, blob)) }
      catch (error) { return res.status(400).json({ error: 'invalid_grant' }) }
    }

    if (req.method !== 'POST') {
      res.setHeader('WWW-Authenticate', 'Bearer resource_metadata="' + resourceMetadataUrl + '"')
      return res.status(req.method === 'GET' ? 401 : 405).json({ error: 'Connexion Claude requise.' })
    }
    await mcp.authenticate(req.headers?.authorization, blob)
    const message = req.body
    if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string' || Array.isArray(message)) {
      return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Requête JSON-RPC invalide.' } })
    }
    if (message.id === undefined && message.method.startsWith('notifications/')) return res.status(202).end()
    const reply = result => res.status(200).json({ jsonrpc: '2.0', id: message.id ?? null, result })
    if (message.method === 'initialize') return reply({
      protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'mi-gestoria', version: '1.0.0' }, instructions: mcp.INSTRUCTIONS,
    })
    if (message.method === 'ping') return reply({})
    if (message.method === 'tools/list') return reply({ tools: mcp.TOOLS })
    if (message.method === 'tools/call') {
      try {
        const result = await mcp.callTool(message.params?.name, message.params?.arguments || {}, blob)
        return reply({ content: [{ type: 'text', text: JSON.stringify(result, null, 1) }] })
      } catch (error) {
        const shown = error.status === 400 || error.status === 409
        return reply({ isError: true, content: [{ type: 'text', text: shown ? error.message : 'Action non confirmée. Vérifie dans Mi Gestoría avant de réessayer.' }] })
      }
    }
    return res.status(200).json({ jsonrpc: '2.0', id: message.id ?? null, error: { code: -32601, message: 'Méthode inconnue.' } })
  } catch (error) {
    const status = error.status || 503
    if (status === 401) res.setHeader('WWW-Authenticate', 'Bearer resource_metadata="' + require('../server/mcp.cjs').origin() + '/.well-known/oauth-protected-resource/api/gestoria-mcp"')
    return res.status(status).json({ error: status === 503 ? 'Connecteur indisponible. Réessaie.' : error.message })
  }
}
