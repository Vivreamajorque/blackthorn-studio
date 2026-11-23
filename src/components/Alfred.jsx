import React from 'react'
import './alfred.css'

// Alfred, le majordome du QG : un personnage original (nœud papillon soleil, queue-de-pie mer).
// Il cligne des yeux, respire doucement et salue au survol. Animation coupée si l'utilisateur réduit les mouvements.
export default function Alfred({ size = 40, mood = 'calme', title = 'Alfred' }) {
  return <svg className={'alf alf-' + mood} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title}>
    <defs>
      <clipPath id="alf-rond"><circle cx="50" cy="50" r="50" /></clipPath>
    </defs>
    <g clipPath="url(#alf-rond)">
      <rect width="100" height="100" fill="#9fd3c7" />
      <circle cx="80" cy="18" r="22" fill="#ddefea" opacity=".6" />
      <g className="alf-corps">
        <path d="M14 104 C16 80 30 70 50 70 C70 70 84 80 86 104 Z" fill="#103c42" />
        <path d="M40 71 L50 92 L60 71 Z" fill="#ffffff" />
        <path d="M37 72 L50 92 L44 104 L30 104 Z" fill="#0b2d31" opacity=".55" />
        <path d="M63 72 L50 92 L56 104 L70 104 Z" fill="#0b2d31" opacity=".55" />
        <g className="alf-noeud">
          <path d="M50 76 L40 71 L40 81 Z" fill="#f0b43c" />
          <path d="M50 76 L60 71 L60 81 Z" fill="#f0b43c" />
          <circle cx="50" cy="76" r="2.6" fill="#d99a1e" />
        </g>
        <circle cx="50" cy="86" r="1.3" fill="#103c42" />
      </g>
      <g className="alf-tete">
        <rect x="44" y="58" width="12" height="12" rx="4" fill="#e9b893" />
        <ellipse cx="31" cy="44" rx="4" ry="5.5" fill="#e9b893" />
        <ellipse cx="69" cy="44" rx="4" ry="5.5" fill="#e9b893" />
        <ellipse cx="50" cy="42" rx="18" ry="20" fill="#f3cba8" />
        <path d="M31 40 C30 24 40 18 51 18 C63 18 71 25 69 40 C66 31 60 27 52 28 C46 28.5 41 30 38 34 C36 30 33 33 31 40 Z" fill="#4a3426" />
        <path d="M38 34 C42 29 48 27.5 52 28" stroke="#2f2018" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M38.5 38.5 Q42 36.5 45.5 38" stroke="#4a3426" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M54.5 38 Q58 36.5 61.5 38.5" stroke="#4a3426" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <g className="alf-yeux">
          <ellipse cx="42" cy="43" rx="2.3" ry="2.7" fill="#103c42" />
          <ellipse cx="58" cy="43" rx="2.3" ry="2.7" fill="#103c42" />
          <circle cx="42.8" cy="42" r=".8" fill="#fff" />
          <circle cx="58.8" cy="42" r=".8" fill="#fff" />
        </g>
        <ellipse cx="37" cy="50" rx="3.4" ry="2" fill="#ec9d8a" opacity=".55" />
        <ellipse cx="63" cy="50" rx="3.4" ry="2" fill="#ec9d8a" opacity=".55" />
        <path d="M49 45 Q50.5 49 49 50.5" stroke="#d9a27c" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <path className="alf-bouche" d="M44.5 53.5 Q50 57.5 55.5 53.5" stroke="#8a4a3a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </g>
    </g>
  </svg>
}
