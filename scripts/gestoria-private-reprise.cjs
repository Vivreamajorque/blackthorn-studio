const fs = require('node:fs')
const { createRequire } = require('node:module')

let step = 'environment'

async function main() {
  const manifest = process.env.GESTORIA_LEDGER_REPRISE
  if (!manifest) return
  if (process.env.VERCEL_ENV !== 'preview' ||
      process.env.VERCEL_GIT_COMMIT_REF !== 'feature/mi-gestoria-amely' ||
      process.env.GESTORIA_URL !== 'https://mi-gestoria-amely.vercel.app') throw new Error('Unexpected import environment')
  step = 'load-validator'
  const apiPath = require.resolve('../api/gestoria-workspace.js')
  const api = { exports: {} }
  const { validWorkspace, readWorkspace } = new Function('require', 'module', 'exports',
    fs.readFileSync(apiPath, 'utf8') + '\nreturn { validWorkspace, readWorkspace }')(createRequire(apiPath), api, api.exports)
  step = 'validate-incoming'
  const incoming = JSON.parse(manifest)
  const key = entry => entry.reference.trim().toUpperCase()
  if (!validWorkspace({ entries: incoming, records: {} }) || incoming.some(entry => !key(entry)) ||
      new Set(incoming.map(key)).size !== incoming.length) throw new Error('Invalid private manifest')
  step = 'blob-module'
  const blob = await import('@vercel/blob')
  const path = 'mi-gestoria/personal/v1/workspace.json'
  for (let attempt = 0; attempt < 4; attempt++) {
    step = 'read-ledger'
    const current = await readWorkspace(blob, path)
    step = 'merge-ledger'
    const entries = [...current.data.entries]
    let added = 0
    let enriched = 0
    let conflicts = 0
    for (const row of incoming) {
      const matches = entries.filter(saved => key(saved) === key(row) && saved.kind === row.kind)
      if (!matches.length) { entries.push(row); added++; continue }
      const saved = matches[0]
      if (matches.length !== 1 || saved.date !== row.date || saved.amountCents !== row.amountCents ||
          (saved.currency || 'EUR') !== (row.currency || 'EUR')) { conflicts++; continue }
      const next = { ...row, ...saved }
      if (row.paymentDate && !saved.paymentDate) {
        next.payment = 'paid'
        next.paymentDate = row.paymentDate
      }
      if (JSON.stringify(next) !== JSON.stringify({ ...next, ...saved }) ||
          Object.keys(next).some(field => !(field in saved))) {
        entries[entries.indexOf(saved)] = next
        enriched++
      }
    }
    const data = { ...current.data, entries }
    if (!validWorkspace(data)) throw new Error('Invalid merged workspace')
    if (added || enriched) {
      try {
        step = 'save-ledger'
        await blob.put(path, JSON.stringify(data), {
          access: 'private', addRandomSuffix: false, contentType: 'application/json',
          allowOverwrite: current.revision !== null,
          ...(current.revision !== null && { ifMatch: current.revision }),
        })
      } catch (error) {
        if (error instanceof blob.BlobPreconditionFailedError ||
            (current.revision === null && (await readWorkspace(blob, path)).revision !== null)) continue
        throw error
      }
    }
    step = 'verify-ledger'
    const verified = await readWorkspace(blob, path)
    const present = incoming.filter(row => verified.data.entries.some(saved => key(saved) === key(row) && saved.kind === row.kind))
    if (present.length !== incoming.length || !verified.revision) throw new Error('Private ledger readback failed')
    console.log('MG_REPRISE_VERIFIED ' + JSON.stringify({ added, enriched, conflicts, invoices: present.filter(row => row.kind === 'invoice').length, expenses: present.filter(row => row.kind === 'expense').length }))
    return
  }
  throw new Error('Concurrent changes prevented a safe import')
}

main().catch(error => {
  console.error('MG_REPRISE_FAILED ' + step + ' ' + (error?.name || 'Error'))
  if (step === 'save-ledger') {
    const message = String(error?.message || '').replace(/https?:\/\/[^\s]+/g, '[url]')
      .replace(/[a-zA-Z0-9_\-]{20,}/g, '[identifier]').replace(/\s+/g, ' ').slice(0, 180)
    console.error('MG_REPRISE_SAVE_REASON ' + message)
  }
  if (step === 'environment') console.error('MG_REPRISE_SCOPE ' + JSON.stringify({
    preview: process.env.VERCEL_ENV === 'preview',
    branch: process.env.VERCEL_GIT_COMMIT_REF === 'feature/mi-gestoria-amely',
    url: process.env.GESTORIA_URL === 'https://mi-gestoria-amely.vercel.app',
  }))
  process.exitCode = 1
})
