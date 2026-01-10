# Teto-on UTAU Editor - Frontend

Frontend Angular pour la plateforme de création et partage de compositions musicales UTAU.

**Stack** : Angular 19 + TailwindCSS

## Prérequis

Le backend doit être démarré avant le frontend. Voir le repo [teto-on-backend](https://github.com/Mairooo/teto-on-backend).

## Installation

```bash
npm install
```

## Lancement

```bash
npm start
```

Application disponible sur http://localhost:4200

## Structure

```
src/app/
├── pages/
│   ├── auth/            # Login/Register/OAuth callback
│   ├── home/            # Accueil avec projets
│   ├── composer/        # Éditeur piano-roll UTAU
│   ├── search-results/  # Résultats recherche
│   ├── project-detail/  # Détail projet + lecteur
│   ├── project-edit/    # Édition métadonnées projet
│   ├── profile/         # Profil utilisateur
│   └── settings/        # Paramètres compte
└── shared/
    ├── components/      # Composants réutilisables
    ├── services/        # Services API (auth, projects, search...)
    ├── guards/          # Auth guards
    ├── interceptors/    # HTTP interceptors (JWT)
    └── interfaces/      # Types TypeScript
```

## Fonctionnalités

- **Éditeur UTAU** : Piano-roll pour créer des compositions avec voicebanks
- **Recherche** : Full-text avec Meilisearch, filtres par tags/voicebanks
- **Social** : Likes, compteur de lectures, notifications temps réel
- **Auth** : JWT local + OAuth GitHub
- **Export** : Rendu audio WAV des compositions

## URLs

| Page | URL |
|------|-----|
| Accueil | http://localhost:4200 |
| Éditeur | http://localhost:4200/composer |
| Recherche | http://localhost:4200/search |
| Profil | http://localhost:4200/profile/:id |

## Auteur

Mairo Frebourg - Janvier 2026
