import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
process.env.GESTORIA_URL = 'https://mi-gestoria.test'
process.env.GESTORIA_SESSION_SECRET = 'x'.repeat(40)
const { seedCrm, CRM_PATH } = require('../server/crm.cjs')
const mcp = require('../server/mcp.cjs')
const { validWorkspace } = require('../api/gestoria-workspace.js')

function fakeBlob(files) {
  let n = 0
  const store = new Map(Object.entries(files).map(([k, v]) => [k, { body: JSON.stringify(v), etag: 'e' + (n++) }]))
  class BlobPreconditionFailedError extends Error {}
  return { store, BlobPreconditionFailedError,
    async get(p) { const f = store.get(p); return f && { stream: new Response(f.body).body, blob: { url: p, etag: f.etag } } },
    async head(u) { return { etag: store.get(u).etag } },
    async put(p, body, o) { const f = store.get(p); if (o.ifMatch && f?.etag !== o.ifMatch) throw new BlobPreconditionFailedError(); if (!o.allowOverwrite && f) throw new BlobPreconditionFailedError()
      const etag = 'e' + (n++); store.set(p, { body, etag }); return { etag } } }
}
const read = (blob, p) => JSON.parse(blob.store.get(p).body)
const WS = 'mi-gestoria/personal/v1/workspace.json'

test('connexion OAuth : PKCE obligatoire, code à usage unique, révocation', async () => {
  const blob = fakeBlob({})
  const redirect = 'https://claude.ai/api/mcp/auth_callback'
  const { client_id } = mcp.registerClient({ redirect_uris: [redirect] })
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const request = mcp.authorize({ client_id, redirect_uri: redirect, response_type: 'code', code_challenge_method: 'S256', code_challenge: challenge, resource: mcp.resource(), state: 'abc' })
  const url = new URL(mcp.approve(request))
  assert.equal(url.origin + url.pathname, redirect)
  assert.equal(url.searchParams.get('state'), 'abc')
  const code = url.searchParams.get('code')
  const body = { grant_type: 'authorization_code', resource: mcp.resource(), client_id, redirect_uri: redirect, code }
  await assert.rejects(mcp.exchange({ ...body, code_verifier: randomBytes(32).toString('base64url') }, blob), 'mauvais verifier refusé')
  const { access_token } = await mcp.exchange({ ...body, code_verifier: verifier }, blob)
  await assert.rejects(mcp.exchange({ ...body, code_verifier: verifier }, blob), 'code réutilisé refusé')
  await mcp.authenticate('Bearer ' + access_token, blob)
  await assert.rejects(mcp.authenticate('Bearer abc.def', blob))
  await mcp.revokeAll(blob)
  await assert.rejects(mcp.authenticate('Bearer ' + access_token, blob), 'jeton coupé après révocation')
  assert.throws(() => mcp.registerClient({ redirect_uris: ['https://evil.example/cb'] }))
})

test('facture dictée : préparation sans écriture, émission après confirmation, registre valide', async () => {
  const crm = seedCrm()
  crm.emetteur.nif = 'X0000000T'
  const blob = fakeBlob({ [CRM_PATH]: crm, [WS]: { entries: [
    { id: 'inv_old', kind: 'invoice', date: '2026-10-01', label: 'X', reference: 'A-2026-004', amountCents: 100, payment: 'paid', paymentDate: '2026-10-02' },
  ], records: {} } })
  const prep = await mcp.callTool('preparer_facture', { client: 'nisha', projet: 'formation', lignes: [{ description: 'Accompagnement', quantite: 3, prix_ht: 290 }] }, blob)
  assert.equal(prep.numero, 'A-2026-005')
  assert.equal(prep.base_ht.replace(/\s/g, ' '), '870,00 €')
  assert.equal(read(blob, WS).entries.length, 1, 'rien n’est écrit à la préparation')
  await assert.rejects(mcp.callTool('emettre_facture', { jeton: prep.jeton, confirmation: 'non' }, blob))
  const done = await mcp.callTool('emettre_facture', { jeton: prep.jeton, confirmation: 'emettre' }, blob)
  assert.equal(done.numero, 'A-2026-005')
  const ws = read(blob, WS)
  assert.ok(await validWorkspace(ws), 'le dossier fiscal reste valide')
  const entry = ws.entries.find(e => e.reference === 'A-2026-005')
  assert.equal(entry.vat.category, 'sale_es'); assert.equal(entry.amountCents, 105270)
  const c = read(blob, CRM_PATH)
  assert.equal(c.liens[entry.id].clientId, crm.clients.find(x => x.nom === 'Nisha').id)
  assert.equal(c.factures[entry.id].lignes[0].prixCents, 29000)
  await assert.rejects(mcp.callTool('emettre_facture', { jeton: prep.jeton, confirmation: 'emettre' }, blob), 'pas de doublon de numéro')

  const eu = await mcp.callTool('preparer_facture', { client: 'Decathlon', lignes: [{ description: 'Kits', quantite: 10, prix_ht: 290 }], date: '2026-11-30' }, blob)
  assert.match(eu.regime_iva, /Autoliquidation/)
  await mcp.callTool('emettre_facture', { jeton: eu.jeton, confirmation: 'emettre' }, blob)

  const paid = await mcp.callTool('pointer_paiement', { numero: 'A-2026-005', date: '2026-12-01', confirmation: 'pointer' }, blob)
  assert.equal(paid.pointee, true)
  await mcp.callTool('ajouter_depense', { libelle: 'Abonnement', fournisseur: 'Vercel', date: '2026-11-03', montant_ttc: 24.2, iva: 4.2, confirmation: 'ajouter' }, blob)
  await mcp.callTool('ajouter_prospect', { nom: 'Laura', entreprise: 'Studio yoga', valeur_ht: 1400 }, blob)
  assert.ok(await validWorkspace(read(blob, WS)))
  const resume = await mcp.callTool('resume_activite', { annee: 2026 }, blob)
  assert.equal(resume.a_encaisser.length, 1)
  assert.equal(read(blob, CRM_PATH).prospects[0].nom, 'Laura')
  await assert.rejects(mcp.callTool('preparer_facture', { client: 'Inconnu', lignes: [{ description: 'x', quantite: 1, prix_ht: 1 }] }, blob), /introuvable/)
})

test('Alfred : noter, faire le point, classer et terminer sans toucher à la compta', async () => {
  const crm = seedCrm()
  const ws = { entries: [{ id: 'inv_1', kind: 'invoice', date: '2026-01-05', reference: 'A-1', amountCents: 10000, payment: 'pending', expectedPaymentDate: '2026-01-10', label: 'X' }], records: {} }
  const blob = fakeBlob({ [CRM_PATH]: crm, [WS]: ws })
  const before = blob.store.get(WS).body
  await mcp.callTool('alfred_noter', { texte: 'Appeler la banque' }, blob)
  await mcp.callTool('alfred_noter', { titre: 'Préparer le carrousel', quadrant: 'planifier', echeance: '2026-12-01' }, blob)
  let p = await mcp.callTool('alfred_point', {}, blob)
  assert.equal(p.boite_alfred_a_classer.length, 1)
  assert.ok(p.matrice.faire.elements.some(e => e.titre.includes('A-1')), 'facture en retard en urgent')
  assert.ok(p.matrice.planifier.elements.some(e => e.titre === 'Préparer le carrousel'))
  await mcp.callTool('alfred_classer', { traites: [{ id: p.boite_alfred_a_classer[0].id, resultat: 'tâche créée' }],
    taches: [{ titre: 'Appeler la banque', quadrant: 'faire' }], priorite: 'Relancer A-1', agent: { id: 'compta', resume: '1 facture en retard' } }, blob)
  p = await mcp.callTool('alfred_point', {}, blob)
  assert.equal(p.boite_alfred_a_classer.length, 0); assert.equal(p.priorite_actuelle, 'Relancer A-1')
  const t = p.matrice.faire.elements.find(e => e.titre === 'Appeler la banque')
  await mcp.callTool('alfred_terminer', { id: t.id }, blob)
  const auto = p.matrice.faire.elements.find(e => e.auto)
  await mcp.callTool('alfred_terminer', { id: auto.id }, blob)
  p = await mcp.callTool('alfred_point', {}, blob)
  assert.ok(!p.matrice.faire.elements.some(e => e.titre === 'Appeler la banque' || e.id === auto.id))
  assert.equal(blob.store.get(WS).body, before, 'compta intacte')
})

test('devis à la voix : préparer, enregistrer, changer de statut', async () => {
  const crm = seedCrm()
  const blob = fakeBlob({ [CRM_PATH]: crm, [WS]: { entries: [], records: {} } })
  const prep = await mcp.callTool('preparer_devis', { client: 'Nisha', intro: 'Outil de location de tire-lait', date: '2026-11-22',
    lignes: [{ description: 'Outil', quantite: 1, prix_ht: 1250 }], echeancier: [{ label: 'Acompte', montant_ht: 625 }, { label: 'Solde', montant_ht: 625, date: '2026-12-20' }] }, blob)
  assert.equal(prep.numero, 'DEV-2026-001'); assert.equal(prep.alerte, null)
  await assert.rejects(mcp.callTool('enregistrer_devis', { jeton: prep.jeton, confirmation: 'non' }, blob))
  const r = await mcp.callTool('enregistrer_devis', { jeton: prep.jeton, confirmation: 'enregistrer' }, blob)
  assert.equal(r.numero, 'DEV-2026-001')
  let list = await mcp.callTool('lister_devis', { client: 'Nisha' }, blob)
  assert.equal(list[0].statut, 'brouillon'); assert.equal(list[0].total_ht.replace(/\s/g, ''), '1250,00€')
  const saved = JSON.parse(blob.store.get(CRM_PATH).body)
  assert.equal(saved.echeances.filter(e => e.devisId).length, 2)
  await mcp.callTool('changer_statut_devis', { numero: 'dev-2026-001', statut: 'signe', confirmation: 'changer', date: '2026-11-23' }, blob)
  list = await mcp.callTool('lister_devis', {}, blob)
  assert.equal(list[0].statut, 'signé'); assert.equal(list[0].signe_le, '2026-11-23')
  await assert.rejects(mcp.callTool('changer_statut_devis', { numero: 'DEV-9', statut: 'signe', confirmation: 'changer' }, blob))
  const again = await mcp.callTool('preparer_devis', { client: 'Nisha', lignes: [{ description: 'X', quantite: 1, prix_ht: 10 }], date: '2026-11-22' }, blob)
  assert.equal(again.numero, 'DEV-2026-002')
})
