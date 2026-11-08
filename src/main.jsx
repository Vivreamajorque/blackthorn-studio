import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import MiGestoria from './pages/MiGestoria'
import './style.css'

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
  const [feedback, setFeedback] = useState(null)

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

  if (status === 'loading') return <main className="login"><p role="status">Chargement de Mi Gestoría…</p></main>
  if (status === 'connected') return <>
    <header className="app-header">
      <span>Mon espace privé</span>
      <button onClick={logout} disabled={busy}>Se déconnecter</button>
    </header>
    {feedback && <p className="auth-feedback" role="alert">{feedback.text}</p>}
    <MiGestoria />
  </>

  return <main className="login">
    <p className="eyebrow">Mon espace privé</p>
    <h1>Mi Gestoría</h1>
    <p>Retrouve tes échéances, ton activité et le dossier Blackthorn Tattoo.</p>
    <form onSubmit={submit}>
      {!token && <label>Ton adresse e-mail
        <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
      </label>}
      <button disabled={busy}>{token ? 'Ouvrir mon dossier' : 'Recevoir mon lien de connexion'}</button>
      {token && <button type="button" onClick={() => { setToken(null); setFeedback(null) }}>Demander un autre lien</button>}
    </form>
    {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
  </main>
}

createRoot(document.getElementById('root')).render(<App />)
