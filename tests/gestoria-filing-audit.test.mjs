import { test } from 'node:test'
import assert from 'node:assert/strict'
import { preparationChecks, rentWithholdings } from '../src/lib/gestoria-filing-audit.mjs'
import { trackedFilingDeadline } from '../src/lib/gestoria-calendar.mjs'
import { vatSummary } from '../src/lib/gestoria-models.mjs'
import { irpfForecast, minoracion } from '../src/lib/gestoria-irpf.mjs'

const year = 2026
const today = '2026-11-10'
const expense = (id, date, fields) => ({ id, kind: 'expense', date, ...fields })

test('rent withholding follows the actual payment quarter and separates invoices to reconcile', () => {
  const entries = [
    expense('blackthorn-rent-sept', '2026-09-30', {
      payment: 'paid', paymentDate: '2026-10-02', attachment: {}, documentAmounts: { rentWithholdingCents: 16667 },
    }),
    expense('blackthorn-rent-oct', '2026-10-01', { attachment: {}, documentAmounts: { rentWithholdingCents: 16667 } }),
    expense('blackthorn-rent-nov', '2026-11-01', { documentAmounts: { rentWithholdingCents: 16667 } }),
  ]
  assert.deepEqual(rentWithholdings(entries, { year, quarter: 3, today }), { documented: 0, confirmed: 0, pending: 0, missing: 0 })
  assert.deepEqual(rentWithholdings(entries, { year, quarter: 4, today }), { documented: 33334, confirmed: 16667, pending: 16667, missing: 1 })
})

test('the IRPF preparation warns about missing status, rules, expenses and prior installments', () => {
  const row = { model: '130', quarter: 4, status: 'unknown' }
  const filings = [{ model: '130', quarter: 3, status: 'filed' }]
  const entries = [expense('rent', '2026-10-01', {})]
  const context = { row, year, entries, filings, today }
  assert.equal(preparationChecks(context).length, 5)
  assert.deepEqual(preparationChecks({
    ...context, row: { ...row, status: 'to_prepare' }, entries: [{ ...entries[0], taxAmountCents: 1000 }],
    settings: { basis: 'accrual', priorNetCents: 900000, filed: { 3: { box07: 100 } } },
  }), [])
})

test('the VAT ledger does not infer a zero return from charges outside VAT', () => {
  const rows = [expense('reta', '2026-10-01', { vat: { category: 'excluded' } })]
  assert.equal(vatSummary(rows, { year, quarter: 4, today }).balance, null)
  const domestic = expense('rent', '2026-10-01', {
    vat: { category: 'buy_es', date: '2026-10-01', baseCents: 87720, quotaCents: 18421, deductibleCents: 18421 },
  })
  assert.equal(vatSummary([...rows, domestic], { year, quarter: 4, today }).balance, -18421)
})

test('IRPF thresholds and earlier filed boxes follow their own bases', () => {
  assert.deepEqual([900000, 900001, 1000001, 1100001, 1200001].map(minoracion), [10000, 7500, 5000, 2500, 0])
  const rows = [{ kind: 'invoice', date: '2026-10-01', taxAmountCents: 1000000 }]
  const settings = { basis: 'accrual', priorNetCents: 900000, filed: {
    3: { box07: 50000, box15: 0, box16: 1000, box19: 39000 },
  } }
  const last = irpfForecast(rows, { year, today, settings }).quarters[3]
  assert.equal(last.fields['05'], 49000)
  assert.equal(last.due, 131000)
})

test('the annual rent reporting deadline is distinct from the quarterly withholding payment', () => {
  assert.deepEqual(trackedFilingDeadline(2025, { model: '180' }), { date: '2026-02-02', indicative: false })
  assert.deepEqual(trackedFilingDeadline(2026, { model: '180' }), { date: '2027-02-01', indicative: true })
  assert.equal(trackedFilingDeadline(2026, { model: '115', quarter: 4 }).date, '2027-01-20')
})
