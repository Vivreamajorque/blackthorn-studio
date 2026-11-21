import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDocumentHtml, missingForInvoice, totalsOf } from '../src/lib/gestoria-documents.mjs'

const emetteur = { nom: 'Amely Debora Attias', activite: 'Consultante', nif: 'Z3041510H', adresse: 'Carrer de la Sirena\n07639 Sa Ràpita', email: 'a@b.es', iban: 'ES2515830001109009060095' }
const client = { nom: 'Nisha', raisonSociale: 'Nisha Sage-Femme SRL', nif: 'BE1016591276', adresse: 'Rue Edmond Delcourt 3\n1070 Anderlecht' }

test('facture en autoliquidation : mentions légales, TVA du client, total sans IVA, IBAN', () => {
  const html = buildDocumentHtml({ kind: 'facture', numero: 'A-2026-001', date: '2026-11-21', due: '2026-12-06', regime: 'eu', irpf: 0,
    lignes: [{ description: 'Acompte <b>', quantite: 1, prixCents: 55000 }], client, emetteur })
  assert.ok(html.includes('Inversión del sujeto pasivo') && html.includes('art. 69'))
  assert.ok(html.includes('BE1016591276') && html.includes('Z3041510H'))
  assert.ok(html.includes('ES25 1583 0001 1090 0906 0095'))
  assert.ok(html.includes('Acompte &lt;b&gt;'), 'le texte saisi est échappé')
  assert.ok(html.includes('IVA 0 %') && html.includes('21/11/2026') && html.includes('06/12/2026'))
  assert.match(html.replace(/ | /g, ' '), /Total à payer<\/span><span>550,00 €/)
})

test('devis : validité, échéancier, périmètre et signature', () => {
  const html = buildDocumentHtml({ kind: 'devis', numero: 'DEV-2026-002', date: '2026-11-21', validite: '2026-12-21', regime: 'eu', irpf: 0,
    lignes: [{ description: 'App', quantite: 1, prixCents: 125000 }], perimetre: ['Parcours de location'],
    echeances: [{ label: 'Novembre', date: '2026-11-30', montantCents: 75000 }], client, emetteur })
  for (const text of ['Valable jusqu’au', '21/12/2026', 'Échéancier', 'Parcours de location', 'Bon pour accord', 'Signature']) assert.ok(html.includes(text), text)
  assert.ok(!html.includes('Paiement'), 'pas de bloc IBAN sur un devis')
})

test('IVA 21 % avec retenue IRPF : totaux et ligne de retenue', () => {
  const t = totalsOf([{ description: 'x', quantite: 1, prixCents: 100000 }], 'es21', 15)
  assert.deepEqual([t.base, t.quota, t.withholding, t.total], [100000, 21000, 15000, 106000])
  const html = buildDocumentHtml({ kind: 'facture', numero: 'A-1', date: '2026-01-05', regime: 'es21', irpf: 15, lignes: [{ description: 'x', quantite: 1, prixCents: 100000 }], client, emetteur })
  assert.ok(html.includes('Retención IRPF 15 %') && !html.includes('Inversión'))
})

test('une facture à qui il manque une mention obligatoire est signalée', () => {
  assert.deepEqual(missingForInvoice({ emetteur, client, regime: 'eu' }), [])
  assert.deepEqual(missingForInvoice({ emetteur: { nom: 'A' }, client: { nom: 'N' }, regime: 'eu' }),
    ['ton NIF', 'ton adresse', 'l’adresse du client', 'le numéro de TVA du client'])
  assert.deepEqual(missingForInvoice({ emetteur, client: { ...client, nif: '' }, regime: 'es21' }), [], 'le NIF client n’est requis qu’en autoliquidation')
})
