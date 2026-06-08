import React, { useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Sessions from './pages/Sessions'
import Comptabilite from './pages/Comptabilite'
import Metriques from './pages/Metriques'
import Apprentissage from './pages/Apprentissage'
import Roadmap from './pages/Roadmap'
import TonyDashboard from './pages/TonyDashboard'

const PIN_AMELY = import.meta.env.VITE_APP_PIN  || '2026'
const PIN_TONY  = import.meta.env.VITE_TONY_PIN || '1111'

const NAV_AMELY = [
  { path: '/',          icon: '◈',  label: 'Hub' },
  { path: '/metriques', icon: '📊', label: 'Métriques' },
  { path: '/compta',    icon: '⊞',  label: 'Compta' },
]

function PinScreen({ onUnlock }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  const press = (v) => {
    if (v === 'del') { setCode(c => c.slice(0,-1)); return }
    const next = code + v
    setCode(next)
    if (next.length === 4) {
      if (next === PIN_AMELY)     onUnlock('amely')
      else if (next === PIN_TONY) onUnlock('tony')
      else {
        setShake(true); setError(true)
        setTimeout(() => { setShake(false); setCode(''); setError(false) }, 600)
      }
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 24px' }}>
      <div style={{ textAlign:'center', marginBottom:'48px' }}>
        <div style={{ fontFamily:'var(--font-head)', fontSize:'28px', fontWeight:800, letterSpacing:'4px', color:'var(--pierre)', marginBottom:'8px' }}>BLACKTHORN</div>
        <div style={{ fontSize:'12px', color:'var(--gris)', letterSpacing:'2px', textTransform:'uppercase' }}>Cockpit Studio</div>
      </div>
      <div style={{ display:'flex', gap:'16px', marginBottom:'40px', animation: shake ? 'shake .4s ease' : 'none' }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width:16, height:16, borderRadius:'50%', background: i < code.length ? (error ? 'var(--rouge)' : 'var(--pierre)') : 'var(--noir3)', border:`2px solid ${i < code.length ? (error ? 'var(--rouge)' : 'var(--pierre)') : 'var(--gris2)'}`, transition:'all .2s' }} />
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 72px)', gap:'12px' }}>
        {['1','2','3','4','5','6','7','8','9','','0','del'].map((k,i) => (
          k==='' ? <div key={i}/> :
          <button key={i} onClick={() => press(k)} style={{ width:72, height:72, borderRadius:'50%', background: k==='del' ? 'var(--noir3)' : 'var(--noir2)', border:'1px solid var(--noir3)', color:'var(--blanc)', fontFamily: k==='del' ? 'var(--font-body)' : 'var(--font-mono)', fontSize: k==='del' ? '18px' : '22px', transition:'all .15s', cursor:'pointer' }}
            onMouseDown={e => e.currentTarget.style.transform='scale(.9)'}
            onMouseUp={e => e.currentTarget.style.transform='scale(1)'}>
            {k==='del' ? '⌫' : k}
          </button>
        ))}
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
    </div>
  )
}

function NavBar({ onLogout }) {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <nav style={{ position:'fixed', bottom:0, left:0, right:0, background:'var(--noir2)', borderTop:'1px solid var(--noir3)', display:'flex', justifyContent:'space-around', padding:'8px 0 calc(8px + env(safe-area-inset-bottom))', zIndex:100 }}>
      {NAV_AMELY.map(({ path, icon, label }) => {
        const active = location.pathname === path
        return (
          <button key={path} onClick={() => navigate(path)} style={{ background:'none', border:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', color: active ? 'var(--pierre)' : 'var(--gris2)', padding:'4px 6px', transition:'color .2s', minWidth:52 }}>
            <span style={{ fontSize:'18px', lineHeight:1 }}>{icon}</span>
            <span style={{ fontSize:'9px', fontFamily:'var(--font-head)', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase' }}>{label}</span>
          </button>
        )
      })}
      <button onClick={onLogout} style={{ background:'none', border:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', color:'var(--gris2)', padding:'4px 6px', minWidth:40 }}>
        <span style={{ fontSize:'16px', lineHeight:1 }}>🔒</span>
        <span style={{ fontSize:'8px', fontFamily:'var(--font-head)', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase' }}>Exit</span>
      </button>
    </nav>
  )
}

export default function App() {
  const [role, setRole] = useState(() => sessionStorage.getItem('bt_role') || null)
  const unlock = (r) => { sessionStorage.setItem('bt_role', r); setRole(r) }

  if (!role) return <PinScreen onUnlock={unlock} />
  if (role === 'tony') return <TonyDashboard onLogout={() => { sessionStorage.removeItem('bt_role'); setRole(null) }} />

  return (
    <div style={{ paddingBottom:'72px' }}>
      <Routes>
        <Route path="/"              element={<Dashboard />} />
        <Route path="/sessions"      element={<Sessions />} />
        <Route path="/metriques"     element={<Metriques />} />
        <Route path="/compta"        element={<Comptabilite />} />
        <Route path="/apprentissage" element={<Apprentissage />} />
        <Route path="/roadmap"       element={<Roadmap />} />
      </Routes>
      <NavBar onLogout={() => { sessionStorage.removeItem('bt_role'); setRole(null) }} />
    </div>
  )
}
