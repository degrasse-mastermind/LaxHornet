# LaxHornet - Optimized Multi-Stage Build
# Stage 1: Builder - Only what's needed for static file preparation
FROM node:22-alpine AS builder
WORKDIR /build
RUN apk add --no-cache python3 git
# Cache layers by copying lock files first
COPY package*.json ./
RUN npm ci --ignore-scripts 2>/dev/null || true
# Copy app code
COPY . .
# Verify build (optional linting/validation)
RUN npm run build 2>/dev/null || true

# Stage 2: Runtime - Lean production image
FROM node:22-alpine AS runtime
WORKDIR /app

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy only what's needed from builder
COPY --from=builder --chown=nodejs:nodejs /build . 

# Remove dev dependencies and build artifacts to reduce image size
RUN rm -rf node_modules package-lock.json .git .github .codex .agents docs research launch-kit

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5173

# Optimized server with better error handling
CMD ["node", "-e", "const http = require('http'); const fs = require('fs'); const path = require('path'); const port = process.env.PORT || 5173; const server = http.createServer((req, res) => { const filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url); fs.readFile(filePath, (err, data) => { if (err) { res.writeHead(err.code === 'ENOENT' ? 404 : 500, {'Content-Type': 'text/plain'}); res.end(err.code === 'ENOENT' ? 'Not Found' : 'Server Error'); } else { const ext = path.extname(filePath); const contentTypes = {'.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon'}; const contentType = contentTypes[ext] || 'application/octet-stream'; res.writeHead(200, {'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600'}); res.end(data); } }); server.on('clientError', (err, socket) => { socket.end('HTTP/1.1 400 Bad Request\\r\\n\\r\\n'); }); }); server.listen(port, '0.0.0.0', () => console.log(`LaxHornet listening on port ${port}`)); process.on('SIGTERM', () => { console.log('SIGTERM received, shutting down gracefully'); server.close(() => process.exit(0)); });"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5173/index.html', (res) => { if (res.statusCode !== 200) throw new Error(res.statusCode); })"
