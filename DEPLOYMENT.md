# Deploiement KulturDB

Ce projet est deploye sur le VPS avec l'architecture reelle suivante:

- DNS OVH vers l'IP du VPS
- Nginx installe sur l'hote
- Certbot sur l'hote pour le TLS
- Docker Compose dans ~/apps/kulturdb
- Conteneur accessible uniquement sur 127.0.0.1:3003
- API auth interne disponible via /api (proxy Nginx conteneur)

## DNS

Le sous-domaine attendu est moviedb.azim404.com.

## Secrets GitHub Actions

- VPS_HOST
- VPS_USERNAME
- VPS_SSH_KEY

Le port SSH est actuellement fixe a 2222 dans le workflow.

## Preparation du VPS

```bash
docker network inspect web >/dev/null 2>&1 || docker network create web
mkdir -p ~/apps/kulturdb
cd ~/apps/kulturdb
cp .env.example .env
```

Puis renseigner au minimum:

```bash
VITE_TMDB_API_KEY=your_tmdb_api_key
VITE_TMDB_BASE_URL=https://api.themoviedb.org/3
VITE_API_BASE_URL=/api

AUTH_JWT_SECRET=change_me
AUTH_SESSION_SECRET=change_me_too
AUTH_BASE_URL=https://moviedb.azim404.com
FRONTEND_BASE_URL=https://moviedb.azim404.com

BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=KulturDB

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# Optionnel si non standard:
GOOGLE_CALLBACK_URL=https://moviedb.azim404.com/api/auth/oauth/google/callback

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
# Optionnel si non standard:
GITHUB_CALLBACK_URL=https://moviedb.azim404.com/api/auth/oauth/github/callback
```

Notes:

- Si BREVO_API_KEY est vide, les mails de verification ne partent pas.
- Si GOOGLE_CLIENT_ID/SECRET sont vides, OAuth Google est desactive automatiquement.
- Si GITHUB_CLIENT_ID/SECRET sont vides, OAuth GitHub est desactive automatiquement.

## Deploiement manuel de secours

```bash
cd ~/apps/kulturdb
git fetch origin
git reset --hard origin/main
git clean -fd -e .env

# Nettoyage legacy apres rebrand (si present)
if [ -d ~/apps/cinetech ]; then
	cd ~/apps/cinetech
	COMPOSE_PROJECT_NAME=cinetech docker compose down || true
	cd ~/apps/kulturdb
fi

COMPOSE_PROJECT_NAME=kulturdb docker compose down || true

# Garde-fou anti conflit de port
docker ps --filter "publish=127.0.0.1:3003" --format '{{.ID}} {{.Names}}'

COMPOSE_PROJECT_NAME=kulturdb docker compose up -d --build
```

## Verification

```bash
cd ~/apps/kulturdb
docker compose ps
docker compose logs --tail=100
curl -I https://moviedb.azim404.com
```

## A ne pas faire

- Ne pas reintroduire Traefik, Caddy, Portainer ou un proxy secondaire dans ce repo
- Ne pas committer de vraie cle API dans .env ou docker-compose.yml
- Ne pas committer les secrets auth (JWT/OAuth/Brevo)
