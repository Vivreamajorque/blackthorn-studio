const normalize = value => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const columns = {
  date: ['date', 'completed date', 'date de fin', 'date de finalisation', 'fecha', 'fecha de finalizacion'],
  label: ['description', 'libelle', 'descripcion', 'concepto', 'client', 'cliente'],
  amount: ['amount', 'montant', 'importe', 'total'],
  currency: ['currency', 'devise', 'divisa', 'moneda'],
  state: ['state', 'status', 'statut', 'etat', 'estado'],
  reference: ['reference', 'referencia', 'invoice', 'facture', 'factura'],
}
const completed = new Set(['completed', 'complete', 'completada', 'completado', 'termine', 'terminee', 'execute', 'executee', 'finalise', 'finalisee', 'finalizada', 'finalizado'])

function csvRows(source, delimiter) {
  const rows = []
  let row = [], value = '', quoted = false
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { value += '"'; i++ }
      else if (quoted || !value) quoted = !quoted
      else value += char
    } else if (!quoted && char === delimiter) {
      row.push(value); value = ''
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && source[i + 1] === '\n') i++
      rows.push([...row, value]); row = []; value = ''
    } else value += char
  }
  if (quoted) throw new Error('Une valeur entre guillemets est incomplète.')
  if (row.length || value) rows.push([...row, value])
  return rows.filter(values => values.some(value => value.trim()))
}

function parseDate(value) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(value)
  const eu = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:$| )/.exec(value)
  if (!iso && !eu) return ''
  const date = iso ? iso[0].slice(0, 10) : [eu[3], eu[2].padStart(2, '0'), eu[1].padStart(2, '0')].join('-')
  const parsed = new Date(date)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : ''
}

function parseAmount(value) {
  const normalized = value.replace(/[\s\u00a0\u202f]/g, '').replace(/−/g, '-').replace(',', '.')
  return /^[+-]?\d+(?:\.\d{1,2})?$/.test(normalized) ? Number(normalized) : NaN
}

export function parseGestoriaCsv(source, kind) {
  const csv = source.replace(/^\uFEFF/, '')
  const header = csv.split(/\r?\n/, 1)[0]
  const delimiter = [';', ',', '\t'].find(candidate => {
    const labels = header.split(candidate).map(label => normalize(label.replace(/^"|"$/g, '')))
    return ['date', 'amount', 'label'].every(key => columns[key].some(label => labels.includes(label)))
  })
  if (!delimiter) throw new Error('Colonnes requises : date, description et montant.')
  const [labels, ...rows] = csvRows(csv, delimiter)
  const normalized = labels.map(normalize)
  const indices = Object.fromEntries(Object.entries(columns).map(([key, aliases]) => [key, normalized.findIndex(label => aliases.includes(label))]))
  if (kind === 'bank' && indices.currency === -1) throw new Error('Ajoute la colonne devise avant d’importer un relevé bancaire.')
  const parsed = [], skipped = { currency: 0, state: 0 }
  for (const [index, row] of rows.entries()) {
    const field = key => row[indices[key]]?.trim() || ''
    const state = normalize(field('state'))
    if (kind === 'bank' && state && !completed.has(state)) { skipped.state++; continue }
    const currency = field('currency').toUpperCase()
    if ((kind === 'bank' || currency) && currency !== 'EUR') { skipped.currency++; continue }
    const date = parseDate(field('date'))
    const amount = parseAmount(field('amount'))
    const label = field('label')
    if (!date || !Number.isFinite(amount) || Math.abs(amount) > 100000000 || !label) {
      throw new Error('Ligne ' + (index + 2) + ' à corriger : date, description ou montant invalide.')
    }
    parsed.push({ date, amount, label, reference: field('reference') })
  }
  if (!parsed.length) throw new Error('Aucune ligne exploitable en euros.')
  return { rows: parsed, skipped }
}
