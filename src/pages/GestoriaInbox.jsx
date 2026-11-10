import React, { useState } from 'react'
import { inboxCategories } from '../lib/gestoria-inbox.mjs'
import { attachmentUrl, uploadFile } from '../lib/gestoria-files.mjs'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const money = value => euro.format(value / 100)
const years = [2025, 2026, 2027]
const archiveFirst = ['filing', 'statement', 'social']

function InboxReview({ item, year, disabled, onResolve }) {
  const [kind, setKind] = useState(archiveFirst.includes(item.category) || item.attachment.mime === 'text/csv' ? 'archive' : 'expense')
  const [category, setCategory] = useState(item.category)
  const amounts = [[item.totalCents, 'Total'], [item.baseCents, 'Base'], [item.vatCents, 'TVA']].filter(([amount]) => amount != null)
  const documentYear = Number(item.date?.slice(0, 4))

  function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onResolve(item.attachment.id, { kind, category, label: form.get('label').trim(),
      date: form.get('date'), reference: form.get('reference').trim(),
      amountCents: kind === 'expense' ? Math.round(Number(form.get('amount')) * 100) : undefined,
      year: kind === 'archive' ? Number(form.get('year')) : undefined })
  }

  return <details className="mg-inbox-item">
    <summary><strong>{item.attachment.name}</strong><span>{inboxCategories[item.category]}</span></summary>
    <div className="mg-inbox-body">
      <div className="mg-card-actions">
        <a href={attachmentUrl(item.attachment)} target="_blank" rel="noreferrer">Ouvrir la pièce originale ↗</a>
      </div>
      <p className="mg-muted">{item.analysis === 'text'
        ? 'Suggestions à vérifier sur la pièce. Le montant peut rester vide si le document contient plusieurs totaux.'
        : 'Classement proposé à partir du nom. Ouvre la pièce pour vérifier son contenu.'}</p>
      {amounts.length > 0 && <p className="mg-card-note">{amounts.map(([amount, label]) => label + ' ' + money(amount)).join(' · ')}</p>}
      <form onSubmit={submit}>
        <fieldset className="mg-archive-fields" disabled={disabled}>
          <label>Ranger dans <select value={kind} onChange={e => setKind(e.target.value)}>
            <option value="expense" disabled={item.attachment.mime === 'text/csv'}>Compta · nouvelle charge</option>
            <option value="archive">Archives · pièce justificative</option>
          </select></label>
          <label>Catégorie <select value={category} onChange={e => setCategory(e.target.value)}>
            {Object.entries(inboxCategories).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select></label>
          <label>Libellé <input required name="label" maxLength={160} defaultValue={item.attachment.name.replace(/\.[^.]+$/, '').slice(0, 160)} /></label>
          <label>Date de la pièce <input type="date" name="date" required={kind === 'expense'} min="2025-01-01" max="2027-12-31"
            defaultValue={years.includes(documentYear) ? item.date : ''} /></label>
          <label>Référence <input name="reference" maxLength={100} defaultValue={item.reference || ''} /></label>
          {kind === 'expense' ? <label>Total en euros <input key="amount" name="amount" type="number" step=".01" required min="-100000000" max="100000000"
            defaultValue={item.totalCents == null ? '' : item.totalCents / 100} /></label> :
            <label>Exercice des archives <select key="year" name="year" defaultValue={years.includes(documentYear) ? documentYear : year}>
              {years.map(value => <option key={value} value={value}>{value}</option>)}
            </select></label>}
          <button type="submit">{kind === 'expense' ? 'Ajouter la charge à vérifier' : 'Classer dans les archives'}</button>
        </fieldset>
      </form>
    </div>
  </details>
}

export default function GestoriaInbox({ items, year, canSave, onResolve, reload }) {
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('all')
  const [feedback, setFeedback] = useState(null)
  const [selection, setSelection] = useState([])

  async function send(files) {
    if (busy || !files.length) return
    setBusy(true)
    const failed = []
    let received = 0
    let duplicates = 0
    let failureMessage
    for (const file of files) {
      setFeedback('Dépôt ' + (received + duplicates + failed.length + 1) + ' / ' + files.length + '…')
      try {
        const result = await uploadFile(file, { inbox: true })
        if (result.duplicate) duplicates++
        else received++
      } catch (error) {
        failed.push(file)
        failureMessage ||= error.message
      }
    }
    setSelection(failed)
    setFeedback([received + ' pièce(s) reçue(s)', duplicates + ' doublon(s)',
      failed.length && failed.length + ' fichier(s) à réessayer · ' + failureMessage].filter(Boolean).join(' · '))
    setBusy(false)
    if (received || duplicates) reload()
  }

  const visible = items.filter(item => filter === 'all' || item.category === filter)
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))

  return <div className="mg-dashboard">
    <section className="mg-panel">
      <h2>Déposer des pièces pour Blackthorn</h2>
      <form onSubmit={e => { e.preventDefault(); send(selection) }}>
        <div className="mg-inbox-drop" onDragOver={e => e.preventDefault()} onDrop={e => {
          e.preventDefault()
          if (!busy && canSave) setSelection(Array.from(e.dataTransfer.files))
        }}>
          <label>Glisse tes fichiers ici ou choisis-les sur ton appareil
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.csv" disabled={!canSave || busy}
              onChange={e => { setSelection(Array.from(e.target.files)); e.target.value = '' }} />
          </label>
          <p className="mg-muted">PDF, photos et CSV · 3 Mo maximum par fichier</p>
        </div>
        <button type="submit" disabled={!canSave || busy || !selection.length}>{busy ? 'Dépôt en cours…' : 'Envoyer ' + selection.length + ' pièce(s)'}</button>
      </form>
      {feedback && <p role="status">{feedback}</p>}
    </section>
    <section className="mg-panel">
      <div className="mg-panel-heading"><h2>{items.length} pièce(s) à vérifier</h2>
        <label>Catégorie <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">Toutes</option>
          {Object.entries(inboxCategories).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></label>
      </div>
      <p className="mg-muted">Cette boîte regroupe les pièces de Tony de tous les exercices.</p>
      {!visible.length && <p>Aucune pièce dans cette sélection.</p>}
      {visible.map(item => <InboxReview key={item.attachment.id} item={item} year={year} disabled={!canSave || busy} onResolve={onResolve} />)}
    </section>
  </div>
}
