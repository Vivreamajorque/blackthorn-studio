import React, { useState } from 'react'
import { attachmentUrl, uploadFile } from '../lib/gestoria-files.mjs'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const boxes = ['07', '13', '15', '16', '19']
const asEuros = cents => cents == null ? '' : String(cents / 100)
const asCents = value => Math.round(Number(value) * 100)

export default function GestoriaFilingDetails({ row, canSave, onSave, declaredBoxes }) {
  const [reference, setReference] = useState(row.evidence?.reference || '')
  const [amount, setAmount] = useState(asEuros(row.evidence?.amountCents))
  const [filedDate, setFiledDate] = useState(row.evidence?.filedDate || '')
  const [paid, setPaid] = useState(row.evidence?.paid === true)
  const [filed, setFiled] = useState(row.status === 'filed')
  const [attachment, setAttachment] = useState(row.evidence?.attachment)
  const [file, setFile] = useState()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [recordBoxes, setRecordBoxes] = useState(Boolean(declaredBoxes))
  const [values, setValues] = useState(() => Object.fromEntries(boxes.map(box => [box, asEuros(declaredBoxes?.['box' + box])])))
  const is130 = row.model === '130'

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const details = { reference: reference.trim(), ...(filedDate && { filedDate }),
        ...(amount !== '' && (!is130 || !recordBoxes) && { amountCents: asCents(amount) }),
        ...(paid && { paid: true }),
      }
      const recorded = is130 && recordBoxes ? Object.fromEntries(boxes.filter(box => values[box] !== '')
        .map(box => ['box' + box, asCents(values[box])])) : undefined
      if (recorded) details.amountCents = recorded.box19
      if (file) {
        details.attachment = await uploadFile(file)
        setAttachment(details.attachment)
        setFile(undefined)
      } else if (attachment) details.attachment = attachment
      await onSave(row.key, details, filed, recorded)
    } catch (failure) {
      setError(failure.message || 'Le justificatif n’a pas pu être enregistré.')
    } finally {
      setBusy(false)
    }
  }
  return <details className="mg-filing-evidence">
    <summary>{row.evidence?.attachment || row.evidence?.reference ? 'Déclaration ou justificatif enregistré' : 'Ajouter une déclaration ou un justificatif'}
      {row.evidence?.amountCents != null && ' · ' + euro.format(row.evidence.amountCents / 100)}</summary>
    <form className="mg-filing-form" onSubmit={submit}>
      {row.model === 'RETA' ? <>
        <label><input type="checkbox" checked={filed} onChange={e => setFiled(e.target.checked)} /> Cotisation prélevée ou payée</label>
        <label>Date du paiement <input type="date" value={filedDate} onChange={e => setFiledDate(e.target.value)} /></label>
      </> : <>
        <label><input type="checkbox" checked={filed} onChange={e => setFiled(e.target.checked)} /> Déclaration déposée auprès de Hacienda</label>
        <label>Date de dépôt <input type="date" value={filedDate} onChange={e => setFiledDate(e.target.value)} /></label>
      </>}
      <label>Référence du reçu <input maxLength={120} value={reference} onChange={e => setReference(e.target.value)} /></label>
      {(!is130 || !recordBoxes) && <label>{row.model === 'RETA' ? 'Montant prélevé en €' : 'Solde déclaré en €'}
        <input type="number" step="0.01" min="-100000000" max="100000000" value={amount} onChange={e => setAmount(e.target.value)} />
      </label>}
      {is130 && <label><input type="checkbox" checked={recordBoxes} onChange={e => {
        setRecordBoxes(e.target.checked)
        if (e.target.checked) setFiled(true)
      }} /> Reprendre les cases du 130 déposé pour le prochain calcul</label>}
      {is130 && recordBoxes && <fieldset className="mg-tax-settings">
        <legend>Cases à recopier du PDF déposé</legend>
        <p className="mg-muted">Inscris 0 si une case obligatoire est vide sur le PDF.</p>
        {boxes.map(box => <label key={box}>Case [{box}]{box === '13' && ' · réduction, facultative'}
          <input type="number" required={box !== '13'} step="0.01" max="100000000"
            min={['13', '15', '16'].includes(box) ? 0 : -100000000} value={values[box]}
            onChange={e => setValues({ ...values, [box]: e.target.value })} />
        </label>)}
      </fieldset>}
      {row.model !== 'RETA' && <label><input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)} /> Paiement confirmé</label>}
      <label>PDF déposé, reçu ou photo · 3 Mo max
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={busy} onChange={e => setFile(e.target.files?.[0])} />
      </label>
      {attachment && <a href={attachmentUrl(attachment)} target="_blank" rel="noopener noreferrer">{attachment.name} ↗</a>}
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={!canSave || busy || (recordBoxes && !filed)}>{busy ? 'Enregistrement…' : 'Enregistrer dans Mi Gestoría'}</button>
    </form>
  </details>
}
