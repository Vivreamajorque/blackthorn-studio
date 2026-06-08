import React from 'react'

export function Sparkline({ data, color = '#C4A882', height = 40, width = 120, target }) {
  if (!data || !data.length) return <div style={{ height, width }} />
  const max = Math.max(...data, target || 0, 1)
  const pts = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * width
    const y = height - (v / max) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')
  const targetY = target ? height - (target / max) * (height - 4) - 2 : null
  return (
    <svg width={width} height={height}>
      {targetY && <line x1="0" y1={targetY} x2={width} y2={targetY} stroke="#444" strokeWidth="1" strokeDasharray="3,2" />}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((v, i) => {
        const x = (i / Math.max(data.length - 1, 1)) * width
        const y = height - (v / max) * (height - 4) - 2
        return <circle key={i} cx={x} cy={y} r="3" fill={target && v >= target ? '#27AE60' : color} />
      })}
    </svg>
  )
}

export function MiniBar({ data, color = '#C4A882', height = 48, target }) {
  const max = Math.max(...data.map(d => d.v), target || 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height }}>
      {data.map((d, i) => {
        const h = Math.max(2, (d.v / max) * height)
        const hit = target && d.v >= target
        return (
          <div key={i} style={{ flex: 1, height: h, borderRadius: '2px 2px 0 0', background: hit ? '#27AE60' : d.v > 0 ? color : '#1F1F1F', transition: 'height .3s ease' }} title={`${d.label || ''}: ${d.v}`} />
        )
      })}
    </div>
  )
}

export function Donut({ segments, size = 80, centerLabel }) {
  const total = segments.reduce((a, s) => a + s.v, 0) || 1
  const r = (size - 14) / 2
  const circ = 2 * Math.PI * r
  let cumul = 0
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ position: 'absolute' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1F1F1F" strokeWidth="10" />
        {segments.filter(s => s.v > 0).map((s, i) => {
          const dash = (s.v / total) * circ
          const offset = -(cumul / total) * circ
          cumul += s.v
          return (
            <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
              stroke={s.color} strokeWidth="10"
              strokeDasharray={`${dash} ${circ}`}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${size/2} ${size/2})`}
            />
          )
        })}
      </svg>
      {centerLabel && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'var(--gris)', textAlign: 'center', lineHeight: 1.2 }}>
          {centerLabel}
        </div>
      )}
    </div>
  )
}

export function BigStat({ label, value, sub, color = 'var(--pierre)', icon, trend }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="label">{label}</div>
        {icon && <span style={{ fontSize: '18px' }}>{icon}</span>}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', color, marginBottom: '4px' }}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
      {trend !== undefined && (
        <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: trend >= 0 ? '#27AE60' : '#C0392B', marginTop: '3px' }}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  )
}
