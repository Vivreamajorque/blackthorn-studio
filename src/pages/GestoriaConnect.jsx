import React, { useState } from 'react'

const KEY = 'mi-gestoria-connect-mcp'

// Garde la demande de connexion de Claude le temps de se connecter (10 minutes).
export function pendingConnect() {
  const fromUrl = new URLSearchParams(window.location.search).get('connect_mcp')
  if (fromUrl) {
    localStorage.setItem(KEY, JSON.stringify({ request: fromUrl, exp: Date.now() + 10 * 60000 }))
    const url = new URL(window.location.href)
    url.searchParams.delete('connect_mcp')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (saved && saved.exp > Date.now() && typeof saved.request === 'string') return saved.request
  } catch { /* rien */ }
  localStorage.removeItem(KEY)
  return null
}

export default function GestoriaConnect({ request, onDone }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function approve() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/gestoria-mcp?action=approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      localStorage.removeItem(KEY)
      window.location.href = data.redirect
    } catch (e) {
      setError(e.message || 'Autorisation non confirmée. Relance la connexion depuis Claude.')
      setBusy(false)
    }
  }
  function refuse() { localStorage.removeItem(KEY); onDone() }

  return <main className="login">
    <p className="eyebrow">Connexion</p>
    <h1>Autoriser Claude ?</h1>
    <p>Claude pourra, depuis ton ordinateur ou ton téléphone :</p>
    <ul>
      <li>lire tes clients, tes factures et ce qui reste à encaisser ;</li>
      <li>préparer une facture, puis l’émettre <strong>seulement après ton « oui »</strong> ;</li>
      <li>pointer un paiement, ajouter une dépense ou un prospect, toujours après ton accord.</li>
    </ul>
    <p className="eyebrow">Claude ne voit pas tes déclarations, tes pièces jointes ni le dossier Blackthorn. L’accès dure 30 jours et se coupe à tout moment depuis Mi Gestoría.</p>
    <form onSubmit={e => { e.preventDefault(); approve() }}>
      <button type="submit" disabled={busy}>Autoriser Claude</button>
      <button type="button" onClick={refuse} disabled={busy}>Refuser</button>
    </form>
    {error && <p role="alert">{error}</p>}
  </main>
}
