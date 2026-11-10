import React, { useEffect, useRef, useState } from 'react'
import './tony-gestoria.css'

const years = ['2025', '2026', '2027']
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date())
const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' })
const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const fileTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
const format = amount => amount == null ? 'Indisponible' : money.format(amount / 100)

async function call(action, fields = {}) {
  const response = await fetch('/api/gestoria-link', { method: 'POST', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...fields }) })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(result.error || 'La liaison Mi Gestoría est indisponible.'), { status: response.status })
  return result
}

function readReceipt(file, allowCsv = false) {
  if (!file) return undefined
  const mime = allowCsv && /\.csv$/i.test(file.name) ? 'text/csv' : file.type
  if ((!fileTypes.includes(mime) && !(allowCsv && mime === 'text/csv')) || file.size > 3 * 1024 * 1024) throw new Error('Choisis un PDF, JPEG, PNG ou WebP' + (allowCsv ? ' ou CSV' : '') + ' de 3 Mo maximum.')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Le justificatif n’a pas pu être lu.'))
    reader.onload = () => resolve({ name: file.name, mime, base64: String(reader.result).split(',')[1] })
    reader.readAsDataURL(file)
  })
}

export default function TonyGestoria({ onBack }) {
  const [year, setYear] = useState(() => years.includes(today().slice(0, 4)) ? today().slice(0, 4) : years.at(-1))
  const [report, setReport] = useState(null)
  const [access, setAccess] = useState('loading')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [documents, setDocuments] = useState([])
  const [draft, setDraft] = useState(null)
  const [revision, refresh] = useState(0)
  const inFlight = useRef(false)

  useEffect(() => {
    let active = true
    let pending = false
    async function load() {
      if (pending) return
      pending = true
      try {
        const result = await call('load', { year })
        if (!active) return
        setReport({ year, months: result.months })
        setAccess('ready')
      } catch (error) {
        if (active) setAccess(error.status === 401 ? 'activate' : 'error')
      } finally {
        pending = false
      }
    }
    load()
    const reloadOnFocus = () => { if (!document.hidden) load() }
    window.addEventListener('focus', reloadOnFocus)
    const timer = window.setInterval(reloadOnFocus, 60000)
    return () => {
      active = false
      window.removeEventListener('focus', reloadOnFocus)
      window.clearInterval(timer)
    }
  }, [year, revision])

  async function submit(event, action) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setFeedback(null)
    try {
      if (action === 'activate') {
        await call('activate', { code: code.trim() })
        setCode('')
      } else {
        await call('expense', { expense: { id: draft.id, label: draft.label.trim(), date: draft.date,
          amountCents: Math.round(Number(draft.amount) * 100), paymentDate: draft.paid ? draft.paymentDate : '',
          file: await readReceipt(draft.file) } })
        setYear(draft.date.slice(0, 4))
        setDraft(null)
        setFeedback({ text: 'Charge enregistrée dans Mi Gestoría.' })
      }
      refresh(value => value + 1)
    } catch (error) {
      setFeedback({ error: true, text: error.message })
      if (action === 'expense' && error.status === 401) setAccess('activate')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  async function uploadBatch(event) {
    event.preventDefault()
    if (inFlight.current || !documents.length) return
    inFlight.current = true
    setBusy(true)
    const failed = []
    let accepted = 0
    let duplicates = 0
    let firstError = ''
    try {
      for (const file of documents) {
        setFeedback({ text: 'Dépôt ' + (accepted + duplicates + failed.length + 1) + ' / ' + documents.length + '…' })
        try {
          const result = await call('inbox', { file: await readReceipt(file, true) })
          if (result.duplicate) duplicates++
          else accepted++
        } catch (error) {
          failed.push(file)
          firstError ||= error.message
          if (error.status === 401) setAccess('activate')
        }
      }
      setDocuments(failed)
      setFeedback({ error: failed.length > 0, text: [
        accepted + ' pièce(s) envoyée(s) à Mi Gestoría', duplicates && duplicates + ' doublon(s)',
        failed.length && failed.length + ' à réessayer · ' + firstError,
      ].filter(Boolean).join(' · ') })
    } finally {
      setBusy(false)
      inFlight.current = false
    }
  }

  return <section className="bt-gestoria">
    <header><div><p>BLACKTHORN TATTOO</p><h1>Ventes &amp; charges</h1></div>
      <button type="button" className="btn btn-ghost" onClick={onBack}>← Retour</button></header>
    <p className="bt-gestoria-muted">Ventes encaissées du Hub et charges enregistrées dans Mi Gestoría.</p>
    {access === 'loading' && <p role="status">Chargement du suivi…</p>}
    {access === 'activate' && <form className="card bt-gestoria-form" onSubmit={event => submit(event, 'activate')}>
      <h2>Activer Mi Gestoría</h2>
      <p>Amely peut créer ton code dans son dossier Blackthorn. Il suffit de le saisir ici une fois sur ce navigateur.</p>
      <label>Code d’accès <input type="password" autoComplete="off" required value={code} onChange={event => setCode(event.target.value)} /></label>
      <button className="btn btn-primary" disabled={busy || !code.trim()}>Activer mon accès</button>
    </form>}
    {access === 'error' && <p role="alert">Le suivi est indisponible. <button type="button" className="btn btn-ghost" onClick={() => refresh(value => value + 1)}>Réessayer</button></p>}
    {feedback && <p role={feedback.error ? 'alert' : 'status'} className="bt-gestoria-feedback">{feedback.text}</p>}
    {access === 'ready' && <>
      <div className="bt-gestoria-controls">
        <label>Année <select value={year} onChange={event => setYear(event.target.value)}>
          {years.map(value => <option key={value}>{value}</option>)}
        </select></label>
        <button type="button" className="btn btn-primary" onClick={() => setDraft({
          id: crypto.randomUUID(), label: '', date: today(), amount: '', paid: false, paymentDate: '',
        })}>Ajouter une charge</button>
      </div>
      <form className="card bt-gestoria-form" onSubmit={uploadBatch} onDragOver={e => e.preventDefault()} onDrop={e => {
        e.preventDefault()
        if (!busy) setDocuments(Array.from(e.dataTransfer.files))
      }}>
        <h2>Déposer mes justificatifs</h2>
        <p>Glisse tes factures, tickets ou relevés. Ils arrivent dans la boîte de réception Blackthorn de Mi Gestoría.</p>
        <label>Fichiers <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.csv" disabled={busy}
          onChange={e => { setDocuments(Array.from(e.target.files)); e.target.value = '' }} /></label>
        <p className="bt-gestoria-muted">PDF, photos et CSV · 3 Mo par fichier</p>
        {documents.length > 0 && <ul>{documents.map((file, i) => <li key={i}>{file.name}</li>)}</ul>}
        <button className="btn btn-primary" disabled={busy || !documents.length}>{busy ? 'En cours…' : 'Envoyer ' + documents.length + ' pièce(s)'}</button>
      </form>
      {draft && <form className="card bt-gestoria-form" onSubmit={event => submit(event, 'expense')}>
        <h2>Nouvelle charge</h2>
        <label>Fournisseur ou libellé <input required maxLength={160} value={draft.label}
          onChange={event => setDraft({ ...draft, label: event.target.value })} /></label>
        <label>Montant TTC en € <input type="number" inputMode="decimal" required min=".01" max="100000000" step=".01" value={draft.amount}
          onChange={event => setDraft({ ...draft, amount: event.target.value })} /></label>
        <label>Date de la dépense <input type="date" required min="2025-01-01" max="2027-12-31" value={draft.date}
          onChange={event => setDraft({ ...draft, date: event.target.value })} /></label>
        <label className="bt-gestoria-check"><input type="checkbox" checked={draft.paid} onChange={event => setDraft({ ...draft, paid: event.target.checked })} /> Payée</label>
        {draft.paid && <label>Date de paiement <input type="date" required max={today()} value={draft.paymentDate}
          onChange={event => setDraft({ ...draft, paymentDate: event.target.value })} /></label>}
        <label>Ticket ou facture, facultatif <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={event => setDraft({ ...draft, file: event.target.files?.[0] })} /></label>
        <div className="bt-gestoria-controls">
          <button className="btn btn-primary" disabled={busy || !draft.label.trim()}>{busy ? 'Enregistrement…' : 'Enregistrer la charge'}</button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setDraft(null)}>Annuler</button>
        </div>
      </form>}
      {report?.year !== year ? <p role="status">Chargement de l’année…</p> :
        <div className="card bt-gestoria-table"><table>
          <thead><tr><th scope="col">Mois</th><th scope="col">Ventes encaissées</th><th scope="col">Charges saisies</th></tr></thead>
          <tbody>{report.months.map(row => <tr key={row.month}>
            <th scope="row">{monthName.format(new Date(row.month + '-01T00:00:00Z'))}</th>
            <td>{format(row.salesCents)}</td><td>{format(row.expensesCents)}</td>
          </tr>)}</tbody>
        </table></div>}
    </>}
  </section>
}
