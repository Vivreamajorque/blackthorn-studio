import React, { useState } from 'react'
import { todayInSpain, formatDate } from '../lib/gestoria-calendar.mjs'
import './gestoria-opportunites.css'

// Les annonces trouvées par l'agent Prospection. Amely décide, annonce par annonce :
// ça m'intéresse / pas pour moi (avec la raison, pour que l'agent apprenne), puis je contacte / je ne contacte pas.
const RAISONS = ['Hors de mon offre', 'Trop technique', 'Trop petit', 'Trop gros pour moi', 'Annonce trop vieille', 'Pas le bon secteur', 'Autre']
const FILTRES = [['a_trier', 'À trier'], ['interesse', 'Je garde'], ['plus_tard', 'Plus tard'], ['contacte', 'Contactées'], ['refuse', 'Écartées']]
const plusDays = n => { const d = new Date(todayInSpain() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

export const etatOf = p => ['contacte', 'rdv', 'devis', 'gagne'].includes(p.statut) ? 'contacte'
  : p.decision === 'refuse' || p.statut === 'perdu' ? 'refuse' : p.decision || 'a_trier'

function Carte({ p, onUpdate, canSave }) {
  const [refus, setRefus] = useState(false)
  const [edit, setEdit] = useState(false)
  const [texte, setTexte] = useState(p.brouillon)
  const [copie, setCopie] = useState(false)
  const etat = etatOf(p)
  const today = todayInSpain()
  const set = (patch, msg) => onUpdate(p.id, { ...patch, decideLe: today }, msg)

  async function copier() {
    try { await navigator.clipboard.writeText(texte || p.brouillon); setCopie(true); setTimeout(() => setCopie(false), 2000) } catch { setEdit(true) }
  }

  return <article className={'op-card op-' + etat}>
    <header>
      <div className="op-from">
        <strong>{p.entreprise || p.nom}</strong>
        <span>{[p.plateforme || p.source, p.publieLe && 'publiée le ' + formatDate(p.publieLe)].filter(Boolean).join(' · ')}</span>
      </div>
      {p.pertinence > 0 && <span className="op-score" title="Pertinence estimée par l'agent">{'●'.repeat(p.pertinence)}{'○'.repeat(3 - p.pertinence)}</span>}
    </header>
    {p.besoin && <p className="op-besoin">{p.besoin}</p>}
    {p.pourquoi && <p className="op-pourquoi"><b>Pourquoi ça te correspond :</b> {p.pourquoi}</p>}
    {p.lien && <a className="op-lien" href={p.lien} target="_blank" rel="noopener noreferrer">Voir l’annonce</a>}

    {(etat === 'interesse' || edit) && (p.brouillon || edit) && <div className="op-brouillon">
      <p className="op-label">Ta réponse, prête à envoyer</p>
      {edit
        ? <textarea value={texte} onChange={e => setTexte(e.target.value)} rows={8} />
        : <p className="op-texte">{texte || p.brouillon}</p>}
      <div className="op-row">
        <button type="button" className="op-ghost" onClick={copier}>{copie ? 'Copié ✓' : 'Copier'}</button>
        {edit
          ? <button type="button" className="op-ghost" disabled={!canSave} onClick={() => { onUpdate(p.id, { brouillon: texte }, 'Réponse enregistrée.'); setEdit(false) }}>Enregistrer</button>
          : <button type="button" className="op-ghost" onClick={() => setEdit(true)}>Modifier</button>}
      </div>
    </div>}

    {etat === 'a_trier' && !refus && <div className="op-actions">
      <button type="button" className="op-yes" disabled={!canSave} onClick={() => set({ decision: 'interesse' }, 'Gardée. Ta réponse est prête juste en dessous.')}>Ça m’intéresse</button>
      <button type="button" className="op-no" disabled={!canSave} onClick={() => setRefus(true)}>Pas pour moi</button>
      <button type="button" className="op-later" disabled={!canSave} onClick={() => set({ decision: 'plus_tard' }, 'Mise de côté.')}>Plus tard</button>
    </div>}

    {refus && <div className="op-raisons">
      <p className="op-label">Pourquoi ? L’agent s’en souviendra.</p>
      <div className="op-chips">{RAISONS.map(r => <button key={r} type="button" disabled={!canSave}
        onClick={() => set({ decision: 'refuse', raison: r, statut: 'perdu' }, 'Écartée. L’agent en tiendra compte.')}>{r}</button>)}</div>
      <button type="button" className="op-ghost" onClick={() => setRefus(false)}>Annuler</button>
    </div>}

    {(etat === 'interesse' || etat === 'plus_tard') && !refus && <div className="op-actions">
      <button type="button" className="op-yes" disabled={!canSave} onClick={() => set({ decision: 'interesse', statut: 'contacte', relance: plusDays(4) }, 'Noté : contactée. Relance prévue dans 4 jours.')}>Je l’ai contacté</button>
      {etat === 'plus_tard' && <button type="button" className="op-ghost" disabled={!canSave} onClick={() => set({ decision: 'interesse' }, 'Gardée.')}>Je la garde</button>}
      <button type="button" className="op-no" disabled={!canSave} onClick={() => setRefus(true)}>Je ne le contacte pas</button>
    </div>}

    {etat === 'contacte' && <p className="op-etat">Contactée{p.relance ? ' · relance le ' + formatDate(p.relance) : ''}. Suis-la dans l’onglet Pistes.</p>}
    {etat === 'refuse' && <div className="op-row"><p className="op-etat">Écartée{p.raison ? ' : ' + p.raison.toLowerCase() : ''}.</p>
      <button type="button" className="op-ghost" disabled={!canSave} onClick={() => set({ decision: '', raison: '', statut: 'nouveau' }, 'Remise à trier.')}>Remettre à trier</button></div>}
  </article>
}

export default function GestoriaOpportunites({ crm, saveCrm, canSave }) {
  const opps = crm.prospects.filter(p => p.origine === 'agent')
  const counts = Object.fromEntries(FILTRES.map(([k]) => [k, opps.filter(p => etatOf(p) === k).length]))
  const [filtre, setFiltre] = useState(counts.a_trier ? 'a_trier' : counts.interesse ? 'interesse' : 'a_trier')
  const list = opps.filter(p => etatOf(p) === filtre)
    .sort((a, b) => (b.pertinence - a.pertinence) || (b.publieLe || b.trouveLe || '').localeCompare(a.publieLe || a.trouveLe || ''))
  const update = (id, patch, msg) => saveCrm(d => ({ ...d, prospects: d.prospects.map(p => p.id === id ? { ...p, ...patch } : p) }), msg)

  return <section className="op">
    <p className="op-intro">Chaque matin, l’agent Prospection cherche des annonces où quelqu’un a besoin d’un outil sur mesure, d’automatiser, de s’organiser ou d’être plus visible en ligne. Toi, tu tries : chaque refus lui apprend ce qui ne te correspond pas.</p>
    <nav className="op-filtres" aria-label="Filtrer les annonces">
      {FILTRES.map(([k, l]) => <button key={k} type="button" aria-pressed={filtre === k} onClick={() => setFiltre(k)}>{l}<span>{counts[k]}</span></button>)}
    </nav>
    {list.length === 0 ? <p className="op-vide">{filtre === 'a_trier' ? 'Rien à trier. L’agent repasse demain matin.' : 'Aucune annonce ici pour l’instant.'}</p>
      : <div className="op-grid">{list.map(p => <Carte key={p.id} p={p} onUpdate={update} canSave={canSave} />)}</div>}
  </section>
}
