export const inboxCategories = {
  fees: 'SumUp et commissions',
  social: 'Cotisations RETA',
  rent: 'Loyer du local',
  utilities: 'Électricité, eau et internet',
  equipment: 'Matériel et fournitures',
  insurance: 'Assurance',
  filing: 'Déclaration ou reçu fiscal',
  statement: 'Relevé ou rapport',
  other: 'Autre pièce',
}

const identifier = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/
const nameIsValid = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 160
const cents = value => Number.isSafeInteger(value) && Math.abs(value) <= 1e10

export function validInboxItem(item) {
  if (!item || typeof item !== 'object' || Object.keys(item).some(key => ![
    'attachment', 'addedAt', 'category', 'analysis', 'date', 'totalCents', 'vatCents', 'baseCents', 'reference',
  ].includes(key))) return false
  const { attachment, addedAt, category, analysis, date, reference } = item
  return attachment && Object.keys(attachment).length === 3 &&
    typeof attachment.id === 'string' && identifier.test(attachment.id) && nameIsValid(attachment.name) &&
    ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/csv'].includes(attachment.mime) &&
    typeof addedAt === 'string' && /^20\d{2}-\d{2}-\d{2}T/.test(addedAt) && Number.isFinite(Date.parse(addedAt)) &&
    Object.hasOwn(inboxCategories, category) && ['text', 'filename'].includes(analysis) &&
    (date === undefined || typeof date === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(date) &&
      Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date) &&
    (reference === undefined || typeof reference === 'string' && reference.length <= 100) &&
    ['totalCents', 'vatCents', 'baseCents'].every(key => item[key] === undefined || cents(item[key]))
}

export function hasInboxAttachment(data, id) {
  return (data.inbox || []).some(item => item.attachment.id === id) ||
    data.entries.some(item => item.attachment?.id === id) ||
    Object.values(data.records).some(record => (record.archives || []).some(item => item.attachment.id === id) ||
      Object.values(record.filingDetails || {}).some(item => item.attachment?.id === id))
}

export function resolveInboxItem(data, id, decision) {
  const item = (data.inbox || []).find(row => row.attachment.id === id)
  if (!item) throw new Error('Cette pièce a déjà été traitée.')
  const inbox = data.inbox.filter(row => row.attachment.id !== id)
  if (decision.kind === 'expense') {
    if (data.entries.length >= 1000) throw new Error('Le registre a atteint sa capacité maximale.')
    const reference = decision.reference.trim()
    const duplicate = data.entries.some(row => row.entity === 'blackthorn' && row.kind === 'expense' &&
      (row.attachment?.id === id || reference && row.reference.trim().toLowerCase() === reference.toLowerCase() &&
        [row.amountCents, row.documentAmounts?.totalCents, row.documentAmounts?.dueCents].includes(decision.amountCents) && row.date === decision.date && (!row.currency || row.currency === 'EUR')))
    if (duplicate) throw new Error('Une charge correspondante existe déjà. Rapproche la pièce avant de l’ajouter.')
    const expenseCategory = decision.category === 'social' ? 'social' : decision.category === 'equipment' ? undefined : 'professional'
    const entry = {
      id: 'inbox-' + id, kind: 'expense', entity: 'blackthorn', source: 'direct', currency: 'EUR',
      label: decision.label, reference, date: decision.date, amountCents: decision.amountCents, payment: 'unknown',
      attachment: item.attachment, ...(expenseCategory && { expenseCategory }),
      taxReview: 'Montant saisi depuis la boîte de réception. Vérifier la part IRPF et TVA avec le justificatif.',
    }
    return { ...data, inbox, entries: [...data.entries, entry] }
  }
  const scope = 'blackthorn:' + decision.year
  const record = data.records[scope] || { tasks: {}, filings: {}, notices: [] }
  const archives = record.archives || []
  if (archives.length >= 100) throw new Error('Les archives de cet exercice sont pleines.')
  const archived = { id: 'inbox-' + id, label: decision.label, type: 'supporting', attachment: item.attachment,
    ...(decision.date && { date: decision.date }), ...(decision.reference && { reference: decision.reference }) }
  return { ...data, inbox, records: { ...data.records, [scope]: { ...record, archives: [...archives, archived] } } }
}
