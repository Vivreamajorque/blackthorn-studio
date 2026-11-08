import React, { useMemo, useState } from 'react'

// Mi Gestoría — audit de préparation uniquement.
// Aucune donnée n'est sauvegardée ni envoyée à un service externe.
// Ne pas utiliser pour déposer des déclarations ou calculer une dette fiscale.
const ENTITIES = [
  { id: 'blackthorn', name: 'Blackthorn Tattoo', subtitle: 'Dossier fiscal de Tony' },
  { id: 'independent', name: 'Mon activité', subtitle: 'Dossier fiscal indépendant' }
]
const FORMS = [
  { id: '303', label: 'Modelo 303', detail: 'IVA trimestrielle' },
  { id: '130', label: 'Modelo 130', detail: 'Acomptes IRPF — si applicable' },
  { id: '115', label: 'Modelo 115', detail: 'Retenues sur loyer — si applicable' },
  { id: '111', label: 'Modelo 111', detail: 'Retenues salariés/prestataires — si applicable' }
]
const STATUS = [
  { value: 'unknown', label: 'À vérifier' },
  { value: 'missing', label: 'Non déposée (à confirmer)' },
  { value: 'filed', label: 'Déposée (justificatif à contrôler)' },
  { value: 'not_applicable', label: 'Non applicable (à confirmer)' }
]
const years = [2025, 2026]
const quarters = [1, 2, 3, 4]
const cellKey = (entity, year, quarter, form) => [entity, year, quarter, form].join(':')
const card = { background: 'var(--card, #fff)', border: '1px solid var(--border, #ddd)', borderRadius: 14, padding: 16 }
const muted = { color: 'var(--txt2, #777)', fontSize: 13 }

export default function MiGestoria() {
  const [entity, setEntity] = useState('blackthorn')
  const [year, setYear] = useState(2025)
  const [records, setRecords] = useState({})
  const [formFilter, setFormFilter] = useState('all')
  const current = ENTITIES.find(e => e.id === entity)
  const relevant = useMemo(() => {
    return quarters.flatMap(q => FORMS.filter(f => formFilter === 'all' || f.id === formFilter)
      .map(f => ({ quarter: q, form: f, key: cellKey(entity, year, q, f.id) })))
  }, [entity, year, formFilter])
  const count = relevant.filter(r => (records[r.key] || 'unknown') !== 'unknown').length

  const exportChecklist = () => {
    const lines = ['Mi Gestoría — liste de vérification (déclarations non vérifiées)', current.name, String(year), '']
    relevant.forEach(r => lines.push('T' + r.quarter + ' · Modelo ' + r.form.id + ' · ' +
      STATUS.find(s => s.value === (records[r.key] || 'unknown')).label))
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mi-gestoria-audit-' + entity + '-' + year + '.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return <main style={{ padding: '24px 16px 100px', maxWidth: 900, margin: '0 auto', color: 'var(--txt, #222)' }}>
    <div style={{ marginBottom: 18 }}>
      <a href="/" style={muted}>← Retour au Hub</a>
      <h1 style={{ margin: '12px 0 4px' }}>Mi Gestoría</h1>
      <p style={muted}>Audit préparatoire des obligations fiscales · Deux dossiers distincts</p>
    </div>
    <section style={{ ...card, borderColor: '#a76b35', marginBottom: 18 }}>
      <strong>Version de préparation — aucune connexion administrative</strong>
      <p style={{ ...muted, marginBottom: 0 }}>
        Les statuts ci-dessous sont déclaratifs et non vérifiés. Aucun chiffre ni justificatif n'est importé.
        Les informations saisies restent en mémoire dans cet onglet et disparaissent au rechargement.
        Ne saisissez pas de données sensibles. Les modèles applicables doivent être validés
        selon chaque activité, son régime fiscal et sa date de début.
      </p>
    </section>
    <section style={{ ...card, marginBottom: 16 }}>
      <label style={{ display: 'block', marginBottom: 8, fontWeight: 700 }}>Entreprise</label>
      <select value={entity} onChange={e => setEntity(e.target.value)} style={{ width: '100%', padding: 10 }}>
        {ENTITIES.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      <p style={muted}>{current.subtitle}</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <label>Année <select value={year} onChange={e => setYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select></label>
        <label>Déclaration <select value={formFilter} onChange={e => setFormFilter(e.target.value)}>
          <option value="all">Toutes</option>
          {FORMS.map(f => <option key={f.id} value={f.id}>Modelo {f.id}</option>)}
        </select></label>
      </div>
    </section>
    <section style={{ ...card, marginBottom: 16 }}>
      <strong>Vérifications renseignées : {count} / {relevant.length}</strong>
      <p style={muted}>Un statut « déposée » n'est pas une preuve : vérifier l'accusé de réception AEAT.</p>
      {relevant.map(r => <div key={r.key} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        justifyContent: 'space-between', gap: 10, padding: '12px 0', borderTop: '1px solid var(--border, #ddd)' }}>
        <div><strong>T{r.quarter} · Modelo {r.form.id}</strong><div style={muted}>{r.form.detail}</div></div>
        <select aria-label={'Statut T' + r.quarter + ' modelo ' + r.form.id}
          value={records[r.key] || 'unknown'}
          onChange={e => setRecords(prev => ({ ...prev, [r.key]: e.target.value }))}
          style={{ padding: 8, maxWidth: '100%' }}>
          {STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>)}
      <button onClick={exportChecklist} style={{ marginTop: 12, padding: '10px 14px', cursor: 'pointer' }}>
        Exporter la checklist (texte)
      </button>
    </section>
    <section style={card}>
      <h2 style={{ fontSize: 17, marginTop: 0 }}>Prochaines étapes</h2>
      <ol style={{ ...muted, lineHeight: 1.8 }}>
        <li>Vérifier les déclarations réellement déposées sur la Sede AEAT.</li>
        <li>Importer ensuite les factures dans un espace privé avec authentification forte.</li>
        <li>Rapprocher recettes, TVA facturée, TVA déductible et retenues de loyer.</li>
        <li>Faire contrôler les corrections avant tout dépôt officiel.</li>
      </ol>
    </section>
  </main>
}
