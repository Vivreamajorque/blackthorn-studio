import React, { useState } from 'react'
import { attachmentUrl, uploadFile } from '../lib/gestoria-files.mjs'
import { formatDate } from '../lib/gestoria-calendar.mjs'

const types = {
  supporting: 'Pièce à vérifier',
  filed: 'Justificatif de dépôt',
  draft: 'Brouillon',
  certificate: 'Certificat',
}

export default function GestoriaArchives({ record, canSave, onAdd }) {
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [pendingFile, setPendingFile] = useState(null)
  const archives = record.archives || []
  const linked = Object.entries(record.filingDetails || {}).flatMap(([key, detail]) => {
    if (!detail.attachment || archives.some(item => item.attachment.id === detail.attachment.id)) return []
    return [{
      id: key, label: key.endsWith(':RETA') ? 'Pièce de cotisation' : 'Modelo ' + key.split(':')[1],
      type: record.filings[key] === 'filed' ? 'filed' : 'supporting',
      date: detail.filedDate, reference: detail.reference, attachment: detail.attachment,
      quarter: /^T[1-4]:/.test(key) ? Number(key[1]) : undefined,
    }]
  })
  const documents = [...archives, ...linked].sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  async function archive(event) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    const file = form.elements.file.files[0]
    const label = fields.get('label').trim()
    if (!label) {
      setFeedback('Indique un nom pour retrouver cette pièce.')
      return
    }
    setBusy(true)
    setFeedback('')
    try {
      const staged = pendingFile?.file === file ? pendingFile : {
        file, id: crypto.randomUUID(), attachment: await uploadFile(file),
      }
      setPendingFile(staged)
      const item = { id: staged.id, label, type: fields.get('type'), attachment: staged.attachment }
      for (const key of ['model', 'date', 'reference']) {
        const value = fields.get(key).trim()
        if (value) item[key] = value
      }
      if (fields.get('quarter')) item.quarter = Number(fields.get('quarter'))
      if (await onAdd(item)) {
        form.reset()
        setPendingFile(null)
        setFeedback('Pièce archivée.')
      } else setFeedback('La pièce reste à archiver. Réessaie après avoir vérifié le message de sauvegarde.')
    } catch (error) {
      setFeedback(error.message || 'La pièce n’a pas pu être ajoutée.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="mg-dashboard">
    <section className="mg-panel">
      <h2>Mes pièces fiscales</h2>
      <p className="mg-muted">Un justificatif de dépôt permet de vérifier la déclaration. Un aperçu du formulaire reste un brouillon.</p>
      {!documents.length && <p>Aucune pièce archivée pour cet exercice.</p>}
      {documents.map(item => <div className="mg-work-row" key={item.id}>
        <div><strong>{item.label}</strong>
          <p className="mg-muted">{[types[item.type], item.quarter && 'T' + item.quarter,
            item.date && formatDate(item.date), item.reference && 'Réf. ' + item.reference].filter(Boolean).join(' · ')}</p>
        </div>
        <a href={attachmentUrl(item.attachment)} target="_blank" rel="noreferrer">Ouvrir la pièce ↗</a>
      </div>)}
    </section>
    <section className="mg-panel">
      <h2>Ajouter une pièce</h2>
      <p className="mg-muted">Pour ajouter un document à une ligne de déclaration et renseigner le montant déclaré, ouvre aussi l’onglet Démarches.</p>
      {archives.length >= 100 ? <p>Les archives de cet exercice ont atteint la limite de 100 pièces.</p> : <form onSubmit={archive}>
        <fieldset className="mg-archive-fields" disabled={!canSave || busy}>
          <label>Nom de la pièce <input name="label" required maxLength={160} placeholder="Ex. Modelo 130 · Justificatif T3" /></label>
          <label>Type de pièce <select name="type">
            {Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label>Modelo <input name="model" inputMode="numeric" pattern="[0-9]{3}" maxLength={3} placeholder="Ex. 130" /></label>
          <label>Trimestre <select name="quarter"><option value="">Non renseigné</option>
            {[1, 2, 3, 4].map(value => <option key={value} value={value}>T{value}</option>)}</select></label>
          <label>Date du document <input name="date" type="date" /></label>
          <label>Numéro de justificatif <input name="reference" maxLength={120} /></label>
          <label>Pièce jointe · 3 Mo max <input name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={() => setPendingFile(null)} /></label>
          <button type="submit">{busy ? 'Archivage…' : 'Archiver la pièce'}</button>
        </fieldset>
      </form>}
      {feedback && <p role="status">{feedback}</p>}
    </section>
  </div>
}
