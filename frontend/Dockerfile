# =============================================================================
# retomY Frontend — Production Dockerfile
# Multi-stage: build React SPA → serve via Nginx
# =============================================================================

# ── Stage 1: Build ──────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

# Copy source and build
COPY . .

# Accept build-time env vars for Vite (baked into static assets)
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_APP_NAME=retomY
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_APP_NAME=${VITE_APP_NAME}

RUN npm run build

# ── Stage 2: Serve ──────────────────────────────────────
FROM nginx:1.27-alpine AS production

# Remove default nginx config
RUN rm -rf /etc/nginx/conf.d/*

# Copy built assets and nginx config
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user
RUN addgroup -S retomy && adduser -S retomy -G retomy && \
    chown -R retomy:retomy /usr/share/nginx/html && \
    chown -R retomy:retomy /var/cache/nginx && \
    chown -R retomy:retomy /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R retomy:retomy /var/run/nginx.pid

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
