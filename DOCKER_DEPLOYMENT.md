# LaxHornet Docker Deployment Guide

## Overview

LaxHornet is now fully containerized with production-grade optimizations:

- **Image Size**: 60.7 MB (down from ~95 MB) — 36% reduction
- **Security**: Non-root user, read-only filesystem, signal handling
- **Build Cache**: Multi-stage builds with layer caching for fast rebuilds
- **Health Checks**: Built-in HTTP health checks
- **Development Mode**: Hot-reload via bind mounts with `docker-compose.dev.yml`

---

## Quick Start

### Production Mode

```bash
# Build the production image
docker build -t laxhornet:latest .

# Run with Docker Compose (production)
docker compose up --pull always
```

The app will be accessible at `http://localhost:5173`.

### Development Mode

```bash
# Run with hot-reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Changes to HTML, JS, and CSS files will be reflected immediately
```

---

## Key Improvements

### 1. **Multi-Stage Build**

- **Builder stage**: Installs dependencies, copies source code
- **Runtime stage**: Lean production image with only what's needed
  - Dev dependencies removed
  - Build artifacts cleaned
  - Documentation and research dirs excluded
  - Result: 36% smaller image

### 2. **Security Hardening**

| Feature | Benefit |
|---------|---------|
| **Non-root user** | Limits blast radius of container compromise |
| **Read-only filesystem** | Prevents unauthorized writes to container layers |
| **tmpfs mounts** | /tmp and /run remain writable for Node.js |
| **No privilege escalation** | `no-new-privileges:true` in Compose |
| **Signal handling** | SIGTERM gracefully shuts down the server |

### 3. **Layer Caching & Performance**

The Dockerfile is optimized to cache effectively:

1. Base image layer (rarely changes)
2. Dependencies (only rebuild on `package.json` changes)
3. Source code (fast rebuild on code changes)
4. Cleanup & security (one final step)

**Build time**: ~1–2s on cache hit, ~8s on cold build.

### 4. **Health Checks**

The container includes a built-in health check:

```bash
docker inspect laxhornet-test --format='{{.State.Health}}'
# Output: healthy
```

Docker Compose automatically monitors this and can restart unhealthy containers.

### 5. **Content-Type Headers**

The embedded HTTP server now sets proper MIME types:

- `.js` → `application/javascript`
- `.css` → `text/css`
- `.json` → `application/json`
- `.svg` → `image/svg+xml`
- `.png` → `image/png`

Cache-Control headers are also set (3600s max-age).

---

## Environment Variables

Create a `.env` file or pass variables via `-e`:

```bash
# Optional: override PORT (default 5173)
docker run -e PORT=8080 laxhornet:latest

# Or in Docker Compose:
# environment:
#   - PORT=8080
```

---

## Docker Compose Profiles

### Production (default)

```bash
docker compose up
```

- Read-only filesystem
- No volume mounts
- `restart: unless-stopped`
- Health checks enabled

### Development

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

- Bind mounts for instant reload
- Writable filesystem
- Perfect for local development

---

## Monitoring & Logs

### View logs

```bash
docker compose logs -f laxhornet-server
```

### Check container status

```bash
docker compose ps
```

### Inspect container

```bash
docker inspect laxhornet-server
```

### Check health

```bash
docker compose exec laxhornet-server node -e "require('http').get('http://localhost:5173/index.html', (res) => console.log('Status:', res.statusCode))"
```

---

## Deployment Targets

### Docker Desktop / Local

```bash
docker compose up --pull always
```

### Kubernetes

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: laxhornet
spec:
  containers:
    - name: laxhornet-server
      image: laxhornet:latest
      ports:
        - containerPort: 5173
      readinessProbe:
        httpGet:
          path: /index.html
          port: 5173
        initialDelaySeconds: 5
        periodSeconds: 10
      livenessProbe:
        httpGet:
          path: /index.html
          port: 5173
        initialDelaySeconds: 30
        periodSeconds: 30
      securityContext:
        readOnlyRootFilesystem: true
        allowPrivilegeEscalation: false
        runAsNonRoot: true
        runAsUser: 1001
      volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: run
          mountPath: /run
  volumes:
    - name: tmp
      emptyDir: {}
    - name: run
      emptyDir: {}
```

### Docker Swarm

```bash
docker service create \
  --name laxhornet \
  --publish 5173:5173 \
  --update-delay 10s \
  --constraint node.role==manager \
  laxhornet:latest
```

---

## CI/CD Integration

### Build & Push to Registry

```bash
# Authenticate with your registry
docker login docker.io

# Build and tag
docker build -t docker.io/username/laxhornet:1.0.0 .

# Push
docker push docker.io/username/laxhornet:1.0.0

# Deploy
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### GitHub Actions Example

```yaml
name: Build & Deploy

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: docker/setup-buildx-action@v2
      - uses: docker/login-action@v2
        with:
          registry: docker.io
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      - uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: docker.io/username/laxhornet:${{ github.sha }}
```

---

## Troubleshooting

### Container exits immediately

```bash
docker compose logs laxhornet-server
```

Check for:
- Port 5173 already in use → `lsof -i :5173` (or Docker Desktop port conflicts)
- Missing files → Rebuild with `docker build --no-cache .`

### Health check failing

```bash
docker compose ps  # Shows health status
docker inspect laxhornet-server | grep -A 10 Health
```

### Slow builds

```bash
# Clear build cache and rebuild
docker builder prune
docker build --no-cache -t laxhornet:latest .
```

### File permissions errors (dev mode)

If you see "permission denied" on volume mounts:

```bash
# On Linux, ensure UID matches container (1001)
# On macOS/Windows, Docker Desktop handles this automatically
```

---

## Next Steps

1. **Push to Registry**: `docker push laxhornet:latest`
2. **Add CI/CD**: Automate builds on each commit
3. **Set up Monitoring**: Integrate with Prometheus, Datadog, or New Relic
4. **Configure Secrets**: Use Docker secrets or .env files for Supabase config
5. **Add Load Balancing**: Deploy behind nginx or HAProxy for horizontal scaling

---

## Files Modified/Created

- `Dockerfile` – Multi-stage optimized build
- `.dockerignore` – Excludes 40+ unnecessary files
- `docker-compose.yml` – Production configuration
- `docker-compose.dev.yml` – Development overrides
- `.env.example` – Environment template
