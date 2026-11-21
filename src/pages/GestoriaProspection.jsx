import React, { useState } from 'react'
import { money, uid, toCents, fromCents } from '../lib/gestoria-crm'
import { formatDate, todayInSpain } from '../lib/gestoria-calendar.mjs'
import { Dialog, bind } from './GestoriaClients'
import GestoriaCanaux from './GestoriaCanaux'
import './gestoria-clients.css'

const STEPS = [['nouveau', 'À contacter'], ['contacte', 'Contacté'], ['rdv', 'Rendez-vous'], ['devis', 'Devis envoyé'], ['gagne', 'Signé'], ['perdu', 'Perdu']]
const SOURCES = ['Instagram', 'Malt', 'Annonce LinkedIn', 'Bouche-à-oreille', 'Réseau', 'Site web', 'Autre']
const plusDays = n => { const d = new Date(todayInSpain() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

function ProspectForm({ prospect, onSave, onDelete, onSign, onClose, saving }) {
  const [p, setP] = useState({ ...prospect, valeur: fromCents(prospect.valeurCents) })
  const f = bind(p, setP)
  const clean = () => ({ ...p, valeurCents: toCents(p.valeur || 0) })
  const badLink = p.lien && !/^https:\/\//i.test(p.lien.trim())
  return <Dialog title={prospect.id ? p.nom || 'Prospect' : 'Nouveau prospect'} onClose={onClose}
    footer={<>
      {prospect.id ? <button className="mgc-danger" disabled={saving} onClick={() => window.confirm('Supprimer ce prospect ?') && onDelete(prospect.id)}>Supprimer</button> : <span />}
      <div className="mgc-row">
        <button disabled={saving || !p.nom?.trim() || badLink} onClick={() => onSave(clean())}>Enregistrer</button>
        {!p.clientId && <button className="mgc-primary" disabled={saving || !p.nom?.trim() || badLink} onClick={() => onSign(clean())}>Signé → créer le client</button>}
      </div>
    </>}>
    <div className="mgc-form">
      <div className="mgc-cols"><label>Nom de la personne<input autoFocus {...f('nom')} /></label><label>Entreprise / activité<input {...f('entreprise')} /></label></div>
      <div className="mgc-cols">
        <label>Source<select {...f('source')}><option value="">—</option>{SOURCES.map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Étape<select {...f('statut')}>{STEPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Valeur estimée (€ HT)<input type="number" {...f('valeur')} /></label>
      </div>
      <div className="mgc-cols">
        <label>E-mail / téléphone<input {...f('email')} /></label>
        <label>Lien (profil, annonce)<input placeholder="https://" {...f('lien')} /></label>
        <label>Prochaine relance<input type="date" {...f('relance')} /></label>
      </div>
      <div className="mgc-row mgc-muted">Relancer dans : {[2, 4, 8, 15].map(n => <button key={n} type="button" onClick={() => setP({ ...p, relance: plusDays(n) })}>{n} j</button>)}</div>
      {badLink && <p className="mgc-error">Le lien doit commencer par https://</p>}
      <label>Son besoin<textarea {...f('besoin')} /></label>
      <label>Historique / notes<textarea {...f('notes')} /></label>
    </div>
  </Dialog>
}

export default function GestoriaProspection({ crm, saveCrm, canSave, saving, onClient }) {
  const [edit, setEdit] = useState(null)
  const [view, setView] = useState('pistes')
  const today = todayInSpain()
  const open = crm.prospects.filter(p => !['gagne', 'perdu'].includes(p.statut))
  const toFollow = open.filter(p => p.relance && p.relance <= today)
  const month = today.slice(0, 7)

  const save = p => saveCrm(data => ({ ...data, prospects: data.prospects.some(x => x.id === p.id)
    ? data.prospects.map(x => x.id === p.id ? p : x) : [{ ...p, id: uid('pro') }, ...data.prospects] }), 'Prospect enregistré.')
    .then(ok => ok && setEdit(null))

  async function sign(p) {
    const clientId = uid('cli')
    const prospectId = p.id || uid('pro')
    const ok = await saveCrm(data => ({
      ...data,
      clients: [...data.clients, { id: clientId, nom: p.entreprise || p.nom, contact: p.entreprise ? p.nom : '', email: p.email,
        canal: p.source, statut: 'actif', type: p.entreprise ? 'entreprise' : 'particulier', pays: 'Espagne', notes: p.besoin }],
      projets: [...data.projets, { id: uid('prj'), clientId, nom: (p.besoin || 'Premier projet').slice(0, 60), statut: 'a_demarrer',
        montantCents: p.valeurCents, actions: [], documents: [] }],
      prospects: [{ ...p, id: prospectId, statut: 'gagne', clientId, signeLe: today }, ...data.prospects.filter(x => x.id !== prospectId)],
      journal: [{ date: new Date().toISOString(), texte: 'Signé : ' + (p.entreprise || p.nom) }, ...data.journal],
    }), 'Signé ! Le client et son projet sont créés.')
    if (ok) { setEdit(null); onClient(clientId) }
  }

  return <>
    <div className="mgc-between">
      <div><p className="mg-section-label">MON ACTIVITÉ</p><h1 style={{ margin: '.1em 0', fontSize: 'clamp(1.65rem, 4vw, 2.6rem)', letterSpacing: '-.05em' }}>Prospection</h1>
        <p className="mgc-muted" style={{ margin: 0 }}>Tes pistes, tes relances, et un clic pour transformer un « oui » en client.</p></div>
      {view === 'pistes' && <button className="mgc-primary" disabled={!canSave} onClick={() => setEdit({ nom: '', statut: 'nouveau', source: 'Instagram' })}>+ Prospect</button>}
    </div>
    <div className="mgc-tabs" role="tablist" aria-label="Prospection">
      {[['pistes', 'Pistes'], ['canaux', 'Canaux de communication']].map(([id, label]) =>
        <button key={id} role="tab" aria-selected={view === id} className={view === id ? 'on' : ''} onClick={() => setView(id)}>{label}</button>)}
    </div>
    {view === 'canaux' && <GestoriaCanaux crm={crm} saveCrm={saveCrm} canSave={canSave} saving={saving} />}
    {view === 'pistes' && <>
    <div className="mgc-tiles">
      <div className="mgc-tile"><strong>{open.length}</strong><span>Pistes ouvertes · {money(open.reduce((s, p) => s + p.valeurCents, 0))} potentiels</span></div>
      <div className="mgc-tile"><strong>{toFollow.length}</strong><span>À relancer aujourd’hui</span></div>
      <div className="mgc-tile"><strong>{crm.prospects.filter(p => p.statut === 'gagne' && p.signeLe.startsWith(month)).length}</strong><span>Signés ce mois-ci</span></div>
    </div>
    {toFollow.length > 0 && <section className="mgc-panel">
      <h3>À relancer</h3>
      <ul className="mgc-list">{toFollow.map(p => <li key={p.id}><button className="mgc-link" onClick={() => setEdit(p)}>{p.nom}</button>
        <span className="mgc-muted">{p.entreprise && p.entreprise + ' · '}prévu le {formatDate(p.relance)}</span></li>)}</ul>
    </section>}
    <div className="mgc-kanban">
      {STEPS.map(([k, l]) => {
        const items = crm.prospects.filter(p => p.statut === k)
        return <div key={k} className="mgc-col"><h3>{l}<span className="mgc-muted">{items.length}</span></h3>
          {items.map(p => <button key={p.id} className="mgc-pcard" onClick={() => setEdit(p)}>
            <strong>{p.nom}</strong>
            <div className="mgc-muted">{[p.entreprise, p.source].filter(Boolean).join(' · ')}</div>
            {p.valeurCents > 0 && <div>{money(p.valeurCents)}</div>}
            {p.relance && !['gagne', 'perdu'].includes(k) && <span className={'mgc-badge ' + (p.relance <= today ? 'late' : '')}>Relance {formatDate(p.relance)}</span>}
          </button>)}
        </div>
      })}
    </div>
    </>}
    {edit && <ProspectForm prospect={edit} saving={saving} onClose={() => setEdit(null)} onSave={save} onSign={sign}
      onDelete={id => saveCrm(data => ({ ...data, prospects: data.prospects.filter(p => p.id !== id) }), 'Prospect supprimé.').then(ok => ok && setEdit(null))} />}
  </>
}
