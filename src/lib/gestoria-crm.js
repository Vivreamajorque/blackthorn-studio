import { useEffect, useRef, useState } from 'react'

const path = '/api/gestoria-crm'
const empty = { clients: [], projets: [], prospects: [], liens: {}, factures: {}, journal: [] }

export const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
export const money = cents => euro.format((cents || 0) / 100)
export const uid = prefix => prefix + '_' + Math.random().toString(36).slice(2, 12)
export const toCents = value => Math.round(Number(String(value).replace(',', '.')) * 100) || 0
export const fromCents = cents => cents ? String(cents / 100) : ''

// Factures du registre rattachées à un client : lien explicite, sinon origine (Malt, LiveMentor).
export function clientInvoices(entries, crm, client) {
  return entries
    .filter(e => e.kind === 'invoice' && (e.entity || 'independent') === 'independent')
    .filter(e => crm.liens[e.id] ? crm.liens[e.id].clientId === client.id : (client.source && e.source === client.source))
    .sort((a, b) => b.date.localeCompare(a.date))
}

// Base HT d'une écriture de facture (même logique que le registre).
export const baseCents = e => e.vat?.baseCents ?? e.taxAmountCents ?? e.amountCents

export function useCrm() {
  const [state, setState] = useState(null)
  const [loadState, setLoadState] = useState('loading')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [request, setRequest] = useState(0)
  const pending = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch(path, { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (response.status === 401) window.dispatchEvent(new Event('gestoria-auth-expired'))
      if (!response.ok) throw new Error()
      setState(await response.json())
      setLoadState('ready')
    }).catch(() => { if (!controller.signal.aborted) setLoadState('error') })
    return () => controller.abort()
  }, [request])

  async function save(update, message = 'Enregistré.') {
    if (!state || pending.current) return false
    pending.current = true
    setSaving(true)
    setFeedback(null)
    try {
      // Les modifications sont des fonctions : si un client a coché une action entre-temps,
      // on réapplique la modification sur la version la plus récente (une seule fois).
      let base = state
      let response, result
      for (let attempt = 0; attempt < 2; attempt++) {
        response = await fetch(path, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revision: base.revision, data: update(base.data) }),
        })
        if (response.status === 401) window.dispatchEvent(new Event('gestoria-auth-expired'))
        result = await response.json()
        if (response.status !== 409) break
        base = result
        setState(result)
      }
      if (response.status === 409) {
        throw new Error('Les fiches ont changé dans une autre fenêtre. Elles ont été rechargées : refais ta modification.')
      }
      if (!response.ok) throw new Error(result.error)
      setState(result)
      setFeedback({ text: message })
      return result.data
    } catch (error) {
      setFeedback({ error: true, text: error.message || 'Enregistrement non confirmé. Recharge pour vérifier.' })
      return false
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  return { crm: state?.data || empty, loadState, saving, feedback, save, reload: () => { setLoadState('loading'); setRequest(r => r + 1) } }
}
