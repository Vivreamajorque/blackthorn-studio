import assert from 'node:assert/strict'
import { test } from 'node:test'
import { analyseText, receiveInboxFile } from '../server/gestoria-inbox.cjs'
import { hasInboxAttachment, resolveInboxItem, validInboxItem } from '../src/lib/gestoria-inbox.mjs'

const empty = { entries: [], records: {} }
const item = {
  attachment: { id: 'ba921a00-928e-4260-9912-c7254fa822de', name: 'Endesa.pdf', mime: 'application/pdf' },
  addedAt: '2026-11-10T12:00:00.000Z', category: 'utilities', analysis: 'text', date: '2026-08-18',
  totalCents: 5623,
}

test('invoice dates, domestic VAT and totals are suggested without confusing percentage with amount', () => {
  const lines = 'Endesa\nFecha emisión factura: 18/08/2026\nNº factura: P26CON035166973\nTotal 56,23 €\nIVA normal 21 % s/ 46,47 ..... 9,76 €'
  assert.deepEqual(analyseText('factura.pdf', lines, 'application/pdf'), {
    category: 'utilities', analysis: 'text', date: '2026-08-18', reference: 'P26CON035166973',
    totalCents: 5623, baseCents: 4647, vatCents: 976,
  })
  assert.deepEqual(analyseText('photo.jpg', '', 'image/jpeg'), { category: 'other', analysis: 'filename' })
  assert.equal(analyseText('rapport.csv', 'Date;Montant;Commission', 'text/csv').totalCents, undefined)
})

test('the owner can archive an item and exact duplicates are recognized afterwards', () => {
  assert.equal(validInboxItem(item), true)
  const data = resolveInboxItem({ ...empty, inbox: [item] }, item.attachment.id,
    { kind: 'archive', label: 'Endesa', date: item.date, year: 2026 })
  assert.equal(data.inbox.length, 0)
  assert.equal(data.records['blackthorn:2026'].archives[0].attachment, item.attachment)
  assert.equal(hasInboxAttachment(data, item.attachment.id), true)
})

test('expense import keeps payment and tax unconfirmed and detects existing invoice gross totals', () => {
  const decision = { kind: 'expense', label: 'Électricité', date: item.date, amountCents: item.totalCents,
    reference: 'TEST-2026', category: 'utilities' }
  const data = resolveInboxItem({ ...empty, inbox: [item] }, item.attachment.id, decision)
  assert.equal(data.entries[0].payment, 'unknown')
  assert.equal(data.entries[0].vat, undefined)
  assert.throws(() => resolveInboxItem({ ...data, inbox: [item], entries: [{
    ...data.entries[0], attachment: undefined, amountCents: 4000, documentAmounts: { totalCents: item.totalCents },
  }] }, item.attachment.id, decision), /correspondante/)
})

test('the upload stores each document once and does not create a charge', async () => {
  const blobs = new Map()
  let revisions = 0
  const blob = {
    async get(path) {
      const item = blobs.get(path)
      return item && { blob: { url: path, etag: item.etag, contentType: item.contentType }, stream: new Response(item.value).body }
    },
    async head(path) { return { etag: blobs.get(path).etag } },
    async put(path, value, options) {
      blobs.set(path, { value, etag: 'rev-' + ++revisions, contentType: options.contentType })
    },
  }
  const file = { name: 'SumUp.csv', mime: 'text/csv', base64: Buffer.from('Date;Total;Commission\n2026-08-01;100;1').toString('base64') }
  assert.deepEqual(await receiveInboxFile(blob, file), { received: true })
  assert.deepEqual(await receiveInboxFile(blob, file), { duplicate: true })
  const workspace = JSON.parse(blobs.get('mi-gestoria/personal/v1/workspace.json').value)
  assert.equal(workspace.inbox.length, 1)
  assert.equal(workspace.inbox[0].category, 'fees')
  assert.equal(workspace.entries.length, 0)
})
