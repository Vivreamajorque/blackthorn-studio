import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import MiGestoria from './pages/MiGestoria'
import GestoriaEspace from './pages/GestoriaEspace'
import GestoriaConnect, { pendingConnect } from './pages/GestoriaConnect'
import './style.css'
import '@fontsource-variable/bricolage-grotesque'
import './atelier-theme.css'
import './qg-uniform.css'

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
      <button type="button" className="app-brand" title="Mettre à jour le QG" onClick={() => miseAJourMaintenant()}><img src="/qg-icon-96.png" alt="" width="34" height="34" /> Le QG</button>
      <button onClick={logout} disabled={busy}>Se déconnecter</button>
    </header>
    {feedback && <p className="auth-feedback" role="alert">{feedback.text}</p>}
    <MiGestoria />
  </>

  return <main className="login">
    <img src="/qg-icon-192.png" alt="" width="72" height="72" />
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

// Mises à jour : sur l'écran d'accueil du téléphone ou de l'iPad, l'appli reste ouverte longtemps et garde l'ancienne version.
// On vérifie au retour sur l'appli, quand la fenêtre reprend la main, et toutes les 3 minutes pendant qu'on s'en sert.
// Si une nouvelle version est en ligne, un bandeau l'annonce et l'appli se recharge seule (sauf si on est en train d'écrire).
const currentBundle = () => document.querySelector('script[type="module"][src*="/assets/"]')?.getAttribute('src') || ''
let lastCheck = 0
let bandeau = null
const enTrainDEcrire = () => {
  const el = document.activeElement
  return !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit'].includes(el.type)) || el.isContentEditable) && String(el.value || '').length > 0
}
function proposerMiseAJour() {
  if (bandeau) return
  bandeau = document.createElement('div')
  bandeau.setAttribute('role', 'status')
  bandeau.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(18px + env(safe-area-inset-bottom));z-index:9999;display:flex;align-items:center;gap:12px;background:#103c42;color:#fff;padding:10px 10px 10px 18px;border-radius:999px;box-shadow:0 10px 30px rgba(16,60,66,.35);font:600 15px/1.2 "Bricolage Grotesque Variable",system-ui,sans-serif;max-width:calc(100vw - 24px)'
  const txt = document.createElement('span'); txt.textContent = 'Nouvelle version du QG'
  const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Mettre à jour'
  btn.style.cssText = 'border:0;border-radius:999px;background:#9fd3c7;color:#103c42;font:inherit;font-weight:700;padding:10px 16px;min-height:40px;cursor:pointer'
  btn.onclick = () => window.location.reload()
  bandeau.append(txt, btn)
  document.body.appendChild(bandeau)
  // Rechargement automatique au bout de 6 s, sauf si une saisie est en cours (alors on attend le clic).
  const auto = () => { if (!enTrainDEcrire()) window.location.reload(); else setTimeout(auto, 15000) }
  setTimeout(auto, 6000)
}
// Recharge tout de suite (nouvelle version + données fraîches), avec un petit voile pour montrer que ça bouge.
function miseAJourMaintenant() {
  const voile = document.createElement('div')
  voile.setAttribute('role', 'status')
  voile.textContent = 'Mise à jour du QG…'
  voile.style.cssText = 'position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:rgba(242,247,246,.92);color:#103c42;font:600 18px/1.2 "Bricolage Grotesque Variable",system-ui,sans-serif'
  document.body.appendChild(voile)
  window.location.reload()
}
window.miseAJourMaintenant = miseAJourMaintenant

async function checkForUpdate(force = false, immediat = false) {
  if (!import.meta.env.PROD || bandeau || (!force && Date.now() - lastCheck < 30000)) return
  lastCheck = Date.now()
  try {
    const html = await (await fetch('/?v=' + Date.now(), { cache: 'no-store', headers: { 'cache-control': 'no-cache' } })).text()
    const next = html.match(/<script[^>]+type="module"[^>]+src="([^"]*\/assets\/[^"]+)"/)?.[1]
    if (next && currentBundle() && next !== currentBundle()) {
      if (immediat && !enTrainDEcrire()) miseAJourMaintenant()
      else proposerMiseAJour()
    }
  } catch { /* hors ligne : on réessaiera */ }
}

// Quand on rouvre l'appli depuis son icône (téléphone, iPad) : si elle dormait depuis plus de 2 minutes,
// on recharge tout (dernière version + données à jour) ; sinon on vérifie juste s'il y a une nouvelle version.
let cacheLe = 0
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { cacheLe = Date.now(); return }
  const dormait = cacheLe && Date.now() - cacheLe > 120000
  cacheLe = 0
  if (dormait && import.meta.env.PROD && !enTrainDEcrire()) return miseAJourMaintenant()
  window.dispatchEvent(new CustomEvent('qg-crm-change'))
  checkForUpdate(true, true)
})
window.addEventListener('pageshow', e => { if (e.persisted && import.meta.env.PROD) miseAJourMaintenant(); else checkForUpdate(true, true) })
window.addEventListener('focus', () => checkForUpdate())
window.addEventListener('online', () => checkForUpdate(true))
setInterval(() => { if (document.visibilityState === 'visible') checkForUpdate(true) }, 180000)
setTimeout(() => checkForUpdate(true, true), 3000)
