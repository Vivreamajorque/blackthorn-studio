import React, { useState } from 'react'
import { daysUntil, formatDate, todayInSpain } from '../lib/gestoria-calendar.mjs'

const box = { background: 'var(--card, #fff)', border: '1px solid var(--border, #ddd)', borderRadius: 14, padding: 16, marginBottom: 16 }
const line = { padding: '12px 0', borderTop: '1px solid var(--border, #ddd)' }
const aeat = 'https://sede.agenciatributaria.gob.es/Sede'

function countdown(date, today) {
  const days = daysUntil(date, today)
  if (days === 0) return 'Aujourd’hui'
  if (days < 0) return 'Date dépassée'
  return 'Dans ' + days + ' j'
}

export default function GestoriaGuide({ year, notices, filings, tasks, canSave, onNotices, onTasks }) {
  const [draft, setDraft] = useState(null)
  const today = todayInSpain()
  const openNotices = notices.filter(notice => !notice.done)
  const confirmed = filings.filter(item => ['missing', 'to_prepare'].includes(item.status))
    .sort((a, b) => a.date.localeCompare(b.date))
  const upcoming = filings.filter(item => !['filed', 'not_applicable'].includes(item.status) && item.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
  const nextTask = tasks.find(task => !['complete', 'not_applicable'].includes(task.status))
  const urgent = openNotices.find(notice => notice.date && notice.date <= today)
    || openNotices.find(notice => !notice.date)
    || [...openNotices].sort((a, b) => a.date.localeCompare(b.date))
      .find(notice => daysUntil(notice.date, today) <= 7)
  const priority = urgent ? (!urgent.date ? 'Vérifier le délai du courrier « ' : urgent.date < today
    ? 'Vérifier les suites possibles du courrier « ' : 'Traiter le courrier « ') + urgent.title + ' »'
    : confirmed.length ? 'Vérifier le dépôt ou préparer le ' + confirmed[0].title
      : nextTask?.title || 'Suivi à jour pour les démarches listées.'
  const sources = year === 2025
    ? 'https://sede.agenciatributaria.gob.es/static_files/Sede/Calendario_Contribuyente/Anyos_anteriores/Calendario_del_contribuyente_2025_es_es.pdf'
    : aeat + '/ayuda/calendario-contribuyente/calendario-contribuyente-2026.html'

  async function submit(event) {
    event.preventDefault()
    const saved = await onNotices([...notices.filter(notice => notice.id !== draft.id), {
      ...draft, title: draft.title.trim(),
    }])
    if (saved) setDraft(null)
  }

  return <>
    <section style={box}>
      <h2>À faire en priorité</h2>
      <p><strong>{priority}</strong></p>
      {urgent ? <p>Ouvre la notification d’origine dans ton espace Hacienda et vérifie le délai à partir des informations de notification. Enregistre ensuite la date limite dans le suivi.</p>
        : confirmed.length ? <p>Vérifie les dépôts déjà effectués et rassemble les justificatifs du trimestre concerné.</p>
          : nextTask && <p>{nextTask.detail}</p>}
      <button onClick={onTasks}>Ouvrir les démarches</button>{' '}
      {urgent && <a href={aeat + '/mi-area-personal.html'} target="_blank" rel="noopener noreferrer">Ouvrir Hacienda ↗</a>}
    </section>
    <section style={box}>
      <h2>Courriers et dates à suivre</h2>
      <p>Ajoute une date à anticiper ou le délai indiqué dans un courrier. Laisse-la vide si tu dois encore la confirmer.</p>
      {notices.length === 0 && <p>Aucune date ou courrier suivi pour ce dossier.</p>}
      {[...notices].sort((a, b) => Number(a.done) - Number(b.done) || a.date.localeCompare(b.date)).map(notice =>
        <div style={line} key={notice.id}>
          <strong>{notice.title}</strong>
          <p>{notice.done ? 'Traité' : notice.date ? formatDate(notice.date) + ' · ' + countdown(notice.date, today) : 'Date limite à vérifier'}</p>
          <button disabled={!canSave} onClick={() => setDraft(notice)}>Modifier</button>{' '}
          <button disabled={!canSave} onClick={() => onNotices(notices.map(item =>
            item.id === notice.id ? { ...item, done: !item.done } : item))}>{notice.done ? 'Rouvrir' : 'Marquer traité'}</button>
        </div>)}
      {draft ? <form onSubmit={submit} style={line}>
        <label>Intitulé <input required maxLength={140} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>{' '}
        <label>Date limite <input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label>{' '}
        <button disabled={!canSave || !draft.title.trim()}>Enregistrer</button>{' '}
        <button type="button" onClick={() => setDraft(null)}>Annuler</button>
      </form> : <button disabled={!canSave || notices.length >= 50}
        onClick={() => setDraft({ id: crypto.randomUUID(), title: '', date: '', done: false })}>Ajouter un courrier ou une date</button>}
    </section>
    <section style={box}>
      <h2>Échéances fiscales</h2>
      <p>Dates générales de dépôt pour les modèles trimestriels suivis. Le paiement par prélèvement a son propre calendrier.</p>
      {confirmed.filter(item => item.date < today).map(item => <p key={item.key}>
        <strong>{item.title}</strong> · {formatDate(item.date)} · Date passée, dépôt à vérifier
      </p>)}
      {!upcoming.length && <p>Aucune date future pour cet exercice parmi les modèles suivis.</p>}
      {upcoming.slice(0, 8).map(item => <p key={item.key}>
        <strong>{item.title}</strong> · {formatDate(item.date)} · {countdown(item.date, today)}
        {item.indicative && ' · date à confirmer'}
        {item.status === 'unknown' && ' · obligation à vérifier'}
      </p>)}
      <button onClick={onTasks}>Voir tous les trimestres</button>{' '}
      <a href={sources} target="_blank" rel="noopener noreferrer">Calendrier officiel AEAT ↗</a>
    </section>
  </>
}
