import React, { useEffect, useState } from 'react'
import { money } from '../lib/gestoria-crm'
import { formatDate } from '../lib/gestoria-calendar.mjs'
import { ProjectBadge } from './GestoriaClients'
import './gestoria-clients.css'

const api = '/api/gestoria-espace'
export const formatRdv = value => {
  if (!value) return ''
  const d = new Date(value.length === 10 ? value + 'T12:00:00' : value)
  if (isNaN(d)) return value
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + (value.length > 10 ? ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '')
}

export default function GestoriaEspace({ token }) {
  const [view, setView] = useState(null)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState('actions')
  const [index, setIndex] = useState(0)

  useEffect(() => {
    fetch(api + '?t=' + encodeURIComponent(token), { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(setView).catch(() => setError(true))
  }, [token])

  if (error) return <main className="login"><h1>Espace introuvable</h1><p>Ce lien n’est plus valide. Demande le nouveau lien à ta consultante.</p></main>
  if (!view) return <main className="login"><p role="status">Chargement…</p></main>

  const project = view.projets[index]
  const actions = project?.actions || []
  const done = actions.filter(a => a.fait).length
  const first = view.consultante.nom.split(' ')[0]

  async function toggle(action) {
    const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ t: token, projetId: project.id, actionId: action.id, fait: !action.fait }) })
    if (response.ok) setView(await response.json())
    else window.alert('Modification non enregistrée. Recharge la page et réessaie.')
  }

  return <div>
    <div className="mgc-portal-top"><strong>{view.consultante.nom} · Suivi de projet</strong><span className="mgc-badge late">Espace privé</span></div>
    <div className="mgc-portal-head"><div className="mgc-portal-in">
      {project && <div className="mg-section-label" style={{ color: '#8a4b3a', letterSpacing: '.14em' }}>{project.nom.toUpperCase()}</div>}
      <h1>Bonjour {view.client.nom.split(' ')[0]}.</h1>
      <p style={{ maxWidth: 540, margin: 0 }}>{project?.messageClient || `Ton espace de travail avec ${first} : où on en est, ce qu’il reste à faire, et tous tes documents.`}</p>
      {actions.length > 0 && <div style={{ maxWidth: 440, marginTop: 14 }}>
        <div className="mgc-bar" style={{ background: 'rgba(0,0,0,.08)' }}><div style={{ width: Math.round(done / actions.length * 100) + '%', background: '#8a4b3a' }} /></div>
        <strong style={{ fontSize: '.85rem' }}>{project.etape ? project.etape + ' · ' : ''}{done} action{done > 1 ? 's' : ''} terminée{done > 1 ? 's' : ''} sur {actions.length}</strong>
      </div>}
    </div></div>
    <div className="mgc-portal-in" style={{ padding: '0 20px 60px' }}>
      {view.projets.length > 1 && <div className="mgc-tabs">{view.projets.map((p, i) => <button key={p.id} aria-pressed={i === index} onClick={() => setIndex(i)}>{p.nom}</button>)}</div>}
      <div className="mgc-tabs">{[['actions', 'Mes actions'], ['avancement', 'Avancement'], ['notes', 'Notes'], ['documents', 'Documents'], ['factures', 'Factures']].map(([k, l]) =>
        <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>

      {!project && tab !== 'factures' && <p className="mg-empty">Ton projet arrive bientôt ici.</p>}
      {project && tab === 'actions' && <section className="mgc-panel">
        <div className="mgc-between"><h2>Une étape à la fois.</h2><ProjectBadge status={project.statut} /></div>
        {actions.length === 0 ? <p className="mgc-muted">Pas encore d’action. {first} les ajoute au fil du projet.</p> :
          <ul className="mgc-list">{actions.map((a, i) => <React.Fragment key={a.id}>
            {a.groupe && a.groupe !== actions[i - 1]?.groupe && <li className="mgc-group-title"><strong>{a.groupe}</strong></li>}
            <li>
            {a.pour === 'client' ? <input type="checkbox" checked={a.fait} onChange={() => toggle(a)} aria-label={a.label} />
              : <span className={'mgc-badge ' + (a.fait ? 'ok' : '')}>{a.fait ? 'Fait' : first}</span>}
            <div style={{ flex: 1 }}><div className={a.fait ? 'mgc-done' : ''}>{a.label}</div>{a.detail && <div className="mgc-muted">{a.detail}</div>}</div>
            {a.pour === 'client' && <span className="mgc-badge">Pour toi</span>}
          </li></React.Fragment>)}</ul>}
      </section>}
      {project && tab === 'avancement' && <section className="mgc-panel">
        <h2>Où on en est</h2>
        {project.prochainRdv && <p className="mgc-note">Prochain rendez-vous : <strong>{formatRdv(project.prochainRdv)}</strong></p>}
        {project.rythme && <p className="mgc-muted">{project.rythme}</p>}
        {project.plan.length === 0 ? <p className="mgc-muted">Le plan arrive bientôt.</p> :
          <ol className="mgc-plan">{project.plan.map(e => <li key={e.id}>
            <div className="mgc-muted">{e.periode}</div><strong>{e.titre}</strong>
            {e.amely && <p><span className="mgc-badge ok">{first}</span> {e.amely}</p>}
            {e.client && <p><span className="mgc-badge">Toi</span> {e.client}</p>}
          </li>)}</ol>}
      </section>}
      {project && tab === 'notes' && (project.notes.length === 0 ? <p className="mg-empty">Pas encore de note partagée.</p> :
        project.notes.map(n => <section key={n.id} className="mgc-panel">
          <div className="mgc-muted">{n.date ? formatRdv(n.date) : ''}</div>
          {n.titre && <h3>{n.titre}</h3>}
          <div style={{ whiteSpace: 'pre-line', marginTop: 6 }}>{n.texte}</div>
        </section>))}
      {project && tab === 'documents' && (project.documents.length === 0 ? <p className="mg-empty">Aucun document partagé pour l’instant.</p> :
        <div className="mgc-grid">{project.documents.map((d, i) => <a key={i} className="mgc-panel" style={{ marginTop: 0, textDecoration: 'none' }} href={d.url} target="_blank" rel="noopener noreferrer"><strong>{d.label}</strong> ↗</a>)}</div>)}
      {tab === 'factures' && view.echeancier?.length > 0 && <section className="mgc-panel"><h3 style={{ marginTop: 0 }}>Échéancier</h3>
        <table className="mgc-table"><tbody>{view.echeancier.map((e, i) => <tr key={i}>
          <td>{e.label}</td><td className="mgc-muted">{e.date ? formatDate(e.date) : '—'}</td>
          <td><span className={'mgc-badge ' + (e.statut === 'payee' ? 'ok' : e.statut === 'facturee' ? 'info' : '')}>{e.statut === 'payee' ? 'Réglée' : e.statut === 'facturee' ? 'À régler' : 'À venir'}</span></td>
          <td className="mgc-num">{money(e.montantCents)}</td></tr>)}</tbody></table></section>}
      {tab === 'factures' && (view.factures.length === 0 ? <p className="mg-empty">Aucune facture pour l’instant.</p> :
        <section className="mgc-panel"><table className="mgc-table"><tbody>{view.factures.map((f, i) => <tr key={i}>
          <td>{f.reference}</td><td className="mgc-muted">{formatDate(f.date)}</td>
          <td><span className={'mgc-badge ' + (f.payment === 'paid' ? 'ok' : 'info')}>{f.payment === 'paid' ? 'Réglée' : 'À régler'}</span></td>
          <td className="mgc-num">{money(f.amountCents)}</td></tr>)}</tbody></table></section>)}
      {view.consultante.email && <p className="mgc-muted" style={{ marginTop: 28 }}>Une question ? Écris à {view.consultante.email}.</p>}
    </div>
  </div>
}
