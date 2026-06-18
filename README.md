<p align="center">
  <a href="./README.md"><strong>简体中文</strong></a>
  ·
  <a href="./README.zh-Hant.md">繁體中文</a>
  ·
  <a href="./README.en.md">English</a>
</p>

# Love Room

一个温暖、干净、可自托管的双人私密 Web App。适合异地情侣、亲密朋友，或者任何只想和一个人共享日常小空间的人。

![Love Room 预览](docs/assets/readme-hero.svg)

<p align="center">
  <strong>私密路径</strong> · <strong>双入口口令</strong> · <strong>本地 SQLite</strong> · <strong>Docker 就绪</strong>
</p>

## 它是什么

Love Room 不是社交平台，也不是账号系统。它只有一个私密访问路径和两个房间口令。你把它部署在自己的服务器上，数据保存在自己的 SQLite 和本地上传目录里。

第一次打开网页时，会出现初始化表单。用户可以在网页端填写：

- 两个人的显示名、emoji 和口令
- 两个城市、时区、生日
- 下次见面时间、地点、倒计时标题

经纬度不用手填。天气会根据城市名自动解析坐标；如果自动解析不准，再去设置页的高级项手动覆盖。

## 功能一览

![功能地图](docs/assets/feature-map.svg)

- 双城 Dashboard：时间、日期、天气、体感温度、风速、UV、穿搭建议
- 下次见面倒计时：主倒计时、生日、纪念日、自定义纪念日
- 共享心愿单：实时同步新增、编辑、完成、删除
- 今天的你：双方回答前互不可见，双方提交后解锁
- 电影同步房间：视频链接、本地上传、播放/暂停/进度/倍速同步、聊天
- 共同画板：实时画画、橡皮擦、撤销、清空、保存图片
- 盖印册：每日邮戳、连续天数、月度查看、历史记录
- 你画我猜：私人实时小游戏
- 更多入口：可配置 VirtualTabletop / Posio 外部游戏链接

## 技术栈

- Node.js + Express
- Socket.io
- SQLite
- 原生 HTML / CSS / JavaScript
- Open-Meteo 默认天气源，可选 OpenWeatherMap
- 本地文件上传，适合自托管

## 快速开始

推荐 Node.js 20、22 或 24 LTS；当前不建议使用 Node 25。

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

打开：

```text
http://localhost:3000/love-room-demo
```

然后在网页里完成首次配置。

## 一键部署支持

支持 Docker Compose。严格来说，公开部署前仍需要先改一次 `.env` 里的服务器级秘密，例如 `ROOM_SECRET` 和 `ROOM_PATH`；之后可以一条命令启动。

![部署流程](docs/assets/deploy-flow.svg)

```bash
git clone https://github.com/Python-PIG/love-room.git
cd love-room
cp .env.example .env
# 编辑 .env：至少修改 ROOM_SECRET，部署公网时也建议修改 ROOM_PATH
docker compose up -d --build
```

查看日志：

```bash
docker compose logs -f
```

停止：

```bash
docker compose down
```

Docker Compose 会使用 volume 保存：

- SQLite 数据库：`/app/data`
- 上传文件：`/app/uploads`

所以重建容器不会丢数据。

## `.env` 还需要做什么

大多数个性化信息已经移到网页端。`.env` 只保留服务器级配置。

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `NODE_ENV` | 否 | `development` | 生产环境用 `production` |
| `PORT` | 否 | `3000` | Node 服务端口 |
| `HOST` | 否 | `127.0.0.1` | Nginx 反代推荐保持默认；直连局域网可改 `0.0.0.0` |
| `BASE_URL` | 否 | `http://localhost:3000` | 你的公开访问地址 |
| `ROOM_PATH` | 建议 | `/love-room-demo` | 私密路径，公开部署前建议修改 |
| `DB_PATH` | 否 | `data/app.sqlite` | SQLite 文件位置 |
| `WEATHER_PROVIDER` | 否 | `openmeteo` | 可选 `openmeteo` 或 `openweathermap` |
| `WEATHER_API_KEY` | 视情况 | 空 | OpenWeatherMap 才需要 |
| `MAX_VIDEO_MB` | 否 | `500` | 视频上传大小限制 |
| `ROOM_SECRET` | 生产必填 | 示例值 | 生产环境必须换成长随机字符串 |
| `VTT_URL` | 否 | 空 | 更多页里的 VirtualTabletop 链接 |
| `POSIO_URL` | 否 | 空 | 更多页里的 Posio 链接 |
| `TRUST_PROXY` | 反代时 | `0` | Nginx / 反代后建议设为 `1` |
| `COOKIE_SECURE` | HTTPS 时 | 自动 | 生产环境默认启用 Secure cookie；只有纯本地 HTTP 才建议设为 `0` |

生成 `ROOM_SECRET`：

```bash
openssl rand -hex 32
```

## 传统 Node 部署

```bash
sudo mkdir -p /opt/love-room
sudo chown "$USER":"$USER" /opt/love-room
git clone https://github.com/Python-PIG/love-room.git /opt/love-room
cd /opt/love-room
npm ci --omit=dev
cp .env.example .env
# 编辑 .env：NODE_ENV=production、ROOM_SECRET、ROOM_PATH、BASE_URL
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

创建 `/etc/systemd/system/love-room.service`：

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

启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now love-room
sudo systemctl status love-room
```

## Nginx 反向代理

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

如果用 Nginx，请在 `.env` 中设置：

```env
TRUST_PROXY=1
```

HTTPS 可以用 Certbot 或你喜欢的证书方案。

## 备份

需要备份：

- `data/app.sqlite`
- `uploads/drawings`
- 如果你想保留上传影片，也备份 `uploads/videos`

示例：

```bash
APP_DIR=/opt/love-room BACKUP_ROOT=/opt/love-room-backups bash scripts/backup.sh
```

备份脚本也会复制 `.env`，所以备份目录需要保持私密。如果系统安装了 `sqlite3`，脚本会使用 SQLite 在线备份；否则会同时复制 `app.sqlite` 以及可能存在的 WAL/SHM 文件，并把它们保存在同一个快照里。

## 常见问题

**生产启动时报 `Set ROOM_SECRET before running in production.`**
说明你还没有设置真实 `ROOM_SECRET`，或者仍在使用示例值。

**天气城市不准怎么办？**
先把城市名写具体一点，例如加国家或地区。如果仍不准，到设置页展开 `Advanced weather coordinates` 手动填经纬度。

**改了 `.env` 里的城市，网页没变？**
首次配置会写入 SQLite。之后请在网页设置页修改；或者删除数据库重新初始化。

**Socket.io 在 Nginx 后面连不上？**
检查 `Upgrade` / `Connection` 请求头，并设置 `TRUST_PROXY=1`。

**Windows 执行 `npm` 被 PowerShell 拦截？**
使用 README 里的 `npm.cmd` 命令。

## 安全边界

- 不要提交 `.env`、SQLite 数据库、上传文件、备份、私钥、真实 Nginx 配置。
- 公网部署前请修改 `ROOM_PATH`。
- 首次 setup 完成前，只要知道房间路径的人都可能初始化房间；请先完成 setup 再分享地址。
- 口令在 setup 或旧数据迁移后会以 scrypt 哈希保存。
- 浏览器会话使用签名的 HTTP-only cookie，同时为 WebSocket 鉴权保留同一个短期 access token。
- `/uploads` 下文件会被静态访问。上传会校验 MIME 和扩展名，但这里不是敏感文件存储。
- 这是私密路径 + 口令方案，不是完整账号系统。

## 开源发布检查

```bash
git add -n .
rg --glob '!node_modules/**' --glob '!data/**' --glob '!uploads/**' "your-real-domain|your-real-ip|real-passcode|real-room-path"
```

只提交源码、文档、`.env.example`、`.gitignore`、lockfile、License 和 `.gitkeep`。

## License

MIT
