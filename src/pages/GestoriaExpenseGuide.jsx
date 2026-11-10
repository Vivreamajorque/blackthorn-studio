import React, { useState } from 'react'

const general = 'https://sede.agenciatributaria.gob.es/Sede/iva/que-iva-soportado-puedo-deducir/que-requisitos-debo-cumplir-poder-iva.html'
const home = 'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c07-rendimientos-actividades-economicas-estimacion-directa/fase-1-determinacion-rendimiento-neto/gastos-fiscalmente-deducibles/servicios-exteriores/suministros.html'
const vehicle = 'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/manual-iva-2026/capitulo-05-deducciones-devoluciones/deducciones/requisitos-deduccion/iva-soportado-adq-bienes-servic-profes.html'
const rules = {
  professional: ['Dépense uniquement professionnelle', 'Potentiellement déductible si elle est liée à ton activité, justifiée et enregistrée. Pour l’IRPF, déduis la part de TVA récupérable du montant retenu comme charge.', 'Vérifie la TVA espagnole sur la facture et ton droit à la déduire. Pour un fournisseur étranger, contrôle si tu dois autoliquider la TVA.', general],
  mixed: ['Usage professionnel et personnel', 'Détermine si une part professionnelle est admise et justifiable pour cette dépense. Conserve le détail du calcul.', 'Vérifie les règles propres à la TVA et au type de bien. Évite de reprendre automatiquement le pourcentage retenu à l’IRPF.', general],
  home: ['Internet, énergie ou eau à la maison', 'Pour les fournitures d’une résidence principale partiellement affectée à l’activité, applique en principe 30 % × la proportion de surface professionnelle, sauf preuve d’une autre proportion.', 'La TVA suit ses propres règles. Vérifie la part professionnelle et le justificatif avant de renseigner une déduction.', home],
  vehicle: ['Véhicule, carburant ou entretien', 'Pour une voiture de tourisme, vérifie l’exigence d’usage professionnel exclusif et les exceptions avant de déduire une charge à l’IRPF.', 'Une fois l’usage professionnel établi, une présomption de 50 % s’applique en principe à la TVA des voitures de tourisme. Garde les éléments qui justifient l’usage et vérifie la dépense concernée.', vehicle],
  equipment: ['Matériel durable ou équipement', 'Vérifie si le bien doit être amorti. Le prix payé et la charge déductible de l’année peuvent être différents.', 'Vérifie si le bien relève des biens d’investissement et si une régularisation peut s’appliquer.', general],
  social: ['Cotisation de travailleur indépendant', 'Rapproche la cotisation avec le reçu ou le débit et rattache-la à la bonne période. Vérifie séparément les majorations.', 'Une cotisation sociale ne comporte pas de TVA à récupérer.', general],
  personal: ['Dépense personnelle', 'Identifie-la comme personnelle et laisse-la hors des charges professionnelles.', 'Indique « Hors calcul TVA » si tu la conserves dans ton suivi.', general],
}

export default function GestoriaExpenseGuide({ category, onCategory, onExclude }) {
  const [workArea, setWorkArea] = useState('')
  const [totalArea, setTotalArea] = useState('')
  const ratio = totalArea > 0 && workArea !== '' && Number(workArea) >= 0 && Number(workArea) <= Number(totalArea)
    ? .3 * Number(workArea) / Number(totalArea) : null
  const rule = rules[category]
  return <fieldset className="mg-tax-settings mg-expense-guide">
    <legend>Est-ce que cette dépense peut passer en compta ?</legend>
    <label>Type de dépense <select value={category} onChange={event => onCategory(event.target.value)}>
      <option value="">Choisis un type pour voir les règles</option>
      {Object.entries(rules).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}
    </select></label>
    {rule && <><p><strong>Impôt sur le revenu.</strong> {rule[1]}</p>
      <p><strong>TVA.</strong> {rule[2]}</p>
      {category === 'home' && <div className="mg-tax-boxes">
        <label>Surface professionnelle en m² <input type="number" min="0" step="any" value={workArea} onChange={event => setWorkArea(event.target.value)} /></label>
        <label>Surface totale en m² <input type="number" min="0" step="any" value={totalArea} onChange={event => setTotalArea(event.target.value)} /></label>
        {ratio != null && <p>Part indicative à l’IRPF · {new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 2 }).format(ratio)}</p>}
      </div>}
      {['personal', 'social'].includes(category) && <button type="button" onClick={onExclude}>
        {category === 'personal' ? 'Exclure de l’IRPF et de la TVA' : 'Indiquer hors TVA'}
      </button>}
      <p>Garde le justificatif. Pour la TVA, vérifie que le ticket ou la facture remplit les conditions de déduction.</p>
      <a href={rule[3]} target="_blank" rel="noopener noreferrer">Vérifier auprès de Hacienda ↗</a></>}
  </fieldset>
}
