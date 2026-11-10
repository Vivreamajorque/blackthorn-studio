function readPortalPage() {
  const host = location.hostname
  const social = ['portal.seg-social.gob.es', 'sede.seg-social.gob.es', 'sede-tu.seg-social.gob.es', 'w6.seg-social.es'].includes(host)
  const fiscal = ['sede.agenciatributaria.gob.es', 'www1.agenciatributaria.gob.es', 'www2.agenciatributaria.gob.es', 'www3.agenciatributaria.gob.es'].includes(host)
  if (location.protocol !== 'https:' || (!social && !fiscal)) return null

  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
  const asRef = value => {
    const text = (value || '').trim().toUpperCase()
    return /^[A-Z0-9][A-Z0-9/-]{3,39}$/.test(text) ? text : ''
  }
  const asDate = value => {
    const found = (value || '').match(/^(\d{2})[/-](\d{2})[/-](20\d{2})(?:\s|$)/)
    return found ? [found[3], found[2], found[1]].join('-') : ''
  }
  const asPeriod = value => {
    const months = [...(value || '').matchAll(/\b(0[1-9]|1[0-2])[/-](20\d{2})\b/g)]
    return [...new Set(months.map(item => item[2] + '-' + item[1]))].slice(0, 2).join(' à ')
  }
  const asCents = value => {
    const text = (value || '').replace(/[€\s]/g, '')
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{2})?$/.test(text)) return null
    const [euros, cents = '00'] = text.replaceAll('.', '').split(',')
    const amount = Number(euros) * 100 + Number(cents)
    return amount <= 1e10 ? amount : null
  }
  const selected = pattern => {
    const input = [...document.querySelectorAll('select,input[role="combobox"]')].find(element =>
      element.getClientRects().length && !element.multiple && pattern.test(normalize([
        element.name, element.id, element.getAttribute('aria-label') || '',
        ...[...(element.labels || [])].map(label => label.innerText),
      ].join(' '))))
    return input?.selectedOptions?.[0]?.innerText || input?.value || ''
  }
  const selectedModel = fiscal && selected(/modelo/)
  const selectedYear = fiscal && selected(/ejercicio/)
  const visibleText = cell => cell.innerText.trim()
  const results = []

  for (const table of document.querySelectorAll('table')) {
    if (!table.getClientRects().length) continue
    const rows = [...table.rows].filter(row => row.getClientRects().length)
    const headerRow = rows.find(row => [...row.cells].filter(cell => cell.tagName === 'TH').length >= 2)
    if (!headerRow) continue
    const headers = [...headerRow.cells].map(cell => normalize(visibleText(cell)))
    const column = pattern => headers.findIndex(header => pattern.test(header))
    const periodo = column(/^(?:periodo|mes)(?:\s|$)/)
    const amount = column(/^importe(?:\s|$)|^cuota(?:\s|$)/)
    const receiptRef = column(/liq.*doc.*exp|^referencia|recibo/)
    const filedRef = column(/justificante|^csv$/)
    const subject = column(/^concepto$|^asunto$/)
    const certificate = column(/certificado/)
    const notified = column(/fecha.*notifica/)
    const issued = column(/fecha.*emision/)
    const read = column(/^leida?$/)
    const modelColumn = column(/^modelo/)
    const exercise = column(/^ejercicio|^ano$/)
    const filedDate = column(/fecha.*presentacion|^fecha$/)
    const status = column(/^estado$/)
    const regime = column(/^regimen$/)
    let kind
    if (social && periodo >= 0 && amount >= 0) {
      if (column(/liq.*doc.*exp/) >= 0) kind = 'debts'
      else if (/recibo|cuota/.test(normalize([document.title, table.caption?.innerText || '',
        ...[...document.querySelectorAll('h1,h2')].map(item => item.innerText)].join(' ')))) kind = 'receipts'
    }
    if (fiscal && certificate >= 0 && subject >= 0 && (notified >= 0 || issued >= 0)) kind = 'notifications'
    if (fiscal && filedRef >= 0 && (modelColumn >= 0 || selectedModel)) kind = 'filings'
    if (!kind) continue

    const parsed = rows.filter(row => row !== headerRow && row.cells.length === headers.length).flatMap(row => {
      const cell = index => index < 0 ? '' : visibleText(row.cells[index])
      if (kind === 'debts' || kind === 'receipts') {
        if (regime >= 0 && !/0521|autonom/.test(normalize(cell(regime)))) return []
        const period = asPeriod(cell(periodo))
        const amountCents = asCents(cell(amount))
        const reference = asRef(cell(receiptRef))
        if (!period || amountCents === null || (kind === 'debts' && !reference)) return []
        return [{ period, amountCents, ...(reference && { reference }) }]
      }
      if (kind === 'notifications') {
        const reference = asRef(cell(certificate))
        const title = cell(subject).replace(/\s+/g, ' ').slice(0, 90)
        const date = asDate(cell(notified)) || asDate(cell(issued))
        const readFlag = normalize(cell(read))
        if (!reference || !title || !date) return []
        return [{ reference, subject: title, date, ...(['si', 'no'].includes(readFlag) && { read: readFlag === 'si' }) }]
      }
      if (/baja|anulad|cancelad/.test(normalize(cell(status)))) return []
      const reference = asRef(cell(filedRef))
      const model = (cell(modelColumn) || selectedModel).match(/(?:^|\b)(\d{3})(?:\b|$)/)?.[1]
      const year = (cell(exercise) || selectedYear).match(/\b20\d{2}\b/)?.[0]
      const term = cell(periodo).toUpperCase().match(/^(?:[1-4]T|0[1-9]|1[0-2])$/)?.[0]
      const date = asDate(cell(filedDate))
      if (!reference || !model || !year) return []
      return [{ reference, model, period: year + (term ? ' · ' + term : ''), ...(date && { date }) }]
    })
    if (parsed.length) results.push({ kind, rows: parsed })
  }
  if (!results.length) return null
  const { kind } = results[0]
  const unique = new Map(results.filter(item => item.kind === kind).flatMap(item => item.rows)
    .map(row => [row.reference || row.period + ':' + row.amountCents, row]))
  return { kind, capturedAt: new Date().toISOString(), rows: [...unique.values()].slice(0, 60) }
}
