import React, { useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import Dashboard      from './pages/Dashboard'
import TonyDashboard  from './pages/TonyDashboard'
import Metriques      from './pages/Metriques'
import Comptabilite   from './pages/Comptabilite'
import Communication  from './pages/Communication'

const PIN_AMELY = import.meta.env.VITE_APP_PIN  || '2026'
const PIN_TONY  = import.meta.env.VITE_TONY_PIN || '1111'


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
  const [shake,  setShake]  = useState(false)

  const tap = (n) => {
    const next = [...digits, n]
    if (next.length < 4) { setDigits(next); return }
    const code = next.join('')
    if (code === PIN_AMELY)     { onUnlock('amely') }
    else if (code === PIN_TONY) { onUnlock('tony') }
    else {
      setShake(true)
      setTimeout(() => { setShake(false); setDigits([]) }, 600)
    }
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

      {/* Dots */}
      <div style={{
        display:'flex', gap:'18px', marginBottom:'44px',
        animation: shake ? 'pinShake .5s ease' : 'none'
      }}>
        {[0,1,2,3].map(i => (
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
  const [role, setRole] = useState(() => sessionStorage.getItem('bt_role') || null)
  const unlock = (r) => { sessionStorage.setItem('bt_role', r); setRole(r) }
  const logout = () => { sessionStorage.removeItem('bt_role'); setRole(null) }

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
