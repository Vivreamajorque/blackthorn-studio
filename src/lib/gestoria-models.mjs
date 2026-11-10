import { inActivityYear } from './gestoria-calendar.mjs'

const aeat = 'https://sede.agenciatributaria.gob.es/Sede'
const importass = 'https://portal.seg-social.gob.es/wps/portal/importass/importass'
export const debtUrl = importass + '/mapaWeb?1dmy=&urile=wcm%3Apath%3A%2Fwps%2Fwcm%2Fconnect%2Fimportass%2Fimportass_contenidos%2Fcategorias%2Fconsulta+de+pagos+y+deudas%2Fpagosdevoluciones_%2Fconsultadeudas'
export const models = {
  130: { url: aeat + '/tramitacion/G601.shtml', sources: 'Factures, frais, cotisations déductibles, retenues et cases des acomptes déjà déposés.' },
  303: { url: aeat + '/tramitacion/G414.shtml', sources: 'Factures émises et reçues, régime d’IVA, régularisations, investissements et solde antérieur à compenser.' },
  349: { url: aeat + '/procedimientos/GI28.shtml', sources: 'Vérifie le ROI, la périodicité et chaque numéro de TVA intracommunautaire dans VIES.' },
  390: { url: aeat + '/iva/modelo-390-iva-declaracion-resumen-anual.html', sources: 'Vérifie l’obligation, puis réunis les quatre 303 déposés, les totaux annuels par taux et les opérations intracommunautaires.' },
  100: { url: aeat + '/Renta.html', sources: 'Vérifie les données fiscales, les revenus d’activité et salariés, les revenus étrangers, les acomptes 130 et les données familiales.' },
  111: { url: aeat + '/procedimientos/GH01.shtml', sources: 'Rassemble les salaires et honoraires soumis à retenue, les bases, retenues et nombres de bénéficiaires par catégorie.' },
  180: { url: aeat + '/procedimientos/GI00.shtml', sources: 'Rapproche les paiements au bailleur, les retenues effectuées et les Modelo 115 de l’exercice.' },
  115: { url: aeat + '/procedimientos/GH02.shtml', sources: 'Vérifie le bail professionnel et la retenue, puis rassemble les bases, les retenues et le nombre de bailleurs concernés.' },
  RETA: { url: importass + '/Categorias/Consulta%2Bde%2Bpagos%2By%2Bdeudas/ConsultaRecibos', sources: 'Vérifie le reçu du mois et rapproche le débit bancaire. Consulte les dettes séparément dans Importass.' },
}

export const vatCategories = {
  excluded: 'Hors calcul TVA après vérification',
  sale_es: 'Vente en Espagne · taux national',
  sale_eu: 'Service B2B intracommunautaire',
  sale_other: 'Service hors territoire · règles de localisation',
  buy_es: 'Achat courant · TVA espagnole',
  buy_eu: 'Service intracommunautaire · autoliquidation',
  buy_reverse: 'Autre achat courant · autoliquidation',
}

const domesticRates = { 0: ['150', '151', '152'], 4: ['01', '02', '03'], 10: ['04', '05', '06'], 21: ['07', '08', '09'] }

export function vatSummary(entries, { year, quarter, startDate, today }) {
  const boxes = {}
  const rates = new Set()
  const counterparts = new Map()
  const missing = []
  const missingIds = []
  let count = 0
  let output = 0
  let deductible = 0
  const add = (key, value) => { boxes[key] = (boxes[key] || 0) + value }
  for (const row of entries) {
    const date = row.vat?.date || row.date
    if (!inActivityYear(date, year, startDate) || date > today ||
        (quarter && Math.ceil(Number(date.slice(5, 7)) / 3) !== quarter)) continue
    if (row.taxReview) missing.push(row)
    if (!row.vat) { if (!row.taxReview) missing.push(row); continue }
    const { category, baseCents, quotaCents, deductibleCents, country, id, rate } = row.vat
    if (category === 'excluded') continue
    count++
    if (category === 'sale_es') {
      const [base, percent, quota] = domesticRates[rate]
      add(base, baseCents)
      add(quota, quotaCents)
      boxes[percent] = rate
      rates.add(percent)
      output += quotaCents
    }
    if (category === 'sale_other') add('120', baseCents)
    if (category === 'sale_eu') add('59', baseCents)
    if (category === 'buy_eu' || category === 'buy_reverse') {
      add(category === 'buy_eu' ? '10' : '12', baseCents)
      add(category === 'buy_eu' ? '11' : '13', quotaCents)
      output += quotaCents
    }
    if (category.startsWith('buy_') && deductibleCents) {
      add(category === 'buy_eu' ? '36' : '28', baseCents)
      add(category === 'buy_eu' ? '37' : '29', deductibleCents)
      deductible += deductibleCents
    }
    if (category === 'sale_eu' || category === 'buy_eu') {
      if (!country || !id) { missingIds.push(row); continue }
      const operation = category === 'sale_eu' ? 'S' : 'I'
      const key = [country, id, operation].join(':')
      const prior = counterparts.get(key)
      counterparts.set(key, { country, id, operation, label: row.label, baseCents: (prior?.baseCents || 0) + baseCents })
    }
  }
  if (count) Object.assign(boxes, { '27': output, '45': deductible, '46': output - deductible })
  return { boxes, rates, count, missing, missingIds, counterparts: [...counterparts.values()], balance: count ? output - deductible : null }
}
