import React from 'react'
import { dataWarnings } from '../lib/finance.mjs'

export default function FinanceNotice({ sessions = [], error = '' }) {
  const count = dataWarnings(sessions).length
  return <div role={error ? 'alert' : 'note'} style={{ padding:'10px 12px', margin:'10px 0', border:'1px solid var(--border)', borderRadius:10, fontSize:11, lineHeight:1.5, color:error ? '#C0392B' : 'var(--txt2)' }}>
    {error ? `Chargement incomplet : ${error}. Les chiffres ne sont pas à jour.` : <>
      Encaissements enregistrés TTC. Dépenses saisies uniquement : pensez à ajouter le loyer, les cotisations et les frais bancaires. Provisions fiscales indicatives (IVA 21 %, IRPF 20 %), à valider avec votre gestor.
      {count > 0 && <strong style={{display:'block',color:'#D4820A'}}>{count} ancienne(s) ligne(s) présentent un écart entre « Prix » et « Solde reçu ». Les montants historiques sont conservés et restent à rapprocher des paiements.</strong>}
    </>}
  </div>
}
