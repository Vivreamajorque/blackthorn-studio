import React, { useState } from 'react'
import { debtUrl, models } from '../lib/gestoria-models.mjs'
import { formatDate } from '../lib/gestoria-calendar.mjs'
import { portalRowsForYear } from '../lib/gestoria-portal.mjs'

const tax = 'https://sede.agenciatributaria.gob.es/Sede'
const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const dateTime = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' })
const sources = {
  filings: { title: 'Déclarations déposées', portal: 'Hacienda', url: tax + '/mi-area-personal.html',
    step: 'Dans « Mis expedientes », ouvre « Consultar declaraciones presentadas », sélectionne le Modelo et l’année, puis lance la recherche.' },
  notifications: { title: 'Notifications et courriers', portal: 'Hacienda', url: tax + '/procedimientoini/ZN01.shtml',
    step: 'Choisis « Consulta de notificaciones y comunicaciones » et lance la recherche pour afficher la liste.' },
  debts: { title: 'Dettes de cotisations', portal: 'Importass', url: debtUrl,
    step: 'Clique sur « Consultar deudas », identifie-toi et affiche la liste des dettes.' },
  receipts: { title: 'Reçus de cotisation', portal: 'Importass', url: models.RETA.url,
    step: 'Clique sur « Consultar recibos » et affiche les montants de l’année. Un reçu émis se vérifie ensuite avec le prélèvement.' },
}

function PortalRows({ rows, kind }) {
  const amount = ['debts', 'receipts'].includes(kind)
  return <div className="mg-tax-table"><table>
    <thead><tr><th scope="col">{kind === 'notifications' ? 'Objet' : 'Période'}</th>
      <th scope="col">{amount ? 'Montant' : 'Date affichée'}</th><th scope="col">Référence</th></tr></thead>
    <tbody>{rows.map((row, i) => <tr key={row.reference || row.period + ':' + i}>
      <th scope="row">{row.subject || [row.model && 'Modelo ' + row.model, row.period].filter(Boolean).join(' · ')}</th>
      <td>{amount ? money.format(row.amountCents / 100) : row.date ? formatDate(row.date) : '—'}</td>
      <td>{row.reference || '—'}{row.read === false && ' · Non lue'}</td>
    </tr>)}</tbody>
  </table></div>
}

export default function GestoriaPortals({ capture, year, dossier, canSave, onDiscard, onSave }) {
  const [view, setView] = useState('debts')
  const kind = capture?.kind || view
  const source = sources[kind]
  const saved = dossier.record.portalChecks?.[view]
  const captureRows = capture ? portalRowsForYear(capture.rows, year) : []
  return <div className="mg-portal">
    <section className="mg-panel mg-portal-intro">
      <div><p className="mg-section-label">HACIENDA ET SEGURIDAD SOCIAL</p><h2>Consulter mes portails</h2>
        <p>Retrouve un dépôt, un courrier ou un montant directement sur le site officiel. Le connecteur Chrome ramène le tableau affiché dans ton dossier privé après ta connexion.</p></div>
      <details className="mg-install">
        <summary>Installer le connecteur Chrome</summary>
        <ol>
          <li>Télécharge puis décompresse le fichier.</li>
          <li>Dans Chrome, ouvre <code>chrome://extensions</code> et active le <strong>Mode développeur</strong>.</li>
          <li>Clique sur <strong>Charger l’extension non empaquetée</strong> et sélectionne le dossier qui contient <code>manifest.json</code>.</li>
          <li>Sur le tableau du portail en espagnol, ouvre l’extension <strong>Mi Gestoría</strong> et clique sur <strong>Lire le tableau affiché</strong>.</li>
        </ol>
        <a className="mg-link-button" href="/mi-gestoria-connecteur-chrome.zip" download>Télécharger pour Chrome ↓</a>
        <p className="mg-muted">La connexion se fait sur le portail officiel avec ta méthode habituelle. La lecture se lance à ta demande et tu valides l’aperçu avant de l’enregistrer.</p>
      </details>
    </section>
    {capture && <section className="mg-panel mg-capture" aria-labelledby="mg-capture-title">
      <p className="mg-section-label">À RELIRE AVANT D’ENREGISTRER</p>
      <h2 id="mg-capture-title">{source.portal} · {source.title}</h2>
      <p>Vérifie que ces informations concernent bien <strong>{dossier.name}</strong> pour <strong>{year}</strong>. Choisis le dossier et l’exercice en haut si besoin.</p>
      {captureRows.length ? <PortalRows rows={captureRows} kind={kind} /> : <p>Aucune ligne datée de {year} dans cette lecture. Vérifie l’exercice sélectionné.</p>}
      {captureRows.length < capture.rows.length && <p className="mg-muted">Seules les lignes de l’exercice sélectionné seront enregistrées.</p>}
      <div className="mg-card-actions">
        <button type="button" className="mg-primary" disabled={!canSave || !captureRows.length} onClick={async () => {
          const ok = await onSave(kind, { capturedAt: capture.capturedAt, rows: captureRows })
          if (ok) setView(kind)
        }}>Enregistrer la lecture</button>
        <button type="button" onClick={onDiscard}>Écarter l’aperçu</button>
      </div>
    </section>}
    <div className="mg-portal-grid" aria-label="Choisir une consultation">
      {Object.entries(sources).map(([id, item]) => <button type="button" key={id}
        className="mg-portal-choice" aria-pressed={view === id} onClick={() => setView(id)}>
        <span className="mg-section-label">{item.portal}</span>
        <strong>{item.title}</strong>
        <span>{dossier.record.portalChecks?.[id] ? 'Lecture enregistrée' : 'À consulter'} <span aria-hidden="true">→</span></span>
      </button>)}
    </div>
    <section className="mg-panel">
      <p className="mg-section-label">{sources[view].portal}</p><h2>{sources[view].title}</h2>
      <p>{sources[view].step}</p>
      <a className="mg-link-button" href={sources[view].url} target="_blank" rel="noopener noreferrer">Ouvrir {sources[view].portal} ↗</a>
      {saved ? <div className="mg-portal-saved">
        <p className="mg-muted">Dernière lecture enregistrée le {dateTime.format(new Date(saved.capturedAt))}. {view === 'debts' ? 'Ce tableau reprend les lignes visibles lors de cette lecture.' : 'Les lignes déjà enregistrées restent consultables ici.'}</p>
        <PortalRows rows={saved.rows} kind={view} />
      </div> : <p className="mg-muted">Tu verras ici les résultats enregistrés pour {year}.</p>}
      {view === 'debts' && <p className="mg-muted">Les montants des dettes ouvertes sont rapprochés par référence dans Prévisions. Une ligne absente du tableau reste à vérifier.</p>}
    </section>
  </div>
}
