# Build stage
FROM node:20-alpine as builder

WORKDIR /app

# Variables d'environnement pour le build
ARG VITE_TMDB_API_KEY
ARG VITE_TMDB_BASE_URL
ENV VITE_TMDB_API_KEY=$VITE_TMDB_API_KEY
ENV VITE_TMDB_BASE_URL=$VITE_TMDB_BASE_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
