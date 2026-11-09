import React, { useEffect, useState } from 'react'
import { inActivityYear, todayInSpain } from '../lib/gestoria-calendar.mjs'
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

export function useStudioLedger(year) {
  const [state, setState] = useState({ year, status: 'loading' })
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const response = await fetch('/api/gestoria-studio?year=' + year, { cache: 'no-store', signal: controller.signal })
        if (response.status === 401 && !controller.signal.aborted) window.dispatchEvent(new Event('gestoria-auth-expired'))
        if (!response.ok) throw new Error()
        const data = await response.json()
        if (!controller.signal.aborted) setState({ year, status: 'ready', data })
      } catch {
        if (!controller.signal.aborted) setState({ year, status: 'error' })
      }
    }
    load()
    return () => controller.abort()
  }, [year, refresh])

  const current = state.year === year ? state : { status: 'loading' }
  function reload() {
    setState({ year, status: 'loading' })
    setRefresh(previous => previous + 1)
  }
  return { ...current, reload }
}

export function StudioData({ ledger }) {
  const { data, status, reload } = ledger
  return <section style={card}>
    <h2 style={{ fontSize: 18, marginTop: 0 }}>Blackthorn Tattoo · Compta du Hub</h2>
    <p style={muted}>Données Notion en lecture seule. Les rendez-vous prévus sont hors encaissements. Les dépenses reflètent le registre du studio.</p>
    <button disabled={status === 'loading'} onClick={reload}>Actualiser depuis le Hub</button>
    {status === 'loading' && <p role="status">Chargement des données du studio…</p>}
    {status === 'error' && <p role="alert">Lecture du Hub indisponible. Réessaie depuis une session propriétaire connectée.</p>}
    {data && <>
      <Amounts values={[['Encaissements enregistrés', total(data.receipts)], ['Dépenses saisies', total(data.expenses)]]} />
      {!data.receipts.length && !data.expenses.length && <p>Aucun mouvement trouvé pour cette année.</p>}
      {data.reconciliationWarnings > 0 && <p role="status">{data.reconciliationWarnings} ligne(s) à rapprocher avant d’utiliser les totaux.</p>}
      <Movements title="Encaissements" rows={data.receipts} />
      <Movements title="Dépenses" rows={data.expenses} />
    </>}
  </section>
}

const sources = { direct: 'Direct ou autre', malt: 'Malt', livementor: 'LiveMentor' }
const payments = { unknown: 'Paiement à vérifier', pending: 'En attente', paid: 'Payé' }

export function PersonalData({ year, startDate, entries, canSave, onEntries, bank, onBank }) {
  const [draft, setDraft] = useState(null)
  const [sourceFilter, setSourceFilter] = useState('all')
  const today = todayInSpain()
  const minDate = startDate?.startsWith(year + '-') ? startDate : year + '-01-01'
  const rows = entries.filter(row => inActivityYear(row.date, year, startDate) &&
    (sourceFilter === 'all' || (row.source || 'direct') === sourceFilter)).sort((a, b) => b.date.localeCompare(a.date))
  const invoices = rows.filter(row => row.kind === 'invoice')
  const expenses = rows.filter(row => row.kind === 'expense')
  const sum = items => items.reduce((value, row) => value + row.amountCents, 0) / 100

  function start(kind) {
    setDraft({ id: crypto.randomUUID(), kind, source: sourceFilter === 'all' ? 'direct' : sourceFilter, date: inActivityYear(today, year, startDate) ? today : minDate,
      label: '', reference: '', amount: '', payment: 'unknown' })
  }

  async function submit(event) {
    event.preventDefault()
    if (!inActivityYear(draft.date, year, startDate)) return
    const { amount, ...fields } = draft
    const row = { ...fields, label: draft.label.trim(),
      reference: draft.reference.trim(), amountCents: Math.round(Number(amount) * 100) }
    if (await onEntries([...entries.filter(entry => entry.id !== row.id), row])) setDraft(null)
  }

  return <>
    <section style={card}>
      <h2>Compta de mon activité</h2>
      <label>Origine <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
        <option value="all">Toutes</option>
        {Object.entries(sources).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      {sourceFilter === 'malt' && <p style={muted}>
        Ajoute la facture de mission et, séparément, la facture de frais Malt si elle existe.
        Rapproche le versement bancaire avec la mission.{' '}
        <a href="https://help.malt.com/hc/fr/articles/29540886429586-Comment-fonctionnent-la-facturation-et-le-paiement"
          target="_blank" rel="noopener noreferrer">Aide Malt ↗</a>
      </p>}
      <Amounts values={[
        ['Factures émises', sum(invoices)],
        ['Factures marquées payées', sum(invoices.filter(row => row.payment === 'paid'))],
        ['Factures reçues', sum(expenses)],
      ]} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button disabled={!canSave || entries.length >= 1000} onClick={() => start('invoice')}>Ajouter une facture émise</button>
        <button disabled={!canSave || entries.length >= 1000} onClick={() => start('expense')}>Ajouter une dépense</button>
      </div>
      {draft && <form onSubmit={submit} style={{ display: 'grid', gap: 12, padding: '14px 0', maxWidth: 520 }}>
        <h3>{draft.kind === 'invoice' ? 'Facture émise' : 'Dépense'}</h3>
        <label>Origine <select value={draft.source} onChange={e => setDraft({ ...draft, source: e.target.value })}>
          {Object.entries(sources).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>Client ou fournisseur <input maxLength={160} required value={draft.label}
          onChange={e => setDraft({ ...draft, label: e.target.value })} /></label>
        <label>Date <input type="date" min={minDate} max={year + '-12-31'} required value={draft.date}
          onChange={e => setDraft({ ...draft, date: e.target.value })} /></label>
        <label>Montant total en € <input type="number" step="0.01" min="-100000000" max="100000000" required value={draft.amount}
          onChange={e => setDraft({ ...draft, amount: e.target.value })} /></label>
        <label>Référence <input maxLength={100} value={draft.reference}
          onChange={e => setDraft({ ...draft, reference: e.target.value })} /></label>
        <label>Suivi du paiement <select value={draft.payment}
          onChange={e => setDraft({ ...draft, payment: e.target.value })}>
          {Object.entries(payments).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <div>
          <button disabled={!canSave || !draft.label.trim()}>Enregistrer</button>{' '}
          <button type="button" onClick={() => setDraft(null)}>Annuler</button>
        </div>
      </form>}
      {rows.length === 0 && <p>Aucune facture ni dépense enregistrée pour {year}.</p>}
      {rows.map(({ amountCents, ...row }) => <div key={row.id}
        style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border, #ddd)' }}>
        <strong>{row.label} · {euro.format(amountCents / 100)}</strong>
        <p style={muted}>{dateLabel(row.date)} · {row.kind === 'invoice' ? 'Facture émise' : 'Dépense'} · {payments[row.payment]} · {sources[row.source || 'direct']}
          {row.reference && ' · ' + row.reference}</p>
        <button disabled={!canSave} onClick={() => setDraft({ ...row, source: row.source || 'direct', amount: String(amountCents / 100) })}>Modifier</button>{' '}
        <button disabled={!canSave} onClick={async () => {
          if (window.confirm('Retirer cette ligne de ton dossier ?') &&
              await onEntries(entries.filter(entry => entry.id !== row.id)) && draft?.id === row.id) setDraft(null)
        }}>Retirer</button>
      </div>)}
    </section>
    <BankPreview year={year} startDate={startDate} bank={bank} onBank={onBank} />
  </>
}

function BankPreview({ year, startDate, bank, onBank }) {
  const [message, setMessage] = useState('')
  const rows = bank.filter(row => inActivityYear(row.date, year, startDate))
  async function readFile(event) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    try {
      if (file.size > 2000000) throw new Error('Limite de 2 Mo par fichier CSV.')
      const result = parseGestoriaCsv(await file.text(), 'bank')
      onBank(result.rows)
      const skipped = result.skipped.state + result.skipped.currency
      setMessage(result.rows.length + ' mouvements chargés.' + (skipped ? ' ' + skipped + ' ignorés (hors EUR ou non terminés).' : ''))
    } catch (error) {
      setMessage(error.message || 'Import impossible.')
    }
  }

  return <details style={card}>
    <summary>Comparer avec un relevé Revolut Pro · facultatif</summary>
    <p style={muted}>Aperçu temporaire du relevé dans cet onglet, séparé de ta compta.</p>
    <label>Importer un relevé CSV <input type="file" accept=".csv,text/csv" onChange={readFile} /></label>
    {message && <p role="status">{message}</p>}
    <Movements title="Mouvements du relevé" rows={rows} />
  </details>
}
