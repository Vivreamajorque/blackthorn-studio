import React, { useState } from 'react'

const PHASES = [
  {
    year: '2026', label: 'Fondation', icon: '◈', active: true,
    tony: 'Artiste principal 100%', amely: 'Directrice + apprend piercing',
    ca: '37K€', net: '15K€', capital: '15K€',
    milestones: ['30K€ atteint octobre','Première notoriété DE+EN','Charte artistique Blackthorn','Kit piercing commandé']
  },
  {
    year: '2027', label: 'Expansion', icon: '◉',
    tony: 'Artiste + mentor', amely: 'Directrice + pierceure pro + apprend tattoo',
    ca: '127K€', net: '65K€', capital: '45K€',
    milestones: ['Amely pierceure pro Q1','Début apprentissage tattoo','SL créée','Capital 45K€ atteint']
  },
  {
    year: '2028', label: 'Multi-artiste', icon: '⟐',
    tony: 'Artiste mi-temps + dir. artistique', amely: 'CEO + pierceure expert + tattoueuse semi-pro',
    ca: '153K€', net: '90K€', capital: '80K€',
    milestones: ['Amely premiers clients tattoo payants','Tony réduit tatouage 50%','Capital 80K€ préparation studio 2']
  },
  {
    year: '2029', label: 'Double artiste', icon: '⊞',
    tony: 'Directeur artistique', amely: 'CEO + double artiste pro',
    ca: '167K€', net: '105K€', capital: '120K€',
    milestones: ['Amely pro fine line + piercing','Tony arrête le tatouage quotidien','Ouverture studio Santanyí préparée']
  },
  {
    year: '2030', label: '2 Studios', icon: '◎',
    tony: 'Directeur créatif', amely: 'Présidente + artiste principale',
    ca: '300K€+', net: '180K€+', capital: 'Réinvesti',
    milestones: ['Studio Santanyí ouvert','6 artistes total','Studio manager recruté','Tony presque plus de tatouage']
  },
  {
    year: '2031', label: 'Autonomie', icon: '✦',
    tony: 'Fondateur libre 🎉', amely: 'Présidente',
    ca: '500K€+', net: '300K€+', capital: '—',
    milestones: ['Tony ne tatouage plus','Business tourne seul','3 studios possibles','Objectif atteint']
  }
]

export default function Roadmap() {
  const [selected, setSelected] = useState(null)
  const phase = selected !== null ? PHASES[selected] : null

  return (
    <div style={{ padding: '24px 16px 8px' }}>
      <div style={{ fontFamily: 'var(--font-head)', fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Vision 2031</div>
      <div style={{ fontSize: '12px', color: 'var(--gris)', marginBottom: '20px' }}>En 2031, Tony ne tatouage plus. Blackthorn tourne seul.</div>

      {/* Marché */}
      <div className="card" style={{ marginBottom: '20px', background: 'rgba(196,168,130,.06)' }}>
        <div className="section-title">Marché tatouage</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            { l: 'Espagne 2024', v: '~200M€', s: 'CAGR +8,2%/an' },
            { l: 'Europe 2025', v: '1,2 Md€', s: 'CAGR +9,1%/an' },
            { l: 'Allemands Mallorca', v: '4,57M', s: '34% des touristes' },
            { l: 'Santanyí', v: 'x6 touristes', s: 'vs résidents (été)' },
          ].map(m => (
            <div key={m.l} style={{ padding: '10px', background: 'var(--noir3)', borderRadius: 'var(--r)' }}>
              <div style={{ fontSize: '10px', color: 'var(--gris)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{m.l}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: 'var(--pierre)', margin: '3px 0' }}>{m.v}</div>
              <div style={{ fontSize: '10px', color: 'var(--gris)' }}>{m.s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="section-title">Phases de développement</div>
      {PHASES.map((p, i) => (
        <div key={i} onClick={() => setSelected(selected === i ? null : i)}
          className="card" style={{
            marginBottom: '8px', cursor: 'pointer',
            borderColor: p.active ? 'var(--pierre)' : 'var(--noir3)',
            background: selected === i ? 'var(--noir3)' : 'var(--noir2)',
            transition: 'all .2s'
          }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', align: 'center', gap: '12px' }}>
              <span style={{ fontFamily: 'var(--font-head)', fontSize: '24px', color: p.active ? 'var(--pierre)' : 'var(--gris2)', lineHeight: 1 }}>{p.icon}</span>
              <div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: p.active ? 'var(--pierre)' : 'var(--blanc)' }}>{p.year}</span>
                  <span style={{ fontSize: '12px', color: 'var(--gris)' }}>{p.label}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--gris)', marginTop: '2px' }}>CA : <strong style={{ color: 'var(--pierre)' }}>{p.ca}</strong> · Net : <strong style={{ color: 'var(--vert)' }}>{p.net}</strong></div>
              </div>
            </div>
            <span style={{ color: 'var(--gris)', fontSize: '14px' }}>{selected === i ? '▾' : '▸'}</span>
          </div>

          {selected === i && (
            <div style={{ marginTop: '14px', borderTop: '1px solid var(--noir3)', paddingTop: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div style={{ background: 'var(--noir)', padding: '10px', borderRadius: 'var(--r)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--gris)', marginBottom: '4px', textTransform: 'uppercase' }}>Tony</div>
                  <div style={{ fontSize: '12px' }}>{p.tony}</div>
                </div>
                <div style={{ background: 'var(--noir)', padding: '10px', borderRadius: 'var(--r)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--gris)', marginBottom: '4px', textTransform: 'uppercase' }}>Amely</div>
                  <div style={{ fontSize: '12px' }}>{p.amely}</div>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--pierre)', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Milestones</div>
              {p.milestones.map((m, j) => (
                <div key={j} style={{ display: 'flex', gap: '8px', padding: '4px 0', fontSize: '12px', color: 'var(--gris)' }}>
                  <span style={{ color: 'var(--pierre)' }}>→</span><span>{m}</span>
                </div>
              ))}
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1, padding: '8px', background: 'var(--noir)', borderRadius: 'var(--r)', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: 'var(--gris)' }}>Capital fin période</div>
                  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--pierre)', fontSize: '14px', marginTop: '2px' }}>{p.capital}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* 3 conditions */}
      <div className="card" style={{ marginTop: '16px', borderColor: 'var(--pierre3)' }}>
        <div className="section-title">3 conditions non négociables</div>
        {[
          'Charte artistique Blackthorn rédigée par Tony avant fin 2026',
          'SL créée avant premier artiste externe (2027-2028)',
          'Marque > Personnes : chaque post construit BLACKTHORN'
        ].map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', padding: '8px 0', fontSize: '12px', color: 'var(--gris)', borderBottom: i < 2 ? '1px solid var(--noir3)' : 'none' }}>
            <span style={{ color: 'var(--pierre)', fontWeight: 700 }}>{i+1}.</span>
            <span>{c}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
