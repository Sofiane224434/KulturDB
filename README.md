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
- Si Brevo est mal configure (ex: BREVO_SENDER_EMAIL manquant), l API retourne une erreur explicite au lieu d afficher un faux succes
- Connexion locale (JWT)
- OAuth Google (si variables Google configurees)
- OAuth GitHub (si variables GitHub configurees)
- Route legacy conservee: /favorites redirige vers /library
- Routes lecture publiques: /manga, /manwha, /light-novels, /romans
- Barre de recherche: filtres disponibles pour films, series, anime, manga, manwha, light novel et roman
- Bibliotheque publique active: /library (suivi visionnage/lecture sans login)
- Synchronisation multi-utilisateur active pour comptes connectes: bibliotheque, tops, notes, commentaires et watchlist sont synchronises via l API auth
- Bibliotheque: statuts (a commencer, en cours, a reprendre, termine), progression bornee au total existant, mapping saison/episode pour series/anime, et pas de progression chiffree pour les films
- Bibliotheque: quand un element passe en statut "termine", la progression est automatiquement alignee sur le total max disponible
- Bibliotheque: saisie manuelle de progression amelioree (validation a la sortie/Entree) pour eviter les remplacements de valeur pendant la frappe
- Bibliotheque: rafraichissement periodique des metadonnees TMDB (episodes, saisons, durees) pour garder les compteurs plus a jour
- Bibliotheque: recherche par titre + filtres type/statut
- Catalogues films/series/anime: pagination avec sauts de 5 pages, acces direct par URL via `?page=...`, tri (note, alphabetique), et filtre par acteur/realisateur/equipe sur la page courante
- Catalogues films/series/anime: tri global aligne sur les pages TMDB (pas uniquement local a la page chargee) pour popularite/note/ordre alphabetique
- Les anime sont exclus de la page /series et de la source series utilisee sur l accueil/recherche series
- Tops personnels visibles dans /library (top films, top series, top anime, top manga, etc.), avec gestion locale via le stockage navigateur
- Alias legacy conserve: /watchlist redirige vers /library
- Profil: pseudo modifiable, statistiques (temps regarde, volumes par type), option d affichage des cards en couleur, et gestion d amis depuis /profile (compte connecte)
- Profil: acces au profil d un autre utilisateur depuis la recherche/les listes d amis (`/profile/:userId`)
- Navigation: sidebar desktop repliable/depliable avec memorisation locale de l etat (bouton flottant "Menu" retire)
- Profil amis: l email des autres utilisateurs est masque (recherche, amis, demandes), recherche par pseudo uniquement
- Profil: le temps regarde est affiche en mois / jours / heures
- Bibliotheque/Tops: reclassification automatique des anciens anime stockes par erreur comme series lors du rafraichissement TMDB
- Bibliotheque/Tops: reclassification anime renforcee via croisement TMDB + Jikan (MyAnimeList) pour eviter les faux `series`
- Bibliotheque: nombre total d episodes TV corrige avec fusion des sources (TMDB + somme des saisons + Jikan + AniList + Kitsu, valeur la plus fiable)
- Cas specifiques verrouilles: Inazuma Eleven GO Chrono Stone (51) et Inazuma Eleven GO Galaxy (43) forces en `anime` avec total exact
- Fiche detail serie/anime: affichage episodes/saisons aligne sur la resolution multi-sources pour limiter les faux `1 episode`
- Titres medias: affichage nettoye pour eviter les caracteres japonais/coreens dans les titres visibles (fallback latin)
- Catalogue anime: source elargie (TMDB origin country JP + original language ja) pour couvrir davantage de series anime
- Ajout/Detail series: resolution anime/episodes renforcee des l ajout (TMDB + Jikan + somme des saisons) pour limiter les cas classes en serie avec un total d episodes faux
- Tops: ordre manuel possible a l interieur de chaque categorie (monter / descendre)
- Lisibilite texte amelioree: taille de base augmentee et champs catalogue plus grands

Base lecture via API:

- Categories disponibles: manga, manwha, light novel, roman
- Sources API: Jikan/MyAnimeList (manga, manwha, light novel) et Open Library (roman)
- Proxy backend /api/reading pour MangaDex supplement (chapitres scans, traductions, staff, score) et traduction FR (evite les blocages CORS navigateur)
- Navigation par categorie + pagination publique (sans connexion)
- Pagination simplifiee avec navigation numerique (pages 1, 2, 3, ...)
- Fonction de bibliotheque perso activee (stockage local navigateur)
- Pages detail lecture internes (mode fiche): synopsis/resume en francais, note source, genres, traductions completes, chapitres + chapitres scans, equipe et similaires
- Fiches auteurs/dessinateurs (Jikan) accessibles depuis les pages detail

Routes frontend ajoutees:

- /login
- /register
- /profile
- /auth/verify-email?token=...
- /auth/oauth-success?token=...

Routes API auth:

- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- GET /api/auth/sync-data
- PUT /api/auth/sync-data
- PATCH /api/auth/me/display-name
- GET /api/auth/users/search?query=...
- GET /api/auth/users/:userId
- GET /api/auth/friends
- POST /api/auth/friends/requests
- POST /api/auth/friends/requests/:requestId/accept
- DELETE /api/auth/friends/:userId
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
