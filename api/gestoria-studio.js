const { requireSession } = require('../server/session.cjs')
const { queryAll, DBS } = require('../server/notion.cjs')
const supportedYear = year => typeof year === 'string' && /^20(25|26|27)$/.test(year)

async function readStudioSales(year) {
  const filter = { and: [
    { property: 'Date', date: { on_or_after: year + '-01-01' } },
    { property: 'Date', date: { before: (Number(year) + 1) + '-01-01' } },
  ] }
  const [{ dateOf, receipts, number, paymentMethod, isDeposit, dataWarnings }, sessions] = await Promise.all([
    import('../src/lib/finance.mjs'), queryAll(DBS.sessions, { filter }),
  ])
  const paid = receipts(sessions.filter(row => dateOf(row).startsWith(year + '-')))
  return {
    year: Number(year),
    receipts: paid.map(row => ({
      date: dateOf(row), amount: number(row, 'Prix'), method: paymentMethod(row),
      label: isDeposit(row) ? 'Versement client' : 'Séance',
    })),
    reconciliationWarnings: dataWarnings(paid).length,
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Lecture seule' })
  }
  try {
    const user = await requireSession(req, res)
    if (!user) return
    const year = req.query.year
    if (!supportedYear(year)) return res.status(400).json({ error: 'Année non prise en charge' })
    return res.status(200).json(await readStudioSales(year))
  } catch {
    return res.status(503).json({ error: 'Les ventes du studio sont momentanément indisponibles.' })
  }
}
module.exports.readStudioSales = readStudioSales
module.exports.supportedYear = supportedYear
