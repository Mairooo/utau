# Teto-on UTAU Editor - Frontend

Frontend Angular pour la plateforme de creation et partage de compositions musicales UTAU.

Stack : Angular 19 + TailwindCSS

## Prerequis

Le backend doit etre demarre avant le frontend. Voir le repo [teto-on-backend](https://github.com/Mairooo/teto-on-backend).

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
│   ├── composer/        # Editeur piano-roll UTAU
│   ├── search-results/  # Resultats recherche
│   ├── project-detail/  # Detail projet + lecteur
│   ├── project-edit/    # Edition metadonnees projet
│   ├── profile/         # Profil utilisateur
│   └── settings/        # Parametres compte
└── shared/
    ├── components/      # Composants reutilisables
    ├── services/        # Services API (auth, projects, search...)
    ├── guards/          # Auth guards
    ├── interceptors/    # HTTP interceptors (JWT)
    └── interfaces/      # Types TypeScript
```

## Fonctionnalites

- Editeur UTAU : Piano-roll pour creer des compositions avec voicebanks
- Recherche : Full-text avec Meilisearch, filtres par tags/voicebanks
- Social : Likes, compteur de lectures, notifications temps reel
- Auth : JWT local + OAuth GitHub
- Export : Rendu audio WAV des compositions

## URLs

| Page | URL |
|------|-----|
| Accueil | http://localhost:4200 |
| Editeur | http://localhost:4200/composer |
| Nouveau projet | http://localhost:4200/composer/new |
| Recherche | http://localhost:4200/search |
| Detail projet | http://localhost:4200/project/:id |
| Edition projet | http://localhost:4200/project/:id/edit |
| Profil | http://localhost:4200/profile/:id |
| Parametres | http://localhost:4200/settings |
| Login | http://localhost:4200/login |
| Register | http://localhost:4200/register |

## Auteur

Maïro Frebourg - Janvier 2026
