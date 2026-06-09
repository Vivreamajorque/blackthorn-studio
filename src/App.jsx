import React, { useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import Dashboard      from './pages/Dashboard'
import TonyDashboard  from './pages/TonyDashboard'
import Metriques      from './pages/Metriques'
import Comptabilite   from './pages/Comptabilite'

const PIN_AMELY = import.meta.env.VITE_APP_PIN  || '2026'
const PIN_TONY  = import.meta.env.VITE_TONY_PIN || '1111'

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
      </Routes>
      <NavBar onLogout={logout}/>
    </div>
  )
}
