import React from 'react'
const money = value => new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(value/100)
export default function GestoriaSocialReview({ review, onOpen, entity }) {
  if (!review) return null
  return <section className="mg-panel" style={{marginBottom:20}}>
    <p className="mg-section-label">MON DOSSIER IMPORTASS · MIS À JOUR LE {review.date.split('-').reverse().join('/')}</p>
    <h2>Sécurité sociale : où j’en suis</h2>
    <p className="mg-muted">Synthèse des documents et écrans transmis. Le solde officiel reste à recontrôler ; aucune démarche n’a été envoyée à la TGSS.</p>
    <div className="mg-calendar-summary"><article><span>Prochain prélèvement courant annoncé</span><strong>Janvier 2027</strong><small>Paiement trimestriel actif selon Importass</small></article>
      <article><span>Budget indicatif octobre–décembre</span><strong>{money(review.quarterBudgetCents)}</strong><small>3 × 165,74 € si la cotisation ne change pas. Montant non encore émis ; hors anciennes dettes et Hacienda.</small></article>
      <article><span>Dernier relevé de dette communiqué</span><strong>{money(review.lastDebtCents)}</strong><small>Solde actuel non confirmé · dont 358,21 € pour janvier à expliquer</small></article></div>
    <p className="mg-card-note"><strong>Compte finissant par 9580 : changement souhaité, non effectué.</strong> Tu as indiqué qu’il n’avait pas les fonds nécessaires au départ. Rien n’a été modifié dans Importass.</p>
    <p><strong>Échelonnement souhaité : 100 €/mois</strong> en plus des cotisations courantes. Aucune demande ni acceptation TGSS confirmée.</p>
    <details className="mg-more"><summary>Historique, preuves et questions à régler</summary><div className="mg-more-body">
      {review.sections.map(section => <section key={section.title} style={{marginBottom:24}}><h3>{section.title}</h3>{section.items.map(item => <article key={item.label} style={{borderTop:'1px solid var(--mg-line)',padding:'14px 0'}}>
        <span className={'mg-tag ' + (item.status === 'confirmed' ? 'calm' : 'warning')}>{item.status === 'confirmed' ? 'Confirmé par une pièce ou un écran' : item.status === 'reported' ? 'Déclaré · à rapprocher' : 'À clarifier'}</span>
        <h4 style={{margin:'10px 0 5px'}}>{item.label}</h4><p style={{lineHeight:1.65,margin:0}}>{item.detail}</p>
      </article>)}</section>)}
      <button type="button" onClick={() => onOpen(entity,'archives')}>Ouvrir les justificatifs →</button>
    </div></details>
  </section>
}
