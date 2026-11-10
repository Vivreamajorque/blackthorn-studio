import React, { useEffect, useRef, useState } from 'react'
import { inActivityYear, todayInSpain } from '../lib/gestoria-calendar.mjs'
import { parseGestoriaCsv } from '../lib/gestoria-import.mjs'
import GestoriaInvoice from './GestoriaInvoice'
import { attachmentUrl, uploadFile } from '../lib/gestoria-files.mjs'
import GestoriaTonyAccess from './GestoriaTonyAccess'
import GestoriaExpenseGuide from './GestoriaExpenseGuide'
import GestoriaVatFields, { editVat, saveVat } from './GestoriaVatFields'

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
    let active = false
    const load = async (background = false) => {
      if (active) return
      active = true
      try {
        const response = await fetch('/api/gestoria-studio?year=' + year, { cache: 'no-store', signal: controller.signal })
        if (response.status === 401 && !controller.signal.aborted) window.dispatchEvent(new Event('gestoria-auth-expired'))
        if (!response.ok) throw new Error()
        const data = await response.json()
        if (!controller.signal.aborted) setState({ year, status: 'ready', data })
      } catch {
        if (!controller.signal.aborted && !background) setState({ year, status: 'error' })
      } finally {
        active = false
      }
    }
    load()
    const whenVisible = () => { if (!document.hidden) load(true) }
    window.addEventListener('focus', whenVisible)
    const timer = window.setInterval(whenVisible, 60000)
    return () => {
      controller.abort()
      window.removeEventListener('focus', whenVisible)
      window.clearInterval(timer)
    }
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
  return <section className="mg-panel mg-ledger-panel">
    <p className="mg-section-label">VENTES DU HUB</p>
    <h2>Encaissements Blackthorn</h2>
    <p style={muted}>Les ventes confirmées viennent du Hub. Les charges ci-dessous viennent du registre Mi Gestoría.</p>
    <button disabled={status === 'loading'} onClick={reload}>Actualiser les ventes</button>
    {status === 'loading' && <p role="status">Chargement des ventes du studio…</p>}
    {status === 'error' && <p role="alert">Lecture des ventes indisponible.</p>}
    {data && <>
      <Amounts values={[['Encaissements enregistrés', total(data.receipts)]]} />
      {!data.receipts.length && <p>Aucun encaissement trouvé pour cette année.</p>}
      {data.reconciliationWarnings > 0 && <p role="status">{data.reconciliationWarnings} ligne(s) à rapprocher avant d’utiliser les totaux.</p>}
      <Movements title="Encaissements" rows={data.receipts} />
    </>}
    <GestoriaTonyAccess />
  </section>
}

const sources = { direct: 'Direct ou autre', malt: 'Malt', livementor: 'LiveMentor' }
const payments = { unknown: 'Paiement à vérifier', pending: 'En attente', paid: 'Payé' }

function QuickPayment({ row, disabled, onSave, onCancel }) {
  const [paid, setPaid] = useState(row.payment === 'paid')
  const [date, setDate] = useState(row.paymentDate || '')
  async function submit(event) {
    event.preventDefault()
    const { paymentDate, expectedPaymentDate, ...entry } = row
    const changes = paid ? { payment: 'paid', paymentDate: date } : {
      payment: row.payment === 'unknown' ? 'unknown' : 'pending',
      ...(expectedPaymentDate && { expectedPaymentDate }),
    }
    await onSave({ ...entry, ...changes })
  }
  return <form className="mg-actions mg-quick-payment" onSubmit={submit}>
    <label><input type="checkbox" checked={paid} onChange={event => setPaid(event.target.checked)} /> Payé</label>
    {paid && <label>Date de paiement <input type="date" required max={todayInSpain()} value={date}
      onChange={event => setDate(event.target.value)} /></label>}
    <button type="submit" disabled={disabled || (paid && !date)}>Enregistrer le paiement</button>
    <button type="button" onClick={onCancel}>Annuler</button>
  </form>
}

export function PersonalData({ entity = 'independent', year, startDate, entries, canSave, canAdd, onEntries, bank, onBank }) {
  const [draft, setDraft] = useState(null)
  const [pointingId, setPointingId] = useState(null)
  const [fileMessage, setFileMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [sourceFilter, setSourceFilter] = useState('all')
  const [kindFilter, setKindFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [query, setQuery] = useState('')
  const today = todayInSpain()
  const minDate = startDate?.startsWith(year + '-') ? startDate : year + '-01-01'
  const rows = entries.filter(row => inActivityYear(row.date, year, startDate) &&
    (sourceFilter === 'all' || (row.source || 'direct') === sourceFilter)).sort((a, b) => b.date.localeCompare(a.date))
  const needle = query.trim().toLocaleLowerCase('fr')
  const visibleRows = rows.filter(row => (kindFilter === 'all' || row.kind === kindFilter) &&
    (paymentFilter === 'all' || row.payment === paymentFilter) &&
    (!needle || [row.label, row.reference, row.attachment?.name].some(value => value?.toLocaleLowerCase('fr').includes(needle))))
  const invoices = rows.filter(row => row.kind === 'invoice')
  const expenses = rows.filter(row => row.kind === 'expense')
  const sum = items => items.filter(row => !row.currency || row.currency === 'EUR').reduce((value, row) => value + row.amountCents, 0) / 100

  const paymentField = useRef(null)
  const draftId = draft?.id
  const editingVisible = visibleRows.some(row => row.id === draftId)
  useEffect(() => {
    if (draftId && editingVisible) paymentField.current?.focus()
  }, [draftId, editingVisible])

  function edit(row, { amountCents, taxAmountCents, withholdingCents, vat }) {
    setFileMessage('')
    setPointingId(null)
    setDraft({ ...row, source: row.source || 'direct', amount: String(amountCents / 100),
      currency: row.currency || 'EUR', vatDraft: editVat(vat, row.date),
      taxAmount: taxAmountCents == null ? '' : String(taxAmountCents / 100),
      withholding: withholdingCents == null ? '' : String(withholdingCents / 100),
      taxDate: row.taxDate || '', paymentDate: row.paymentDate || '', expectedPaymentDate: row.expectedPaymentDate || '' })
  }

  function start(kind, values = {}) {
    setPointingId(null)
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

  const editor = draft && <form key={draft.id} id="mg-entry-editor" onSubmit={submit} className="mg-entry-editor">
    <h3>{editingVisible ? 'Modifier · ' + draft.label : draft.kind === 'invoice' ? 'Facture émise' : 'Dépense'}</h3>
    {draft.taxReview && <div className="mg-doc-amounts">
      <strong>Justificatif fiscal à vérifier</strong>
      <span>{draft.taxReview}</span>
      <button type="button" onClick={() => setDraft({ ...draft, taxReview: undefined })}>Ce point est vérifié</button>
    </div>}
    {draft.documentAmounts && <div className="mg-doc-amounts">
      <strong>Montants lus sur le PDF</strong>
      <span>Base {cashAmount(draft.documentAmounts.baseCents, draft.currency)} · Taxe {cashAmount(draft.documentAmounts.taxCents, draft.currency)} · Total {cashAmount(draft.documentAmounts.totalCents, draft.currency)}</span>
      {draft.documentAmounts.rentWithholdingCents != null && <span>Retenue IRPF sur le loyer · {cashAmount(draft.documentAmounts.rentWithholdingCents, draft.currency)} · Modelo 115</span>}
      {draft.documentAmounts.dueCents != null && <span>À régler selon la pièce · {cashAmount(draft.documentAmounts.dueCents, draft.currency)}</span>}
      {draft.currency === 'EUR' && <button type="button" onClick={() => setDraft({ ...draft,
        vatDraft: { ...draft.vatDraft, base: String(draft.documentAmounts.baseCents / 100) } })}>Copier la base dans la saisie TVA</button>}
      <small>La taxe imprimée sur le PDF peut différer de la TVA à déclarer en Espagne. Vérifie le régime avant de saisir la TVA.</small>
    </div>}
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
    <label>Suivi du paiement <select ref={paymentField} value={draft.payment}
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
  </form>

  return <>
    <section className="mg-panel mg-ledger-panel">
      <div className="mg-panel-heading mg-ledger-heading">
        <div><p className="mg-section-label">REGISTRE ET JUSTIFICATIFS</p>
          <h2>{entity === 'blackthorn' ? 'Factures et tickets de Blackthorn' : 'Factures et dépenses'}</h2>
          {entity === 'blackthorn' && <p className="mg-muted">Ces charges alimentent le suivi Blackthorn dans Mi Gestoría et dans l’onglet de Tony.</p>}</div>
        <div className="mg-actions">
          <button className="mg-primary" disabled={!canSave || !canAdd} onClick={() => start('invoice')}>Ajouter une facture émise</button>
          <button disabled={!canSave || !canAdd} onClick={() => start('expense')}>Ajouter une dépense</button>
        </div>
      </div>
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
      {!editingVisible && editor}
      <div className="mg-ledger-filters">
        <label>Rechercher <input type="search" placeholder="Fournisseur, référence, fichier" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <label>Type <select value={kindFilter} onChange={e => setKindFilter(e.target.value)}>
          <option value="all">Tout</option><option value="invoice">Factures émises</option><option value="expense">Dépenses</option>
        </select></label>
        <label>Paiement <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}>
          <option value="all">Tous</option>
          {Object.entries(payments).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Origine <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
          <option value="all">Toutes</option>
          {Object.entries(sources).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
      </div>
      <p className="mg-muted" role="status">{visibleRows.length} ligne(s) affichée(s)</p>
      {visibleRows.length === 0 && <p className="mg-empty">Aucune écriture pour cette sélection.</p>}
      {visibleRows.map(({ amountCents, taxAmountCents, withholdingCents, vat, ...row }) => <article key={row.id} className="mg-ledger-row">
        <div className="mg-ledger-row-head">
          <div><strong>{row.label}</strong>
            <p className="mg-muted">{dateLabel(row.date)} · {row.kind === 'invoice' ? 'Facture émise' : 'Dépense'} · {sources[row.source || 'direct']}
              {row.reference && ' · ' + row.reference}</p>
          </div>
          <div className="mg-ledger-amount"><strong>{cashAmount(amountCents, row.currency)}</strong>
            <span className={`mg-tag ${row.payment === 'paid' ? 'calm' : 'warning'}`}>{payments[row.payment]}</span>
          </div>
        </div>
        <p className="mg-muted">{row.paymentDate && 'Payé le ' + dateLabel(row.paymentDate) + ' · '}
          {row.expectedPaymentDate && 'Prévu le ' + dateLabel(row.expectedPaymentDate) + ' · '}
          {'IRPF ' + (taxAmountCents == null ? 'à vérifier' : euro.format(taxAmountCents / 100))}
          {row.documentAmounts && ' · Montants du PDF relevés'}</p>
        {row.taxReview && <p className="mg-card-note">{row.taxReview}</p>}
        <div className="mg-actions">{row.attachment && <a className="mg-soft-action" href={attachmentUrl(row.attachment)}
          target="_blank" rel="noopener noreferrer">Voir le PDF ↗</a>}
        <button type="button" disabled={!canSave || uploading || Boolean(draft)} aria-expanded={pointingId === row.id}
          onClick={() => setPointingId(pointingId === row.id ? null : row.id)}>Pointer le paiement</button>
        <button type="button" disabled={!canSave || uploading} aria-expanded={draftId === row.id}
          aria-controls={draftId === row.id ? 'mg-entry-editor' : undefined}
          onClick={() => edit(row, { amountCents, taxAmountCents, withholdingCents, vat })}>Modifier</button>{' '}
        <button disabled={!canSave || uploading} onClick={async () => {
          if (window.confirm('Retirer cette ligne de ton dossier ?') &&
              await onEntries(entries.filter(entry => entry.id !== row.id)) && draft?.id === row.id) setDraft(null)
        }}>Retirer</button></div>
        {pointingId === row.id && <QuickPayment key={row.id} row={{ ...row, amountCents,
          ...(taxAmountCents != null && { taxAmountCents }), ...(withholdingCents != null && { withholdingCents }), ...(vat && { vat }) }}
          disabled={!canSave} onCancel={() => setPointingId(null)} onSave={async changed => {
            if (await onEntries(entries.map(item => item.id === changed.id ? changed : item))) setPointingId(null)
          }} />}
        {draftId === row.id && editor}
      </article>)}
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

  return <details className="mg-panel mg-disclosure">
    <summary>Comparer avec un relevé Revolut Pro · facultatif</summary>
    <p style={muted}>Aperçu temporaire du relevé dans cet onglet, séparé de ta compta.</p>
    <label>Importer un relevé CSV <input type="file" accept=".csv,text/csv" onChange={readFile} /></label>
    {message && <p role="status">{message}</p>}
    <Movements title="Mouvements du relevé" rows={rows} />
  </details>
}
