import React, { useEffect, useState } from 'react'
import { inActivityYear, todayInSpain } from '../lib/gestoria-calendar.mjs'
import { parseGestoriaCsv } from '../lib/gestoria-import.mjs'
import GestoriaInvoice from './GestoriaInvoice'
import { attachmentUrl, uploadFile } from '../lib/gestoria-files.mjs'
import GestoriaExpenseGuide from './GestoriaExpenseGuide'
import GestoriaVatFields, { editVat, saveVat } from './GestoriaVatFields'

const card = { background: 'var(--card, #fff)', border: '1px solid var(--border, #ddd)', borderRadius: 14, padding: 16, marginBottom: 16 }
const muted = { color: 'var(--txt2, #777)', fontSize: 13 }
const cashAmount = (amount, currency) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR' }).format(amount / 100)
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

export function PersonalData({ entity = 'independent', year, startDate, entries, canSave, canAdd, onEntries, bank, onBank }) {
  const [draft, setDraft] = useState(null)
  const [fileMessage, setFileMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [sourceFilter, setSourceFilter] = useState('all')
  const today = todayInSpain()
  const minDate = startDate?.startsWith(year + '-') ? startDate : year + '-01-01'
  const rows = entries.filter(row => inActivityYear(row.date, year, startDate) &&
    (sourceFilter === 'all' || (row.source || 'direct') === sourceFilter)).sort((a, b) => b.date.localeCompare(a.date))
  const invoices = rows.filter(row => row.kind === 'invoice')
  const expenses = rows.filter(row => row.kind === 'expense')
  const sum = items => items.filter(row => !row.currency || row.currency === 'EUR').reduce((value, row) => value + row.amountCents, 0) / 100

  function start(kind, values = {}) {
    const date = inActivityYear(today, year, startDate) ? today : minDate
    setFileMessage('')
    setDraft({ id: crypto.randomUUID(), kind, source: sourceFilter === 'all' ? 'direct' : sourceFilter, date,
      label: '', reference: '', amount: '', currency: 'EUR', payment: 'unknown', taxAmount: '', taxDate: '', paymentDate: '', expectedPaymentDate: '', withholding: '',
      ...values, vatDraft: editVat(undefined, values.date || date) })
  }

  async function submit(event) {
    event.preventDefault()
    if (!inActivityYear(draft.date, year, startDate)) return
    if (uploading) return
    const { amount, taxAmount, taxDate, paymentDate, expectedPaymentDate, withholding, vatDraft, file, ...fields } = draft
    const vat = saveVat(vatDraft)
    let attachment = fields.attachment
    setFileMessage('')
    setUploading(true)
    try {
      if (file) {
        attachment = await uploadFile(file)
        setDraft(current => current?.id === draft.id ? { ...current, file: undefined, attachment } : current)
      }
      const row = { ...fields, label: draft.label.trim(), reference: draft.reference.trim(),
      amountCents: Math.round(Number(amount) * 100),
      ...(taxAmount !== '' && { taxAmountCents: Math.round(Number(taxAmount) * 100) }),
      ...(taxDate && { taxDate }),
      ...(fields.payment === 'paid' && paymentDate && { paymentDate }),
      ...(fields.payment !== 'paid' && expectedPaymentDate && { expectedPaymentDate }),
        ...(fields.kind === 'invoice' && withholding !== '' && { withholdingCents: Math.round(Number(withholding) * 100) }),
        ...(attachment && { attachment }),
        ...(vat && { vat }),
      }
      if (await onEntries([...entries.filter(entry => entry.id !== row.id), row])) setDraft(null)
    } catch (error) {
      setFileMessage(error.message || 'Pièce non enregistrée.')
    } finally {
      setUploading(false)
    }
  }

  async function attachBatch(event) {
    const files = [...event.target.files]
    event.target.value = ''
    if (!files.length || uploading) return
    const next = [...entries]
    const notMatched = []
    let count = 0
    setUploading(true)
    try {
      for (const file of files) {
        const name = file.name.toUpperCase()
        const candidates = rows.filter(row => row.reference.trim() && name.includes(row.reference.trim().toUpperCase()))
        if (candidates.length !== 1) { notMatched.push(file.name); continue }
        const index = next.findIndex(row => row.id === candidates[0].id)
        if (next[index].attachment) { notMatched.push(file.name + ' · pièce déjà présente'); continue }
        try {
          next[index] = { ...next[index], attachment: await uploadFile(file) }
          count++
        } catch {
          notMatched.push(file.name + ' · fichier refusé')
        }
      }
      const saved = count > 0 && await onEntries(next)
      setFileMessage((saved ? count + ' pièce(s) rattachée(s).' : 'Aucune pièce rattachée.') +
        (notMatched.length ? ' À vérifier · ' + notMatched.join(', ') : ''))
    } finally {
      setUploading(false)
    }
  }

  return <>
    <section style={card}>
      <h2>{entity === 'blackthorn' ? 'Factures et tickets de Blackthorn' : 'Compta de mon activité'}</h2>
      {entity === 'blackthorn' && <p style={muted}>Ces pièces forment ton registre fiscal dans Mi Gestoría. Les graphiques de recettes et dépenses du studio utilisent les données du Hub.</p>}
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
        <button disabled={!canSave || !canAdd} onClick={() => start('invoice')}>Ajouter une facture émise</button>
        <button disabled={!canSave || !canAdd} onClick={() => start('expense')}>Ajouter une dépense</button>
      </div>
      <details className="mg-chart-details">
        <summary>Rattacher plusieurs factures originales</summary>
        <p style={muted}>Le nom de chaque fichier doit contenir la référence de la facture. Les pièces déjà présentes sont conservées.</p>
        <label>Choisir les PDF ou images <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp"
          disabled={!canSave || uploading || Boolean(draft)} onChange={attachBatch} /></label>
        {!draft && fileMessage && <p role="status">{fileMessage}</p>}
      </details>
      <GestoriaInvoice date={inActivityYear(today, year, startDate) ? today : minDate}
        onPrepare={values => start('invoice', { ...values, source: 'direct' })} />
      {rows.some(row => row.currency && row.currency !== 'EUR') &&
        <p style={muted}>Les écritures en devise sont affichées séparément. Pour les calculs fiscaux, renseigne leur montant vérifié en euros.</p>}
      {draft && <form onSubmit={submit} style={{ display: 'grid', gap: 12, padding: '14px 0', maxWidth: 520 }}>
        <h3>{draft.kind === 'invoice' ? 'Facture émise' : 'Dépense'}</h3>
        <label>Origine <select value={draft.source} onChange={e => setDraft({ ...draft, source: e.target.value })}>
          {Object.entries(sources).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>Client ou fournisseur <input maxLength={160} required value={draft.label}
          onChange={e => setDraft({ ...draft, label: e.target.value })} /></label>
        <label>Date <input type="date" min={minDate} max={year + '-12-31'} required value={draft.date}
          onChange={e => setDraft({ ...draft, date: e.target.value,
            vatDraft: { ...draft.vatDraft, date: draft.vatDraft.date === draft.date ? e.target.value : draft.vatDraft.date } })} /></label>
        <label>Devise <select value={draft.currency} onChange={e => setDraft({ ...draft, currency: e.target.value })}>
          <option value="EUR">EUR</option><option value="USD">USD</option></select></label>
        <label>Montant total dans cette devise <input type="number" step="0.01" min="-100000000" max="100000000" required value={draft.amount}
          onChange={e => setDraft({ ...draft, amount: e.target.value })} /></label>
        <label>Référence <input maxLength={100} value={draft.reference}
          onChange={e => setDraft({ ...draft, reference: e.target.value })} /></label>
        <label>Suivi du paiement <select value={draft.payment}
          onChange={e => setDraft({ ...draft, payment: e.target.value })}>
          {Object.entries(payments).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        {draft.payment === 'paid' && <label>{draft.kind === 'invoice' ? 'Date d’encaissement' : 'Date de paiement'}
          <input type="date" value={draft.paymentDate} onChange={e => setDraft({ ...draft, paymentDate: e.target.value })} />
        </label>}
        {draft.payment !== 'paid' && <label>{draft.kind === 'invoice' ? 'Encaissement prévu, si connu' : 'Paiement prévu, si connu'}
          <input type="date" value={draft.expectedPaymentDate} onChange={e => setDraft({ ...draft, expectedPaymentDate: e.target.value })} />
        </label>}
        {draft.kind === 'expense' && <GestoriaExpenseGuide category={draft.expenseCategory || ''}
          onCategory={expenseCategory => setDraft({ ...draft, expenseCategory: expenseCategory || undefined })}
          onExclude={() => setDraft({ ...draft, ...(draft.expenseCategory === 'personal' && { taxAmount: '0' }),
            vatDraft: { ...draft.vatDraft, category: 'excluded' } })} />}
        <fieldset className="mg-tax-settings">
          <legend>Calcul de l’IRPF</legend>
          <label>{draft.kind === 'invoice' ? 'Revenu hors TVA en €' : 'Part déductible à l’IRPF en €'}
            <input type="number" step="0.01" min="-100000000" max="100000000" value={draft.taxAmount}
              onChange={e => setDraft({ ...draft, taxAmount: e.target.value })} />
          </label>
          {draft.kind === 'invoice' && <button type="button" disabled={!draft.vatDraft.base || !draft.vatDraft.category || draft.vatDraft.category === 'excluded'}
            onClick={() => setDraft({ ...draft, taxAmount: draft.vatDraft.base })}>Reprendre la base hors TVA saisie plus bas</button>}
          <span style={muted}>Laisse le montant fiscal vide s’il reste à vérifier. Indique 0 si la ligne est exclue de l’IRPF.</span>
          <label>Date de rattachement si différente de la date de facture
            <input type="date" value={draft.taxDate} onChange={e => setDraft({ ...draft, taxDate: e.target.value })} />
          </label>
          {draft.kind === 'invoice' && <label>Retenue d’IRPF espagnole en €, si applicable
            <input type="number" step="0.01" min="-100000000" max="100000000" value={draft.withholding}
              onChange={e => setDraft({ ...draft, withholding: e.target.value })} />
          </label>}
        </fieldset>
        <GestoriaVatFields value={draft.vatDraft} invoice={draft.kind === 'invoice'}
          onChange={vatDraft => setDraft({ ...draft, vatDraft })} />
        <label>Justificatif PDF ou image · 3 Mo maximum
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={uploading}
            onChange={e => setDraft({ ...draft, file: e.target.files?.[0] })} />
        </label>
        {draft.attachment && <span style={muted}>Pièce actuelle · {draft.attachment.name}</span>}
        {fileMessage && <p role="alert">{fileMessage}</p>}
        <div>
          <button disabled={!canSave || uploading || !draft.label.trim()}>{uploading ? 'Enregistrement…' : 'Enregistrer'}</button>{' '}
          <button type="button" disabled={uploading} onClick={() => setDraft(null)}>Annuler</button>
        </div>
      </form>}
      {rows.length === 0 && <p>Aucune facture ni dépense enregistrée pour {year}.</p>}
      {rows.map(({ amountCents, taxAmountCents, withholdingCents, vat, ...row }) => <div key={row.id}
        style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border, #ddd)' }}>
        <strong>{row.label} · {cashAmount(amountCents, row.currency)}</strong>
        <p style={muted}>{dateLabel(row.date)} · {row.kind === 'invoice' ? 'Facture émise' : 'Dépense'} · {payments[row.payment]} · {sources[row.source || 'direct']}
          {row.reference && ' · ' + row.reference}
          {row.paymentDate && ' · Payé le ' + dateLabel(row.paymentDate)}
          {row.expectedPaymentDate && ' · Prévu le ' + dateLabel(row.expectedPaymentDate)}
          {' · IRPF ' + (taxAmountCents == null ? 'à vérifier' : euro.format(taxAmountCents / 100))}</p>
        {row.attachment && <p><a href={attachmentUrl(row.attachment)}
          target="_blank" rel="noopener noreferrer">Voir le justificatif ↗</a></p>}
        <button disabled={!canSave || uploading} onClick={() => setDraft({ ...row, source: row.source || 'direct', amount: String(amountCents / 100),
          currency: row.currency || 'EUR', vatDraft: editVat(vat, row.date),
          taxAmount: taxAmountCents == null ? '' : String(taxAmountCents / 100),
          withholding: withholdingCents == null ? '' : String(withholdingCents / 100),
          taxDate: row.taxDate || '', paymentDate: row.paymentDate || '', expectedPaymentDate: row.expectedPaymentDate || '' })}>Modifier</button>{' '}
        <button disabled={!canSave || uploading} onClick={async () => {
          if (window.confirm('Retirer cette ligne de ton dossier ?') &&
              await onEntries(entries.filter(entry => entry.id !== row.id)) && draft?.id === row.id) setDraft(null)
        }}>Retirer</button>
      </div>)}
    </section>
    {bank && <BankPreview year={year} startDate={startDate} bank={bank} onBank={onBank} />}
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
