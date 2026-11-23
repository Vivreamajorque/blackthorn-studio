import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { seedCrm, CRM_PATH } = require('../server/crm.cjs')
const espace = require('../api/gestoria-espace.js')

function fakeBlob(files) {
  let n = 0
  const store = new Map(Object.entries(files).map(([k, v]) => [k, { body: JSON.stringify(v), etag: 'e' + (n++) }]))
  class BlobPreconditionFailedError extends Error {}
  return {
    store, BlobPreconditionFailedError,
    async get(path) { const f = store.get(path); return f && { stream: new Response(f.body).body, blob: { url: path, etag: f.etag } } },
    async head(url) { return { etag: store.get(url).etag } },
    async put(path, body, opts) {
      const f = store.get(path)
      if (opts.ifMatch && f?.etag !== opts.ifMatch) throw new BlobPreconditionFailedError()
      const etag = 'e' + (n++); store.set(path, { body, etag }); return { etag }
    },
  }
}

function call(req) {
  return new Promise(resolve => {
    const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v },
      status(c) { this.statusCode = c; return this }, json(d) { resolve({ status: this.statusCode, data: d }) }, end() { resolve({ status: this.statusCode }) } }
    espace({ headers: { 'content-type': 'application/json' }, ...req }, res)
  })
}

test('espace client : ne montre que le dossier du client et protège les actions', async () => {
  const crm = seedCrm()
  const nisha = crm.clients.find(c => c.nom === 'Nisha')
  const decathlon = crm.clients.find(c => c.nom === 'Decathlon')
  const projet = crm.projets.find(p => p.clientId === nisha.id)
  projet.actions = [{ id: 'a1', label: 'Décrire les parents', pour: 'client', fait: false }, { id: 'a2', label: 'Construire la page', pour: 'amely', fait: false }]
  projet.notes = 'SECRET interne'
  crm.liens = { inv_n: { clientId: nisha.id } }
  const workspace = { entries: [
    { id: 'inv_n', kind: 'invoice', date: '2026-11-05', label: 'Nisha', reference: 'A-2026-001', amountCents: 93775, payment: 'pending' },
    { id: 'inv_m', kind: 'invoice', date: '2026-11-05', label: 'Malt', reference: 'ESRE01', amountCents: 116000, payment: 'paid', source: 'malt' },
    { id: 'exp_1', kind: 'expense', date: '2026-11-05', label: 'Loyer', reference: '', amountCents: 50000, payment: 'paid' },
  ], records: {} }
  espace.blobForTests = fakeBlob({ [CRM_PATH]: crm, 'mi-gestoria/personal/v1/workspace.json': workspace })

  let r = await call({ method: 'GET', query: { t: nisha.portalToken } })
  assert.equal(r.status, 200)
  assert.deepEqual(r.data.factures.map(f => f.reference), ['A-2026-001'])
  const text = JSON.stringify(r.data)
  assert.ok(!text.includes('SECRET') && !text.includes('Decathlon') && !text.includes('Loyer') && !text.includes('portalToken'))

  crm.echeances = [{ id: 'ech_1', clientId: nisha.id, label: 'Novembre', date: '2026-11-21', montantCents: 75000, factureId: 'inv_n' },
    { id: 'ech_2', clientId: nisha.id, label: 'Décembre', date: '2026-12-05', montantCents: 75000 }, { id: 'ech_3', clientId: decathlon.id, label: 'Autre', montantCents: 1 }]
  espace.blobForTests = fakeBlob({ [CRM_PATH]: crm, 'mi-gestoria/personal/v1/workspace.json': workspace })
  r = await call({ method: 'GET', query: { t: nisha.portalToken } })
  assert.deepEqual(r.data.echeancier.map(e => [e.label, e.statut]), [['Novembre', 'facturee'], ['Décembre', 'a_venir']], 'échéancier propre au client')

  r = await call({ method: 'GET', query: { t: decathlon.portalToken } })
  assert.deepEqual(r.data.factures.map(f => f.reference), ['ESRE01'], 'les factures Malt vont à Decathlon')

  r = await call({ method: 'POST', body: { t: nisha.portalToken, projetId: projet.id, actionId: 'a1', fait: true } })
  assert.equal(r.status, 200)
  assert.equal(r.data.projets.find(p => p.id === projet.id).actions[0].fait, true)
  r = await call({ method: 'POST', body: { t: nisha.portalToken, projetId: projet.id, actionId: 'a2', fait: true } })
  assert.equal(r.status, 403)
  r = await call({ method: 'GET', query: { t: 'x'.repeat(32) } })
  assert.equal(r.status, 404)
})

test('espace client : rien n’est visible tant que les fiches n’ont jamais été enregistrées', async () => {
  espace.blobForTests = fakeBlob({})
  const r = await call({ method: 'GET', query: { t: seedCrm().clients[0].portalToken } })
  assert.equal(r.status, 404)
})

test('espace client : devis visibles hors brouillons, brief, leçons, questions et visios', async () => {
  const crm = seedCrm()
  const nisha = crm.clients.find(c => c.nom === 'Nisha')
  const projet = crm.projets.find(p => p.clientId === nisha.id)
  Object.assign(projet, { type: 'formation', brief: [{ id: 'b1', q: 'À quels parents ?', r: '' }],
    lecons: [{ id: 'l1', titre: 'Validée', statut: 'validee' }],
    creneaux: [{ id: 'c1', titre: 'Point hebdo', date: '2026-11-25T18:00' }, { id: 'c2', titre: 'Point hebdo', date: '2026-11-26T18:00' }] })
  crm.devis = [{ id: 'd1', clientId: nisha.id, numero: 'DEV-1', statut: 'signe', lignes: [] }, { id: 'd2', clientId: nisha.id, numero: 'DEV-2', statut: 'brouillon', lignes: [] }]
  const blob = fakeBlob({ [CRM_PATH]: crm, 'mi-gestoria/personal/v1/workspace.json': { entries: [], records: {} } })
  espace.blobForTests = blob
  const t = nisha.portalToken
  let r = await call({ method: 'GET', query: { t } })
  assert.deepEqual(r.data.devis.map(d => d.numero), ['DEV-1'], 'pas de brouillon')

  r = await call({ method: 'POST', body: { t, projetId: projet.id, op: 'brief', reponses: { b1: 'Jeunes parents', bX: 'ignoré' } } })
  assert.equal(r.data.projets[0].brief[0].r, 'Jeunes parents')
  r = await call({ method: 'POST', body: { t, projetId: projet.id, op: 'lecon', lecon: { titre: 'Le sommeil', objectif: 'Comprendre', statut: 'validee' } } })
  const lecons = r.data.projets[0].lecons
  assert.equal(lecons.length, 2); assert.equal(lecons[1].statut, 'brouillon', 'le client ne peut pas valider')
  r = await call({ method: 'POST', body: { t, projetId: projet.id, op: 'lecon', lecon: { id: 'l1', titre: 'Changée' } } })
  assert.equal(r.status, 403, 'leçon validée verrouillée')
  r = await call({ method: 'POST', body: { t, projetId: projet.id, op: 'question', texte: 'Combien de vidéos ?' } })
  assert.equal(r.data.projets[0].questions[0].texte, 'Combien de vidéos ?')
  await call({ method: 'POST', body: { t, projetId: projet.id, op: 'creneau', creneauId: 'c1' } })
  r = await call({ method: 'POST', body: { t, projetId: projet.id, op: 'creneau', creneauId: 'c2' } })
  assert.deepEqual(r.data.projets[0].creneaux.map(c => c.reserve), [false, true], 'un seul horaire réservé par visio')
})

test('espace client : accepter un devis envoyé en ligne', async () => {
  const crm = seedCrm()
  const nisha = crm.clients.find(c => c.nom === 'Nisha')
  crm.devis = [
    { id: 'dev_env', clientId: nisha.id, numero: 'DEV-X', statut: 'envoye', validite: '2099-12-31', lignes: [{ description: 'Outil', quantite: 1, prixCents: 125000 }] },
    { id: 'dev_bro', clientId: nisha.id, numero: 'DEV-Y', statut: 'brouillon', lignes: [{ description: 'Outil', quantite: 1, prixCents: 1000 }] },
  ]
  const workspace = { entries: [], records: {} }
  const blob = fakeBlob({ [CRM_PATH]: crm, 'mi-gestoria/personal/v1/workspace.json': workspace })
  espace.blobForTests = blob
  let r = await call({ method: 'POST', body: { t: nisha.portalToken, op: 'accepter_devis', devisId: 'dev_env', nom: '', accepte: true } })
  assert.equal(r.status, 400, 'nom obligatoire')
  r = await call({ method: 'POST', body: { t: nisha.portalToken, op: 'accepter_devis', devisId: 'dev_bro', nom: 'Nisha', accepte: true } })
  assert.equal(r.status, 403, 'un brouillon ne s’accepte pas')
  r = await call({ method: 'POST', body: { t: nisha.portalToken, op: 'accepter_devis', devisId: 'dev_env', nom: 'Nisha D.', accepte: true } })
  assert.equal(r.status, 200)
  const d = r.data.devis.find(x => x.numero === 'DEV-X')
  assert.equal(d.statut, 'signe')
  assert.equal(d.signePar, 'Nisha D.')
  const saved = JSON.parse(blob.store.get(CRM_PATH).body)
  assert.ok(saved.messages.items.some(m => m.id === 'client:devis-accepte-dev_env'), 'Amely est prévenue')
  r = await call({ method: 'POST', body: { t: nisha.portalToken, op: 'accepter_devis', devisId: 'dev_env', nom: 'Nisha D.', accepte: true } })
  assert.equal(r.status, 403, 'pas deux fois')
  espace.blobForTests = null
})
