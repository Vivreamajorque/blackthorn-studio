import React, { useEffect, useMemo, useState } from 'react'
import { money, uid, toCents, fromCents, clientInvoices, baseCents } from '../lib/gestoria-crm'
import { formatDate, todayInSpain } from '../lib/gestoria-calendar.mjs'
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
  const [p, setP] = useState({ actions: [], documents: [], ...project, montant: fromCents(project.montantCents) })
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
const MENTIONS = {
  es21: '',
  eu: 'Operación no sujeta a IVA en España. Inversión del sujeto pasivo (art. 69 Ley 37/1992 · art. 196 Directiva 2006/112/CE).',
  other: 'Operación no sujeta a IVA en España (art. 69 Ley 37/1992).',
}

function computeInvoice(d) {
  const lines = d.lines.map(l => ({ ...l, cents: Math.round((Number(l.qty) || 0) * toCents(l.price || 0)) }))
  const base = lines.reduce((s, l) => s + l.cents, 0)
  const quota = d.regime === 'es21' ? Math.round(base * 0.21) : 0
  const withholding = Math.round(base * (Number(d.irpf) || 0) / 100)
  return { lines, base, quota, withholding, total: base + quota - withholding }
}

function printInvoice(d, t, client, emetteur) {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
  const nl = v => esc(v).replace(/\n/g, '<br>')
  const rows = t.lines.map(l => `<tr><td>${esc(l.description)}</td><td class="n">${esc(l.qty)}</td><td class="n">${money(toCents(l.price || 0))}</td><td class="n">${money(l.cents)}</td></tr>`).join('')
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Factura ${esc(d.reference)}</title><style>
  body{font:15px system-ui,sans-serif;max-width:780px;margin:40px auto;padding:20px;color:#172b26}h1{margin:0;font-weight:600}
  .top{display:flex;justify-content:space-between;border-top:6px solid #203e36;padding-top:18px}.n{text-align:right}
  section{display:flex;gap:30px;margin:26px 0}section div{flex:1}small{color:#51635d;text-transform:uppercase;letter-spacing:.08em;font-size:11px}
  table{border-collapse:collapse;width:100%}th,td{padding:10px;border-bottom:1px solid #d9e2db;text-align:left}th{font-size:12px;color:#51635d}
  .tot{margin-left:auto;width:300px;margin-top:14px}.tot div{display:flex;justify-content:space-between;padding:4px 0}.tot .g{font-weight:700;border-top:1px solid #172b26;margin-top:4px;padding-top:8px}
  .m{margin-top:24px;font-size:13px;color:#51635d}@media print{body{margin:0}}</style>
  <div class="top"><h1>Factura</h1><div class="n">N.º ${esc(d.reference)}<br>Fecha: ${esc(formatDate(d.date))}${d.due ? '<br>Vencimiento: ' + esc(formatDate(d.due)) : ''}</div></div>
  <section><div><small>Emisor</small><p>${esc(emetteur.nom)}<br>${esc(emetteur.activite)}<br>${emetteur.nif ? 'NIF: ' + esc(emetteur.nif) + '<br>' : ''}${nl(emetteur.adresse)}<br>${esc(emetteur.email)}</p></div>
  <div><small>Cliente</small><p>${esc(client.raisonSociale || client.nom)}<br>${client.nif ? 'NIF/VAT: ' + esc(client.nif) + '<br>' : ''}${nl(client.adresse)}</p></div></section>
  <table><thead><tr><th>Concepto</th><th class="n">Cant.</th><th class="n">Precio</th><th class="n">Importe</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="tot"><div><span>Base imponible</span><span>${money(t.base)}</span></div><div><span>IVA ${d.regime === 'es21' ? '21' : '0'} %</span><span>${money(t.quota)}</span></div>
  ${t.withholding ? `<div><span>Retención IRPF ${esc(d.irpf)} %</span><span>− ${money(t.withholding)}</span></div>` : ''}<div class="g"><span>Total a pagar</span><span>${money(t.total)}</span></div></div>
  <div class="m">${esc(MENTIONS[d.regime])}${d.note ? '<br>' + esc(d.note) : ''}${emetteur.iban ? '<br>Pago por transferencia · IBAN ' + esc(emetteur.iban) : ''}</div>
  <script>window.onload=()=>window.print()</script></html>`
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
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

function InvoiceForm({ client, project, projects, entries, emetteur, onCreate, onClose, saving }) {
  const today = todayInSpain()
  const due = new Date(today + 'T12:00:00Z'); due.setUTCDate(due.getUTCDate() + 15)
  const [d, setD] = useState(() => ({
    date: today, due: due.toISOString().slice(0, 10), reference: nextReference(entries, emetteur.serie || 'A', today.slice(0, 4)),
    projetId: project?.id || '', ...defaultRegime(client), note: '',
    lines: [{ id: uid('l'), description: project ? project.nom : '', qty: '1', price: fromCents(client.tarifJourCents) }],
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
    onCreate(entry, d.projetId, detail).then(ok => ok && setCreated(true))
  }

  if (created) return <Dialog title={'Facture ' + d.reference + ' émise'} onClose={onClose}
    footer={<><button onClick={onClose}>Fermer</button><button className="mgc-primary" onClick={() => printInvoice(d, t, client, emetteur)}>Imprimer ou enregistrer en PDF</button></>}>
    <p>Elle est dans ton registre « Factures &amp; dépenses », en attente de paiement : {money(t.total)}.</p>
    <p className="mgc-muted">Dans la fenêtre d’impression, choisis « Enregistrer en PDF » pour l’envoyer à {client.nom}.</p>
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

function ClientPage({ client, crm, entries, saveCrm, saveWorkspace, canSave, onBack, onFinance, saving }) {
  const [tab, setTab] = useState('projets')
  const [editClient, setEditClient] = useState(false)
  const [editProject, setEditProject] = useState(null)
  const [invoiceFor, setInvoiceFor] = useState(null)
  const projects = crm.projets.filter(p => p.clientId === client.id)
  const invoices = clientInvoices(entries, crm, client)
  const billed = invoices.reduce((s, e) => s + baseCents(e), 0)
  const due = invoices.filter(e => e.payment !== 'paid').reduce((s, e) => s + e.amountCents, 0)
  const link = window.location.origin + '/espace/' + client.portalToken

  const saveProject = p => saveCrm(data => ({ ...data, projets: p.id && data.projets.some(x => x.id === p.id)
    ? data.projets.map(x => x.id === p.id ? p : x) : [...data.projets, { ...p, id: uid('prj'), clientId: client.id }] }), 'Projet enregistré.')
    .then(ok => ok && setEditProject(null))
  const toggle = (p, a) => saveCrm(data => ({ ...data, projets: data.projets.map(x => x.id !== p.id ? x : {
    ...x, actions: x.actions.map(y => y.id === a.id ? { ...y, fait: !y.fait, faitLe: !y.fait ? todayInSpain() : '' } : y) }) }), 'Action mise à jour.')

  async function createInvoice(entry, projetId, detail) {
    const ok = await saveWorkspace(workspace => ({ ...workspace, entries: [...workspace.entries, entry] }))
    if (!ok) return false
    await saveCrm(data => ({ ...data, liens: { ...data.liens, [entry.id]: { clientId: client.id, ...(projetId && { projetId }) } },
      factures: { ...data.factures, [entry.id]: detail },
      journal: [{ date: new Date().toISOString(), texte: 'Facture ' + entry.reference + ' émise pour ' + client.nom }, ...data.journal] }), 'Facture ajoutée au registre.')
    return true
  }
  const markPaid = entry => window.confirm('Pointer la facture ' + entry.reference + ' comme payée aujourd’hui ?') &&
    saveWorkspace(workspace => ({ ...workspace, entries: workspace.entries.map(e => e.id !== entry.id ? e : (() => {
      const { expectedPaymentDate, ...rest } = e
      return { ...rest, payment: 'paid', paymentDate: todayInSpain() }
    })()) }))

  return <>
    <p className="mgc-muted"><button className="mgc-link" onClick={onBack}>Clients</button> / {client.nom}</p>
    <section className="mgc-panel mgc-between">
      <div className="mgc-row"><Initial name={client.nom} /><div>
        <h1 style={{ margin: 0, fontSize: '1.7rem', letterSpacing: '-.03em' }}>{client.nom}</h1>
        <div className="mgc-muted">{[client.contact, client.pays, client.canal && 'arrivé via ' + client.canal, client.tarifJourCents ? money(client.tarifJourCents) + ' / jour' : ''].filter(Boolean).join(' · ')}</div>
      </div></div>
      <div className="mgc-row">
        <div className="mgc-tile" style={{ minWidth: 130 }}><strong>{money(billed)}</strong><span>Facturé HT</span></div>
        <div className="mgc-tile" style={{ minWidth: 130, background: '#f6e7da' }}><strong>{money(due)}</strong><span>À encaisser</span></div>
      </div>
    </section>
    <div className="mgc-between" style={{ marginTop: 12 }}>
      <div className="mgc-tabs" style={{ margin: 0 }}>
        {[['projets', 'Projets'], ['factures', 'Factures (' + invoices.length + ')'], ['espace', 'Espace client'], ['infos', 'Infos']].map(([k, l]) =>
          <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <div className="mgc-row">
        <button disabled={!canSave} onClick={() => setEditClient(true)}>Modifier la fiche</button>
        <button className="mgc-primary" disabled={!canSave} onClick={() => setInvoiceFor({})}>+ Facture</button>
      </div>
    </div>

    {tab === 'projets' && <>
      {projects.map(p => {
        const done = p.actions.filter(a => a.fait).length
        return <section key={p.id} className="mgc-panel">
          <div className="mgc-between">
            <div className="mgc-row"><ProjectBadge status={p.statut} /><h3>{p.nom}</h3></div>
            <div className="mgc-row">
              {p.montantCents > 0 && <span className="mgc-muted">{money(p.montantCents)} HT prévus</span>}
              <button disabled={!canSave} onClick={() => setEditProject(p)}>Modifier</button>
              <button disabled={!canSave} onClick={() => setInvoiceFor({ project: p })}>Facturer</button>
            </div>
          </div>
          {p.etape && <p className="mgc-muted" style={{ margin: '6px 0 0' }}>Étape : {p.etape}</p>}
          {p.actions.length > 0 && <>
            <div className="mgc-bar"><div style={{ width: Math.round(done / p.actions.length * 100) + '%' }} /></div>
            <div className="mgc-muted">{done} / {p.actions.length} actions terminées</div>
            <ul className="mgc-list">{p.actions.map(a => <li key={a.id}>
              <input type="checkbox" checked={a.fait} disabled={!canSave} onChange={() => toggle(p, a)} aria-label={a.label} />
              <span className={a.fait ? 'mgc-done' : ''} style={{ flex: 1 }}>{a.label}</span>
              <span className={'mgc-badge ' + (a.pour === 'amely' ? 'ok' : '')}>{a.pour === 'amely' ? 'Moi' : 'Client'}</span>
            </li>)}</ul>
          </>}
          {p.documents.length > 0 && <p className="mgc-row" style={{ marginBottom: 0 }}>{p.documents.map(d => <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer">{d.label} ↗</a>)}</p>}
        </section>
      })}
      <button style={{ marginTop: 12 }} disabled={!canSave} onClick={() => setEditProject({ clientId: client.id, nom: '', statut: 'a_demarrer', actions: [], documents: [] })}>+ Ajouter un projet</button>
    </>}

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

    {tab === 'espace' && <section className="mgc-panel">
      <h3>Lien personnel de {client.nom}</h3>
      <p className="mgc-muted">Ce lien ouvre l’espace du client : ses projets visibles, ses actions à cocher, ses documents et ses factures. Rien d’autre. Ne le partage qu’avec lui.</p>
      <div className="mgc-row">
        <input readOnly value={link} onFocus={e => e.target.select()} style={{ flex: 1, minWidth: 220 }} />
        <button className="mgc-primary" onClick={() => navigator.clipboard?.writeText(link)}>Copier</button>
        <a href={link} target="_blank" rel="noopener noreferrer">Voir comme le client ↗</a>
      </div>
      <button className="mgc-link" style={{ marginTop: 12 }} disabled={!canSave} onClick={() => window.confirm('Créer un nouveau lien ? L’ancien ne marchera plus.') &&
        saveCrm(data => ({ ...data, clients: data.clients.map(c => c.id === client.id ? { ...c, portalToken: '' } : c) }), 'Nouveau lien créé.')}>Remplacer le lien (si l’ancien a circulé)</button>
    </section>}

    {tab === 'infos' && <section className="mgc-panel mgc-cols">
      <div><div className="mgc-muted">Raison sociale</div>{client.raisonSociale || '—'}</div>
      <div><div className="mgc-muted">NIF / TVA</div>{client.nif || '—'}</div>
      <div><div className="mgc-muted">E-mail</div>{client.email || '—'}</div>
      <div><div className="mgc-muted">Adresse</div><div style={{ whiteSpace: 'pre-line' }}>{client.adresse || '—'}</div></div>
      <div style={{ gridColumn: '1 / -1' }}><div className="mgc-muted">Notes</div><div style={{ whiteSpace: 'pre-line' }}>{client.notes || '—'}</div></div>
    </section>}

    {editClient && <ClientForm client={client} saving={saving} onClose={() => setEditClient(false)}
      onSave={c => saveCrm(data => ({ ...data, clients: data.clients.map(x => x.id === c.id ? c : x) }), 'Fiche enregistrée.').then(ok => ok && setEditClient(false))} />}
    {editProject && <ProjectForm project={editProject} saving={saving} onClose={() => setEditProject(null)} onSave={saveProject}
      onDelete={id => saveCrm(data => ({ ...data, projets: data.projets.filter(p => p.id !== id) }), 'Projet supprimé.').then(ok => ok && setEditProject(null))} />}
    {invoiceFor && <InvoiceForm client={client} project={invoiceFor.project} projects={projects} entries={entries} emetteur={crm.emetteur || {}}
      saving={saving} onClose={() => setInvoiceFor(null)} onCreate={createInvoice} />}
  </>
}

export default function GestoriaClients({ crm, entries, saveCrm, saveWorkspace, canSave, saving, onFinance, initialClient }) {
  const [openId, setOpenId] = useState(initialClient || null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState('actifs')
  const [newClient, setNewClient] = useState(null)
  const [editEmetteur, setEditEmetteur] = useState(false)
  const independent = useMemo(() => entries.filter(e => (e.entity || 'independent') === 'independent'), [entries])
  const open = crm.clients.find(c => c.id === openId)
  if (open) return <ClientPage client={open} crm={crm} entries={independent} saveCrm={saveCrm} saveWorkspace={saveWorkspace}
    canSave={canSave} saving={saving} onBack={() => setOpenId(null)} onFinance={onFinance} />

  const list = crm.clients
    .filter(c => view === 'tous' || (view === 'actifs' ? ['actif', 'pause'].includes(c.statut) : ['termine', 'archive'].includes(c.statut)))
    .filter(c => !query || [c.nom, c.contact, ...crm.projets.filter(p => p.clientId === c.id).map(p => p.nom)].join(' ').toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')))
  const running = crm.projets.filter(p => ['a_demarrer', 'en_cours', 'suivi'].includes(p.statut)).length
  const myActions = crm.projets.flatMap(p => p.actions).filter(a => a.pour === 'amely' && !a.fait).length
  const pending = independent.filter(e => e.kind === 'invoice' && e.payment !== 'paid').reduce((s, e) => s + e.amountCents, 0)

  return <>
    <div className="mgc-hero">
      <div><div className="mgc-eyebrow">Ton atelier · Amely</div><h1>Tes projets, en bonne compagnie.</h1><p>Un endroit pour suivre, partager, facturer et avancer ensemble.</p></div>
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
