FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DB_PATH=data/app.sqlite

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . .
RUN mkdir -p data uploads/videos uploads/drawings

EXPOSE 3000

CMD ["sh", "-c", "node scripts/init-db.js && node src/server.js"]
