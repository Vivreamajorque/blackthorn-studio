import React, { useEffect, useState } from 'react'
import { money, devisBase } from '../lib/gestoria-crm'
import { formatDate } from '../lib/gestoria-calendar.mjs'
import { printDocument } from '../lib/gestoria-documents.mjs'
import './gestoria-espace.css'

const api = '/api/gestoria-espace'
export const formatRdv = value => {
  if (!value) return ''
  const d = new Date(value.length === 10 ? value + 'T12:00:00' : value)
  if (isNaN(d)) return value
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + (value.length > 10 ? ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '')
}
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s
const shortRdv = value => cap(shortRdv0(value))
const shortRdv0 = value => {
  const d = new Date(value.length === 10 ? value + 'T12:00:00' : value)
  if (isNaN(d)) return value
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + (value.length > 10 ? ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '')
}
const nowIso = () => new Date().toISOString().slice(0, 16)
const isFuture = v => !!v && (v.length === 10 ? v >= nowIso().slice(0, 10) : v >= nowIso())

const LECON_LABEL = { brouillon: ['Brouillon', ''], a_valider: ['À relire', 'info'], validee: ['Validée', 'ok'] }
const TABS = [['accueil', 'Accueil', 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  ['actions', 'Mes actions', 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9'],
  ['visios', 'Visios', 'M3 8a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 10l5-3v10l-5-3'],
  ['documents', 'Documents', 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6']]

export default function GestoriaEspace({ token }) {
  const [view, setView] = useState(null)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState('accueil')
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')

  useEffect(() => {
    fetch(api + '?t=' + encodeURIComponent(token), { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(setView).catch(() => setError(true))
  }, [token])
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(''), 3500); return () => clearTimeout(t) }, [flash])

  if (error) return <main className="esp-center"><h1>Espace introuvable</h1><p>Ce lien n’est plus valide. Demande le nouveau lien à ta consultante.</p></main>
  if (!view) return <main className="esp-center"><p role="status">Chargement…</p></main>

  const project = view.projets[Math.min(index, view.projets.length - 1)]
  const first = view.consultante.nom.split(' ')[0]
  const aSigner = view.devis.filter(d => d.statut === 'envoye')

  async function send(payload, message) {
    setBusy(true)
    try {
      const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, projetId: project?.id, ...payload }) })
      if (response.ok) { setView(await response.json()); if (message) setFlash(message); return true }
      const err = await response.json().catch(() => ({}))
      setFlash(err.error || 'Pas enregistré. Recharge la page et réessaie.')
      return false
    } catch {
      setFlash('Pas de connexion. Réessaie dans un instant.')
      return false
    } finally { setBusy(false) }
  }
  const go = k => { setTab(k); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const props = { view, project, first, busy, send, go }

  return <div className="esp">
    <header className="esp-top"><div className="esp-in esp-top-in">
      <strong>{first} · Range Ton Biz</strong><span className="esp-pill">Espace privé</span>
    </div></header>

    <main className="esp-in esp-main">
      <div className="esp-hello">
        <h1>Bonjour {view.client.nom.split(' ')[0]}</h1>
        {view.projets.length > 1 && <label className="esp-field">Projet
          <select value={index} onChange={e => setIndex(Number(e.target.value))}>
            {view.projets.map((p, i) => <option key={p.id} value={i}>{p.nom}</option>)}
          </select></label>}
        {view.projets.length === 1 && <p className="esp-muted">{project.nom}</p>}
      </div>

      {!project && tab !== 'documents' && <p className="esp-card esp-muted">Ton projet arrive bientôt ici.</p>}
      {project && tab === 'accueil' && <Accueil {...props} aSigner={aSigner} />}
      {project && tab === 'actions' && <Actions {...props} />}
      {project && tab === 'visios' && <Visios {...props} />}
      {tab === 'documents' && <Documents {...props} />}

      {view.consultante.email && <p className="esp-muted esp-contact">Une question urgente ? <a href={'mailto:' + view.consultante.email}>{view.consultante.email}</a></p>}
    </main>

    {flash && <div className="esp-flash" role="status">{flash}</div>}

    <nav className="esp-nav" aria-label="Navigation de l’espace"><div className="esp-nav-in">
      {TABS.map(([k, label, d]) => <button key={k} aria-current={tab === k ? 'page' : undefined} onClick={() => go(k)}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
        {label}{k === 'documents' && aSigner.length > 0 && <span className="esp-dot" aria-label="à valider" />}
      </button>)}
    </div></nav>
  </div>
}

// ---------- Accueil ----------
function phaseIndex(project) {
  const i = project.plan.findIndex(e => e.titre && project.etape && e.titre.trim().toLowerCase() === project.etape.trim().toLowerCase())
  return i < 0 ? 0 : i
}
function nextVisio(project) {
  const booked = project.creneaux.filter(c => c.reserve && isFuture(c.date)).sort((a, b) => a.date.localeCompare(b.date))[0]
  if (booked) return { date: booked.date, lien: booked.lien, id: booked.id }
  if (isFuture(project.prochainRdv)) return { date: project.prochainRdv }
  return null
}

function Accueil({ view, project, first, busy, send, go, aSigner }) {
  const todo = project.actions.filter(a => a.pour === 'client' && !a.fait)
  const amely = project.actions.filter(a => a.pour !== 'client' && !a.fait)
  const phase = phaseIndex(project)
  const current = project.plan[phase]
  const visio = nextVisio(project)
  const libres = project.creneaux.filter(c => !c.reserve && isFuture(c.date)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3)
  const briefOuvert = project.brief.length > 0 && project.brief.some(b => !String(b.r || '').trim())
  const doneCount = project.plan.length ? phase : 0

  return <>
    {aSigner.map(d => <section key={d.id} className="esp-card esp-alert">
      <span className="esp-tag warn">À valider</span>
      <h2>Ton devis {d.numero}</h2>
      <p className="esp-muted">{money(devisBase(d))} HT{d.echeances?.[0] ? ' · ' + d.echeances[0].label.toLowerCase() + ' de ' + money(d.echeances[0].montantCents) + ' pour lancer le projet' : ''}</p>
      <button className="esp-primary" onClick={() => go('documents')}>Voir et accepter</button>
    </section>)}

    {briefOuvert && <Brief project={project} busy={busy} send={send} />}

    <section className="esp-card">
      <h2>Prochaine visio</h2>
      {visio ? <>
        <p className="esp-big">{cap(formatRdv(visio.date))}</p>
        {visio.lien && <a className="esp-primary" href={visio.lien} target="_blank" rel="noopener noreferrer">Rejoindre la visio</a>}
      </> : libres.length > 0 ? <>
        <p className="esp-muted">Choisis le créneau qui t’arrange.</p>
        <div className="esp-chips">{libres.map(c => <button key={c.id} disabled={busy} onClick={() => send({ op: 'creneau', creneauId: c.id }, 'Visio réservée.')}>{shortRdv(c.date)}</button>)}</div>
      </> : <p className="esp-muted">Pas encore de date. {first} te propose des créneaux ici très vite.</p>}
    </section>

    <section className="esp-card">
      <div className="esp-between"><h2>Ce que j’attends de toi</h2>{todo.length > 0 && <span className="esp-muted">{todo.length} à faire</span>}</div>
      {todo.length === 0 ? <p className="esp-muted">Rien pour l’instant. Profites-en.</p> :
        <ul className="esp-checks">{todo.slice(0, 3).map(a => <ActionCheck key={a.id} a={a} busy={busy} send={send} />)}</ul>}
      {todo.length > 3 && <button className="esp-link" onClick={() => go('actions')}>Voir mes {todo.length} actions</button>}
    </section>

    {(current?.amely || amely.length > 0) && <section className="esp-card esp-dark">
      <h2>Ce que fait {first} en ce moment</h2>
      {current?.amely ? <p>{current.amely}</p> : <ul>{amely.slice(0, 3).map(a => <li key={a.id}>{a.label}</li>)}</ul>}
    </section>}

    {project.plan.length > 0 && <section className="esp-card">
      <h2>Où on en est</h2>
      <div className="esp-bar" aria-hidden="true"><div style={{ width: Math.round((doneCount + 0.5) / project.plan.length * 100) + '%' }} /></div>
      <ol className="esp-phases">{project.plan.map((e, i) => <li key={e.id} className={i < phase ? 'done' : i === phase ? 'now' : ''}>
        <span className="esp-step" aria-hidden="true">{i < phase ? '✓' : i + 1}</span>
        <span><strong>{e.titre}</strong>{e.periode && <span className="esp-muted"> · {e.periode}</span>}{i === phase && <span className="esp-muted"> · en cours</span>}</span>
      </li>)}</ol>
    </section>}

    <details className="esp-card esp-details">
      <summary>Comment on travaille ensemble</summary>
      <p>Tu apportes ton expertise, tes contenus et tes validations. {first} construit l’outil, le teste et te forme pour le prendre en main.</p>
      <p>Entre deux visios, coche tes actions et note tes questions dans l’onglet Visios : on les traite au rendez-vous suivant.</p>
    </details>
  </>
}

function ActionCheck({ a, busy, send }) {
  return <li><label>
    <input type="checkbox" checked={a.fait} disabled={busy} onChange={() => send({ actionId: a.id, fait: !a.fait }, a.fait ? 'Action remise à faire.' : 'Bravo, c’est noté.')} />
    <span><strong className={a.fait ? 'esp-done' : ''}>{a.label}</strong>{a.detail && !a.fait && <span className="esp-muted esp-sub">{a.detail}</span>}</span>
  </label></li>
}

function Brief({ project, busy, send }) {
  const [brief, setBrief] = useState(() => Object.fromEntries(project.brief.map(b => [b.id, b.r || ''])))
  useEffect(() => { setBrief(Object.fromEntries(project.brief.map(b => [b.id, b.r || '']))) }, [project.id])
  const [open, setOpen] = useState(false)
  const reste = project.brief.filter(b => !String(b.r || '').trim()).length
  return <section className="esp-card esp-start">
    <span className="esp-tag">Pour démarrer</span>
    <h2>Quelques questions sur ton projet</h2>
    <p className="esp-muted">{reste} question{reste > 1 ? 's' : ''} sans réponse. Quelques phrases suffisent, tu pourras compléter plus tard.</p>
    {!open ? <button className="esp-primary" onClick={() => setOpen(true)}>Répondre</button> : <>
      <div className="esp-form">{project.brief.map(b => <label key={b.id} className="esp-field">{b.q}
        <textarea rows={3} value={brief[b.id] || ''} onChange={e => setBrief(x => ({ ...x, [b.id]: e.target.value }))} /></label>)}</div>
      <div className="esp-row">
        <button className="esp-primary" disabled={busy} onClick={() => send({ op: 'brief', reponses: brief }, 'Réponses enregistrées.').then(ok => ok && setOpen(false))}>Enregistrer mes réponses</button>
        <button className="esp-link" onClick={() => setOpen(false)}>Plus tard</button>
      </div>
    </>}
  </section>
}

// ---------- Mes actions ----------
function Actions({ project, first, busy, send }) {
  const todo = project.actions.filter(a => a.pour === 'client' && !a.fait)
  const fait = project.actions.filter(a => a.pour === 'client' && a.fait)
  const amely = project.actions.filter(a => a.pour !== 'client')
  return <>
    <section className="esp-card">
      <h2>À faire de ton côté</h2>
      <p className="esp-muted">Coche dès que c’est fait : {first} le voit tout de suite.</p>
      {todo.length === 0 ? <p className="esp-muted">Tout est fait. Bravo.</p> :
        <ul className="esp-checks">{todo.map(a => <ActionCheck key={a.id} a={a} busy={busy} send={send} />)}</ul>}
      {fait.length > 0 && <details className="esp-details-in"><summary>Déjà fait ({fait.length})</summary>
        <ul className="esp-checks">{fait.map(a => <ActionCheck key={a.id} a={a} busy={busy} send={send} />)}</ul></details>}
    </section>
    {amely.length > 0 && <section className="esp-card">
      <h2>Du côté de {first}</h2>
      <ul className="esp-list">{amely.map(a => <li key={a.id}><span className={'esp-tag ' + (a.fait ? 'ok' : '')}>{a.fait ? 'Fait' : 'En cours'}</span><span className={a.fait ? 'esp-done' : ''}>{a.label}</span></li>)}</ul>
    </section>}
    {project.type === 'formation' && <Lecons project={project} first={first} busy={busy} send={send} />}
  </>
}

const emptyLecon = { titre: '', objectif: '', points: '', video: '' }
function Lecons({ project, first, busy, send }) {
  const [edit, setEdit] = useState(null)
  const save = statut => send({ op: 'lecon', lecon: { ...edit, statut } }, statut === 'a_valider' ? 'Leçon envoyée à ' + first + '.' : 'Brouillon enregistré.').then(ok => ok && setEdit(null))
  return <section className="esp-card">
    <div className="esp-between"><h2>Mes leçons</h2>{!edit && <button className="esp-primary" onClick={() => setEdit({ ...emptyLecon })}>Nouvelle leçon</button>}</div>
    {edit && <div className="esp-form esp-edit">
      <label className="esp-field">Titre de la leçon<input value={edit.titre} onChange={e => setEdit({ ...edit, titre: e.target.value })} /></label>
      <label className="esp-field">Ce que le parent apprendra<textarea rows={2} value={edit.objectif} onChange={e => setEdit({ ...edit, objectif: e.target.value })} /></label>
      <label className="esp-field">Les points que tu veux montrer<textarea rows={5} value={edit.points} onChange={e => setEdit({ ...edit, points: e.target.value })} /></label>
      <label className="esp-field">Lien de la vidéo, si elle est prête<input placeholder="https://…" value={edit.video} onChange={e => setEdit({ ...edit, video: e.target.value })} /></label>
      <div className="esp-row">
        <button className="esp-primary" disabled={busy || !edit.titre.trim()} onClick={() => save('a_valider')}>Envoyer à {first}</button>
        <button className="esp-secondary" disabled={busy || !edit.titre.trim()} onClick={() => save('brouillon')}>Garder en brouillon</button>
        <button className="esp-link" onClick={() => setEdit(null)}>Annuler</button>
      </div>
    </div>}
    {project.lecons.length === 0 && !edit ? <p className="esp-muted">Commence par une seule leçon pilote : un titre, ce que le parent apprendra et les points à montrer.</p> :
      <ul className="esp-list">{project.lecons.map(l => <li key={l.id} className="esp-lecon">
        <div className="esp-between"><strong>{l.titre}</strong><span className={'esp-tag ' + LECON_LABEL[l.statut][1]}>{LECON_LABEL[l.statut][0]}</span></div>
        {l.objectif && <span className="esp-muted">{l.objectif}</span>}
        {l.retour && <p className="esp-note"><strong>Retour de {first} :</strong> {l.retour}</p>}
        <div className="esp-row">
          {l.video && <a href={l.video} target="_blank" rel="noopener noreferrer">Voir la vidéo</a>}
          {l.statut !== 'validee' && <button className="esp-link" onClick={() => setEdit({ id: l.id, titre: l.titre, objectif: l.objectif, points: l.points, video: l.video })}>Modifier</button>}
        </div>
      </li>)}</ul>}
  </section>
}

// ---------- Visios et questions ----------
function Visios({ project, first, busy, send }) {
  const [texte, setTexte] = useState('')
  const visio = nextVisio(project)
  const libres = project.creneaux.filter(c => !c.reserve && isFuture(c.date)).sort((a, b) => a.date.localeCompare(b.date))
  const questions = project.questions.slice().reverse()
  const ouvertes = questions.filter(q => !q.traitee)
  const traitees = questions.filter(q => q.traitee)
  return <>
    <section className="esp-card">
      <h2>Prochaine visio</h2>
      {visio ? <>
        <p className="esp-big">{cap(formatRdv(visio.date))}</p>
        <div className="esp-row">
          {visio.lien && <a className="esp-primary" href={visio.lien} target="_blank" rel="noopener noreferrer">Rejoindre la visio</a>}
          {visio.id && <button className="esp-link" disabled={busy} onClick={() => send({ op: 'creneau', creneauId: visio.id, reserve: false }, 'Créneau libéré. Choisis-en un autre.')}>Changer de créneau</button>}
        </div>
      </> : libres.length > 0 ? <>
        <p className="esp-muted">Choisis le créneau qui t’arrange.</p>
        <div className="esp-chips">{libres.map(c => <button key={c.id} disabled={busy} onClick={() => send({ op: 'creneau', creneauId: c.id }, 'Visio réservée.')}>{shortRdv(c.date)}</button>)}</div>
      </> : <p className="esp-muted">Pas encore de date. {first} te propose des créneaux ici très vite.</p>}
    </section>

    <section className="esp-card">
      <h2>Mes questions pour la prochaine visio</h2>
      <label className="esp-field">Ta question<textarea rows={3} value={texte} onChange={e => setTexte(e.target.value)} /></label>
      <button className="esp-primary" disabled={busy || !texte.trim()} onClick={() => send({ op: 'question', texte }, 'Question ajoutée.').then(ok => ok && setTexte(''))}>Ajouter</button>
      {ouvertes.length > 0 && <ul className="esp-list">{ouvertes.map(q => <li key={q.id} className="esp-q"><span className="esp-muted">{q.date ? formatDate(q.date) : ''}</span><span>{q.texte}</span></li>)}</ul>}
      {traitees.length > 0 && <details className="esp-details-in"><summary>Questions traitées ({traitees.length})</summary>
        <ul className="esp-list">{traitees.map(q => <li key={q.id} className="esp-q"><span>{q.texte}</span>{q.reponse && <p className="esp-note"><strong>{first} :</strong> {q.reponse}</p>}</li>)}</ul></details>}
    </section>

    {project.notes.length > 0 && <section className="esp-card">
      <h2>Comptes rendus</h2>
      {project.notes.map((n, i) => <details key={n.id} className="esp-details-in" open={i === 0}>
        <summary>{n.titre || 'Compte rendu'}{n.date ? ' · ' + formatDate(n.date) : ''}</summary>
        <div className="esp-pre">{n.texte}</div>
      </details>)}
    </section>}
  </>
}

// ---------- Documents et paiements ----------
const ibanFmt = v => String(v || '').replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()

function AcceptDevis({ devis, send, busy, onRead }) {
  const [nom, setNom] = useState('')
  const [ok, setOk] = useState(false)
  const remises = (devis.lignes || []).filter(l => (l.prixCents || 0) < 0)
  const brut = (devis.lignes || []).filter(l => (l.prixCents || 0) >= 0).reduce((s, l) => s + Math.round((Number(l.quantite) || 0) * l.prixCents), 0)
  return <section className="esp-card esp-accept">
    <div className="esp-between"><span className="esp-tag warn">À accepter</span>{devis.validite && <span className="esp-muted">valable jusqu’au {formatDate(devis.validite)}</span>}</div>
    <h2>Devis {devis.numero}</h2>
    <dl className="esp-sum">
      {remises.length > 0 && <><dt>Prix</dt><dd>{money(brut)}</dd>
        {remises.map((l, i) => <React.Fragment key={i}><dt>{l.description || 'Remise'}</dt><dd>{money(Math.round((Number(l.quantite) || 0) * l.prixCents))}</dd></React.Fragment>)}</>}
      <dt className="esp-total">Total HT</dt><dd className="esp-total">{money(devisBase(devis))}</dd>
    </dl>
    <button className="esp-link" onClick={onRead}>Lire le devis complet</button>
    <label className="esp-field">Ton nom et prénom<input value={nom} onChange={e => setNom(e.target.value)} autoComplete="name" /></label>
    <label className="esp-check"><input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} /> J’ai lu le devis et j’en accepte les prestations, les prix et l’échéancier.</label>
    <button className="esp-primary esp-wide" disabled={busy || !ok || nom.trim().length < 2} onClick={() => send({ op: 'accepter_devis', devisId: devis.id, nom: nom.trim(), accepte: true }, 'Devis accepté. Merci !')}>J’accepte le devis</button>
    {(!ok || nom.trim().length < 2) && <p className="esp-muted esp-hint">Indique ton nom et coche la case pour accepter.</p>}
  </section>
}

function PayAcompte({ devis, next: first, emetteur }) {
  return <section className="esp-card esp-paid">
    <span className="esp-tag ok">Accepté{devis.signeLe ? ' le ' + formatDate(devis.signeLe) : ''}</span>
    <h2>Prochain paiement</h2>
    {first && <p><strong>{money(first.montantCents)} HT</strong> · {first.label}. Tu reçois la facture par email.</p>}
    {emetteur?.iban && <dl className="esp-sum esp-pay"><dt>Virement</dt><dd>{ibanFmt(emetteur.iban)}</dd><dt>Bénéficiaire</dt><dd>{emetteur.nom}</dd><dt>Référence</dt><dd>{devis.numero}</dd></dl>}
    {devis.lienPaiement && <a className="esp-primary" href={devis.lienPaiement} target="_blank" rel="noopener noreferrer">Payer par carte</a>}
  </section>
}

function Documents({ view, project, send, busy }) {
  const printDevis = d => printDocument({ kind: 'devis', numero: d.numero, date: d.date, validite: d.validite, regime: d.regime, irpf: 0,
    lignes: d.lignes, intro: d.intro, perimetre: d.perimetre, note: d.note, outils: d.outils, echeances: d.echeances, client: view.client, emetteur: view.emetteur })
  const aSigner = view.devis.filter(d => d.statut === 'envoye')
  const signes = view.devis.filter(d => d.statut === 'signe')
  const payee = label => view.echeancier.some(e => e.statut === 'payee' && e.label === label)
  const aPayer = signes.filter(d => d.signePar).map(d => ({ d, next: [...(d.echeances || [])].sort((a, b) => (a.date || '').localeCompare(b.date || '')).find(e => !payee(e.label)) })).find(x => x.next)
  const total = view.echeancier.reduce((s, e) => s + (e.montantCents || 0), 0)
  return <>
    {aSigner.map(d => <AcceptDevis key={d.id} devis={d} send={send} busy={busy} onRead={() => printDevis(d)} />)}
    {aPayer && <PayAcompte devis={aPayer.d} next={aPayer.next} emetteur={view.emetteur} />}

    {view.echeancier.length > 0 && <section className="esp-card">
      <h2>Échéancier{view.projets.length > 1 ? ' · tous tes projets' : ''}</h2>
      <ul className="esp-rows">{view.echeancier.map((e, i) => <li key={i}>
        <span>{e.label}</span><span className="esp-muted">{e.date ? formatDate(e.date) : ''}</span>
        <span className={'esp-tag ' + (e.statut === 'payee' ? 'ok' : e.statut === 'facturee' ? 'warn' : '')}>{e.statut === 'payee' ? 'Réglé' : e.statut === 'facturee' ? 'À régler' : 'À venir'}</span>
        <strong>{money(e.montantCents)}</strong></li>)}
        <li className="esp-rows-total"><strong>Total</strong><span /><span /><strong>{money(total)}</strong></li>
      </ul>
    </section>}

    <section className="esp-card">
      <h2>Mes factures</h2>
      {view.factures.length === 0 ? <p className="esp-muted">Aucune facture pour l’instant.</p> :
        <ul className="esp-rows">{view.factures.map((f, i) => <li key={i}>
          <strong>{f.reference}</strong><span className="esp-muted">{formatDate(f.date)}</span>
          <span className={'esp-tag ' + (f.payment === 'paid' ? 'ok' : 'warn')}>{f.payment === 'paid' ? 'Réglée' : 'À régler'}</span>
          <strong>{money(f.amountCents)}</strong></li>)}</ul>}
    </section>

    {signes.length > 0 && <section className="esp-card">
      <h2>Devis acceptés</h2>
      <ul className="esp-rows">{signes.map(d => <li key={d.id}>
        <strong>{d.numero}</strong><span className="esp-muted">{d.signeLe ? 'accepté le ' + formatDate(d.signeLe) : ''}</span>
        <span>{money(devisBase(d))} HT</span><button className="esp-link" onClick={() => printDevis(d)}>Voir</button></li>)}</ul>
    </section>}

    {project && project.documents.length > 0 && <section className="esp-card">
      <h2>Documents partagés</h2>
      <ul className="esp-list">{project.documents.map((d, i) => <li key={i}><a href={d.url} target="_blank" rel="noopener noreferrer">{d.label}</a></li>)}</ul>
    </section>}
  </>
}
