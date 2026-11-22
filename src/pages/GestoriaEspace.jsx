import React, { useEffect, useState } from 'react'
import { money, devisBase } from '../lib/gestoria-crm'
import { formatDate } from '../lib/gestoria-calendar.mjs'
import { printDocument } from '../lib/gestoria-documents.mjs'
import { ProjectBadge } from './GestoriaClients'
import './gestoria-clients.css'

const api = '/api/gestoria-espace'
export const formatRdv = value => {
  if (!value) return ''
  const d = new Date(value.length === 10 ? value + 'T12:00:00' : value)
  if (isNaN(d)) return value
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + (value.length > 10 ? ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '')
}

const DEVIS_LABEL = { envoye: ['À signer', 'info'], signe: ['Signé', 'ok'] }
const LECON_LABEL = { brouillon: ['Brouillon', ''], a_valider: ['À relire', 'info'], validee: ['Validée', 'ok'] }

export default function GestoriaEspace({ token }) {
  const [view, setView] = useState(null)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState('start')
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)

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
  const formation = project?.type === 'formation'

  async function send(payload) {
    setBusy(true)
    try {
      const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, projetId: project.id, ...payload }) })
      if (response.ok) { setView(await response.json()); return true }
      const err = await response.json().catch(() => ({}))
      window.alert(err.error || 'Modification non enregistrée. Recharge la page et réessaie.')
      return false
    } finally { setBusy(false) }
  }

  const tabs = [['start', 'Pour commencer'], ['avancement', 'Avancement'], ['actions', 'Mes actions'],
    ...(formation ? [['lecons', 'Mes leçons']] : []), ['visios', 'Visios'], ['questions', 'Questions'], ['documents', 'Documents et factures']]
  const current = tabs.some(([k]) => k === tab) ? tab : 'start'
  const go = k => { setTab(k); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  return <div>
    <div className="mgc-portal-top"><strong>{view.consultante.nom} · Suivi de projet</strong><span className="mgc-badge late">Espace privé</span></div>
    <div className="mgc-portal-head"><div className="mgc-portal-in">
      {project && <div className="mg-section-label" style={{ color: '#8a4b3a', letterSpacing: '.14em' }}>{project.nom.toUpperCase()}</div>}
      <h1>Bonjour {view.client.nom.split(' ')[0]}.</h1>
      <p style={{ maxWidth: 540, margin: 0 }}>{project?.messageClient || `Un cap clair, tes prochaines actions et un endroit pour avancer avec ${first}.`}</p>
      {actions.length > 0 && <div style={{ maxWidth: 440, marginTop: 14 }}>
        <div className="mgc-bar" style={{ background: 'rgba(0,0,0,.08)' }}><div style={{ width: Math.round(done / actions.length * 100) + '%', background: '#8a4b3a' }} /></div>
        <strong style={{ fontSize: '.85rem' }}>{project.etape ? project.etape + ' · ' : ''}{done} action{done > 1 ? 's' : ''} terminée{done > 1 ? 's' : ''} sur {actions.length}</strong>
      </div>}
    </div></div>
    <div className="mgc-portal-in" style={{ padding: '0 20px 60px' }}>
      {view.projets.length > 1 && <div className="mgc-tabs">{view.projets.map((p, i) => <button key={p.id} aria-pressed={i === index} onClick={() => setIndex(i)}>{p.nom}</button>)}</div>}
      <div className="mgc-tabs" role="tablist">{tabs.map(([k, l]) =>
        <button key={k} role="tab" aria-selected={current === k} aria-pressed={current === k} onClick={() => setTab(k)}>{l}{k === 'documents' && view.devis.some(d => d.statut === 'envoye') ? ' •' : ''}</button>)}</div>

      {!project && current !== 'documents' && <p className="mg-empty">Ton projet arrive bientôt ici.</p>}
      {project && current === 'start' && <Start project={project} first={first} formation={formation} busy={busy} send={send} go={go} />}
      {project && current === 'avancement' && <Avancement project={project} first={first} />}
      {project && current === 'actions' && <Actions project={project} first={first} send={send} />}
      {project && current === 'lecons' && <Lecons project={project} first={first} busy={busy} send={send} />}
      {project && current === 'visios' && <Visios project={project} first={first} busy={busy} send={send} />}
      {project && current === 'questions' && <Questions project={project} first={first} busy={busy} send={send} />}
      {current === 'documents' && <Documents view={view} project={project} />}
      {view.consultante.email && <p className="mgc-muted" style={{ marginTop: 28 }}>Une question ? Écris à {view.consultante.email}.</p>}
    </div>
  </div>
}

function Start({ project, first, formation, busy, send, go }) {
  const next = project.actions.filter(a => a.pour === 'client' && !a.fait).slice(0, 3)
  const [brief, setBrief] = useState(() => Object.fromEntries(project.brief.map(b => [b.id, b.r])))
  useEffect(() => { setBrief(Object.fromEntries(project.brief.map(b => [b.id, b.r]))) }, [project.id])
  return <>
    <section className="mgc-panel">
      <div className="mgc-between"><div className="mg-section-label" style={{ color: '#8a4b3a' }}>TON ESPACE DE TRAVAIL AVEC {first.toUpperCase()}</div><ProjectBadge status={project.statut} /></div>
      <h2 style={{ marginTop: 4 }}>Une étape à la fois.</h2>
      <p>{formation
        ? `Nous préparons une formation claire, utile aux parents et facile à découvrir puis à acheter. Ce suivi t’aide à avancer sur ton offre et tes contenus pendant que ${first} construit l’espace technique.`
        : `Ce suivi rassemble ce qui reste à faire, l’avancement du projet et tous tes documents. Tu y avances à ton rythme pendant que ${first} construit sa partie.`}</p>
      <h3>Tes {next.length > 1 ? next.length + ' prochaines actions' : 'prochaine action'}</h3>
      {next.length === 0 ? <p className="mgc-muted">Rien en attente de ton côté pour l’instant.</p> :
        <ul className="mgc-list">{next.map(a => <li key={a.id}><span className="mgc-badge">À faire</span>
          <div style={{ flex: 1 }}><strong>{a.label}</strong>{a.detail && <div className="mgc-muted">{a.detail}</div>}</div></li>)}</ul>}
      <div className="mgc-row" style={{ marginTop: 10 }}>
        <button className="mgc-primary" onClick={() => go('actions')}>Ouvrir mes actions</button>
        {formation && <button onClick={() => go('lecons')}>Préparer une leçon</button>}
      </div>
    </section>

    <section className="mgc-panel">
      <h3 style={{ marginTop: 0 }}>Comment nous travaillons ensemble</h3>
      <div className="mgc-grid">
        <div><strong>Toi</strong><p className="mgc-muted">{formation
          ? 'Tu apportes ton expertise, les besoins entendus auprès des parents et tes contenus. Tu complètes les fiches, partages tes vidéos et valides les choix.'
          : 'Tu apportes ta connaissance du métier, tes besoins et tes validations. Tu coches tes actions et poses tes questions ici.'}</p></div>
        <div><strong>{first}</strong><p className="mgc-muted">{formation
          ? `${first} structure le projet avec toi, prépare les écrans, construit le parcours d’achat et d’accès, intègre les contenus convenus et t’aide à prendre l’outil en main.`
          : `${first} structure le projet avec toi, construit l’outil, le teste et t’aide à le prendre en main.`}</p></div>
        <div><strong>À chaque point</strong><p className="mgc-muted">Nous regardons les avancées, testons ce qui est prêt et choisissons les prochaines actions. Dépose tes questions avant le rendez-vous pour les regrouper.</p></div>
        <div><strong>Entre deux rendez-vous</strong><p className="mgc-muted">{formation
          ? 'Mets à jour tes actions, prépare une fiche par leçon et dépose les liens des vidéos. Si tu bloques, écris dans Questions.'
          : 'Mets à jour tes actions. Si tu bloques, écris dans Questions.'} Les informations enregistrées sont partagées dans cet espace.</p></div>
      </div>
    </section>

    {project.brief.length > 0 && <section className="mgc-panel">
      <h3 style={{ marginTop: 0 }}>{formation ? 'Le brief de ta première formation' : 'Ton brief'}</h3>
      <p className="mgc-muted">Quelques phrases suffisent. Enregistre tout en bas. Tu pourras revenir compléter tes réponses.</p>
      <div className="mgc-form">{project.brief.map(b => <label key={b.id}>{b.q}
        <textarea rows={3} value={brief[b.id] || ''} onChange={e => setBrief(x => ({ ...x, [b.id]: e.target.value }))} /></label>)}</div>
      <button className="mgc-primary" style={{ marginTop: 10 }} disabled={busy} onClick={() => send({ op: 'brief', reponses: brief }).then(ok => ok && window.alert('Brief enregistré.'))}>Enregistrer mon brief</button>
    </section>}

    {formation && <section className="mgc-panel">
      <h3 style={{ marginTop: 0 }}>Des décisions fondées sur les retours</h3>
      <p className="mgc-muted">Une offre précise, un parcours pédagogique progressif, une vidéo pilote et des retours de parents nous aident à améliorer la formation avant le lancement. Les visites, achats et questions recueillies permettront ensuite de choisir les ajustements. Les ventes dépendront aussi de la demande et de la diffusion.</p>
    </section>}
  </>
}

function Avancement({ project, first }) {
  const nextEtape = project.plan[0]
  return <>
    <section className="mgc-panel">
      <div className="mg-section-label" style={{ color: '#8a4b3a' }}>OÙ ON EN EST</div>
      <h2 style={{ marginTop: 4 }}>{project.etape || nextEtape?.titre || 'Démarrage'}</h2>
      {project.prochainRdv && <p className="mgc-note">Prochain rendez-vous : <strong>{formatRdv(project.prochainRdv)}</strong></p>}
      {project.rythme && <p className="mgc-muted">{project.rythme}</p>}
      {project.plan.length === 0 ? <p className="mgc-muted">Le plan arrive bientôt.</p> :
        <ol className="mgc-plan">{project.plan.map(e => <li key={e.id}>
          <div className="mgc-muted">{e.periode}</div><strong>{e.titre}</strong>
          {e.amely && <p><span className="mgc-badge ok">{first}</span> {e.amely}</p>}
          {e.client && <p><span className="mgc-badge">Toi</span> {e.client}</p>}
        </li>)}</ol>}
    </section>
    <h3 style={{ margin: '22px 0 0' }}>Décisions et comptes rendus</h3>
    {project.notes.length === 0 ? <p className="mg-empty">Les décisions apparaîtront ici après vos échanges.</p> :
      project.notes.map(n => <section key={n.id} className="mgc-panel">
        <div className="mgc-muted">{n.date ? formatRdv(n.date) : ''}</div>
        {n.titre && <h3>{n.titre}</h3>}
        <div style={{ whiteSpace: 'pre-line', marginTop: 6 }}>{n.texte}</div>
      </section>)}
  </>
}

function Actions({ project, first, send }) {
  const actions = project.actions
  return <section className="mgc-panel">
    <div className="mgc-between"><h2>Ce qui fait avancer le projet</h2><ProjectBadge status={project.statut} /></div>
    <p className="mgc-muted">Coche tes actions au fur et à mesure : {first} le voit tout de suite.</p>
    {actions.length === 0 ? <p className="mgc-muted">Pas encore d’action. {first} les ajoute au fil du projet.</p> :
      <ul className="mgc-list">{actions.map((a, i) => <React.Fragment key={a.id}>
        {a.groupe && a.groupe !== actions[i - 1]?.groupe && <li className="mgc-group-title"><strong>{a.groupe}</strong></li>}
        <li>
          {a.pour === 'client' ? <input type="checkbox" checked={a.fait} onChange={() => send({ actionId: a.id, fait: !a.fait })} aria-label={a.label} />
            : <span className={'mgc-badge ' + (a.fait ? 'ok' : '')}>{a.fait ? 'Fait' : first}</span>}
          <div style={{ flex: 1 }}><div className={a.fait ? 'mgc-done' : ''}>{a.label}</div>{a.detail && <div className="mgc-muted">{a.detail}</div>}</div>
          {a.pour === 'client' && <span className="mgc-badge">Pour toi</span>}
        </li></React.Fragment>)}</ul>}
  </section>
}

const emptyLecon = { titre: '', objectif: '', points: '', video: '' }

function Lecons({ project, first, busy, send }) {
  const [edit, setEdit] = useState(null)
  const save = statut => send({ op: 'lecon', lecon: { ...edit, statut } }).then(ok => ok && setEdit(null))
  return <section className="mgc-panel">
    <div className="mgc-between"><h2>Construire tes leçons</h2>{!edit && <button className="mgc-primary" onClick={() => setEdit({ ...emptyLecon })}>Créer une fiche de leçon</button>}</div>
    <p className="mgc-muted">Commence par une seule leçon pilote. Nous validons sa structure et la lecture avant de poursuivre les tournages. Les fiches restent modifiables à mesure que le programme se précise.</p>
    {edit && <div className="mgc-panel mgc-form" style={{ background: '#faf7f1' }}>
      <label>Titre de la leçon<input value={edit.titre} onChange={e => setEdit({ ...edit, titre: e.target.value })} /></label>
      <label>Ce que le parent apprendra<textarea rows={2} value={edit.objectif} onChange={e => setEdit({ ...edit, objectif: e.target.value })} /></label>
      <label>Les points que tu veux montrer<textarea rows={5} value={edit.points} onChange={e => setEdit({ ...edit, points: e.target.value })} /></label>
      <label>Lien de la vidéo (si prête)<input placeholder="https://…" value={edit.video} onChange={e => setEdit({ ...edit, video: e.target.value })} /></label>
      <div className="mgc-row">
        <button disabled={busy || !edit.titre.trim()} onClick={() => save('brouillon')}>Enregistrer le brouillon</button>
        <button className="mgc-primary" disabled={busy || !edit.titre.trim()} onClick={() => save('a_valider')}>Envoyer à {first} pour relecture</button>
        <button className="mgc-link" onClick={() => setEdit(null)}>Annuler</button>
      </div>
    </div>}
    {project.lecons.length === 0 && !edit ? <div className="mgc-note"><strong>Ta première fiche de leçon</strong><br />Ouvre « Créer une fiche de leçon » ci-dessus. Donne-lui un titre, explique ce que le parent apprendra et décris les points que tu veux montrer.</div> :
      <ul className="mgc-list">{project.lecons.map((l, i) => <li key={l.id} style={{ display: 'block' }}>
        <div className="mgc-between"><div className="mgc-row"><span className="mgc-muted">{i + 1}.</span><strong>{l.titre}</strong><span className={'mgc-badge ' + LECON_LABEL[l.statut][1]}>{LECON_LABEL[l.statut][0]}</span></div>
          {l.statut !== 'validee' && <button onClick={() => setEdit({ id: l.id, titre: l.titre, objectif: l.objectif, points: l.points, video: l.video })}>Modifier</button>}</div>
        {l.objectif && <div className="mgc-muted">{l.objectif}</div>}
        {l.video && <a className="mgc-link" href={l.video} target="_blank" rel="noopener noreferrer">Voir la vidéo ↗</a>}
        {l.retour && <p className="mgc-note"><strong>Retour de {first} :</strong> {l.retour}</p>}
      </li>)}</ul>}
  </section>
}

function Visios({ project, first, busy, send }) {
  const groups = {}
  for (const c of project.creneaux) (groups[c.titre] ||= []).push(c)
  return <section className="mgc-panel">
    <h2>Rendez-vous en visio</h2>
    <p className="mgc-muted">Choisis parmi les créneaux proposés par {first}. Les rendez-vous réservés apparaissent ici.</p>
    {project.prochainRdv && <p className="mgc-note">Prochain rendez-vous prévu : <strong>{formatRdv(project.prochainRdv)}</strong></p>}
    {project.creneaux.length === 0 ? <p className="mg-empty">Aucun créneau proposé pour le moment.</p> :
      Object.entries(groups).map(([titre, list]) => {
        const booked = list.find(c => c.reserve)
        return <div key={titre} style={{ marginTop: 12 }}>
          <strong>{titre}</strong>
          {booked ? <p className="mgc-note">Réservé : <strong>{formatRdv(booked.date)}</strong>{booked.lien && <> · <a href={booked.lien} target="_blank" rel="noopener noreferrer">Rejoindre la visio ↗</a></>}
            <br /><button className="mgc-link" disabled={busy} onClick={() => send({ op: 'creneau', creneauId: booked.id, reserve: false })}>Changer de créneau</button></p>
            : <div className="mgc-row" style={{ marginTop: 6, flexWrap: 'wrap' }}>{list.map(c =>
              <button key={c.id} disabled={busy} onClick={() => send({ op: 'creneau', creneauId: c.id })}>{formatRdv(c.date)}</button>)}</div>}
        </div>
      })}
  </section>
}

function Questions({ project, first, busy, send }) {
  const [texte, setTexte] = useState('')
  const list = project.questions.slice().reverse()
  return <section className="mgc-panel">
    <h2>Questions avant la visio</h2>
    <p className="mgc-muted">Note ici les sujets que tu veux aborder, pour les retrouver au prochain rendez-vous.</p>
    <div className="mgc-form"><textarea rows={3} placeholder="Ta question…" value={texte} onChange={e => setTexte(e.target.value)} /></div>
    <button className="mgc-primary" style={{ marginTop: 8 }} disabled={busy || !texte.trim()} onClick={() => send({ op: 'question', texte }).then(ok => ok && setTexte(''))}>Ajouter la question</button>
    {list.length === 0 ? <p className="mg-empty">Aucune question pour le moment.</p> :
      <ul className="mgc-list" style={{ marginTop: 12 }}>{list.map(q => <li key={q.id} style={{ display: 'block' }}>
        <div className="mgc-between"><span className="mgc-muted">{q.date ? formatDate(q.date) : ''}</span>{q.traitee && <span className="mgc-badge ok">Traitée</span>}</div>
        <div style={{ whiteSpace: 'pre-line' }}>{q.texte}</div>
        {q.reponse && <p className="mgc-note"><strong>{first} :</strong> {q.reponse}</p>}
      </li>)}</ul>}
  </section>
}

function Documents({ view, project }) {
  const printDevis = d => printDocument({ kind: 'devis', numero: d.numero, date: d.date, validite: d.validite, regime: d.regime, irpf: 0,
    lignes: d.lignes, intro: d.intro, perimetre: d.perimetre, note: d.note, outils: d.outils, echeances: d.echeances, client: view.client, emetteur: view.emetteur })
  return <>
    <section className="mgc-panel"><h3 style={{ marginTop: 0 }}>Devis</h3>
      {view.devis.length === 0 ? <p className="mgc-muted">Aucun devis pour l’instant.</p> :
        <table className="mgc-table"><tbody>{view.devis.map(d => <tr key={d.id}>
          <td><strong>{d.numero}</strong>{d.intro && <div className="mgc-muted" style={{ maxWidth: 420 }}>{d.intro.slice(0, 140)}{d.intro.length > 140 ? '…' : ''}</div>}</td>
          <td className="mgc-muted">{d.date ? formatDate(d.date) : ''}</td>
          <td><span className={'mgc-badge ' + DEVIS_LABEL[d.statut][1]}>{DEVIS_LABEL[d.statut][0]}</span></td>
          <td className="mgc-num">{money(devisBase(d))} HT</td>
          <td><button onClick={() => printDevis(d)}>Voir / PDF</button></td></tr>)}</tbody></table>}
    </section>
    <section className="mgc-panel"><h3 style={{ marginTop: 0 }}>Échéancier et suivi des règlements</h3>
      {view.echeancier?.length > 0 ? <table className="mgc-table"><tbody>{view.echeancier.map((e, i) => <tr key={i}>
        <td>{e.label}</td><td className="mgc-muted">{e.date ? formatDate(e.date) : '—'}</td>
        <td><span className={'mgc-badge ' + (e.statut === 'payee' ? 'ok' : e.statut === 'facturee' ? 'info' : '')}>{e.statut === 'payee' ? 'Réglée' : e.statut === 'facturee' ? 'À régler' : 'À venir'}</span></td>
        <td className="mgc-num">{money(e.montantCents)}</td></tr>)}</tbody></table> : <p className="mgc-muted">Pas d’échéancier pour l’instant.</p>}
    </section>
    <section className="mgc-panel"><h3 style={{ marginTop: 0 }}>Factures</h3>
      {view.factures.length === 0 ? <p className="mgc-muted">Aucune facture pour l’instant.</p> :
        <table className="mgc-table"><tbody>{view.factures.map((f, i) => <tr key={i}>
          <td>{f.reference}</td><td className="mgc-muted">{formatDate(f.date)}</td>
          <td><span className={'mgc-badge ' + (f.payment === 'paid' ? 'ok' : 'info')}>{f.payment === 'paid' ? 'Réglée' : 'À régler'}</span></td>
          <td className="mgc-num">{money(f.amountCents)}</td></tr>)}</tbody></table>}
    </section>
    {project && <section className="mgc-panel"><h3 style={{ marginTop: 0 }}>Documents partagés</h3>
      {project.documents.length === 0 ? <p className="mgc-muted">Aucun document partagé pour l’instant.</p> :
        <div className="mgc-grid">{project.documents.map((d, i) => <a key={i} className="mgc-panel" style={{ marginTop: 0, textDecoration: 'none' }} href={d.url} target="_blank" rel="noopener noreferrer"><strong>{d.label}</strong> ↗</a>)}</div>}
    </section>}
  </>
}
