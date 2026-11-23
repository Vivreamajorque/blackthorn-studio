import React, { useEffect, useMemo, useState } from 'react'
import { money, uid, toCents, fromCents, clientInvoices, baseCents, devisBase, clientPotential, livementorEstimate } from '../lib/gestoria-crm'
import { formatDate, todayInSpain } from '../lib/gestoria-calendar.mjs'
import DevisTab from './GestoriaDevis'
import { printDocument, missingForInvoice } from '../lib/gestoria-documents.mjs'
import './gestoria-clients.css'

export const PROJECT_STATUS = {
  a_demarrer: ['À démarrer', 'wait'], en_cours: ['En cours', 'ok'], suivi: ['Suivi en cours', 'info'],
  en_pause: ['En pause', ''], livre: ['Livré', 'ok'],
}
const CANAUX = ['Malt', 'Instagram', 'Bouche-à-oreille', 'LinkedIn', 'Réseau', 'Site web', 'Autre']
const PAYS = ['Espagne', 'France', 'Belgique', 'Allemagne', 'Italie', 'Portugal', 'Pays-Bas', 'Luxembourg', 'Irlande', 'Autriche', 'Suisse', 'Royaume-Uni', 'Autre']
const EU_CODES = { France: 'FR', Belgique: 'BE', Allemagne: 'DE', Italie: 'IT', Portugal: 'PT', 'Pays-Bas': 'NL', Luxembourg: 'LU', Irlande: 'IE', Autriche: 'AT' }

export function Dialog({ title, onClose, children, footer }) {
  useEffect(() => {
    const key = event => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  return <div className="mgc-overlay" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <div className="mgc-dialog" role="dialog" aria-label={title}>
      <div className="mgc-between"><h2>{title}</h2><button type="button" aria-label="Fermer" onClick={onClose}>×</button></div>
      {children}
      {footer && <div className="mgc-actions">{footer}</div>}
    </div>
  </div>
}

export const bind = (value, set) => (key, convert = v => v) => ({
  value: value[key] ?? '', onChange: event => set({ ...value, [key]: convert(event.target.value) }),
})

export function ProjectBadge({ status }) {
  const [label, tone] = PROJECT_STATUS[status] || [status, '']
  return <span className={'mgc-badge ' + tone}>{label}</span>
}

export function PaymentBadge({ entry }) {
  if (entry.payment === 'paid') return <span className="mgc-badge ok">Payée</span>
  if (entry.expectedPaymentDate && entry.expectedPaymentDate < todayInSpain()) return <span className="mgc-badge late">En retard</span>
  return <span className="mgc-badge info">À encaisser</span>
}

function Initial({ name }) {
  return <div className="mgc-initial">{(name || '?').trim()[0]?.toUpperCase()}</div>
}

// ---------- Fiche client ----------
function ClientForm({ client, onSave, onClose, saving }) {
  const [c, setC] = useState({ ...client, tarifJour: fromCents(client.tarifJourCents) })
  const f = bind(c, setC)
  return <Dialog title={client.id ? 'Modifier le client' : 'Nouveau client'} onClose={onClose}
    footer={<><span /><button className="mgc-primary" disabled={saving || !c.nom?.trim()}
      onClick={() => onSave({ ...c, tarifJourCents: toCents(c.tarifJour || 0) })}>Enregistrer</button></>}>
    <div className="mgc-form">
      <div className="mgc-cols">
        <label>Nom affiché<input autoFocus {...f('nom')} /></label>
        <label>Contact (personne, rôle)<input {...f('contact')} /></label>
      </div>
      <div className="mgc-cols">
        <label>Type<select {...f('type')}><option value="entreprise">Entreprise / pro</option><option value="particulier">Particulier</option></select></label>
        <label>Pays<select {...f('pays')}><option value="">—</option>{PAYS.map(p => <option key={p}>{p}</option>)}</select></label>
        <label>Arrivé par<select {...f('canal')}><option value="">—</option>{CANAUX.map(p => <option key={p}>{p}</option>)}</select></label>
      </div>
      <div className="mgc-cols">
        <label>Statut<select {...f('statut')}><option value="actif">Actif</option><option value="pause">En pause</option><option value="termine">Terminé</option><option value="archive">Archivé</option></select></label>
        <label>Tarif jour (€ HT)<input type="number" step="1" {...f('tarifJour')} /></label>
        <label>Factures du registre<select {...f('source')}>
          <option value="">Seulement celles créées ici</option><option value="malt">Toutes les factures Malt</option><option value="livementor">Toutes les factures LiveMentor</option>
        </select></label>
      </div>
      <div className="mgc-cols">
        <label>Raison sociale (facture)<input {...f('raisonSociale')} /></label>
        <label>NIF / TVA intracom.<input {...f('nif')} /></label>
        <label>E-mail<input type="email" {...f('email')} /></label>
      </div>
      <label>Adresse de facturation<textarea {...f('adresse')} /></label>
      <label>Notes<textarea {...f('notes')} /></label>
    </div>
  </Dialog>
}

function ProjectForm({ project, onSave, onDelete, onClose, saving }) {
  const [p, setP] = useState({ actions: [], documents: [], plan: [], notesPartagees: [], ...project, montant: fromCents(project.montantCents) })
  const setStep = (id, key, value) => setP(x => ({ ...x, plan: x.plan.map(e => e.id === id ? { ...e, [key]: value } : e) }))
  const setNote = (id, key, value) => setP(x => ({ ...x, notesPartagees: x.notesPartagees.map(e => e.id === id ? { ...e, [key]: value } : e) }))
  const f = bind(p, setP)
  const setAction = (id, key, value) => setP(x => ({ ...x, actions: x.actions.map(a => a.id === id ? { ...a, [key]: value } : a) }))
  const setDoc = (id, key, value) => setP(x => ({ ...x, documents: x.documents.map(a => a.id === id ? { ...a, [key]: value } : a) }))
  const badUrl = p.documents.some(d => d.url && !/^https:\/\//i.test(d.url.trim()))
  return <Dialog title={project.id ? 'Projet' : 'Nouveau projet'} onClose={onClose}
    footer={<>
      {project.id ? <button className="mgc-danger" disabled={saving} onClick={() => window.confirm('Supprimer ce projet ?') && onDelete(project.id)}>Supprimer</button> : <span />}
      <button className="mgc-primary" disabled={saving || !p.nom?.trim() || badUrl} onClick={() => onSave({ ...p, montantCents: toCents(p.montant || 0) })}>Enregistrer</button>
    </>}>
    <div className="mgc-form">
      <div className="mgc-cols">
        <label>Nom du projet<input autoFocus {...f('nom')} /></label>
        <label>Statut<select {...f('statut')}>{Object.entries(PROJECT_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
      </div>
      <div className="mgc-cols">
        <label>Étape actuelle<input placeholder="ex. Validation du démarrage" {...f('etape')} /></label>
        <label>Montant prévu (€ HT)<input type="number" {...f('montant')} /></label>
        <label>Échéance<input type="date" {...f('echeance')} /></label>
      </div>
      <label>Message pour le client (en haut de son espace)<textarea {...f('messageClient')} /></label>
      <div className="mgc-cols">
        <label>Prochain rendez-vous<input type="datetime-local" {...f('prochainRdv')} /></label>
        <label>Rythme des rendez-vous<input placeholder="ex. Une visio par semaine" {...f('rythme')} /></label>
      </div>
      <div>
        <strong style={{ fontSize: '.85rem' }}>Plan par étapes (visible par le client)</strong>
        {p.plan.map(e => <div key={e.id} className="mgc-note-row">
          <div className="mgc-cols" style={{ gridTemplateColumns: '1fr 2fr 30px' }}>
            <input placeholder="Période" value={e.periode} onChange={x => setStep(e.id, 'periode', x.target.value)} />
            <input placeholder="Étape" value={e.titre} onChange={x => setStep(e.id, 'titre', x.target.value)} />
            <button type="button" aria-label="Retirer" onClick={() => setP(x => ({ ...x, plan: x.plan.filter(y => y.id !== e.id) }))}>×</button>
          </div>
          <input placeholder="Ce que je fais" value={e.amely} onChange={x => setStep(e.id, 'amely', x.target.value)} />
          <input placeholder="Ce que fait le client" value={e.client} onChange={x => setStep(e.id, 'client', x.target.value)} />
        </div>)}
        <button type="button" className="mgc-link" style={{ marginTop: 8 }} onClick={() => setP(x => ({ ...x, plan: [...x.plan, { id: uid('etp'), periode: '', titre: '', amely: '', client: '' }] }))}>+ Ajouter une étape</button>
      </div>
      <div>
        <strong style={{ fontSize: '.85rem' }}>Notes partagées (visibles par le client)</strong>
        {p.notesPartagees.map(n => <div key={n.id} className="mgc-note-row">
          <div className="mgc-cols" style={{ gridTemplateColumns: '150px 1fr 30px' }}>
            <input placeholder="Date" value={n.date} onChange={x => setNote(n.id, 'date', x.target.value)} />
            <input placeholder="Titre" value={n.titre} onChange={x => setNote(n.id, 'titre', x.target.value)} />
            <button type="button" aria-label="Retirer" onClick={() => setP(x => ({ ...x, notesPartagees: x.notesPartagees.filter(y => y.id !== n.id) }))}>×</button>
          </div>
          <textarea value={n.texte} onChange={x => setNote(n.id, 'texte', x.target.value)} />
        </div>)}
        <button type="button" className="mgc-link" style={{ marginTop: 8 }} onClick={() => setP(x => ({ ...x, notesPartagees: [{ id: uid('not'), date: todayInSpain(), titre: '', texte: '' }, ...x.notesPartagees] }))}>+ Ajouter une note</button>
      </div>
      <label className="mgc-check"><input type="checkbox" checked={p.visibleClient !== false} onChange={e => setP({ ...p, visibleClient: e.target.checked })} /> Visible dans l’espace du client</label>
      <div>
        <strong style={{ fontSize: '.85rem' }}>Actions</strong>
        {p.actions.map(a => <div key={a.id} className="mgc-lines">
          <input type="checkbox" aria-label="Fait" checked={!!a.fait} onChange={e => setAction(a.id, 'fait', e.target.checked)} />
          <input value={a.label} placeholder="Action" onChange={e => setAction(a.id, 'label', e.target.value)} />
          <select value={a.pour} onChange={e => setAction(a.id, 'pour', e.target.value)}><option value="client">Pour le client</option><option value="amely">Pour moi</option></select>
          <button type="button" aria-label="Retirer" onClick={() => setP(x => ({ ...x, actions: x.actions.filter(y => y.id !== a.id) }))}>×</button>
        </div>)}
        <button type="button" className="mgc-link" style={{ marginTop: 8 }}
          onClick={() => setP(x => ({ ...x, actions: [...x.actions, { id: uid('act'), label: '', pour: 'client', fait: false }] }))}>+ Ajouter une action</button>
      </div>
      <div>
        <strong style={{ fontSize: '.85rem' }}>Documents et liens partagés</strong>
        {p.documents.map(d => <div key={d.id} className="mgc-docs">
          <input value={d.label} placeholder="Nom" onChange={e => setDoc(d.id, 'label', e.target.value)} />
          <input value={d.url} placeholder="https://… (Drive, Canva…)" onChange={e => setDoc(d.id, 'url', e.target.value)} />
          <button type="button" aria-label="Retirer" onClick={() => setP(x => ({ ...x, documents: x.documents.filter(y => y.id !== d.id) }))}>×</button>
        </div>)}
        <button type="button" className="mgc-link" style={{ marginTop: 8 }}
          onClick={() => setP(x => ({ ...x, documents: [...x.documents, { id: uid('doc'), label: '', url: '' }] }))}>+ Ajouter un document</button>
        {badUrl && <p className="mgc-error">Les liens doivent commencer par https://</p>}
      </div>
      <label>Notes internes (jamais visibles du client)<textarea {...f('notes')} /></label>
    </div>
  </Dialog>
}

// ---------- Facture créée depuis la fiche, écrite dans le registre ----------
function nextReference(entries, serie, year) {
  const prefix = serie + '-' + year + '-'
  const max = entries.filter(e => e.kind === 'invoice' && e.reference.startsWith(prefix))
    .map(e => parseInt(e.reference.slice(prefix.length), 10)).filter(Number.isFinite).reduce((m, n) => Math.max(m, n), 0)
  return prefix + String(max + 1).padStart(3, '0')
}

function defaultRegime(client) {
  const pays = client.pays || 'Espagne'
  const pro = client.type !== 'particulier'
  if (pays === 'Espagne') return { regime: 'es21', irpf: pro ? '15' : '0' }
  if (EU_CODES[pays]) return { regime: pro ? 'eu' : 'es21', irpf: '0' }
  return { regime: 'other', irpf: '0' }
}

const REGIMES = {
  es21: 'IVA 21 % (client en Espagne, ou particulier dans l’UE)',
  eu: 'Autoliquidation UE (client pro dans l’UE, 0 %)',
  other: 'Hors UE (non soumis, 0 %)',
}

function computeInvoice(d) {
  const lines = d.lines.map(l => ({ ...l, cents: Math.round((Number(l.qty) || 0) * toCents(l.price || 0)) }))
  const base = lines.reduce((s, l) => s + l.cents, 0)
  const quota = d.regime === 'es21' ? Math.round(base * 0.21) : 0
  const withholding = Math.round(base * (Number(d.irpf) || 0) / 100)
  return { lines, base, quota, withholding, total: base + quota - withholding }
}

function printInvoice(d, t, client, emetteur) {
  printDocument({ kind: 'facture', numero: d.reference, date: d.date, due: d.due, regime: d.regime, irpf: Number(d.irpf) || 0, note: d.note,
    lignes: t.lines.map(l => ({ description: l.description, quantite: Number(l.qty) || 0, prixCents: toCents(l.price || 0) })), client, emetteur })
}

// Réimprimer une facture émise depuis l'atelier (ou depuis Claude) à partir de son détail enregistré.
function reprint(entry, detail, client, emetteur) {
  const d = { reference: entry.reference, date: entry.date, due: detail.echeance, regime: detail.regime, irpf: String(detail.irpf), note: detail.note }
  const lines = detail.lignes.map(l => ({ description: l.description, qty: String(l.quantite), price: String(l.prixCents / 100), cents: Math.round(l.quantite * l.prixCents) }))
  const base = lines.reduce((s, l) => s + l.cents, 0)
  const quota = detail.regime === 'es21' ? Math.round(base * 0.21) : 0
  const withholding = Math.round(base * (detail.irpf || 0) / 100)
  printInvoice(d, { lines, base, quota, withholding, total: base + quota - withholding }, client, emetteur)
}

function InvoiceForm({ client, project, projects, entries, emetteur, echeance, onCreate, onClose, saving }) {
  const today = todayInSpain()
  const due = new Date(today + 'T12:00:00Z'); due.setUTCDate(due.getUTCDate() + 15)
  const [d, setD] = useState(() => ({
    date: today, due: (echeance?.date && echeance.date >= today ? echeance.date : due.toISOString().slice(0, 10)), reference: nextReference(entries, emetteur.serie || 'A', today.slice(0, 4)),
    projetId: project?.id || '', ...defaultRegime(client), note: '',
    lines: echeance ? [{ id: uid('l'), description: echeance.label, qty: '1', price: fromCents(echeance.montantCents) }]
      : [{ id: uid('l'), description: project ? project.nom : '', qty: '1', price: fromCents(client.tarifJourCents) }],
  }))
  const [error, setError] = useState('')
  const [created, setCreated] = useState(false)
  const f = bind(d, setD)
  const t = computeInvoice(d)
  const year = Number(d.date.slice(0, 4))
  const taken = entries.some(e => e.kind === 'invoice' && e.reference.trim() === d.reference.trim())
  const setLine = (id, key, value) => setD(x => ({ ...x, lines: x.lines.map(l => l.id === id ? { ...l, [key]: value } : l) }))

  function create() {
    setError('')
    if (!d.reference.trim()) return setError('Indique le numéro de la facture.')
    if (taken) return setError('Ce numéro existe déjà dans ton registre.')
    if (t.base <= 0) return setError('Le montant est à zéro.')
    if (![2025, 2026, 2027].includes(year)) return setError('Mi Gestoría suit les exercices 2025 à 2027.')
    if (d.regime === 'eu' && !EU_CODES[client.pays]) return setError('Pour l’autoliquidation UE, indique le pays du client dans sa fiche.')
    const missing = missingForInvoice({ emetteur, client, regime: d.regime })
    if (missing.length) return setError('Pour que la facture soit conforme, complète : ' + missing.join(', ') + '. Ton NIF et ton adresse sont dans « Mes infos de facturation », ceux du client dans sa fiche.')
    const projet = projects.find(p => p.id === d.projetId)
    const vat = { category: d.regime === 'es21' ? 'sale_es' : d.regime === 'eu' ? 'sale_eu' : 'sale_other', date: d.date, baseCents: t.base, quotaCents: t.quota, deductibleCents: 0,
      ...(d.regime === 'es21' && { rate: 21 }), ...(d.regime === 'eu' && { country: EU_CODES[client.pays] }) }
    const entry = {
      id: uid('inv'), kind: 'invoice', date: d.date, label: (client.nom + (projet ? ' · ' + projet.nom : '')).slice(0, 160),
      reference: d.reference.trim().slice(0, 100), amountCents: t.total, payment: 'pending', source: client.source || 'direct',
      taxAmountCents: t.base, ...(t.withholding > 0 && { withholdingCents: t.withholding }),
      ...(d.due && { expectedPaymentDate: d.due }), vat,
    }
    const detail = { regime: d.regime, irpf: Number(d.irpf) || 0, note: d.note, echeance: d.due,
      lignes: t.lines.map(l => ({ description: l.description, quantite: Number(l.qty) || 0, prixCents: toCents(l.price || 0) })) }
    onCreate(entry, d.projetId, detail, echeance?.id, echeance?.lmMois).then(ok => ok && setCreated(true))
  }

  if (created) return <Dialog title={'Facture ' + d.reference + ' émise'} onClose={onClose}
    footer={<><button onClick={onClose}>Fermer</button><button className="mgc-primary" onClick={() => printInvoice(d, t, client, emetteur)}>Imprimer ou enregistrer en PDF</button></>}>
    <p>Elle est dans ton registre « Factures &amp; dépenses », en attente de paiement : {money(t.total)}.</p>
    {client.source === 'livementor'
      ? <p className="mgc-muted">Enregistre-la en PDF (« Imprimer », puis « Enregistrer en PDF ») et dépose-la sur ta page de facturation LiveMentor.</p>
      : <p className="mgc-muted">Elle apparaît déjà dans l’espace de {client.nom.split(' ')[0]}, avec les coordonnées pour payer. Tu peux aussi l’enregistrer en PDF pour l’envoyer par e-mail.</p>}
  </Dialog>


  return <Dialog title={'Facture · ' + client.nom} onClose={onClose}
    footer={<>
      <button disabled={t.base <= 0} onClick={() => printInvoice(d, t, client, emetteur)}>Aperçu à imprimer</button>
      <button className="mgc-primary" disabled={saving} onClick={create}>Émettre et ajouter au registre</button>
    </>}>
    <div className="mgc-form">
      {!emetteur.nif && <p className="mgc-note">Ton NIF et ton adresse ne sont pas encore renseignés : ajoute-les dans « Mes infos de facturation » (onglet Clients) avant d’envoyer une facture.</p>}
      <div className="mgc-cols">
        <label>Numéro<input {...f('reference')} /></label>
        <label>Date d’émission<input type="date" {...f('date')} /></label>
        <label>Paiement attendu le<input type="date" {...f('due')} /></label>
      </div>
      <div className="mgc-cols">
        <label>Projet<select {...f('projetId')}><option value="">—</option>{projects.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}</select></label>
        <label>IVA<select {...f('regime')}>{Object.entries(REGIMES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Retenue IRPF (%)<input type="number" min="0" max="21" {...f('irpf')} /></label>
      </div>
      <div>
        <strong style={{ fontSize: '.85rem' }}>Prestations (quantité × prix HT)</strong>
        {d.lines.map(l => <div key={l.id} className="mgc-cols" style={{ gridTemplateColumns: '1fr 70px 110px 30px', marginTop: 6 }}>
          <input placeholder="Description" value={l.description} onChange={e => setLine(l.id, 'description', e.target.value)} />
          <input type="number" step="0.5" aria-label="Quantité" value={l.qty} onChange={e => setLine(l.id, 'qty', e.target.value)} />
          <input type="number" step="0.01" aria-label="Prix HT" value={l.price} onChange={e => setLine(l.id, 'price', e.target.value)} />
          {d.lines.length > 1 ? <button type="button" aria-label="Retirer" onClick={() => setD(x => ({ ...x, lines: x.lines.filter(y => y.id !== l.id) }))}>×</button> : <span />}
        </div>)}
        <button type="button" className="mgc-link" style={{ marginTop: 8 }} onClick={() => setD(x => ({ ...x, lines: [...x.lines, { id: uid('l'), description: '', qty: '1', price: '' }] }))}>+ Ajouter une ligne</button>
      </div>
      <div className="mgc-total">
        <div><div className="mgc-muted">Base HT</div><strong>{money(t.base)}</strong></div>
        <div><div className="mgc-muted">IVA</div><strong>{money(t.quota)}</strong></div>
        <div><div className="mgc-muted">Retenue IRPF</div><strong>{t.withholding ? '− ' + money(t.withholding) : money(0)}</strong></div>
        <div><div className="mgc-muted">Total à encaisser</div><strong style={{ fontSize: '1.1rem' }}>{money(t.total)}</strong></div>
      </div>
      <label>Mention ou conditions (facultatif)<input maxLength={300} {...f('note')} /></label>
      <p className="mgc-muted">La facture entre dans « Factures &amp; dépenses » de Mon activité, comme une facture émise en attente de paiement. Elle compte dans tes 303 et 130.</p>
      {error && <p className="mgc-error">{error}</p>}
    </div>
  </Dialog>
}

function EmetteurForm({ emetteur, onSave, onClose, saving }) {
  const [e, setE] = useState(emetteur)
  const f = bind(e, setE)
  return <Dialog title="Mes infos de facturation" onClose={onClose}
    footer={<><span /><button className="mgc-primary" disabled={saving} onClick={() => onSave(e)}>Enregistrer</button></>}>
    <div className="mgc-form">
      <div className="mgc-cols"><label>Nom<input {...f('nom')} /></label><label>Activité<input {...f('activite')} /></label></div>
      <div className="mgc-cols"><label>NIF / NIE<input {...f('nif')} /></label><label>E-mail<input {...f('email')} /></label></div>
      <label>Adresse<textarea {...f('adresse')} /></label>
      <div className="mgc-cols"><label>IBAN (sur les factures)<input {...f('iban')} /></label>
        <label>Série de numérotation<input {...f('serie')} /><span className="mgc-muted">Ex. A → A-2026-001</span></label></div>
    </div>
  </Dialog>
}



// Synthèse financière d'un client : signé, facturé, encaissé, reste à facturer, à encaisser, prochaine échéance.
export function clientMoney(client, crm, invoices, entries) {
  const { enCours } = clientPotential(entries, crm, client)
  const devis = (crm.devis || []).filter(d => d.clientId === client.id)
  const signed = devis.filter(d => d.statut === 'signe').reduce((s, d) => s + devisBase(d), 0)
  const pendingDevis = devis.filter(d => d.statut === 'envoye' || d.statut === 'brouillon')
  const billed = invoices.reduce((s, e) => s + baseCents(e), 0)
  const paid = invoices.filter(e => e.payment === 'paid').reduce((s, e) => s + e.amountCents, 0)
  const due = invoices.filter(e => e.payment !== 'paid').reduce((s, e) => s + e.amountCents, 0)
  const today = todayInSpain()
  const next = (crm.echeances || []).filter(e => e.clientId === client.id && !e.factureId).sort((a, b) => a.date.localeCompare(b.date))[0]
  return { enCours, signed, billed, paid, due, rest: Math.max(0, signed - billed), pendingDevis, pendingTotal: pendingDevis.reduce((s, d) => s + devisBase(d), 0),
    next, nextLate: next && next.date < today, overdue: invoices.filter(e => e.payment !== 'paid' && e.expectedPaymentDate && e.expectedPaymentDate < today) }
}

function IndicateursForm({ client, onSave, onClose, saving }) {
  const [rows, setRows] = useState(() => client.indicateurs?.length ? client.indicateurs : [{ id: uid('ind'), label: '', valeur: '', date: todayInSpain(), note: '' }])
  const set = (id, k, v) => setRows(r => r.map(x => x.id === id ? { ...x, [k]: v, ...(k === 'valeur' && { date: todayInSpain() }) } : x))
  return <Dialog title={'Suivi · ' + client.nom} onClose={onClose}
    footer={<><span /><button className="mgc-primary" disabled={saving} onClick={() => onSave(rows.filter(r => r.label.trim()))}>Enregistrer</button></>}>
    <div className="mgc-form">
      <p className="mgc-muted">Les chiffres à suivre pour ce client (ex. apprenants actifs, jauge, missions en cours). La date se met à jour quand tu changes une valeur.</p>
      {rows.map(r => <div key={r.id} className="mgc-note-row">
        <div className="mgc-cols" style={{ gridTemplateColumns: '2fr 1fr 1fr 30px' }}>
          <input placeholder="Indicateur" value={r.label} onChange={e => set(r.id, 'label', e.target.value)} />
          <input placeholder="Valeur" value={r.valeur} onChange={e => set(r.id, 'valeur', e.target.value)} />
          <input type="date" value={r.date} onChange={e => set(r.id, 'date', e.target.value)} />
          <button type="button" aria-label="Retirer" onClick={() => setRows(x => x.filter(y => y.id !== r.id))}>×</button>
        </div>
        <input placeholder="Source ou remarque (facultatif)" value={r.note} onChange={e => set(r.id, 'note', e.target.value)} />
      </div>)}
      <button type="button" className="mgc-link" onClick={() => setRows(r => [...r, { id: uid('ind'), label: '', valeur: '', date: todayInSpain(), note: '' }])}>+ Ajouter un indicateur</button>
    </div>
  </Dialog>
}

const MSG_LABEL = { livementor: 'LiveMentor', malt: 'Malt', client: 'Client', autre: 'Autre' }
const fmtWhen = d => d ? formatDate(d.slice(0, 10)) + (d.length > 10 ? ' · ' + d.slice(11, 16) : '') : ''

// Liste des messages pro relevés (LiveMentor, Malt, clients). « Vu » les range sans rien toucher dans la boîte mail.
export function MessagesList({ items, canSave, onVu, showSource = true, empty = 'Aucun nouveau message.' }) {
  const [all, setAll] = useState(false)
  const unread = items.filter(m => !m.vu)
  const shown = (all ? items : unread).slice().sort((a, b) => b.date.localeCompare(a.date))
  return <>
    {shown.length === 0 ? <p className="mgc-muted">{empty}</p> : <ul className="mgc-list mgc-msgs">{shown.map(m => <li key={m.id} className={m.vu ? 'is-vu' : ''}>
      <div style={{ minWidth: 0 }}>
        <div className="mgc-row">{showSource && <span className={'mgc-badge src-' + m.source}>{MSG_LABEL[m.source]}</span>}<strong>{m.sujet}</strong></div>
        <div className="mgc-muted">{[m.de, fmtWhen(m.date)].filter(Boolean).join(' · ')}</div>
        {m.apercu && <div className="mgc-msg-apercu">{m.apercu}</div>}
      </div>
      <div className="mgc-row" style={{ flexShrink: 0 }}>
        {m.lien && <a className="mgc-link" href={m.lien} target="_blank" rel="noreferrer">Ouvrir</a>}
        {!m.vu && <button disabled={!canSave} onClick={() => onVu(m.id)}>Vu</button>}
      </div>
    </li>)}</ul>}
    {items.length > unread.length && <button className="mgc-link" onClick={() => setAll(!all)}>{all ? 'Masquer les messages vus' : 'Voir aussi les messages vus'}</button>}
  </>
}

export const markMessageVu = (saveCrm, msgId) => saveCrm(data => ({ ...data, messages: { ...data.messages, items: (data.messages?.items || []).map(m => m.id === msgId ? { ...m, vu: true } : m) } }))

const BRIEF_FORMATION = ['À quels parents veux-tu t’adresser ?', 'Quelle difficulté cherchent-ils à résoudre ?', 'Que sauront-ils faire après la formation ?',
  'Quel est le périmètre de la formation ?', 'Quelles étapes les aideront à progresser ?', 'Comment souhaites-tu organiser l’accès ?',
  'Comment les parents te poseront-ils leurs questions ?', 'Qu’aimerais-tu éclaircir avec Amely ?']

// Ce que le client voit et remplit dans son espace : type, brief, créneaux de visio, questions et leçons.
const ETAPE_LABEL = { a_faire: 'À faire', en_cours: 'En cours', a_tester: 'À tester', a_corriger: 'À corriger', validee: 'Validée' }
// Atelier : carnet de construction de l'outil d'un client. L'agent Atelier prépare et construit ; Amely teste et valide.
function AtelierPanel({ project, canSave, saveConstruction, defaultOpen = false }) {
  const k = project.construction
  const [open, setOpen] = useState(defaultOpen)
  const [retour, setRetour] = useState({})
  const [cahierOpen, setCahierOpen] = useState(false)
  if (!k || !k.actif) return <div className="atl atl-off">
    <span className="mgc-muted">{k ? 'Atelier en pause.' : 'Un outil à construire pour ce projet ?'}</span>
    <button disabled={!canSave} onClick={() => saveConstruction(project, x => ({ etapes: [], ...x, actif: true, demande: new Date().toISOString().slice(0, 16) }), 'L’Atelier va préparer le cahier de construction.')}>
      {k ? 'Reprendre l’Atelier' : 'Démarrer l’Atelier'}</button>
  </div>
  const todo = k.etapes.filter(e => e.etat !== 'validee').length
  const done = k.etapes.length - todo
  const setEtape = (e, patch, msg) => saveConstruction(project, x => ({ ...x, etapes: x.etapes.map(o => o.id === e.id ? { ...o, ...patch, majLe: new Date().toISOString().slice(0, 16) } : o) }), msg)
  return <div className="atl">
    <div className="mgc-between">
      <button className="atl-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <strong>Atelier</strong> · {k.etapes.length ? done + ' / ' + k.etapes.length + ' étapes validées' : (k.cahier ? 'cahier prêt' : 'cahier en préparation')}
        {k.etapes.some(e => e.etat === 'a_tester') && <span className="mgc-badge warn">à tester</span>} <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      <div className="mgc-row">
        {k.urlTest && <a href={k.urlTest} target="_blank" rel="noopener noreferrer">Version de test ↗</a>}
        {k.cahier && !k.cahierValide
          ? <button className="mgc-primary" onClick={() => { setOpen(true); setCahierOpen(true) }}>Relire et valider le cahier</button>
          : <button className="mgc-primary" disabled={!canSave || !!k.demande} onClick={() => saveConstruction(project, x => ({ ...x, demande: new Date().toISOString().slice(0, 16) }), 'Demande envoyée à l’Atelier.')}>
          {k.demande ? 'Demandé · l’Atelier passe bientôt' : (k.cahier ? 'Construis l’étape suivante' : 'Prépare le cahier')}</button>}
      </div>
    </div>
    {open && <div className="atl-body">
      {k.note && <p className="atl-note">{k.note}</p>}
      {k.cahier && <details className="atl-cahier" open={cahierOpen || !k.cahierValide} onToggle={ev => setCahierOpen(ev.currentTarget.open)}>
        <summary>Cahier de construction {k.cahierValide ? '· validé' : '· à relire puis valider'}</summary>
        <div className="atl-text">{k.cahier}</div>
        {!k.cahierValide && <div className="atl-actions">
          <button className="mgc-primary" disabled={!canSave} onClick={() => saveConstruction(project, x => ({ ...x, cahierValide: true }), 'Cahier validé. Tu peux lancer la construction.')}>Valider le cahier</button>
          <span className="mgc-muted">Une fois validé, le bouton « Construis l’étape suivante » apparaît en haut du bloc.</span>
        </div>}
      </details>}
      {k.etapes.length > 0 && <ol className="atl-steps">{k.etapes.map(e => <li key={e.id} className={'atl-step s-' + e.etat}>
        <div className="mgc-between"><strong>{e.titre}</strong><span className={'mgc-badge ' + (e.etat === 'validee' ? 'ok' : e.etat === 'a_tester' || e.etat === 'a_corriger' ? 'warn' : '')}>{ETAPE_LABEL[e.etat]}</span></div>
        {e.detail && <p className="mgc-muted">{e.detail}</p>}
        {e.fait && <p><b>Ce qui a été fait :</b> {e.fait}</p>}
        {e.aVerifier && e.etat === 'a_tester' && <p><b>À vérifier :</b> {e.aVerifier}</p>}
        {e.retour && e.etat === 'a_corriger' && <p><b>Ton retour :</b> {e.retour}</p>}
        {e.lienTest && <p><a href={e.lienTest} target="_blank" rel="noopener noreferrer">Ouvrir la version de test ↗</a></p>}
        {e.etat === 'a_tester' && <div className="atl-actions">
          <button className="mgc-primary" disabled={!canSave} onClick={() => setEtape(e, { etat: 'validee' }, 'Étape validée.')}>C’est bon</button>
          <input placeholder="Ce qu’il faut corriger…" value={retour[e.id] || ''} onChange={ev => setRetour({ ...retour, [e.id]: ev.target.value })} />
          <button disabled={!canSave || !(retour[e.id] || '').trim()} onClick={() => setEtape(e, { etat: 'a_corriger', retour: retour[e.id].trim() }, 'Retour envoyé à l’Atelier.')}>À corriger</button>
        </div>}
      </li>)}</ol>}
      {!k.cahier && !k.etapes.length && <p className="mgc-muted">L’Atelier prépare le cahier de construction à son prochain passage (chaque nuit vers 22 h, ou en journée si tu le demandes).</p>}
      <p className="atl-foot"><button className="mgc-link" disabled={!canSave} onClick={() => saveConstruction(project, x => ({ ...x, actif: false, demande: '' }), 'Atelier mis en pause.')}>Mettre l’Atelier en pause</button>
        {k.majLe && <span className="mgc-muted"> · dernière mise à jour {k.majLe.replace('T', ' à ')}</span>}</p>
    </div>}
  </div>
}

function SharedSpaceForm({ project, onSave, onClose, saving }) {
  const [p, setP] = useState(() => ({ type: project.type || 'standard', brief: project.brief || [], creneaux: project.creneaux || [],
    questions: project.questions || [], lecons: project.lecons || [] }))
  const upd = (k, id, field, v) => setP(x => ({ ...x, [k]: x[k].map(r => r.id === id ? { ...r, [field]: v } : r) }))
  const del = (k, id) => setP(x => ({ ...x, [k]: x[k].filter(r => r.id !== id) }))
  return <Dialog title={'Espace partagé · ' + project.nom} onClose={onClose}
    footer={<><span /><button className="mgc-primary" disabled={saving} onClick={() => onSave({ ...project, ...p })}>Enregistrer</button></>}>
    <div className="mgc-form">
      <label>Type de projet <select value={p.type} onChange={e => setP(x => ({ ...x, type: e.target.value }))}>
        <option value="standard">Projet (outil, mission…)</option><option value="formation">Formation (ajoute le brief et « Mes leçons »)</option></select></label>

      <h4>Brief</h4>
      {p.brief.length === 0 && <div className="mgc-row"><span className="mgc-muted">Pas de brief.</span>
        {p.type === 'formation' && <button type="button" className="mgc-link" onClick={() => setP(x => ({ ...x, brief: BRIEF_FORMATION.map(q => ({ id: uid('brf'), q, r: '' })) }))}>Mettre les questions du brief formation</button>}</div>}
      {p.brief.map(b => <div key={b.id} className="mgc-note-row">
        <div className="mgc-cols" style={{ gridTemplateColumns: '1fr 30px' }}><input value={b.q} onChange={e => upd('brief', b.id, 'q', e.target.value)} />
          <button type="button" aria-label="Retirer" onClick={() => del('brief', b.id)}>×</button></div>
        <div className="mgc-muted" style={{ whiteSpace: 'pre-line' }}>{b.r ? 'Réponse : ' + b.r : 'Pas encore de réponse.'}</div>
      </div>)}
      <button type="button" className="mgc-link" onClick={() => setP(x => ({ ...x, brief: [...x.brief, { id: uid('brf'), q: '', r: '' }] }))}>+ Ajouter une question au brief</button>

      <h4>Créneaux de visio</h4>
      <p className="mgc-muted">Même intitulé = plusieurs horaires au choix pour la même visio. Le client en réserve un.</p>
      {p.creneaux.map(c => <div key={c.id} className="mgc-cols" style={{ gridTemplateColumns: '2fr 1.3fr 2fr auto 30px' }}>
        <input placeholder="Intitulé" value={c.titre} onChange={e => upd('creneaux', c.id, 'titre', e.target.value)} />
        <input type="datetime-local" value={c.date} onChange={e => upd('creneaux', c.id, 'date', e.target.value)} />
        <input placeholder="Lien visio (https://…)" value={c.lien} onChange={e => upd('creneaux', c.id, 'lien', e.target.value)} />
        <span className={'mgc-badge ' + (c.reserve ? 'ok' : '')}>{c.reserve ? 'Réservé' : 'Libre'}</span>
        <button type="button" aria-label="Retirer" onClick={() => del('creneaux', c.id)}>×</button></div>)}
      <button type="button" className="mgc-link" onClick={() => setP(x => ({ ...x, creneaux: [...x.creneaux, { id: uid('crn'), titre: x.creneaux.at(-1)?.titre || 'Point hebdo', date: '', lien: x.creneaux.at(-1)?.lien || '', reserve: false }] }))}>+ Proposer un créneau</button>

      <h4>Questions du client</h4>
      {p.questions.length === 0 ? <p className="mgc-muted">Aucune question.</p> : p.questions.slice().reverse().map(q => <div key={q.id} className="mgc-note-row">
        <div className="mgc-between"><span className="mgc-muted">{q.date ? formatDate(q.date) : ''}</span>
          <label className="mgc-row" style={{ fontWeight: 400 }}><input type="checkbox" checked={q.traitee} onChange={e => upd('questions', q.id, 'traitee', e.target.checked)} /> Traitée</label></div>
        <div style={{ whiteSpace: 'pre-line' }}>{q.texte}</div>
        <textarea rows={2} placeholder="Ta réponse (visible par le client)" value={q.reponse} onChange={e => upd('questions', q.id, 'reponse', e.target.value)} />
      </div>)}

      {p.type === 'formation' && <>
        <h4>Leçons</h4>
        {p.lecons.length === 0 ? <p className="mgc-muted">Aucune fiche de leçon.</p> : p.lecons.map((l, i) => <div key={l.id} className="mgc-note-row">
          <div className="mgc-between"><strong>{i + 1}. {l.titre}</strong>
            <select value={l.statut} onChange={e => upd('lecons', l.id, 'statut', e.target.value)}>
              <option value="brouillon">Brouillon</option><option value="a_valider">À relire</option><option value="validee">Validée</option></select></div>
          {l.objectif && <div className="mgc-muted">{l.objectif}</div>}
          {l.points && <div style={{ whiteSpace: 'pre-line', fontSize: 13 }}>{l.points}</div>}
          {l.video && <a className="mgc-link" href={l.video} target="_blank" rel="noreferrer">Vidéo ↗</a>}
          <textarea rows={2} placeholder="Ton retour (visible par le client)" value={l.retour} onChange={e => upd('lecons', l.id, 'retour', e.target.value)} />
        </div>)}
      </>}
    </div>
  </Dialog>
}

function LivementorPanel({ lm }) {
  const e = livementorEstimate(lm)
  if (!e) return <section className="mgc-panel"><h3>Gains LiveMentor</h3><p className="mgc-muted">Pas encore de relevé. Dis « mets à jour LiveMentor » à Claude.</p></section>
  const learners = lm.releve.apprenants || []
  return <section className="mgc-panel">
    <div className="mgc-between"><h3>Gains LiveMentor · mois en cours</h3>
      <span className="mgc-muted">Montant affiché par LiveMentor au {formatDate(e.releveDate)} · actualisé chaque matin</span></div>
    <div className="mgc-money-grid" style={{ marginTop: 8 }}>
      <div className="is-key"><span>Gagné ce mois-ci</span><strong>{money(e.estimate)}</strong><small>HT · {e.sameMonth ? 'relevé LiveMentor' : 'nouveau mois : en attente du premier relevé'}</small></div>
      <div><span>Projection fin de mois</span><strong>{money(e.projection)}</strong><small>si personne n’arrive ni ne part</small></div>
      <div><span>Apprenants actifs</span><strong>{e.actifs}</strong><small>≈ {money(e.perLearner)} / apprenant / mois</small></div>
    </div>
    {learners.length > 0 && <details style={{ marginTop: 8 }}><summary className="mgc-muted">Détail par apprenant (relevé du {formatDate(e.releveDate)})</summary>
      <table className="mgc-table"><tbody>{learners.map(a => <tr key={a.nom}><td>{a.nom}</td><td className="mgc-num">{a.jours} j</td><td className="mgc-num">{money(a.montantCents)}</td></tr>)}</tbody></table>
    </details>}
  </section>
}

function ClientSummary({ client, crm, saveCrm, entries, invoices, projects, canSave, onTab, onIndicateurs }) {
  const m = clientMoney(client, crm, invoices, entries)
  const base = Math.max(m.signed, m.billed, 1)
  const active = projects.filter(p => p.statut !== 'livre')
  return <>
    <section className="mgc-panel mgc-money">
      <div className="mgc-money-grid">
        <div><span>Devis signés</span><strong>{m.signed ? money(m.signed) : '—'}</strong><small>HT</small></div>
        <div><span>Facturé</span><strong>{money(m.billed)}</strong><small>HT · {invoices.length} facture{invoices.length > 1 ? 's' : ''}</small></div>
        <div><span>Encaissé</span><strong>{money(m.paid)}</strong><small>sur ton compte</small></div>
        {(m.signed > 0 || !m.enCours) && <div className={m.rest ? 'is-key' : ''}><span>Reste à facturer</span><strong>{m.signed ? money(m.rest) : '—'}</strong><small>{m.signed ? 'sur les devis signés' : 'pas de devis signé'}</small></div>}
        {(m.enCours > 0 || !m.signed) && <div className={m.enCours ? 'is-key' : ''}><span>En cours, pas facturé</span><strong>{money(m.enCours)}</strong><small>{m.enCours ? 'missions en cours' : 'mets un montant sur le projet'}</small></div>}
        <div className={m.due ? 'is-warn' : ''}><span>À encaisser</span><strong>{money(m.due)}</strong><small>{m.overdue.length ? m.overdue.length + ' en retard' : 'factures envoyées'}</small></div>
      </div>
      {m.signed > 0 && <div className="mgc-money-bar" role="img" aria-label={'Encaissé ' + money(m.paid) + ', facturé ' + money(m.billed) + ', signé ' + money(m.signed)}>
        <span className="paid" style={{ width: Math.min(100, m.paid / base * 100) + '%' }} />
        <span className="billed" style={{ width: Math.min(100, Math.max(0, m.billed - m.paid) / base * 100) + '%' }} />
      </div>}
      {m.signed > 0 && <p className="mgc-legend" style={{ marginTop: 6 }}><span><i style={{ background: '#00897b' }} />Encaissé</span><span><i style={{ background: '#7fc4bb' }} />Facturé, pas encore payé</span><span><i style={{ background: '#e7e1d5' }} />Reste à facturer</span></p>}
      <div className="mgc-row" style={{ marginTop: 10 }}>
        {m.next && <span className={'mgc-badge ' + (m.nextLate ? 'late' : 'wait')}>Prochaine échéance : {formatDate(m.next.date)} · {money(m.next.montantCents)} · {m.next.label}</span>}
        {m.pendingDevis.length > 0 && <button className="mgc-link" onClick={() => onTab('devis')}>{m.pendingDevis.length} devis en attente de signature · {money(m.pendingTotal)} HT</button>}
      </div>
    </section>

    {(() => {
      const msgs = (crm.messages?.items || []).filter(m => m.clientId === client.id || (!m.clientId && client.source && m.source === client.source))
      if (!msgs.length) return null
      const n = msgs.filter(m => !m.vu).length
      return <section className="mgc-panel"><div className="mgc-between"><h3>Messages{n ? ' · ' + n + ' non lu' + (n > 1 ? 's' : '') : ''}</h3></div>
        <MessagesList items={msgs} canSave={canSave} showSource={false} onVu={id => markMessageVu(saveCrm, id)} /></section>
    })()}
    {client.source === 'livementor' && <LivementorPanel lm={crm.livementor} />}
    {client.indicateurs?.length > 0 && <section className="mgc-panel">
      <div className="mgc-between"><h3>Suivi</h3><button disabled={!canSave} onClick={onIndicateurs}>Mettre à jour</button></div>
      {client.indicateurs?.length ? <div className="mgc-tiles" style={{ marginBottom: 0 }}>
        {client.indicateurs.map(x => <div key={x.id} className="mgc-tile" title={x.note}><strong>{x.valeur || '—'}</strong><span>{x.label}{x.date ? ' · au ' + formatDate(x.date) : ''}</span></div>)}
      </div> : <p className="mgc-muted">Ajoute les chiffres à suivre (apprenants actifs, jauge…).</p>}
    </section>}

  </>
}

// Une carte par projet : Aperçu (ce qui compte maintenant), Actions (moi / client), Construction (Atelier), Liens et notes.
function ProjectCard({ p, client, canSave, toggle, onEdit, onShared, onInvoice, saveConstruction }) {
  const [vue, setVue] = useState('apercu')
  const today = todayInSpain()
  const k = p.construction
  const mine = p.actions.filter(a => a.pour === 'amely'), theirs = p.actions.filter(a => a.pour !== 'amely')
  const done = p.actions.filter(a => a.fait).length
  const questions = (p.questions || []).filter(q => !q.traitee).length
  const lecons = (p.lecons || []).filter(l => l.statut === 'a_valider').length
  const visio = [...(p.creneaux || []).filter(c => c.reserve).map(c => c.date), p.prochainRdv].filter(d => d && d.slice(0, 10) >= today).sort()[0]
  const lastClient = theirs.filter(a => a.fait && a.faitLe).map(a => a.faitLe).sort().at(-1)
  const actif = !['livre', 'en_pause'].includes(p.statut)
  const etapeK = k?.actif ? (k.etapes.find(e => e.etat === 'a_tester') || k.etapes.find(e => e.etat === 'a_corriger')) : null
  const nbVal = k?.etapes?.filter(e => e.etat === 'validee').length || 0
  const Check = ({ a, ro }) => <li><label>
    <input type="checkbox" checked={a.fait} disabled={!canSave || ro} onChange={() => toggle(p, a)} />
    <span className={a.fait ? 'mgc-done' : ''}>{a.label}{a.detail && !a.fait && <small>{a.detail}</small>}</span></label></li>
  const Liste = ({ list, ro, vide }) => {
    const open = list.filter(a => !a.fait), closed = list.filter(a => a.fait)
    return <>{open.length === 0 ? <p className="mgc-muted">{vide}</p> : <ul className="fc-checks">{open.map(a => <Check key={a.id} a={a} ro={ro} />)}</ul>}
      {closed.length > 0 && <details className="fc-done"><summary>Fait ({closed.length})</summary><ul className="fc-checks">{closed.map(a => <Check key={a.id} a={a} ro={ro} />)}</ul></details>}</>
  }
  return <section className={'fc-proj' + (actif ? '' : ' off')}>
    <header className="fc-proj-head">
      <div className="mgc-row"><ProjectBadge status={p.statut} /><h3>{p.nom}</h3></div>
      <span className="mgc-muted">{[p.etape, p.montantCents > 0 && money(p.montantCents) + ' HT', p.actions.length && done + ' / ' + p.actions.length + ' actions'].filter(Boolean).join(' · ')}</span>
    </header>
    {p.actions.length > 0 && <div className="fc-bar" aria-hidden="true"><div style={{ width: Math.round(done / p.actions.length * 100) + '%' }} /></div>}
    <div className="fc-vues" role="tablist">
      {[['apercu', 'Aperçu'], ['actions', 'Actions'], ...(k ? [['construction', 'Construction']] : []), ['liens', 'Liens et notes']].map(([v, l]) =>
        <button key={v} role="tab" aria-selected={vue === v} onClick={() => setVue(v)}>{l}{v === 'construction' && etapeK ? ' •' : ''}</button>)}
    </div>

    {vue === 'apercu' && <div className="fc-grid">
      {(questions > 0 || lecons > 0) && <div className="fc-box hot"><strong>{client.nom.split(' ')[0]} attend ta réponse</strong>
        <span>{[questions && questions + ' message' + (questions > 1 ? 's' : ''), lecons && lecons + ' leçon' + (lecons > 1 ? 's' : '') + ' à relire'].filter(Boolean).join(' · ')}</span>
        <button className="fc-btn fc-btn-main" onClick={onShared}>Répondre</button></div>}
      {actif && (visio ? <div className="fc-box"><strong>Prochaine visio</strong><span>{formatDate(visio.slice(0, 10))}{visio.length > 10 ? ' à ' + visio.slice(11, 16) : ''}</span></div>
        : <div className="fc-box warn"><strong>Aucune visio prévue</strong><span>Propose des créneaux : ils s’affichent dans son espace.</span><button className="fc-btn fc-btn-main" disabled={!canSave} onClick={onShared}>Proposer des créneaux</button></div>)}
      {k?.actif && <div className="fc-box dark"><strong>Atelier · {k.cahier && !k.cahierValide ? 'cahier à relire' : etapeK ? 'étape ' + (etapeK.etat === 'a_tester' ? 'à tester' : 'à corriger') : k.cahier ? nbVal + ' / ' + k.etapes.length + ' étapes validées' : 'cahier en préparation'}</strong>
        <span>{etapeK ? etapeK.titre : k.cahier && !k.cahierValide ? 'Relis-le et valide-le pour lancer la construction.' : 'L’Atelier avance étape par étape.'}</span>
        <button className="fc-btn" onClick={() => setVue('construction')}>Voir la construction</button></div>}
      {p.actions.length > 0 && <><div className="fc-box"><div className="mgc-between"><strong>Mon côté</strong><small>{mine.filter(a => !a.fait).length} à faire</small></div>
        {mine.filter(a => !a.fait).length === 0 ? <span className="mgc-muted">Rien en attente.</span> : <ul className="fc-checks">{mine.filter(a => !a.fait).slice(0, 3).map(a => <Check key={a.id} a={a} />)}</ul>}</div>
      <div className="fc-box"><div className="mgc-between"><strong>Côté {client.nom.split(' ')[0]}</strong><small>{lastClient ? 'dernière coche le ' + formatDate(lastClient) : theirs.length ? 'rien coché pour l’instant' : ''}</small></div>
        {theirs.filter(a => !a.fait).length === 0 ? <span className="mgc-muted">Rien en attente.</span> : <ul className="fc-list">{theirs.filter(a => !a.fait).slice(0, 3).map(a => <li key={a.id}>{a.label}</li>)}</ul>}</div></>}
      {p.actions.length === 0 && <div className="fc-box"><strong>Pas encore d’actions</strong><span className="mgc-muted">Ajoute les étapes de ton côté et du côté du client.</span><button className="fc-btn" disabled={!canSave} onClick={onEdit}>Ajouter des actions</button></div>}
    </div>}

    {vue === 'actions' && <div className="fc-cols">
      <div><h4>Mon côté</h4><Liste list={mine} vide="Rien de ton côté." /></div>
      <div><h4>Côté {client.nom.split(' ')[0]}</h4><Liste list={theirs} ro vide="Rien de son côté." /><p className="mgc-muted fc-note">C’est {client.nom.split(' ')[0]} qui coche ses actions dans son espace.</p></div>
    </div>}

    {vue === 'construction' && k && <AtelierPanel project={p} canSave={canSave} saveConstruction={saveConstruction} defaultOpen />}

    {vue === 'liens' && <div className="fc-liens">
      {p.documents.length > 0 ? <ul className="fc-list">{p.documents.map(d => <li key={d.id}><a href={d.url} target="_blank" rel="noopener noreferrer">{d.label} ↗</a></li>)}</ul> : <p className="mgc-muted">Aucun lien. Ajoute-les dans « Modifier le projet ».</p>}
      <p className="mgc-muted">{[p.plan?.length && p.plan.length + ' étapes au plan', p.notesPartagees?.length && p.notesPartagees.length + ' comptes rendus partagés', p.rythme].filter(Boolean).join(' · ')}</p>
    </div>}

    {!k && actif && vue === 'apercu' && <AtelierPanel project={p} canSave={canSave} saveConstruction={saveConstruction} />}
    <footer className="fc-proj-foot">
      <button className="fc-btn" disabled={!canSave} onClick={onEdit}>Modifier le projet</button>
      <button className="fc-btn" disabled={!canSave} onClick={onShared}>Espace partagé{questions + lecons ? ' (' + (questions + lecons) + ')' : ''}</button>
      <button className="fc-btn" disabled={!canSave} onClick={onInvoice}>Facturer</button>
    </footer>
  </section>
}

function ClientPage({ client, crm, entries, saveCrm, saveWorkspace, canSave, onBack, onFinance, saving, initialInvoice, onInvoiceDone }) {
  const [tab, setTab] = useState('projets')
  const [editClient, setEditClient] = useState(false)
  const [editProject, setEditProject] = useState(null)
  // Facturer en un geste : on arrive de Ma journée avec l'échéance (ou le mois LiveMentor) déjà choisie.
  const [invoiceFor, setInvoiceFor] = useState(() => {
    if (!initialInvoice) return null
    if (initialInvoice.echeanceId) { const e = (crm.echeances || []).find(x => x.id === initialInvoice.echeanceId && !x.factureId); return e ? { echeance: e } : null }
    if (initialInvoice.montantCents) return { echeance: { label: initialInvoice.label, montantCents: initialInvoice.montantCents, lmMois: initialInvoice.lmMois } }
    return null
  })
  const [editIndic, setEditIndic] = useState(false)
  const [editShared, setEditShared] = useState(null)
  const [copied, setCopied] = useState(false)
  const saveConstruction = (p, fn, msg) => saveCrm(data => ({ ...data, projets: data.projets.map(x => x.id === p.id ? { ...x, construction: fn(x.construction || {}) } : x) }), msg)
  const projects = crm.projets.filter(p => p.clientId === client.id)
  const invoices = clientInvoices(entries, crm, client)
  const link = window.location.origin + '/espace/' + client.portalToken

  const saveProject = p => saveCrm(data => ({ ...data, projets: p.id && data.projets.some(x => x.id === p.id)
    ? data.projets.map(x => x.id === p.id ? { ...p, construction: x.construction } : x) : [...data.projets, { ...p, id: uid('prj'), clientId: client.id }] }), 'Projet enregistré.')
    .then(ok => ok && setEditProject(null))
  const toggle = (p, a) => saveCrm(data => ({ ...data, projets: data.projets.map(x => x.id !== p.id ? x : {
    ...x, actions: x.actions.map(y => y.id === a.id ? { ...y, fait: !y.fait, faitLe: !y.fait ? todayInSpain() : '' } : y) }) }), 'Action mise à jour.')

  async function createInvoice(entry, projetId, detail, echeanceId, lmMois) {
    const ok = await saveWorkspace(workspace => ({ ...workspace, entries: [...workspace.entries, entry] }))
    if (!ok) return false
    await saveCrm(data => ({ ...data, liens: { ...data.liens, [entry.id]: { clientId: client.id, ...(projetId && { projetId }) } },
      factures: { ...data.factures, [entry.id]: detail },
      ...(echeanceId && { echeances: (data.echeances || []).map(e => e.id === echeanceId ? { ...e, factureId: entry.id } : e) }),
      ...(lmMois && data.livementor?.aFacturer?.mois === lmMois && { livementor: { ...data.livementor, aFacturer: null } }),
      journal: [{ date: new Date().toISOString(), texte: 'Facture ' + entry.reference + ' émise pour ' + client.nom }, ...data.journal] }), 'Facture ajoutée au registre.')
    return true
  }
  const markPaid = entry => window.confirm('Pointer la facture ' + entry.reference + ' comme payée aujourd’hui ?') &&
    saveWorkspace(workspace => ({ ...workspace, entries: workspace.entries.map(e => e.id !== entry.id ? e : (() => {
      const { expectedPaymentDate, ...rest } = e
      return { ...rest, payment: 'paid', paymentDate: todayInSpain() }
    })()) }))

  return <>
    <p className="mgc-muted fc-crumb"><button className="mgc-link" onClick={onBack}>Clients</button> / {client.nom}</p>
    <section className="fc-head">
      <div className="mgc-row"><Initial name={client.nom} /><div>
        <h1>{client.nom}</h1>
        <div className="mgc-muted">{[client.raisonSociale !== client.nom && client.raisonSociale, client.pays, client.nif, client.tarifJourCents ? money(client.tarifJourCents) + ' / jour' : '', client.canal && 'arrivé via ' + client.canal].filter(Boolean).join(' · ')}</div>
      </div></div>
      <div className="fc-head-act">
        <a className="fc-btn" href={link} target="_blank" rel="noopener noreferrer">Ouvrir son espace ↗</a>
        <button className="fc-btn" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>{copied ? 'Lien copié ✓' : 'Copier son lien'}</button>
        <button className="fc-btn" disabled={!canSave} onClick={() => setEditClient(true)}>Modifier la fiche</button>
        <button className="fc-btn fc-btn-main" disabled={!canSave} onClick={() => setInvoiceFor({})}>+ Facture</button>
      </div>
    </section>
    <ClientSummary client={client} crm={crm} saveCrm={saveCrm} entries={entries} invoices={invoices} projects={projects} canSave={canSave}
      onTab={t => { setTab(t); setTimeout(() => document.getElementById('mgc-tabs')?.scrollIntoView({ behavior: 'smooth' }), 0) }}
      onIndicateurs={() => setEditIndic(true)} />
    <div className="mgc-tabs fc-tabs" id="mgc-tabs" role="tablist">
      {[['projets', 'Projets (' + projects.length + ')'], ['devis', 'Devis (' + (crm.devis || []).filter(d => d.clientId === client.id).length + ')'], ['factures', 'Factures (' + invoices.length + ')'], ['infos', 'Infos']].map(([k, l]) =>
        <button key={k} role="tab" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
    </div>

    {tab === 'projets' && <>
      {projects.length === 0 && <p className="mg-empty">Pas encore de projet pour ce client.</p>}
      {[...projects].sort((x, y) => Number(x.statut === 'livre') - Number(y.statut === 'livre')).map(p => <ProjectCard key={p.id} p={p} client={client} canSave={canSave} toggle={toggle}
        onEdit={() => setEditProject(p)} onShared={() => setEditShared(p)} onInvoice={() => setInvoiceFor({ project: p })} saveConstruction={saveConstruction} />)}
      <button className="fc-add" disabled={!canSave} onClick={() => setEditProject({ clientId: client.id, nom: '', statut: 'a_demarrer', actions: [], documents: [] })}>+ Ajouter un projet</button>
    </>}

    {tab === 'devis' && <DevisTab client={client} crm={crm} entries={entries} saveCrm={saveCrm} canSave={canSave} saving={saving}
      projects={projects} onInvoice={echeance => setInvoiceFor({ echeance })} />}

    {tab === 'factures' && <section className="mgc-panel">
      {invoices.length === 0 ? <p className="mg-empty">Pas encore de facture pour ce client.</p> :
        <table className="mgc-table"><thead><tr><th>N°</th><th>Date</th><th>Statut</th><th className="mgc-num">Total</th><th /></tr></thead>
          <tbody>{invoices.map(e => <tr key={e.id}>
            <td>{e.reference || '—'}{e.source === 'malt' && <span className="mgc-badge" style={{ marginLeft: 6 }}>Malt</span>}{e.source === 'livementor' && <span className="mgc-badge" style={{ marginLeft: 6 }}>LiveMentor</span>}</td>
            <td>{formatDate(e.date)}</td><td><PaymentBadge entry={e} /></td><td className="mgc-num">{money(e.amountCents)}</td>
            <td className="mgc-num">
              {crm.factures?.[e.id] && <button onClick={() => reprint(e, crm.factures[e.id], client, crm.emetteur || {})}>PDF</button>}{' '}
              {e.payment !== 'paid' && <button disabled={!canSave} onClick={() => markPaid(e)}>Pointer payée</button>}</td>
          </tr>)}</tbody></table>}
      <p className="mgc-muted" style={{ marginBottom: 0 }}>Ces factures sont celles de ton registre. Pour les modifier ou joindre la pièce : <button className="mgc-link" onClick={onFinance}>Factures &amp; dépenses</button>.</p>
    </section>}

    {tab === 'infos' && <section className="mgc-panel mgc-cols">
      <div><div className="mgc-muted">Raison sociale</div>{client.raisonSociale || '—'}</div>
      <div><div className="mgc-muted">NIF / TVA</div>{client.nif || '—'}</div>
      <div><div className="mgc-muted">E-mail</div>{client.email || '—'}</div>
      <div><div className="mgc-muted">Adresse</div><div style={{ whiteSpace: 'pre-line' }}>{client.adresse || '—'}</div></div>
      <div style={{ gridColumn: '1 / -1' }}><div className="mgc-muted">Notes</div><div style={{ whiteSpace: 'pre-line' }}>{client.notes || '—'}</div></div>
      <div style={{ gridColumn: '1 / -1' }}><div className="mgc-muted">Lien de son espace (à ne partager qu’avec lui)</div>
        <button className="mgc-link" disabled={!canSave} onClick={() => window.confirm('Créer un nouveau lien ? L’ancien ne marchera plus.') &&
          saveCrm(data => ({ ...data, clients: data.clients.map(c => c.id === client.id ? { ...c, portalToken: '' } : c) }), 'Nouveau lien créé.')}>Remplacer le lien (si l’ancien a circulé)</button></div>
    </section>}

    {editIndic && <IndicateursForm client={client} saving={saving} onClose={() => setEditIndic(false)}
      onSave={rows => saveCrm(data => ({ ...data, clients: data.clients.map(c => c.id === client.id ? { ...c, indicateurs: rows } : c) }), 'Suivi mis à jour.').then(ok => ok && setEditIndic(false))} />}
    {editClient && <ClientForm client={client} saving={saving} onClose={() => setEditClient(false)}
      onSave={c => saveCrm(data => ({ ...data, clients: data.clients.map(x => x.id === c.id ? c : x) }), 'Fiche enregistrée.').then(ok => ok && setEditClient(false))} />}
    {editShared && <SharedSpaceForm project={editShared} saving={saving} onClose={() => setEditShared(null)}
      onSave={p => saveCrm(data => ({ ...data, projets: data.projets.map(x => x.id === p.id ? { ...x, type: p.type, brief: p.brief.map(b => ({ ...b, r: (x.brief || []).find(o => o.id === b.id)?.r ?? b.r })), questions: (x.questions || []).map(q => p.questions.find(f => f.id === q.id) || q), lecons: (x.lecons || []).map(l => p.lecons.find(f => f.id === l.id) || l), creneaux: p.creneaux.map(c => ({ ...c, reserve: (x.creneaux || []).find(o => o.id === c.id)?.reserve ?? false })) } : x) }), 'Espace partagé mis à jour.').then(ok => ok && setEditShared(null))} />}
    {editProject && <ProjectForm project={editProject} saving={saving} onClose={() => setEditProject(null)} onSave={saveProject}
      onDelete={id => saveCrm(data => ({ ...data, projets: data.projets.filter(p => p.id !== id) }), 'Projet supprimé.').then(ok => ok && setEditProject(null))} />}
    {invoiceFor && <InvoiceForm client={client} project={invoiceFor.project} echeance={invoiceFor.echeance} projects={projects} entries={entries} emetteur={crm.emetteur || {}}
      saving={saving} onClose={() => { setInvoiceFor(null); onInvoiceDone?.() }} onCreate={createInvoice} />}
  </>
}

export default function GestoriaClients({ crm, entries, saveCrm, saveWorkspace, canSave, saving, onFinance, initialClient, initialInvoice, onInvoiceDone }) {
  const [openId, setOpenId] = useState(initialClient || null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState('actifs')
  const [newClient, setNewClient] = useState(null)
  const [editEmetteur, setEditEmetteur] = useState(false)
  const independent = useMemo(() => entries.filter(e => (e.entity || 'independent') === 'independent'), [entries])
  const open = crm.clients.find(c => c.id === openId)
  if (open) return <ClientPage client={open} crm={crm} entries={independent} saveCrm={saveCrm} saveWorkspace={saveWorkspace}
    initialInvoice={open.id === initialClient ? initialInvoice : null} onInvoiceDone={onInvoiceDone}
    canSave={canSave} saving={saving} onBack={() => setOpenId(null)} onFinance={onFinance} />

  const list = crm.clients
    .filter(c => view === 'tous' || (view === 'actifs' ? ['actif', 'pause'].includes(c.statut) : ['termine', 'archive'].includes(c.statut)))
    .filter(c => !query || [c.nom, c.contact, ...crm.projets.filter(p => p.clientId === c.id).map(p => p.nom)].join(' ').toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')))
  const running = crm.projets.filter(p => ['a_demarrer', 'en_cours', 'suivi'].includes(p.statut)).length
  const myActions = crm.projets.flatMap(p => p.actions).filter(a => a.pour === 'amely' && !a.fait).length
  const pending = independent.filter(e => e.kind === 'invoice' && e.payment !== 'paid').reduce((s, e) => s + e.amountCents, 0)

  return <>
    <div className="mgc-hero">
      <div><div className="mgc-eyebrow">Tes clients · Amely</div><h1>Tes projets, en bonne compagnie.</h1><p>Un endroit pour suivre, partager, facturer et avancer ensemble.</p></div>
      <div className="mgc-row">
        <button disabled={!canSave} onClick={() => setEditEmetteur(true)}>Mes infos de facturation</button>
        <button disabled={!canSave} onClick={() => setNewClient({ nom: '', statut: 'actif', type: 'entreprise', pays: 'Espagne' })}>+ Nouveau client</button>
      </div>
    </div>
    <div className="mgc-tiles">
      <div className="mgc-tile"><strong>{crm.clients.filter(c => c.statut === 'actif').length}</strong><span>Clients actifs</span></div>
      <div className="mgc-tile"><strong>{running}</strong><span>Projets en cours</span></div>
      <div className="mgc-tile"><strong>{myActions}</strong><span>Actions à faire de ton côté</span></div>
      <div className="mgc-tile"><strong>{money(pending)}</strong><span>À encaisser (Mon activité)</span></div>
    </div>
    <div className="mgc-between">
      <h2 style={{ margin: 0 }}>Tes espaces clients</h2>
      <div className="mgc-tabs" style={{ margin: 0 }}>
        {[['actifs', 'Actifs'], ['anciens', 'Terminés'], ['tous', 'Tous']].map(([k, l]) => <button key={k} aria-pressed={view === k} onClick={() => setView(k)}>{l}</button>)}
      </div>
    </div>
    <input className="mgc-search" style={{ marginTop: 10 }} placeholder="Rechercher un client ou un projet…" value={query} onChange={e => setQuery(e.target.value)} />
    <div className="mgc-grid">
      {list.map(c => {
        const projects = crm.projets.filter(p => p.clientId === c.id)
        const main = projects.find(p => p.statut !== 'livre') || projects[0]
        const billed = clientInvoices(independent, crm, c).reduce((s, e) => s + baseCents(e), 0)
        return <button key={c.id} className="mgc-card" onClick={() => setOpenId(c.id)}>
          <div className="mgc-card-head"><Initial name={c.nom} />
            <div style={{ flex: 1 }}><div className="mgc-name">{c.nom}</div><div className="mgc-muted">{[c.contact, c.canal && 'via ' + c.canal].filter(Boolean).join(' · ') || '—'}</div></div>
            <span className="mgc-muted">{projects.length} projet{projects.length > 1 ? 's' : ''}</span></div>
          <div className="mgc-card-body">
            {main ? <><ProjectBadge status={main.statut} /><div style={{ fontWeight: 650, marginTop: 6 }}>{main.nom}</div>
              {main.actions.length > 0 && <div className="mgc-muted">{main.actions.filter(a => a.fait).length} / {main.actions.length} actions terminées</div>}</>
              : <span className="mgc-muted">Aucun projet</span>}
            <div className="mgc-muted" style={{ marginTop: 6 }}>Facturé : {money(billed)} HT</div>
          </div>
        </button>
      })}
    </div>
    {list.length === 0 && <p className="mg-empty">Aucun client dans cette vue.</p>}
    <p className="mgc-muted" style={{ marginTop: 24 }}>Connexion Claude : tu peux couper l’accès de Claude à tout moment.{' '}
      <button className="mgc-link" onClick={async () => {
        if (!window.confirm('Couper l’accès de Claude à Mi Gestoría ? Il faudra le reconnecter depuis Claude.')) return
        const r = await fetch('/api/gestoria-mcp?action=revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        window.alert(r.ok ? 'Accès de Claude coupé.' : 'Coupure non confirmée, réessaie.')
      }}>Couper l’accès</button></p>
    {newClient && <ClientForm client={newClient} saving={saving} onClose={() => setNewClient(null)}
      onSave={async c => { const id = uid('cli'); const ok = await saveCrm(data => ({ ...data, clients: [...data.clients, { ...c, id }] }), 'Client ajouté.'); if (ok) { setNewClient(null); setOpenId(id) } }} />}
    {editEmetteur && <EmetteurForm emetteur={crm.emetteur || {}} saving={saving} onClose={() => setEditEmetteur(false)}
      onSave={e => saveCrm(data => ({ ...data, emetteur: e }), 'Infos de facturation enregistrées.').then(ok => ok && setEditEmetteur(false))} />}
  </>
}
