import React, { useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import Dashboard      from './pages/Dashboard'
import TonyDashboard  from './pages/TonyDashboard'
import Metriques      from './pages/Metriques'
import Comptabilite   from './pages/Comptabilite'
import Communication  from './pages/Communication'
import Booking        from './pages/Booking'
import Consent        from './pages/Consent'

function UpdateBanner() {
  const [waiting, setWaiting] = React.useState(null)
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const handler = (e) => {
      setWaiting(e.detail)
      setVisible(true)
    }
    window.addEventListener('sw-update', handler)
    return () => window.removeEventListener('sw-update', handler)
  }, [])

  const doUpdate = () => {
    if (waiting) {
      waiting.postMessage('skipWaiting')
    } else {
      window.location.reload()
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position:'fixed', top:0, left:0, right:0, zIndex:9999,
      background:'#1A1209', color:'#F8F5F0',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'12px 16px',
      boxShadow:'0 4px 20px rgba(26,18,9,.4)',
      animation:'bannerSlide .3s cubic-bezier(.32,0,.15,1)'
    }}>
      <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
        <span style={{fontSize:'16px'}}>🆕</span>
        <div>
          <div style={{fontSize:'13px',fontWeight:700,fontFamily:'var(--font-head)',letterSpacing:'-.2px'}}>
            Mise à jour disponible
          </div>
          <div style={{fontSize:'11px',color:'rgba(248,245,240,.55)',marginTop:'1px'}}>
            Une nouvelle version est prête
          </div>
        </div>
      </div>
      <div style={{display:'flex',gap:'8px',flexShrink:0}}>
        <button onClick={()=>setVisible(false)} style={{
          padding:'6px 12px', borderRadius:'8px', fontSize:'12px',
          background:'transparent', border:'1px solid rgba(248,245,240,.2)',
          color:'rgba(248,245,240,.55)', cursor:'pointer', fontFamily:'var(--font-head)', fontWeight:600
        }}>Plus tard</button>
        <button onClick={doUpdate} style={{
          padding:'6px 14px', borderRadius:'8px', fontSize:'12px',
          background:'#C4A882', border:'none',
          color:'#1A1209', cursor:'pointer', fontFamily:'var(--font-head)', fontWeight:700,
          boxShadow:'0 2px 8px rgba(196,168,130,.4)'
        }}>Mettre à jour</button>
      </div>
      <style>{`@keyframes bannerSlide{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  )
}

function PinScreen({ onUnlock }) {
  const [digits, setDigits] = useState([])
  const [shake, setShake] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submitPin = async code => {
    if (busy) return
    setBusy(true); setError('')
    try { await onUnlock(code) }
    catch(e) { setError(e.message); setShake(true); setTimeout(()=>setShake(false),600); setDigits([]) }
    finally { setBusy(false) }
  }
  const tap = n => {
    if (busy) return
    const next = [...digits,n]
    setDigits(next)
    if (next.length === 6) submitPin(next.join(''))
  }

  return (
    <div style={{
      minHeight:'100dvh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      background:'#1A1209', padding:'32px 20px',
      userSelect:'none'
    }}>
      {/* Logo */}
      <img src="/blackthorn-logo.png" alt="Blackthorn" style={{
        width:'180px', opacity:.92,
        filter:'invert(1) sepia(.4) brightness(.92)',
        mixBlendMode:'screen',
        marginBottom:'48px'
      }}/>

      <label style={{color:'#C4A882',fontSize:12}}>Code d’accès (6 chiffres)</label>
      <input aria-label="Code d’accès" type="password" name="pin" autoComplete="current-password" inputMode="numeric" maxLength={6} disabled={busy}
        value={digits.join('')} onChange={e=>{const value=e.target.value.replace(/\D/g,'').slice(0,6);setDigits(value.split(''));if(value.length===6)submitPin(value)}}
        style={{width:180,textAlign:'center',margin:'12px 0',fontSize:24,letterSpacing:12}} />
      {error && <div role="alert" style={{color:'#ffb4a2',marginBottom:12}}>{error}</div>}
      {busy && <div style={{color:'#C4A882'}}>Connexion…</div>}
      {/* Dots */}
      <div style={{
        display:'flex', gap:'18px', marginBottom:'44px',
        animation: shake ? 'pinShake .5s ease' : 'none'
      }}>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{
            width:14, height:14, borderRadius:'50%',
            background: i < digits.length ? '#C4A882' : 'transparent',
            border: `2px solid ${i < digits.length ? '#C4A882' : 'rgba(196,168,130,.35)'}`,
            transition:'background .15s, border-color .15s'
          }}/>
        ))}
      </div>

      {/* Keypad */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', width:'240px' }}>
        {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k,i) => (
          k === '' ? <div key={i}/> :
          <button key={i} onClick={() => k === '⌫' ? setDigits(d => d.slice(0,-1)) : tap(k)}
            style={{
              height:64, borderRadius:12,
              background: k === '⌫' ? 'transparent' : 'rgba(255,255,255,.06)',
              border: k === '⌫' ? 'none' : '1px solid rgba(255,255,255,.08)',
              color: k === '⌫' ? 'rgba(196,168,130,.6)' : '#F8F5F0',
              fontSize: k === '⌫' ? '22px' : '24px',
              fontFamily:'var(--font-head)', fontWeight: k === '⌫' ? 400 : 500,
              cursor:'pointer', transition:'background .1s',
            }}
            onTouchStart={e=>e.currentTarget.style.background='rgba(196,168,130,.12)'}
            onTouchEnd={e=>e.currentTarget.style.background= k==='⌫'?'transparent':'rgba(255,255,255,.06)'}
          >{k}</button>
        ))}
      </div>

      <style>{`@keyframes pinShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
    </div>
  )
}

function NavBar({ onLogout }) {
  return (
    <nav className="nav-bar">
      <NavLink to="/" end className={({isActive})=>`nav-item${isActive?' active':''}`}>
        <span className="nav-icon">◈</span>Hub
      </NavLink>
      <NavLink to="/metriques" className={({isActive})=>`nav-item${isActive?' active':''}`}>
        <span className="nav-icon">◫</span>Métriques
      </NavLink>
      <NavLink to="/compta" className={({isActive})=>`nav-item${isActive?' active':''}`}>
        <span className="nav-icon">⊞</span>Compta
      </NavLink>
      <NavLink to="/communication" className={({isActive})=>`nav-item${isActive?' active':''}`}>
        <span className="nav-icon">◉</span>Comm.
      </NavLink>
      <button className="nav-item" onClick={onLogout}>
        <span className="nav-icon">⊗</span>Exit
      </button>
    </nav>
  )
}

export default function App() {
  const [role, setRole] = useState(null)
  const [checking, setChecking] = useState(true)
  React.useEffect(()=>{
    fetch('/api/auth',{cache:'no-store'}).then(r=>r.json()).then(d=>setRole(d.role || null)).catch(()=>setRole(null)).finally(()=>setChecking(false))
    const expired=()=>setRole(null)
    window.addEventListener('bt-auth-expired',expired)
    return ()=>window.removeEventListener('bt-auth-expired',expired)
  },[])
  const unlock = async pin => {
    const response = await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})})
    const data = await response.json()
    if (!response.ok || !data.role) throw new Error(data.error || 'Connexion impossible')
    setRole(data.role)
    sessionStorage.removeItem('bt_role')
  }
  const logout = async () => { await fetch('/api/auth',{method:'DELETE'}); setRole(null); sessionStorage.removeItem('bt_role') }

  // Routes publiques — pas de PIN requis
  if (window.location.pathname.startsWith('/booking/')) return <Booking />
  if (window.location.pathname.startsWith('/consent/')) return <Consent />

  if (checking) return <div style={{padding:40}}>Chargement…</div>
  if (!role) return <PinScreen onUnlock={unlock} />
  if (role === 'tony') return <TonyDashboard onLogout={logout} />

  return (
    <div style={{ paddingBottom:'72px' }}>
      <Routes>
          <Route path="/"          element={<Dashboard />} />
          <Route path="/metriques" element={<Metriques />} />
          <Route path="/compta"    element={<Comptabilite />} />
          <Route path="/communication" element={<Communication />} />
      </Routes>
      <NavBar onLogout={logout}/>
    </div>
  )
}
