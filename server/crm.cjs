// Clients, projets, espaces clients et prospection.
// Fichier privé séparé du dossier fiscal (workspace.json), pour ne jamais toucher à sa structure.
const crypto = require('crypto')
const { readVersionedBlob } = require('./private-blob.cjs')

const CRM_PATH = 'mi-gestoria/crm/v1/crm.json'

const str = (v, max = 200) => typeof v === 'string' ? v.slice(0, max) : ''
const id = v => typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : null
const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''
const cents = v => Number.isSafeInteger(v) && Math.abs(v) <= 1e10 ? v : 0
const oneOf = (v, list, fallback) => list.includes(v) ? v : fallback
const url = v => { const s = str(v, 600).trim(); return /^https:\/\//i.test(s) ? s : '' }
const token = v => typeof v === 'string' && /^[A-Za-z0-9_-]{32}$/.test(v) ? v : null

const newId = prefix => prefix + '_' + crypto.randomBytes(6).toString('hex')
const newToken = () => crypto.randomBytes(24).toString('base64url')

const CLIENT_STATUS = ['actif', 'pause', 'termine', 'archive']
const PROJECT_STATUS = ['a_demarrer', 'en_cours', 'suivi', 'en_pause', 'livre']
const PROSPECT_STATUS = ['nouveau', 'contacte', 'rdv', 'devis', 'gagne', 'perdu']
const CANAUX = ['instagram', 'linkedin', 'indeed', 'site']
const CANAL_STATUS = ['a_creer', 'en_cours', 'actif']
const DEVIS_STATUS = ['brouillon', 'envoye', 'signe', 'refuse']

function cleanClient(c) {
  return {
    id: id(c.id) || newId('cli'), nom: str(c.nom, 120).trim() || 'Sans nom', contact: str(c.contact, 120),
    type: oneOf(c.type, ['entreprise', 'particulier'], 'entreprise'), pays: str(c.pays, 40), canal: str(c.canal, 40),
    statut: oneOf(c.statut, CLIENT_STATUS, 'actif'), tarifJourCents: cents(c.tarifJourCents), email: str(c.email, 160),
    raisonSociale: str(c.raisonSociale, 160), nif: str(c.nif, 40), adresse: str(c.adresse, 400), notes: str(c.notes, 2000),
    source: oneOf(c.source, ['', 'direct', 'malt', 'livementor'], ''), portalToken: token(c.portalToken) || newToken(),
    createdAt: date(c.createdAt) || new Date().toISOString().slice(0, 10),
  }
}

function cleanProject(p) {
  return {
    id: id(p.id) || newId('prj'), clientId: id(p.clientId) || '', nom: str(p.nom, 120).trim() || 'Projet',
    statut: oneOf(p.statut, PROJECT_STATUS, 'en_cours'), etape: str(p.etape, 120), montantCents: cents(p.montantCents),
    echeance: date(p.echeance), messageClient: str(p.messageClient, 1500), visibleClient: p.visibleClient !== false,
    notes: str(p.notes, 20000), prochainRdv: str(p.prochainRdv, 30), rythme: str(p.rythme, 400),
    actions: (Array.isArray(p.actions) ? p.actions : []).slice(0, 120).filter(a => a && str(a.label).trim()).map(a => ({
      id: id(a.id) || newId('act'), label: str(a.label, 200).trim(), detail: str(a.detail, 1500), groupe: str(a.groupe, 40),
      pour: oneOf(a.pour, ['client', 'amely'], 'client'), fait: a.fait === true, faitLe: date(a.faitLe),
    })),
    // Plan par étapes et notes partagées : visibles dans l'espace du client.
    plan: (Array.isArray(p.plan) ? p.plan : []).slice(0, 20).filter(e => e && (str(e.titre).trim() || str(e.periode).trim())).map(e => ({
      id: id(e.id) || newId('etp'), periode: str(e.periode, 80), titre: str(e.titre, 140), amely: str(e.amely, 800), client: str(e.client, 800),
    })),
    notesPartagees: (Array.isArray(p.notesPartagees) ? p.notesPartagees : []).slice(0, 80).filter(n => n && str(n.texte).trim()).map(n => ({
      id: id(n.id) || newId('not'), date: str(n.date, 30), titre: str(n.titre, 200), texte: str(n.texte, 12000),
    })),
    documents: (Array.isArray(p.documents) ? p.documents : []).slice(0, 40).filter(d => d && url(d.url)).map(d => ({
      id: id(d.id) || newId('doc'), label: str(d.label, 120).trim() || 'Document', url: url(d.url),
    })),
  }
}

function cleanProspect(p) {
  return {
    id: id(p.id) || newId('pro'), nom: str(p.nom, 120).trim() || 'Sans nom', entreprise: str(p.entreprise, 120),
    source: str(p.source, 40), statut: oneOf(p.statut, PROSPECT_STATUS, 'nouveau'), valeurCents: cents(p.valeurCents),
    email: str(p.email, 160), lien: url(p.lien), relance: date(p.relance), besoin: str(p.besoin, 1000),
    notes: str(p.notes, 3000), clientId: id(p.clientId) || '', signeLe: date(p.signeLe),
  }
}

function cleanCanaux(raw) {
  const d = raw && typeof raw === 'object' ? raw : {}
  return Object.fromEntries(CANAUX.map(key => {
    const c = d[key] && typeof d[key] === 'object' ? d[key] : {}
    return [key, { statut: oneOf(c.statut, CANAL_STATUS, 'a_creer'), lien: url(c.lien), action: str(c.action, 200),
      date: date(c.date), notes: str(c.notes, 3000) }]
  }))
}

function cleanDevis(d) {
  return {
    id: id(d.id) || newId('dev'), clientId: id(d.clientId) || '', projetId: id(d.projetId) || '',
    numero: str(d.numero, 40).trim(), date: date(d.date), validite: date(d.validite),
    statut: oneOf(d.statut, DEVIS_STATUS, 'brouillon'), signeLe: date(d.signeLe),
    regime: oneOf(d.regime, ['es21', 'eu', 'other'], 'es21'), irpf: Math.min(Math.max(Number(d.irpf) || 0, 0), 50),
    intro: str(d.intro, 1500), perimetre: (Array.isArray(d.perimetre) ? d.perimetre : []).slice(0, 30).map(x => str(x, 300).trim()).filter(Boolean),
    note: str(d.note, 800), outils: str(d.outils, 800),
    lignes: (Array.isArray(d.lignes) ? d.lignes : []).slice(0, 30).map(l => ({
      description: str(l && l.description, 200), quantite: Math.max(0, Math.min(Number(l && l.quantite) || 0, 100000)), prixCents: cents(l && l.prixCents),
    })).filter(l => l.description.trim()),
  }
}

function cleanEcheance(e) {
  return {
    id: id(e.id) || newId('ech'), clientId: id(e.clientId) || '', label: str(e.label, 200).trim() || 'Échéance',
    date: date(e.date), montantCents: cents(e.montantCents), factureId: id(e.factureId) || '',
  }
}

function cleanCrm(data) {
  const d = data && typeof data === 'object' ? data : {}
  const clients = (Array.isArray(d.clients) ? d.clients : []).slice(0, 300).map(cleanClient)
  const ids = new Set(clients.map(c => c.id))
  const projets = (Array.isArray(d.projets) ? d.projets : []).slice(0, 600).map(cleanProject).filter(p => ids.has(p.clientId))
  const projetIds = new Set(projets.map(p => p.id))
  const liens = {}
  for (const [entryId, l] of Object.entries(d.liens && typeof d.liens === 'object' ? d.liens : {})) {
    if (id(entryId) && l && ids.has(l.clientId)) liens[entryId] = { clientId: l.clientId, ...(projetIds.has(l.projetId) && { projetId: l.projetId }) }
  }
  // Détail des factures émises depuis l'atelier (lignes, régime), pour pouvoir les réimprimer.
  const factures = {}
  for (const [entryId, f] of Object.entries(d.factures && typeof d.factures === 'object' ? d.factures : {}).slice(0, 2000)) {
    if (!id(entryId) || !f || typeof f !== 'object') continue
    factures[entryId] = {
      regime: oneOf(f.regime, ['es21', 'eu', 'other'], 'es21'), irpf: Math.min(Math.max(Number(f.irpf) || 0, 0), 50),
      note: str(f.note, 300), echeance: date(f.echeance),
      lignes: (Array.isArray(f.lignes) ? f.lignes : []).slice(0, 30).map(l => ({
        description: str(l.description, 200), quantite: Math.max(0, Math.min(Number(l.quantite) || 0, 100000)), prixCents: cents(l.prixCents),
      })),
    }
  }
  const devis = (Array.isArray(d.devis) ? d.devis : []).slice(0, 300).map(cleanDevis).filter(x => ids.has(x.clientId) && x.numero)
  const echeances = (Array.isArray(d.echeances) ? d.echeances : []).slice(0, 600).map(cleanEcheance).filter(x => ids.has(x.clientId))
  const journal = (Array.isArray(d.journal) ? d.journal : []).slice(0, 200)
    .filter(j => j && typeof j.texte === 'string').map(j => ({ date: str(j.date, 30), texte: str(j.texte, 300) }))
  const e = d.emetteur && typeof d.emetteur === 'object' ? d.emetteur : {}
  const emetteur = {
    nom: str(e.nom, 120), activite: str(e.activite, 160), nif: str(e.nif, 40), adresse: str(e.adresse, 400),
    email: str(e.email, 160), iban: str(e.iban, 60), serie: str(e.serie, 12).replace(/[^\w]/g, '') || 'A',
  }
  const objectifs = {}
  for (const [year, value] of Object.entries(d.objectifs && typeof d.objectifs === 'object' ? d.objectifs : {})) {
    if (/^20\d{2}$/.test(year) && cents(value) > 0) objectifs[year] = cents(value)
  }
  return {
    version: 1, emetteur, objectifs, clients, projets, liens, factures, devis, echeances, journal, canaux: cleanCanaux(d.canaux),
    prospects: (Array.isArray(d.prospects) ? d.prospects : []).slice(0, 600).map(cleanProspect),
  }
}

function seedCrm() {
  const today = new Date().toISOString().slice(0, 10)
  const c = (nom, extra) => cleanClient({ nom, createdAt: today, ...extra })
  const decathlon = c('Decathlon', { canal: 'Malt', source: 'malt', pays: 'France', tarifJourCents: 29000, notes: 'Missions via Malt, au mois par mois. Les factures Malt du registre s’affichent ici.' })
  const livementor = c('LiveMentor', { canal: 'LinkedIn', source: 'livementor', pays: 'France', notes: 'Mentor externe : accompagnement des tatoueurs.' })
  const nisha = c('Nisha', { type: 'particulier', canal: 'Bouche-à-oreille', contact: 'Nisha, sage-femme', tarifJourCents: 29000 })
  const miriam = c('Miriam · Symphōnie d’essences', { type: 'particulier', canal: 'Réseau' })
  const p = (client, nom, extra) => cleanProject({ clientId: client.id, nom, ...extra })
  return cleanCrm({
    objectifs: { 2027: 20000000 },
    emetteur: { nom: 'Amely Attias', activite: 'Consultante en organisation et communication', email: 'amely.attias@gmail.com' },
    clients: [decathlon, livementor, nisha, miriam],
    projets: [
      p(nisha, 'Première formation pour les parents', { montantCents: 155000, etape: 'Validation du démarrage' }),
      p(nisha, 'Outil de location de tire-lait', { montantCents: 125000, statut: 'a_demarrer' }),
      p(decathlon, 'Kits d’activation communication locale', {}),
      p(decathlon, 'Outil de pilotage communication locale (Gem)', {}),
      p(livementor, 'Mentorat tatoueurs', {}),
      p(miriam, 'Symphōnie d’essences', { statut: 'suivi' }),
    ],
  })
}

async function readCrm(blob) {
  const result = await readVersionedBlob(blob, CRM_PATH)
  if (!result) return { revision: null, data: seedCrm() }
  const data = await new Response(result.content.stream).json()
  return { revision: result.revision, data: cleanCrm(data) }
}

async function writeCrm(blob, data, revision) {
  const saved = await blob.put(CRM_PATH, JSON.stringify(data), {
    access: 'private', addRandomSuffix: false, contentType: 'application/json',
    allowOverwrite: revision !== null, ...(revision !== null && { ifMatch: revision }),
  })
  return saved.etag
}

module.exports = { CRM_PATH, cleanCrm, seedCrm, readCrm, writeCrm, newToken }
