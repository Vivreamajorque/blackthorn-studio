import React, { useEffect, useState } from 'react'
import { parseGestoriaCsv } from '../lib/gestoria-import.mjs'

const card = { background: 'var(--card, #fff)', border: '1px solid var(--border, #ddd)', borderRadius: 14, padding: 16, marginBottom: 16 }
const muted = { color: 'var(--txt2, #777)', fontSize: 13 }
const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const total = rows => rows.reduce((cents, row) => cents + Math.round(row.amount * 100), 0) / 100
const dateLabel = date => date.split('-').reverse().join('/')
const payment = { cash: 'Espèces', carte: 'Carte', virement: 'Virement', inconnu: 'Mode à vérifier' }

function Amounts({ values }) {
  return <dl style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 24px', margin: '12px 0' }}>
    {values.map(([label, amount]) => <div key={label}>
      <dt style={muted}>{label}</dt>
      <dd style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700 }}>{euro.format(amount)}</dd>
    </div>)}
  </dl>
}

function Movements({ title, rows }) {
  if (!rows.length) return null
  return <details style={{ marginTop: 10 }}>
    <summary>{title} ({rows.length})</summary>
    <div style={{ maxHeight: 320, overflow: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', textAlign: 'left', fontSize: 13 }}>
        <thead><tr><th scope="col">Date</th><th scope="col">Libellé</th><th scope="col">Montant</th></tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>
          <td>{dateLabel(row.date)}</td>
          <td>{row.label}{row.reference && ' · ' + row.reference}{row.method && ' · ' + payment[row.method]}</td>
          <td style={{ whiteSpace: 'nowrap' }}>{euro.format(row.amount)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </details>
}

export function StudioData({ year }) {
  const [state, setState] = useState({ status: 'loading' })
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const response = await fetch('/api/gestoria-studio?year=' + year, { cache: 'no-store', signal: controller.signal })
        if (response.status === 401 && !controller.signal.aborted) window.dispatchEvent(new Event('bt-auth-expired'))
        if (!response.ok) throw new Error()
        const data = await response.json()
        if (!controller.signal.aborted) setState({ status: 'ready', data })
      } catch {
        if (!controller.signal.aborted) setState({ status: 'error' })
      }
    }
    load()
    return () => controller.abort()
  }, [year, refresh])

  const data = state.data
  return <section style={card}>
    <h2 style={{ fontSize: 18, marginTop: 0 }}>Blackthorn Tattoo · Compta du Hub</h2>
    <p style={muted}>Données Notion en lecture seule. Les rendez-vous prévus sont hors encaissements. Les dépenses reflètent le registre du studio.</p>
    <button disabled={state.status === 'loading'} onClick={() => {
      setState({ status: 'loading' })
      setRefresh(previous => previous + 1)
    }}>Actualiser depuis le Hub</button>
    {state.status === 'loading' && <p role="status">Chargement des données du studio…</p>}
    {state.status === 'error' && <p role="alert">Lecture du Hub indisponible. Réessaie depuis une session propriétaire connectée.</p>}
    {data && <>
      <Amounts values={[['Encaissements enregistrés', total(data.receipts)], ['Dépenses saisies', total(data.expenses)]]} />
      {!data.receipts.length && !data.expenses.length && <p>Aucun mouvement trouvé pour cette année.</p>}
      {data.reconciliationWarnings > 0 && <p role="status">{data.reconciliationWarnings} ligne(s) à rapprocher avant d’utiliser les totaux.</p>}
      <Movements title="Encaissements" rows={data.receipts} />
      <Movements title="Dépenses" rows={data.expenses} />
    </>}
  </section>
}

export function PersonalData({ year, imports, onImport }) {
  const [message, setMessage] = useState({})
  const fields = [
    { kind: 'invoices', title: 'Factures émises', totalLabel: 'Montant facturé', sample: 'date;description;montant;devise;reference' },
    { kind: 'expenses', title: 'Factures reçues', totalLabel: 'Montant des factures reçues', sample: 'date;description;montant;devise;reference' },
    { kind: 'bank', title: 'Mouvements Revolut Pro', sample: 'date;description;montant;devise' },
  ]

  async function readFile(event, kind) {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      if (file.size > 2000000) throw new Error('Limite de 2 Mo par fichier CSV.')
      const result = parseGestoriaCsv(await file.text(), kind)
      onImport(kind, result.rows)
      const skipped = result.skipped.state + result.skipped.currency
      setMessage(previous => ({ ...previous, [kind]: result.rows.length + ' ligne(s) chargée(s).' +
        (skipped ? ' ' + skipped + ' ligne(s) ignorée(s) car hors EUR ou non terminée(s).' : '') }))
    } catch (error) {
      setMessage(previous => ({ ...previous, [kind]: error.message || 'Import impossible.' }))
    }
  }

  return <section style={card}>
    <h2 style={{ fontSize: 18, marginTop: 0 }}>Mon activité · Factures et Revolut Pro</h2>
    <p style={muted}>Les fichiers sont lus dans cet onglet. Un nouvel import remplace le précédent du même type. Conserve tes fichiers pour reprendre après fermeture.</p>
    {fields.map(field => {
      const rows = (imports[field.kind] || []).filter(row => row.date.startsWith(year + '-'))
      const amounts = field.kind === 'bank'
        ? [['Entrées sur le compte', total(rows.filter(row => row.amount > 0))], ['Sorties du compte', -total(rows.filter(row => row.amount < 0))]]
        : [[field.totalLabel, total(rows)]]
      return <div key={field.kind} style={{ marginTop: 18 }}>
        <h3 style={{ fontSize: 15, marginBottom: 5 }}>{field.title}</h3>
        <p style={muted}>{field.kind === 'bank'
          ? 'Les virements internes et remboursements restent des mouvements à rapprocher.'
          : 'Le total des factures est présenté séparément des mouvements bancaires.'}</p>
        <label>Importer un CSV · {field.title}
          <input type="file" accept=".csv,text/csv" onChange={event => readFile(event, field.kind)}
            style={{ display: 'block', marginTop: 6, maxWidth: '100%' }} />
        </label>
        <p style={muted}>Colonnes CSV <code>{field.sample}</code>. Pour les dates, privilégie AAAA-MM-JJ.</p>
        {message[field.kind] && <p role="status">{message[field.kind]}</p>}
        {rows.length
          ? <><Amounts values={amounts} /><Movements title={field.title} rows={rows} /></>
          : <p style={muted}>Aucune ligne chargée pour {year}.</p>}
      </div>
    })}
  </section>
}
