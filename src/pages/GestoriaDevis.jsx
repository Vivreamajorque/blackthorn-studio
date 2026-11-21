import React, { useState } from 'react'
import { money, uid, toCents, fromCents } from '../lib/gestoria-crm'
import { formatDate, todayInSpain } from '../lib/gestoria-calendar.mjs'
import { Dialog, bind } from './GestoriaClients'

export const DEVIS_STATUS = { brouillon: ['Brouillon', ''], envoye: ['Envoyé', 'info'], signe: ['Signé', 'ok'], refuse: ['Refusé', 'late'] }
const MENTIONS = {
  es21: 'TVA espagnole (IVA 21 %) appliquée.',
  eu: 'TVA espagnole non facturée. Autoliquidation de la TVA par le preneur (inversión del sujeto pasivo).',
  other: 'Opération non soumise à la TVA espagnole (art. 69 Ley 37/1992).',
}
const REGIMES = { es21: 'IVA 21 %', eu: 'Autoliquidation UE (0 %)', other: 'Hors UE (0 %)' }
const EU_CODES = ['France', 'Belgique', 'Allemagne', 'Italie', 'Portugal', 'Pays-Bas', 'Luxembourg', 'Irlande', 'Autriche']

const totalOf = devis => (devis.lignes || []).reduce((s, l) => s + Math.round((Number(l.quantite) || 0) * (l.prixCents || 0)), 0)

export function nextDevisNumber(devis, year) {
  const prefix = 'DEV-' + year + '-'
  const max = devis.filter(d => d.numero.startsWith(prefix)).map(d => parseInt(d.numero.slice(prefix.length), 10))
    .filter(Number.isFinite).reduce((m, n) => Math.max(m, n), 0)
  return prefix + String(max + 1).padStart(3, '0')
}

function defaultRegime(client) {
  const pays = client.pays || 'Espagne'
  const pro = client.type !== 'particulier'
  if (pays === 'Espagne') return 'es21'
  if (EU_CODES.includes(pays)) return pro ? 'eu' : 'es21'
  return 'other'
}

// Statut d'une échéance : payée / facturée / à facturer, d'après la facture liée dans le registre.
export function echeanceState(echeance, entries) {
  const facture = echeance.factureId && entries.find(e => e.id === echeance.factureId)
  if (!facture) return { key: 'a_facturer', label: 'À facturer', tone: '' }
  if (facture.payment === 'paid') return { key: 'payee', label: 'Payée', tone: 'ok', facture }
  return { key: 'facturee', label: 'Facturée · à encaisser', tone: 'info', facture }
}

function printDevis(devis, client, emetteur, echeances) {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
  const nl = v => esc(v).replace(/\n/g, '<br>')
  const total = totalOf(devis)
  const quota = devis.regime === 'es21' ? Math.round(total * 0.21) : 0
  const rows = devis.lignes.map(l => `<tr><td>${esc(l.description)}</td><td class="n">${esc(l.quantite)}</td><td class="n">${money(l.prixCents)}</td><td class="n">${money(Math.round(l.quantite * l.prixCents))}</td></tr>`).join('')
  const scope = devis.perimetre.length ? `<h2>Périmètre</h2><ul>${devis.perimetre.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="m">Tout ce qui n’est pas listé est chiffré séparément, après accord de la cliente.</p>` : ''
  const schedule = echeances.length ? `<h2>Échéancier</h2><table><thead><tr><th>Échéance</th><th>Date</th><th class="n">Montant</th></tr></thead><tbody>${
    echeances.map(e => `<tr><td>${esc(e.label)}</td><td>${e.date ? esc(formatDate(e.date)) : '—'}</td><td class="n">${money(e.montantCents)}</td></tr>`).join('')
  }<tr><td><strong>Total à régler</strong></td><td></td><td class="n"><strong>${money(echeances.reduce((s, e) => s + e.montantCents, 0))}</strong></td></tr></tbody></table>` : ''
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Devis ${esc(devis.numero)}</title><style>
  body{font:15px system-ui,sans-serif;max-width:780px;margin:40px auto;padding:20px;color:#172b26;line-height:1.45}h1{margin:0;font-weight:600}h2{font-size:1.05rem;margin:28px 0 6px}
  .top{display:flex;justify-content:space-between;border-top:6px solid #203e36;padding-top:18px}.n{text-align:right}
  section{display:flex;gap:30px;margin:26px 0}section div{flex:1}small{color:#51635d;text-transform:uppercase;letter-spacing:.08em;font-size:11px}
  table{border-collapse:collapse;width:100%}th,td{padding:10px;border-bottom:1px solid #d9e2db;text-align:left}th{font-size:12px;color:#51635d}th.n,td.n{text-align:right}
  .tot{margin-left:auto;width:300px;margin-top:14px}.tot div{display:flex;justify-content:space-between;padding:4px 0}.tot .g{font-weight:700;border-top:1px solid #172b26;margin-top:4px;padding-top:8px}
  .m{font-size:13px;color:#51635d}.sig{display:flex;gap:30px;margin-top:20px}.sig div{flex:1;border-top:1px solid #172b26;padding-top:6px;min-height:70px;font-size:13px;color:#51635d}
  @media print{body{margin:0}}</style>
  <div class="top"><h1>Devis</h1><div class="n">${esc(devis.numero)}<br>Émis le ${esc(formatDate(devis.date))}${devis.validite ? '<br>Valable jusqu’au ' + esc(formatDate(devis.validite)) : ''}</div></div>
  <section><div><small>Prestataire</small><p>${esc(emetteur.nom)}<br>${esc(emetteur.activite)}<br>${emetteur.nif ? 'NIF : ' + esc(emetteur.nif) + '<br>' : ''}${nl(emetteur.adresse)}<br>${esc(emetteur.email)}</p></div>
  <div><small>Cliente</small><p>${esc(client.raisonSociale || client.nom)}<br>${client.nif ? 'TVA : ' + esc(client.nif) + '<br>' : ''}${nl(client.adresse)}</p></div></section>
  ${devis.intro ? `<p>${nl(devis.intro)}</p>` : ''}
  <table><thead><tr><th>Prestation</th><th class="n">Qté</th><th class="n">Prix HT</th><th class="n">Montant</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="tot"><div><span>Total hors TVA</span><span>${money(total)}</span></div><div><span>IVA ${devis.regime === 'es21' ? '21' : '0'} %</span><span>${money(quota)}</span></div><div class="g"><span>Total à régler</span><span>${money(total + quota)}</span></div></div>
  <p class="m">${esc(MENTIONS[devis.regime])}${client.nif && devis.regime === 'eu' ? ' TVA du client : ' + esc(client.nif) + '.' : ''}${devis.note ? '<br>' + esc(devis.note) : ''}</p>
  ${scope}${schedule}
  ${devis.outils ? `<h2>Frais des outils</h2><p>${nl(devis.outils)}</p>` : ''}
  <h2>Bon pour accord</h2><p class="m">En signant, la cliente accepte les prestations, les prix et les modalités de règlement de ce devis.</p>
  <div class="sig"><div>Nom et qualité</div><div>Date</div><div>Signature</div></div>
  <script>window.onload=()=>window.print()</script></html>`
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

function DevisForm({ devis, client, projects, all, onSave, onDelete, onClose, saving }) {
  const [d, setD] = useState(() => ({
    perimetreText: (devis.perimetre || []).join('\n'),
    ...devis,
    lignes: (devis.lignes || []).map(l => ({ id: uid('l'), description: l.description, qty: String(l.quantite), price: fromCents(l.prixCents) })),
  }))
  const [error, setError] = useState('')
  const f = bind(d, setD)
  const lines = d.lignes.map(l => ({ ...l, cents: Math.round((Number(l.qty) || 0) * toCents(l.price || 0)) }))
  const base = lines.reduce((s, l) => s + l.cents, 0)
  const setLine = (id, key, value) => setD(x => ({ ...x, lignes: x.lignes.map(l => l.id === id ? { ...l, [key]: value } : l) }))

  function save() {
    setError('')
    if (!d.numero.trim()) return setError('Indique le numéro du devis.')
    if (all.some(x => x.id !== d.id && x.numero === d.numero.trim())) return setError('Ce numéro de devis existe déjà.')
    if (base <= 0) return setError('Le montant est à zéro.')
    if (d.regime === 'eu' && !EU_CODES.includes(client.pays)) return setError('Pour l’autoliquidation UE, indique le pays du client dans sa fiche.')
    onSave({
      id: d.id, clientId: client.id, projetId: d.projetId || '', numero: d.numero.trim(), date: d.date, validite: d.validite,
      statut: d.statut, signeLe: d.statut === 'signe' ? (d.signeLe || todayInSpain()) : '', regime: d.regime, irpf: 0,
      intro: d.intro || '', note: d.note || '', outils: d.outils || '',
      perimetre: (d.perimetreText || '').split('\n').map(x => x.trim()).filter(Boolean),
      lignes: lines.filter(l => l.description.trim()).map(l => ({ description: l.description, quantite: Number(l.qty) || 0, prixCents: toCents(l.price || 0) })),
    })
  }

  return <Dialog title={(devis.id ? 'Devis ' + devis.numero : 'Nouveau devis') + ' · ' + client.nom} onClose={onClose}
    footer={<>{onDelete ? <button disabled={saving} onClick={onDelete}>Supprimer</button> : <span />}
      <button className="mgc-primary" disabled={saving} onClick={save}>Enregistrer le devis</button></>}>
    <div className="mgc-form">
      <div className="mgc-cols">
        <label>Numéro<input {...f('numero')} /></label>
        <label>Date d’émission<input type="date" {...f('date')} /></label>
        <label>Valable jusqu’au<input type="date" {...f('validite')} /></label>
      </div>
      <div className="mgc-cols">
        <label>Projet<select {...f('projetId')}><option value="">—</option>{projects.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}</select></label>
        <label>IVA<select {...f('regime')}>{Object.entries(REGIMES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Statut<select {...f('statut')}>{Object.entries(DEVIS_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
      </div>
      <label>Introduction (facultatif)<textarea maxLength={1500} {...f('intro')} /></label>
      <div>
        <strong style={{ fontSize: '.85rem' }}>Prestations (quantité × prix HT)</strong>
        {d.lignes.map(l => <div key={l.id} className="mgc-cols" style={{ gridTemplateColumns: '1fr 70px 110px 30px', marginTop: 6 }}>
          <input placeholder="Description" value={l.description} onChange={e => setLine(l.id, 'description', e.target.value)} />
          <input type="number" step="0.5" aria-label="Quantité" value={l.qty} onChange={e => setLine(l.id, 'qty', e.target.value)} />
          <input type="number" step="0.01" aria-label="Prix HT" value={l.price} onChange={e => setLine(l.id, 'price', e.target.value)} />
          {d.lignes.length > 1 ? <button type="button" aria-label="Retirer" onClick={() => setD(x => ({ ...x, lignes: x.lignes.filter(y => y.id !== l.id) }))}>×</button> : <span />}
        </div>)}
        <button type="button" className="mgc-link" style={{ marginTop: 8 }} onClick={() => setD(x => ({ ...x, lignes: [...x.lignes, { id: uid('l'), description: '', qty: '1', price: '' }] }))}>+ Ajouter une ligne</button>
      </div>
      <label>Périmètre : une fonction ou un livrable par ligne<textarea rows={5} value={d.perimetreText} onChange={e => setD({ ...d, perimetreText: e.target.value })} /></label>
      <label>Frais des outils (facultatif)<textarea maxLength={800} {...f('outils')} /></label>
      <label>Mention ou conditions (facultatif)<input maxLength={800} {...f('note')} /></label>
      <div className="mgc-total"><div><div className="mgc-muted">Total HT</div><strong>{money(base)}</strong></div>
        <div><div className="mgc-muted">Régime</div><strong style={{ fontSize: '.9rem' }}>{REGIMES[d.regime]}</strong></div></div>
      {error && <p className="mgc-error">{error}</p>}
    </div>
  </Dialog>
}

function EcheancesForm({ client, echeances, onSave, onClose, saving }) {
  const [rows, setRows] = useState(() => echeances.map(e => ({ ...e, amount: fromCents(e.montantCents) })))
  const total = rows.reduce((s, r) => s + toCents(r.amount || 0), 0)
  const setRow = (id, key, value) => setRows(x => x.map(r => r.id === id ? { ...r, [key]: value } : r))
  return <Dialog title={'Échéancier · ' + client.nom} onClose={onClose}
    footer={<><span /><button className="mgc-primary" disabled={saving}
      onClick={() => onSave(rows.filter(r => toCents(r.amount || 0) > 0).map(r => ({ id: r.id, clientId: client.id, label: r.label, date: r.date, montantCents: toCents(r.amount || 0), factureId: r.factureId || '' })))}>Enregistrer l’échéancier</button></>}>
    <div className="mgc-form">
      <p className="mgc-muted">Chaque échéance devient une facture quand tu cliques sur « Facturer ». Les échéances déjà facturées gardent leur lien avec la facture.</p>
      {rows.map(r => <div key={r.id} className="mgc-cols" style={{ gridTemplateColumns: '1fr 150px 110px 30px' }}>
        <input aria-label="Libellé" placeholder="Ex. Novembre · à la signature" value={r.label} onChange={e => setRow(r.id, 'label', e.target.value)} />
        <input type="date" aria-label="Date" value={r.date} onChange={e => setRow(r.id, 'date', e.target.value)} />
        <input type="number" step="0.01" aria-label="Montant" value={r.amount} onChange={e => setRow(r.id, 'amount', e.target.value)} />
        {r.factureId ? <span /> : <button type="button" aria-label="Retirer" onClick={() => setRows(x => x.filter(y => y.id !== r.id))}>×</button>}
      </div>)}
      <button type="button" className="mgc-link" onClick={() => setRows(x => [...x, { id: uid('ech'), clientId: client.id, label: '', date: '', amount: '', factureId: '' }])}>+ Ajouter une échéance</button>
      <div className="mgc-total"><div><div className="mgc-muted">Total de l’échéancier</div><strong>{money(total)}</strong></div></div>
    </div>
  </Dialog>
}

export default function DevisTab({ client, crm, entries, saveCrm, canSave, saving, projects, onInvoice }) {
  const [edit, setEdit] = useState(null)
  const [editEcheances, setEditEcheances] = useState(false)
  const devis = (crm.devis || []).filter(d => d.clientId === client.id).sort((a, b) => b.numero.localeCompare(a.numero))
  const echeances = (crm.echeances || []).filter(e => e.clientId === client.id)
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
  const today = todayInSpain()
  const planned = echeances.reduce((s, e) => s + e.montantCents, 0)

  const blank = () => ({ id: '', numero: nextDevisNumber(crm.devis || [], today.slice(0, 4)), date: today,
    validite: new Date(Date.parse(today + 'T12:00:00Z') + 30 * 864e5).toISOString().slice(0, 10), statut: 'brouillon', projetId: '',
    regime: defaultRegime(client), intro: '', note: '', outils: '', perimetre: [], lignes: [{ description: '', quantite: 1, prixCents: 0 }] })

  const saveDevis = d => saveCrm(data => ({ ...data, devis: d.id && (data.devis || []).some(x => x.id === d.id)
    ? data.devis.map(x => x.id === d.id ? d : x) : [...(data.devis || []), { ...d, id: uid('dev') }] }), 'Devis enregistré.').then(ok => ok && setEdit(null))
  const removeDevis = id => window.confirm('Supprimer ce devis ?') &&
    saveCrm(data => ({ ...data, devis: (data.devis || []).filter(x => x.id !== id) }), 'Devis supprimé.').then(ok => ok && setEdit(null))
  const saveEcheances = rows => saveCrm(data => ({ ...data, echeances: [...(data.echeances || []).filter(e => e.clientId !== client.id), ...rows] }),
    'Échéancier enregistré.').then(ok => ok && setEditEcheances(false))

  return <>
    <section className="mgc-panel">
      <div className="mgc-between"><h3 style={{ margin: 0 }}>Devis</h3>
        <button className="mgc-primary" disabled={!canSave} onClick={() => setEdit(blank())}>+ Devis</button></div>
      {devis.length === 0 ? <p className="mg-empty">Pas encore de devis pour ce client.</p> :
        <table className="mgc-table"><thead><tr><th>N°</th><th>Date</th><th>Statut</th><th className="mgc-num">Total HT</th><th /></tr></thead>
          <tbody>{devis.map(d => {
            const [label, tone] = DEVIS_STATUS[d.statut]
            return <tr key={d.id}><td>{d.numero}{d.projetId && projects.find(p => p.id === d.projetId) && <div className="mgc-muted">{projects.find(p => p.id === d.projetId).nom}</div>}</td>
              <td>{formatDate(d.date)}</td><td><span className={'mgc-badge ' + tone}>{label}</span></td><td className="mgc-num">{money(totalOf(d))}</td>
              <td className="mgc-num"><button onClick={() => printDevis(d, client, crm.emetteur || {}, echeances)}>PDF</button>{' '}
                <button disabled={!canSave} onClick={() => setEdit(d)}>Modifier</button></td></tr>
          })}</tbody></table>}
    </section>

    <section className="mgc-panel">
      <div className="mgc-between"><h3 style={{ margin: 0 }}>Échéancier</h3>
        <button disabled={!canSave} onClick={() => setEditEcheances(true)}>{echeances.length ? 'Modifier l’échéancier' : '+ Créer l’échéancier'}</button></div>
      {echeances.length === 0 ? <p className="mg-empty">Pas encore d’échéancier pour ce client.</p> : <>
        <table className="mgc-table"><thead><tr><th>Échéance</th><th>Date</th><th>Statut</th><th className="mgc-num">Montant</th><th /></tr></thead>
          <tbody>{echeances.map(e => {
            const state = echeanceState(e, entries)
            return <tr key={e.id}><td>{e.label}</td><td>{e.date ? formatDate(e.date) : '—'}</td>
              <td><span className={'mgc-badge ' + state.tone}>{state.label}</span></td><td className="mgc-num">{money(e.montantCents)}</td>
              <td className="mgc-num">{state.key === 'a_facturer' && <button disabled={!canSave} onClick={() => onInvoice(e)}>Facturer</button>}</td></tr>
          })}</tbody></table>
        <p className="mgc-muted" style={{ marginBottom: 0 }}>Total de l’échéancier : {money(planned)}. Chaque facture émise ici est pointée « payée » dans l’onglet Factures.</p></>}
    </section>

    {edit && <DevisForm devis={edit} client={client} projects={projects} all={crm.devis || []} saving={saving} onClose={() => setEdit(null)}
      onSave={saveDevis} onDelete={edit.id ? () => removeDevis(edit.id) : null} />}
    {editEcheances && <EcheancesForm client={client} echeances={echeances} saving={saving} onClose={() => setEditEcheances(false)} onSave={saveEcheances} />}
  </>
}
