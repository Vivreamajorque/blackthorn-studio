const fs = require('node:fs')
const { createRequire } = require('node:module')
const { resolve } = require('node:path')

async function main() {
  if (process.env.VERCEL_ENV !== 'preview' ||
      process.env.VERCEL_GIT_COMMIT_REF !== 'feature/mi-gestoria-amely' ||
      process.env.GESTORIA_URL !== 'https://mi-gestoria-amely.vercel.app') {
    throw new Error('Unexpected deployment environment')
  }
  const apiPath = resolve('api/gestoria-workspace.js')
  const api = { exports: {} }
  const { validWorkspace, readWorkspace } = new Function('require', 'module', 'exports',
    fs.readFileSync(apiPath, 'utf8') + '\nreturn { validWorkspace, readWorkspace }')(createRequire(apiPath), api, api.exports)
  const incoming = JSON.parse(process.env.GESTORIA_LEDGER_REPRISE || '[]')
  const key = 'independent:2026'
  const emptyRecord = { tasks: {}, filings: {}, notices: [] }
  if (incoming.length !== 5 ||
      !validWorkspace({ entries: [], records: { [key]: { ...emptyRecord, notices: incoming } } })) {
    throw new Error('Invalid import manifest')
  }
  const blob = await import('@vercel/blob')
  const path = 'mi-gestoria/personal/v1/workspace.json'
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await readWorkspace(blob, path)
    if (!current.revision) throw new Error('Workspace revision unavailable')
    const record = current.data.records[key] || emptyRecord
    const existing = new Set(record.notices.map(notice => notice.id))
    const added = incoming.filter(notice => !existing.has(notice.id))
    const data = {
      ...current.data,
      records: { ...current.data.records, [key]: { ...record, notices: [...record.notices, ...added] } },
    }
    if (!validWorkspace(data)) throw new Error('Invalid merged workspace')
    if (added.length) {
      try {
        await blob.put(path, JSON.stringify(data), {
          access: 'private', addRandomSuffix: false, allowOverwrite: true,
          contentType: 'application/json', ifMatch: current.revision,
        })
      } catch (error) {
        if (error instanceof blob.BlobPreconditionFailedError) continue
        throw error
      }
    }
    const saved = await readWorkspace(blob, path)
    const verified = incoming.map(notice => saved.data.records[key]?.notices.find(row => row.id === notice.id))
    if (verified.some((notice, index) => !notice || notice.amountCents !== incoming[index].amountCents ||
        notice.kind !== incoming[index].kind || notice.title !== incoming[index].title)) {
      throw new Error('Import verification failed')
    }
    console.log('MG_IMPORTASS_VERIFIED ' + JSON.stringify({
      added: added.length, debts: verified.filter(notice => notice.kind === 'debt').length,
      followUp: verified.filter(notice => !notice.kind).length,
    }))
    return
  }
  throw new Error('Concurrent workspace changes')
}

main().catch(() => console.error('MG_IMPORTASS_FAILED')).finally(() => { process.exitCode = 1 })
