import React, { useState } from 'react'

export default function GestoriaTonyAccess() {
  const [code, setCode] = useState('')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  async function update(action) {
    setBusy(true)
    setFeedback('')
    try {
      const response = await fetch('/api/gestoria-tony', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setCode(data.code || '')
      setFeedback(action === 'invite' ? 'Code prêt pour Tony.' : 'L’accès de Tony a été retiré.')
    } catch (error) {
      setFeedback(error.message || 'L’accès n’a pas pu être modifié.')
    } finally {
      setBusy(false)
    }
  }
  return <details className="mg-chart-details">
    <summary>Accès de Tony depuis Blackthorn</summary>
    <p>Crée un code et transmets-le à Tony. Il le saisira dans <strong>Ventes &amp; charges</strong> sur son Hub. Un nouveau code remplace l’accès précédent.</p>
    <div className="mg-actions">
      <button type="button" disabled={busy} onClick={() => update('invite')}>Créer un code pour Tony</button>
      <button type="button" disabled={busy} onClick={() => update('revoke')}>Retirer son accès</button>
    </div>
    {code && <p><label>Code valable 48 h, à usage unique <input readOnly value={code} onFocus={event => event.target.select()} /></label></p>}
    {feedback && <p role="status">{feedback}</p>}
  </details>
}
