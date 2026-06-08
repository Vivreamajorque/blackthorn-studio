# Blackthorn Studio — Cockpit de pilotage

PWA de pilotage opérationnel pour Blackthorn Tattoo Studio, Campos, Mallorca.

## Stack
- React 18 + Vite
- Vercel (déploiement + serverless functions)
- Notion API (base de données)
- PWA (installable sur téléphone)

## Variables d'environnement Vercel
- `NOTION_KEY` — clé API Notion
- `VITE_APP_PIN` — code PIN d'accès (4 chiffres)

## Pages
- **Dashboard** — CA temps réel, alertes, brief matin
- **Sessions** — Saisie sessions tattoo + piercing
- **Clients CRM** — Gestion clients
- **Comptabilité** — Provisions, charges, fiscal
- **Apprentissage** — Checklists piercing + fine line Amely
- **Roadmap** — Vision 5 ans

## Déploiement
Push sur main → Vercel déploie automatiquement en ~30s
