import React from 'react'
import './alfred.css'

// Alfred, le majordome du QG : un monogramme « A » dont la barre est un nœud papillon.
// Le nœud se redresse de temps en temps, un reflet passe, et le A s'incline au survol.
export default function Alfred({ size = 40, mood = 'calme', title = 'Alfred' }) {
  const uid = React.useId().replace(/:/g, '')
  return <svg className={'alf alf-' + mood} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title}>
    <defs>
      <clipPath id={'alf-c' + uid}><circle cx="50" cy="50" r="50" /></clipPath>
      <linearGradient id={'alf-g' + uid} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#1b545b" /><stop offset="1" stopColor="#0b2d31" />
      </linearGradient>
      <linearGradient id={'alf-r' + uid} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".35" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </defs>
    <g clipPath={'url(#alf-c' + uid + ')'}>
      <rect width="100" height="100" fill={'url(#alf-g' + uid + ')'} />
      <circle cx="50" cy="50" r="44" fill="none" stroke="#9fd3c7" strokeOpacity=".28" strokeWidth="1.2" />
      <g className="alf-lettre">
        <path d="M50 17 L74 80 H63.5 L58.4 66 H41.6 L36.5 80 H26 Z M50 37.5 L44.2 56.5 H55.8 Z" fill="#9fd3c7" fillRule="evenodd" />
        <path d="M22 80 H39 M61 80 H78" stroke="#9fd3c7" strokeWidth="3" strokeLinecap="round" />
        <g className="alf-noeud">
          <path d="M50 61 L35 53.5 Q33 61 35 68.5 Z" fill="#f0b43c" />
          <path d="M50 61 L65 53.5 Q67 61 65 68.5 Z" fill="#f0b43c" />
          <path d="M37.5 57 Q41 61 37.5 65" stroke="#d99a1e" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d="M62.5 57 Q59 61 62.5 65" stroke="#d99a1e" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <rect x="46.5" y="57.5" width="7" height="7" rx="2.2" fill="#d99a1e" />
        </g>
      </g>
      <rect className="alf-reflet" x="-60" y="-10" width="40" height="120" fill={'url(#alf-r' + uid + ')'} transform="rotate(20 50 50)" />
      <g className="alf-etoiles" fill="#f0b43c">
        <path d="M80 22 l1.6 3.6 3.6 1.6 -3.6 1.6 -1.6 3.6 -1.6 -3.6 -3.6 -1.6 3.6 -1.6 Z" />
        <path d="M19 30 l1.1 2.4 2.4 1.1 -2.4 1.1 -1.1 2.4 -1.1 -2.4 -2.4 -1.1 2.4 -1.1 Z" />
      </g>
    </g>
  </svg>
}
