<p align="center">
  <a href="./README.md">简体中文</a>
  ·
  <a href="./README.zh-Hant.md">繁體中文</a>
  ·
  <a href="./README.en.md"><strong>English</strong></a>
</p>

# Love Room

A warm, clean, self-hosted private web app for two people. It works well for long-distance couples, close friends, or anyone who wants a small shared room with one special person.

![Love Room preview](docs/assets/readme-hero.svg)

<p align="center">
  <strong>Private path</strong> · <strong>Two passcodes</strong> · <strong>Local SQLite</strong> · <strong>Docker ready</strong>
</p>

## What It Is

Love Room is not a social network and does not include a registration system. It uses one private room path and two passcodes. You deploy it on your own server, and the data stays in your own SQLite database and local upload folders.

On first open, the browser shows a setup form for:

- two display names, emojis, and passcodes
- two cities, time zones, and birthdays
- next meeting time, place, and countdown title

Latitude and longitude are not required for most users. Weather coordinates are resolved from city names automatically. If the result is wrong, use the advanced coordinate override in Settings.

## Features

![Feature map](docs/assets/feature-map.svg)

- Dual-city dashboard with time, weather, feels-like temperature, wind, UV, and outfit hints
- Countdown page for the next meeting, birthdays, anniversaries, and custom dates
- Shared wishlist / todo list with realtime sync
- Daily question: private answers unlock after both people submit
- Synced movie room with URLs, local uploads, playback sync, chat, and presence
- Shared canvas with realtime drawing, eraser, undo, clear, save, and gallery
- Stamp book for daily visits, streak badges, monthly views, and history
- Private draw-and-guess game
- Optional VirtualTabletop and Posio links on the More page

## Stack

- Node.js + Express
- Socket.io
- SQLite
- Plain HTML / CSS / JavaScript
- Open-Meteo by default; optional OpenWeatherMap
- Local filesystem uploads

## Quick Start

Node.js 20, 22, or 24 LTS is recommended. Node 25 is not currently supported.

macOS / Linux:

```bash
npm ci
cp .env.example .env
npm run init-db
npm start
```

Windows PowerShell:

```powershell
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run init-db
npm.cmd start
```

Open:

```text
http://localhost:3000/love-room-demo
```

Then finish the first-run setup in the browser.

## One-Command Deployment

Docker Compose is supported. For public deployment, you still need to edit `.env` once for server-level secrets such as `ROOM_SECRET` and `ROOM_PATH`. After that, one command starts the app.

![Deployment flow](docs/assets/deploy-flow.svg)

```bash
git clone https://github.com/Python-PIG/love-room.git
cd love-room
cp .env.example .env
# Edit .env: at least set ROOM_SECRET; change ROOM_PATH for public deployment.
docker compose up -d --build
```

Logs:

```bash
docker compose logs -f
```

Stop:

```bash
docker compose down
```

Compose stores persistent data in Docker volumes:

- SQLite database: `/app/data`
- uploads: `/app/uploads`

Rebuilding the container does not delete those volumes.

## What Still Belongs In `.env`

Most personal room details live in the browser setup. `.env` is for server-level values.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | Use `production` on servers. |
| `PORT` | No | `3000` | Node app port. |
| `HOST` | No | `127.0.0.1` | Keep for Nginx proxy; use `0.0.0.0` for direct LAN access. |
| `BASE_URL` | No | `http://localhost:3000` | Public URL. |
| `ROOM_PATH` | Recommended | `/love-room-demo` | Change before public deployment. |
| `DB_PATH` | No | `data/app.sqlite` | SQLite file path. |
| `WEATHER_PROVIDER` | No | `openmeteo` | `openmeteo` or `openweathermap`. |
| `WEATHER_API_KEY` | If needed | empty | Required only for OpenWeatherMap. |
| `MAX_VIDEO_MB` | No | `500` | Upload size limit. |
| `ROOM_SECRET` | Yes in production | placeholder | Must be a long random string. |
| `VTT_URL` | No | empty | Optional VirtualTabletop link. |
| `POSIO_URL` | No | empty | Optional Posio link. |
| `TRUST_PROXY` | Behind proxy | `0` | Set to `1` behind Nginx. |
| `COOKIE_SECURE` | HTTPS deployments | auto | Production defaults to Secure cookies; set `0` only for plain local HTTP. |

Generate a secret:

```bash
openssl rand -hex 32
```

## Node Deployment

```bash
sudo mkdir -p /opt/love-room
sudo chown "$USER":"$USER" /opt/love-room
git clone https://github.com/Python-PIG/love-room.git /opt/love-room
cd /opt/love-room
npm ci --omit=dev
cp .env.example .env
# Edit .env: NODE_ENV=production, ROOM_SECRET, ROOM_PATH, BASE_URL
npm run init-db
npm start
```

## PM2

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## systemd

Create `/etc/systemd/system/love-room.service`:

```ini
[Unit]
Description=Love Room
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/love-room
EnvironmentFile=/opt/love-room/.env
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=3
User=love-room
Group=love-room

[Install]
WantedBy=multi-user.target
```

Start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now love-room
sudo systemctl status love-room
```

## Nginx

```nginx
server {
    listen 80;
    server_name your-domain.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Set `TRUST_PROXY=1` behind Nginx. Add HTTPS with Certbot or your preferred certificate manager.

## Backup

Back up:

- `data/app.sqlite`
- `uploads/drawings`
- optionally `uploads/videos`

```bash
APP_DIR=/opt/love-room BACKUP_ROOT=/opt/love-room-backups bash scripts/backup.sh
```

The backup script also copies `.env`, so keep the backup directory private. If `sqlite3` is installed, it uses SQLite's online backup command; otherwise it copies `app.sqlite` together with any WAL/SHM files and keeps them in the same snapshot.

## Troubleshooting

- `Set ROOM_SECRET before running in production.`
  Set a real `ROOM_SECRET` in `.env`.

- Weather resolves the wrong city
  Use a more specific city name, or override coordinates in Settings.

- `.env` city changes do not update the app
  First-run settings are stored in SQLite. Edit them in browser Settings or reset the database.

- Socket.io fails behind Nginx
  Check `Upgrade` / `Connection` headers and set `TRUST_PROXY=1`.

## Security Notes

- Never commit `.env`, SQLite databases, uploads, backups, private keys, or real Nginx configs.
- Change `ROOM_PATH` before public deployment.
- Complete setup before sharing the URL. Before setup is complete, anyone with the room path can claim the initial configuration.
- Passcodes are stored as scrypt hashes after setup or legacy migration.
- Browser sessions use a signed HTTP-only cookie, with the same short-lived access token available for WebSocket auth.
- Files under `/uploads` are statically served. Uploads are MIME/extension checked, but they are not sensitive storage.
- This is a private-path/passcode app, not a full account system.

## Open Source Release Check

```bash
git add -n .
rg --glob '!node_modules/**' --glob '!data/**' --glob '!uploads/**' "your-real-domain|your-real-ip|real-passcode|real-room-path"
```

Commit only source, docs, `.env.example`, `.gitignore`, lockfile, License, and `.gitkeep`.

## License

MIT
