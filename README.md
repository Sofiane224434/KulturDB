# KulturDB

Application front KulturDB servie sur moviedb.azim404.com.

## Stack

- React + Vite
- API auth Node.js/Express + SQLite (backend local au repo)
- Docker multi-stage avec Nginx dans le conteneur
- Nginx sur le VPS comme reverse proxy hote
- GitHub Actions pour le deploiement automatique

## Variables d'environnement

Copier .env.example vers .env pour le developpement local ou pour le build sur le VPS.

Variables attendues:

- VITE_TMDB_API_KEY
- VITE_TMDB_BASE_URL
- VITE_API_BASE_URL
- AUTH_JWT_SECRET

Variables backend auth:

- AUTH_PORT (defaut: 4000)
- AUTH_BASE_URL
- FRONTEND_BASE_URL
- AUTH_JWT_EXPIRES_IN
- AUTH_SESSION_SECRET

Variables verification email Brevo:

- BREVO_API_KEY
- BREVO_SENDER_EMAIL
- BREVO_SENDER_NAME

Variables OAuth Google:

- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_CALLBACK_URL

Variables OAuth GitHub:

- GITHUB_CLIENT_ID
- GITHUB_CLIENT_SECRET
- GITHUB_CALLBACK_URL

## Fonctionnalites auth

- Inscription en attente (le compte est cree seulement apres verification email)
- Verification email via Brevo (lien de confirmation)
- Connexion locale (JWT)
- OAuth Google (si variables Google configurees)
- OAuth GitHub (si variables GitHub configurees)
- Route privee protegee: /favorites (redirection auto vers /login)
- Routes lecture publiques: /manga, /manwha, /light-novels, /romans
- Alias legacy conserves: /library et /watchlist redirigent vers /manga

Base lecture via API:

- Categories disponibles: manga, manwha, light novel, roman
- Sources API: Jikan/MyAnimeList (manga, manwha, light novel) et Open Library (roman)
- Navigation par categorie + pagination publique (sans connexion)
- Fonction de suivi personnel/bibliotheque desactivee temporairement
- Pages detail lecture internes (mode fiche): synopsis/resume, note source, genres, traductions, chapitres/volumes, equipe et similaires
- Fiches auteurs/dessinateurs (Jikan) accessibles depuis les pages detail

Routes frontend ajoutees:

- /login
- /register
- /auth/verify-email?token=...
- /auth/oauth-success?token=...

Routes API auth:

- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- POST /api/auth/resend-verification
- POST /api/auth/verify-email
- GET /api/auth/oauth/providers
- GET /api/auth/oauth/google
- GET /api/auth/oauth/google/callback
- GET /api/auth/oauth/github
- GET /api/auth/oauth/github/callback

## Developpement local

```bash
npm install
cd backend && npm install && cd ..
npm run dev
# API auth (dans un 2e terminal)
npm run dev:api
```

## Production reelle

- Le conteneur expose 127.0.0.1:3003:80
- Le frontend Nginx proxy /api vers le conteneur backend auth (api:4000)
- Nginx sur le VPS route moviedb.azim404.com vers ce port
- Le TLS est gere au niveau hote par Certbot et Nginx
- Les build args Docker viennent du fichier .env local au repo de deploiement

## Deploiement

Le workflow deploye dans ~/apps/kulturdb puis reconstruit l'image sur le VPS.

Secrets GitHub requis:

- VPS_HOST
- VPS_USERNAME
- VPS_SSH_KEY

## Point critique

Ne jamais committer de vraie cle TMDB dans le repo. Utiliser .env en local et .env.example comme modele.

Ne jamais committer de cle Brevo, secret JWT, secret OAuth ni fichier SQLite de production.
