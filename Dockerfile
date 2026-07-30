FROM node:22-alpine AS base
WORKDIR /app

FROM base AS build
RUN apk add --no-cache python3 git
COPY package*.json ./
RUN npm ci --ignore-scripts 2>/dev/null || true
COPY . .

FROM base AS test
RUN apk add --no-cache python3 git
COPY --from=build /app /app
RUN npm ci --ignore-scripts 2>/dev/null || true
CMD ["npm", "test"]

FROM node:22-alpine AS server
WORKDIR /app
COPY . .
EXPOSE 5173
CMD ["node", "-e", "const http = require('http'); const fs = require('fs'); const path = require('path'); const port = 5173; const server = http.createServer((req, res) => { let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url); fs.readFile(filePath, (err, data) => { if (err) { res.writeHead(404); res.end('Not Found'); } else { const ext = path.extname(filePath); const contentType = ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : ext === '.json' ? 'application/json' : 'text/html'; res.writeHead(200, {'Content-Type': contentType}); res.end(data); } }); }); server.listen(port, '0.0.0.0', () => console.log(`Server running on port ${port}`));"]
