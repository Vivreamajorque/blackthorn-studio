import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import MiGestoria from './pages/MiGestoria'
import GestoriaEspace from './pages/GestoriaEspace'
import GestoriaConnect, { pendingConnect } from './pages/GestoriaConnect'
import './style.css'
import './atelier-theme.css'

const api = '/api/gestoria-auth'

async function auth(method, body) {
  const response = await fetch(api, {
    method, cache: 'no-store',
    ...(body && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error)
  return data
}

function App() {
  const [token, setToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('connexion'))
  const [status, setStatus] = useState('loading')
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [connectRequest, setConnectRequest] = useState(pendingConnect)

  useEffect(() => {
    if (window.location.hash.startsWith('#connexion=')) window.history.replaceState(null, '', window.location.pathname)
    const expired = () => {
      setStatus('signed-out')
      setFeedback({ text: 'Ta session a expiré. Demande un lien pour rouvrir ton dossier.' })
    }
    window.addEventListener('gestoria-auth-expired', expired)
    let active = true
    auth('GET').then(result => {
      if (active) setStatus(result.connected ? 'connected' : 'signed-out')
    }).catch(() => {
      if (active) {
        setStatus('signed-out')
        setFeedback({ error: true, text: 'Connexion indisponible sur cette adresse.' })
      }
    })
    return () => { active = false; window.removeEventListener('gestoria-auth-expired', expired) }
  }, [])

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setFeedback(null)
    try {
      if (token) {
        await auth('POST', { action: 'verify', token })
        setToken(null)
        setStatus('connected')
      } else {
        await auth('POST', { action: 'request', email })
        setFeedback({ text: 'Si cette adresse correspond au dossier, tu recevras un lien par e-mail.' })
      }
    } catch (error) {
      setFeedback({ error: true, text: error.message || 'Connexion indisponible.' })
    } finally {
      setBusy(false)
    }
  }

  async function submitPin(event) {
    event.preventDefault()
    setBusy(true)
    setFeedback(null)
    try {
      await auth('POST', { action: 'pin', pin })
      setPin('')
      setStatus('connected')
    } catch (error) {
      setPin('')
      setFeedback({ error: true, text: error.message || 'Connexion indisponible.' })
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    setBusy(true)
    try {
      await auth('DELETE')
      setStatus('signed-out')
      setFeedback(null)
    } catch {
      setFeedback({ error: true, text: 'Déconnexion non confirmée. Réessaie.' })
    } finally {
      setBusy(false)
    }
  }

  if (status === 'loading') return <main className="login"><p role="status">Chargement du QG…</p></main>
  if (status === 'connected' && connectRequest) return <GestoriaConnect request={connectRequest} onDone={() => setConnectRequest(null)} />
  if (status === 'connected') return <>
    <header className="app-header">
      <strong className="app-brand"><span aria-hidden="true">QG</span> Le QG</strong>
      <button onClick={logout} disabled={busy}>Se déconnecter</button>
    </header>
    {feedback && <p className="auth-feedback" role="alert">{feedback.text}</p>}
    <MiGestoria />
  </>

  return <main className="login">
    <p className="eyebrow">Mon espace privé</p>
    <h1>Le QG</h1>
    <p>Ton pilotage, tes clients, ta prospection et ta compta (avec le dossier Blackthorn Tattoo), au même endroit.</p>
    <p>Sur cet appareil personnel, ta connexion est conservée 90 jours et renouvelée quand tu utilises l’outil. Sur un appareil partagé, pense à te déconnecter.</p>
    {!token && <form onSubmit={submitPin}>
      <label>Ton code
        <input type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4,8}" minLength={4} maxLength={8}
          required value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
      </label>
      <button disabled={busy || pin.length < 4}>Entrer avec mon code</button>
    </form>}
    {token && <form onSubmit={submit}>
      <button disabled={busy}>Ouvrir mon dossier</button>
      <button type="button" onClick={() => { setToken(null); setFeedback(null) }}>Utiliser mon code</button>
    </form>}
    {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
  </main>
}

const espace = window.location.pathname.match(/^\/espace\/([A-Za-z0-9_-]{32})\/?$/)
createRoot(document.getElementById('root')).render(espace ? <GestoriaEspace token={espace[1]} /> : <App />)
