# Teto-on UTAU Editor - Frontend

Frontend Angular pour la plateforme de creation et partage de compositions musicales UTAU.

**Stack** : Angular 19 + TailwindCSS

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
│   ├── auth/            # Login/Register
│   ├── home/            # Accueil
│   ├── composer/        # Editeur composition
│   ├── search-results/  # Resultats recherche
│   ├── project-detail/  # Detail projet
│   ├── project-edit/    # Edition projet
│   ├── profile/         # Profil utilisateur
│   └── settings/        # Parametres
└── shared/
    ├── components/      # Composants reutilisables
    ├── services/        # Services API
    ├── guards/          # Auth guards
    ├── interceptors/    # HTTP interceptors
    ├── models/          # Modeles donnees
    └── interfaces/      # Types TypeScript
```

## Fonctionnalites

- Compositions : Creation, edition, publication de projets musicaux
- Recherche : Full-text avec Meilisearch, filtres par tags/voicebanks
- Social : Likes, compteur de lectures, notifications
- Auth : JWT + OAuth GitHub
- Temps reel : WebSocket pour mises a jour en direct

## Auteur

Mairo Frebourg - Janvier 2026
