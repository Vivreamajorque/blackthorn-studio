const { requireSession } = require('../server/session.cjs')
const { queryAll, DBS } = require('../server/notion.cjs')

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Lecture seule' })
  }
  try {
    const user = await requireSession(req, res)
    if (!user) return
    if (user.role !== 'amely') return res.status(403).json({ error: 'Accès réservé au compte propriétaire' })
    const year = req.query.year
    if (!['2025', '2026'].includes(year)) return res.status(400).json({ error: 'Année non prise en charge' })

    const filter = { and: [
      { property: 'Date', date: { on_or_after: year + '-01-01' } },
      { property: 'Date', date: { before: (Number(year) + 1) + '-01-01' } },
    ] }
    const [{ dateOf, receipts, number, paymentMethod, isDeposit, dataWarnings, unique }, sessions, expenses] = await Promise.all([
      import('../src/lib/finance.mjs'),
      queryAll(DBS.sessions, { filter }),
      queryAll(DBS.expenses, { filter }),
    ])
    const withinYear = row => dateOf(row).startsWith(year + '-')
    const paid = receipts(sessions.filter(withinYear))
    return res.status(200).json({
      year: Number(year),
      receipts: paid.map(row => ({
        date: dateOf(row), amount: number(row, 'Prix'), method: paymentMethod(row),
        label: isDeposit(row) ? 'Versement client' : 'Séance',
      })),
      expenses: unique(expenses.filter(withinYear)).map(row => ({
        date: dateOf(row), amount: number(row, 'Montant'),
        label: row.properties?.['Catégorie']?.select?.name || 'Autre',
      })),
      reconciliationWarnings: dataWarnings(paid).length,
    })
  } catch {
    return res.status(503).json({ error: 'Les données du studio sont momentanément indisponibles.' })
  }
}
