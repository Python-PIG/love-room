const crypto = require("node:crypto");
const fs = require("node:fs");
const https = require("node:https");
const http = require("node:http");
const path = require("node:path");
const { execFile } = require("node:child_process");
const express = require("express");
const multer = require("multer");
const { Server } = require("socket.io");
const { hashPasscode, verifyPasscode } = require("./passcodes");
const {
  VIDEO_UPLOAD_ERROR,
  isAllowedVideoUpload,
  safeUploadName
} = require("./uploads");
const {
  db,
  config,
  getSettings,
  getRoomConfig,
  updateRoomConfig,
  roomNeedsSetup,
  updateSettings,
  currentStampDateKey,
  stampYearSummary,
  ensureStampCheckin,
  getOrCreateDailyAssignment
} = require("./db");

const ROOM = "love-room";
const PUBLIC_DIR = path.join(config.rootDir, "public");
const UPLOADS_DIR = path.join(config.rootDir, "uploads");
const VIDEOS_DIR = path.join(UPLOADS_DIR, "videos");
const DRAWINGS_DIR = path.join(UPLOADS_DIR, "drawings");
const SERVERCHAN_PUSH_BIN = process.env.SERVERCHAN_PUSH_BIN || "/usr/local/bin/serverchan-push";
const SERVERCHAN_TARGETS = {
  A: process.env.SERVERCHAN_PERSON_A_TARGET || "pig",
  B: process.env.SERVERCHAN_PERSON_B_TARGET || "cat"
};

const app = express();
if (config.trustProxy) app.set("trust proxy", 1);

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: https:",
    "media-src 'self' http: https: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'"
  ].join("; "));
  next();
});

app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 2e6
});
const unlockAttempts = new Map();
const UNLOCK_WINDOW_MS = 15 * 60 * 1000;
const UNLOCK_MAX_FAILURES = 8;

function nowIso() {
  return new Date().toISOString();
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((acc, chunk) => {
    const index = chunk.indexOf("=");
    if (index === -1) return acc;
    const key = chunk.slice(0, index).trim();
    const value = chunk.slice(index + 1).trim();
    if (key) {
      try {
        acc[key] = decodeURIComponent(value);
      } catch (_error) {
        acc[key] = value;
      }
    }
    return acc;
  }, {});
}

function signAccess(person, expiresAt) {
  return crypto
    .createHmac("sha256", config.roomSecret)
    .update(`${person}.${expiresAt}`)
    .digest("base64url");
}

function makeAccessToken(person) {
  const safePerson = asPerson(person);
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;
  return `${safePerson}.${expiresAt}.${signAccess(safePerson, expiresAt)}`;
}

function verifyAccessToken(token) {
  const [person, expiresAt, signature] = String(token || "").split(".");
  if (!["A", "B"].includes(person)) return null;
  const expires = Number(expiresAt);
  if (!Number.isFinite(expires) || expires < Date.now()) return null;
  const expected = signAccess(person, expiresAt);
  const a = Buffer.from(signature || "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { person, expiresAt: expires };
}

function getAccessFromRequest(req) {
  const headerToken = req.get("x-love-room-access") || "";
  const authorization = req.get("authorization") || "";
  const bearerToken = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  const cookieToken = parseCookies(req.get("cookie") || "").love_room_access || "";
  return verifyAccessToken(headerToken || bearerToken || cookieToken);
}

function setAccessCookie(res, person) {
  const token = makeAccessToken(person);
  res.cookie("love_room_access", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    maxAge: 1000 * 60 * 60 * 24 * 30,
    path: "/"
  });
  return token;
}

function clearAccessCookie(res) {
  res.clearCookie("love_room_access", {
    sameSite: "lax",
    secure: config.cookieSecure,
    path: "/"
  });
}

function requireRoomPath(req, res, next) {
  const roomHeader = req.get("x-love-room") || "";
  if (roomHeader === config.roomPath || roomHeader === config.roomPath.slice(1)) {
    return next();
  }
  return res.status(404).json({ error: "Not found" });
}

function requireRoom(req, res, next) {
  requireRoomPath(req, res, () => {
    const access = getAccessFromRequest(req);
    if (!access) return res.status(401).json({ error: "Room is locked." });
    req.roomPerson = access.person;
    return next();
  });
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function asPerson(value) {
  return value === "B" ? "B" : "A";
}

function unlockAttemptKey(req, person) {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  return `${ip}:${asPerson(person)}`;
}

function getUnlockAttempt(key) {
  const now = Date.now();
  const attempt = unlockAttempts.get(key);
  if (!attempt || attempt.resetAt <= now) {
    const next = { failures: 0, resetAt: now + UNLOCK_WINDOW_MS };
    unlockAttempts.set(key, next);
    return next;
  }
  return attempt;
}

function isUnlockBlocked(key) {
  return getUnlockAttempt(key).failures >= UNLOCK_MAX_FAILURES;
}

function registerUnlockFailure(key) {
  const attempt = getUnlockAttempt(key);
  attempt.failures += 1;
  unlockAttempts.set(key, attempt);
  return attempt;
}

function toBool(value) {
  return value === 1 || value === true;
}

function toTodo(row) {
  return {
    id: row.id,
    title: row.title,
    note: row.note || "",
    type: row.type,
    completed: toBool(row.completed),
    createdAt: row.created_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at
  };
}

function listTodos() {
  return db.prepare(`
    SELECT * FROM todos
    ORDER BY completed ASC, created_at DESC
  `).all().map(toTodo);
}

function emitTodos() {
  io.to(ROOM).emit("todos:updated", listTodos());
}

function dateInTimezone(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function currentQuestionDate() {
  const settings = getSettings();
  return dateInTimezone(settings.cityATimezone || "Asia/Shanghai");
}

function answersForDate(questionDate) {
  return db.prepare(`
    SELECT person, answer, created_at, updated_at
    FROM answers
    WHERE question_date = ?
  `).all(questionDate).reduce((acc, row) => {
    acc[row.person] = {
      answer: row.answer,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
    return acc;
  }, {});
}

function dailyPayload(person = "A", questionDate = currentQuestionDate()) {
  const safePerson = asPerson(person);
  const assignment = getOrCreateDailyAssignment(questionDate);
  const answers = answersForDate(questionDate);
  const unlocked = Boolean(answers.A && answers.B);
  const visibleAnswers = {
    A: unlocked || safePerson === "A" ? answers.A || null : null,
    B: unlocked || safePerson === "B" ? answers.B || null : null
  };

  return {
    date: questionDate,
    question: {
      id: assignment.id,
      text: assignment.text
    },
    answered: {
      A: Boolean(answers.A),
      B: Boolean(answers.B)
    },
    unlocked,
    answers: visibleAnswers
  };
}

function emitDailyToAll(questionDate = currentQuestionDate()) {
  for (const socket of io.sockets.sockets.values()) {
    if (socket.rooms.has(ROOM)) {
      socket.emit("daily:updated", dailyPayload(socket.data.person, questionDate));
    }
  }
}

function dailyHistory(person = "A") {
  try {
    getOrCreateDailyAssignment(currentQuestionDate());
  } catch (error) {
    // Keep history readable even when the unused question pool is empty.
  }
  const rows = db.prepare(`
    SELECT a.question_date, q.id AS question_id, q.text
    FROM daily_assignments a
    JOIN daily_questions q ON q.id = a.question_id
    ORDER BY a.question_date DESC
    LIMIT 60
  `).all();

  return rows.map((row) => {
    const safePerson = asPerson(person);
    const payload = dailyPayload(safePerson, row.question_date);
    return {
      date: row.question_date,
      question: {
        id: row.question_id,
        text: row.text
      },
      answered: payload.answered,
      canMakeUp: !payload.answered[safePerson] && row.question_date !== currentQuestionDate(),
      unlocked: payload.unlocked,
      answers: payload.answers
    };
  });
}

function listQuestions() {
  return db.prepare(`
    SELECT id, text, active, created_at
    FROM daily_questions
    WHERE active = 1
      AND id NOT IN (SELECT question_id FROM daily_assignments)
    ORDER BY id ASC
  `).all().map((row) => ({
    id: row.id,
    text: row.text,
    active: toBool(row.active),
    createdAt: row.created_at
  }));
}

function listQuestionTexts() {
  return db.prepare(`
    SELECT text
    FROM daily_questions
    ORDER BY id ASC
  `).all().map((row) => row.text);
}

function normalizeMovieRow(row) {
  const updatedAt = row.updated_at || nowIso();
  let position = Number(row.position || 0);
  const playbackRate = Number(row.playback_rate || 1);
  const paused = toBool(row.paused);

  if (!paused && updatedAt) {
    const elapsedSeconds = Math.max(0, (Date.now() - new Date(updatedAt).getTime()) / 1000);
    position += elapsedSeconds * playbackRate;
  }

  return {
    id: row.id,
    videoUrl: row.video_url || "",
    videoName: row.video_name || "",
    videoType: row.video_type || "",
    position,
    paused,
    playbackRate,
    updatedAt
  };
}

function getMovieState() {
  const row = db.prepare("SELECT * FROM movie_rooms WHERE id = 'main'").get();
  return normalizeMovieRow(row);
}

function saveMovieState(patch) {
  const current = getMovieState();
  const next = {
    videoUrl: patch.videoUrl !== undefined ? patch.videoUrl : current.videoUrl,
    videoName: patch.videoName !== undefined ? patch.videoName : current.videoName,
    videoType: patch.videoType !== undefined ? patch.videoType : current.videoType,
    position: Number.isFinite(Number(patch.position)) ? Math.max(0, Number(patch.position)) : current.position,
    paused: patch.paused !== undefined ? Boolean(patch.paused) : current.paused,
    playbackRate: Number.isFinite(Number(patch.playbackRate))
      ? Math.min(4, Math.max(0.25, Number(patch.playbackRate)))
      : current.playbackRate,
    updatedAt: nowIso()
  };

  db.prepare(`
    UPDATE movie_rooms
    SET video_url = ?, video_name = ?, video_type = ?,
        position = ?, paused = ?, playback_rate = ?, updated_at = ?
    WHERE id = 'main'
  `).run(
    next.videoUrl || null,
    next.videoName || null,
    next.videoType || null,
    next.position,
    next.paused ? 1 : 0,
    next.playbackRate,
    next.updatedAt
  );

  return getMovieState();
}

function listMovieMessages() {
  return db.prepare(`
    SELECT id, author, message, created_at
    FROM movie_messages
    WHERE room_id = 'main'
    ORDER BY id DESC
    LIMIT 100
  `).all().reverse().map((row) => ({
    id: row.id,
    author: row.author,
    message: row.message,
    createdAt: row.created_at
  }));
}

function emitMovieState(sourceId = "") {
  io.to(ROOM).emit("movie:state", {
    ...getMovieState(),
    sourceId
  });
}

function emitOnline() {
  const online = { A: 0, B: 0, drawing: { A: false, B: false } };
  for (const socket of io.sockets.sockets.values()) {
    if (socket.rooms.has(ROOM)) {
      const person = asPerson(socket.data.person);
      online[person] += 1;
      if (socket.data.drawingActive) online.drawing[person] = true;
    }
  }
  io.to(ROOM).emit("presence:updated", online);
}

function setDrawingActive(socket, active) {
  const next = Boolean(active);
  if (socket.data.drawingActive === next) return;
  socket.data.drawingActive = next;
  emitOnline();
}

const drawGuessWords = [
  "披萨",
  "城市",
  "旅行",
  "小船",
  "火锅",
  "月亮",
  "花束",
  "电影",
  "海边",
  "蛋糕",
  "星星",
  "雨伞",
  "飞机",
  "咖啡",
  "桥",
  "自行车",
  "城堡",
  "拖鞋",
  "奶茶",
  "拥抱",
  "晚霞",
  "面具",
  "吉他",
  "雪人",
  "灯塔",
  "水杯",
  "口红",
  "拥抱",
  "礼物",
  "地图"
];

const drawGuessGame = {
  started: false,
  roundId: "idle",
  roundNumber: 0,
  drawer: "A",
  word: "",
  winner: "",
  guesses: [],
  strokes: [],
  updatedAt: nowIso()
};

function otherPerson(person) {
  return asPerson(person) === "A" ? "B" : "A";
}

function labelForServerChanPerson(person) {
  const room = getRoomConfig();
  return asPerson(person) === "B" ? room.personBName : room.personAName;
}

function serverChanTargetForPerson(person) {
  return SERVERCHAN_TARGETS[asPerson(person)];
}

function notifyDailyAnswer(person, questionDate, questionText) {
  if (!fs.existsSync(SERVERCHAN_PUSH_BIN)) return;

  const senderLabel = labelForServerChanPerson(person);
  const recipientPerson = otherPerson(person);
  const recipientLabel = labelForServerChanPerson(recipientPerson);
  const recipientTarget = serverChanTargetForPerson(recipientPerson);
  const title = `${senderLabel}今天回答问题啦`;
  const body = [
    `日期：${questionDate}`,
    "",
    `今天的问题：${questionText}`,
    "",
    `${senderLabel}已经答完啦，就等${recipientLabel}来回答。`
  ].join("\n");

  execFile(
    SERVERCHAN_PUSH_BIN,
    [title, body],
    {
      env: {
        ...process.env,
        SERVERCHAN_TO: recipientTarget
      },
      timeout: 20000
    },
    (error, stdout, stderr) => {
      if (error) {
        console.error("ServerChan daily answer push failed", {
          recipient: recipientLabel,
          target: recipientTarget,
          code: error.code,
          signal: error.signal,
          message: error.message
        });
        if (stderr) console.error(stderr.trim());
        return;
      }
      if (stdout) console.log(stdout.trim());
    }
  );
}

function normalizeGuess(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function pickDrawGuessWord(previous = "") {
  const pool = drawGuessWords.filter((word) => word !== previous);
  return pool[Math.floor(Math.random() * pool.length)] || drawGuessWords[0];
}

function maskDrawGuessWord(word) {
  return Array.from(String(word || "")).map((char) => {
    if (/[\s·.,!?，。！？]/.test(char)) return char;
    return "□";
  }).join("");
}

function drawGuessPayload(person) {
  const safePerson = asPerson(person);
  const revealed = Boolean(drawGuessGame.winner || safePerson === drawGuessGame.drawer);
  return {
    started: drawGuessGame.started,
    roundId: drawGuessGame.roundId,
    roundNumber: drawGuessGame.roundNumber,
    drawer: drawGuessGame.drawer,
    word: revealed ? drawGuessGame.word : "",
    maskedWord: revealed ? drawGuessGame.word : maskDrawGuessWord(drawGuessGame.word),
    wordLength: Array.from(drawGuessGame.word || "").length,
    winner: drawGuessGame.winner,
    guesses: drawGuessGame.guesses,
    strokes: drawGuessGame.strokes,
    updatedAt: drawGuessGame.updatedAt
  };
}

function emitDrawGuessState() {
  for (const socket of io.sockets.sockets.values()) {
    if (socket.rooms.has(ROOM)) {
      socket.emit("drawguess:state", drawGuessPayload(socket.data.person));
    }
  }
}

function sendDrawGuessState(socket) {
  socket.emit("drawguess:state", drawGuessPayload(socket.data.person));
}

function startDrawGuessRound(drawer) {
  drawGuessGame.started = true;
  drawGuessGame.roundId = crypto.randomBytes(8).toString("hex");
  drawGuessGame.roundNumber += 1;
  drawGuessGame.drawer = asPerson(drawer);
  drawGuessGame.word = pickDrawGuessWord(drawGuessGame.word);
  drawGuessGame.winner = "";
  drawGuessGame.guesses = [];
  drawGuessGame.strokes = [];
  drawGuessGame.updatedAt = nowIso();
  emitDrawGuessState();
}

function isDrawGuessDrawer(socket) {
  return drawGuessGame.started &&
    !drawGuessGame.winner &&
    asPerson(socket.data.person) === drawGuessGame.drawer;
}

function sanitizeDrawGuessStroke(stroke) {
  if (!stroke || !Array.isArray(stroke.points) || stroke.points.length < 2) return null;
  const points = stroke.points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .slice(0, 1600)
    .map((point) => ({
      x: Math.min(1, Math.max(0, Number(point.x))),
      y: Math.min(1, Math.max(0, Number(point.y)))
    }));
  if (points.length < 2) return null;
  return {
    color: String(stroke.color || "#526f93").slice(0, 32),
    size: Math.min(72, Math.max(2, Number(stroke.size || 6))),
    points
  };
}

function listDrawingStrokes() {
  return db.prepare(`
    SELECT id, stroke_json, created_at
    FROM drawing_strokes
    ORDER BY id ASC
  `).all().map((row) => ({
    id: row.id,
    stroke: JSON.parse(row.stroke_json),
    createdAt: row.created_at
  }));
}

function listDrawings() {
  return db.prepare(`
    SELECT id, title, file_path, created_at
    FROM drawings
    ORDER BY id DESC
    LIMIT 50
  `).all().map((row) => ({
    id: row.id,
    title: row.title || "",
    filePath: row.file_path,
    createdAt: row.created_at
  }));
}

function emitDrawingHistory() {
  io.to(ROOM).emit("drawing:history", listDrawingStrokes());
}

function emitDrawingsSaved() {
  io.to(ROOM).emit("drawings:updated", listDrawings());
}

function todayKey() {
  return dateInTimezone("Asia/Shanghai");
}

function parseOutfitItems(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map((item) => String(item).slice(0, 40)) : [];
  } catch (_error) {
    return [];
  }
}

function listOutfits(date = todayKey()) {
  const rows = db.prepare(`
    SELECT person, items_json, updated_at
    FROM outfit_logs
    WHERE outfit_date = ?
  `).all(date);
  const result = {
    date,
    A: { items: [], updatedAt: "" },
    B: { items: [], updatedAt: "" }
  };
  for (const row of rows) {
    result[asPerson(row.person)] = {
      items: parseOutfitItems(row.items_json),
      updatedAt: row.updated_at
    };
  }
  return result;
}

function emitOutfits(date = todayKey()) {
  io.to(ROOM).emit("outfits:updated", listOutfits(date));
}

function emitStamps(year = null) {
  const pickedYear = year || Number(currentStampDateKey().slice(0, 4));
  io.to(ROOM).emit("stamps:updated", stampYearSummary(pickedYear));
}

const AUTO_ANNIVERSARY_DEFS = [
  { id: "love-100", title: "恋爱 100 天", icon: "💌", days: 100 },
  { id: "love-200", title: "恋爱 200 天", icon: "💗", days: 200 },
  { id: "love-300", title: "恋爱 300 天", icon: "🌷", days: 300 },
  { id: "half-year", title: "半周年", icon: "🌙", months: 6 },
  { id: "one-year", title: "一周年", icon: "✨", years: 1 },
  { id: "two-years", title: "两周年", icon: "💫", years: 2 },
  { id: "three-years", title: "三周年", icon: "⭐", years: 3 }
];

function normalizeDateKey(value) {
  const text = String(value || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? "" : text;
}

function dateKeyToUtcDate(dateKey) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function utcDateToKey(date) {
  return date.toISOString().slice(0, 10);
}

function addRelationshipDays(dateKey, days) {
  const date = dateKeyToUtcDate(dateKey);
  date.setUTCDate(date.getUTCDate() + Math.max(0, Number(days || 1) - 1));
  return utcDateToKey(date);
}

function addCalendarMonths(dateKey, months) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + Number(months || 0), 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return utcDateToKey(target);
}

function nextMonthDayKey(mmdd, currentDateKey) {
  const [month, day] = String(mmdd || "").split("-").map(Number);
  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return "";
  const year = Number(currentDateKey.slice(0, 4));
  const padded = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  let dateKey = `${year}-${padded}`;
  if (dateKey < currentDateKey) dateKey = `${year + 1}-${padded}`;
  return normalizeDateKey(dateKey);
}

function toCustomAnniversary(row) {
  return {
    id: `custom-${row.id}`,
    rawId: row.id,
    source: "custom",
    editable: true,
    title: row.title,
    icon: row.icon || "♡",
    date: row.event_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function listCustomAnniversaries() {
  return db.prepare(`
    SELECT id, title, event_date, icon, created_at, updated_at
    FROM anniversaries
    ORDER BY event_date ASC, id ASC
  `).all().map(toCustomAnniversary);
}

function buildAnniversaryPayload() {
  const settings = getSettings();
  const room = getRoomConfig();
  const currentDate = dateInTimezone(settings.cityATimezone || "Asia/Shanghai");
  const relationshipStartDate = normalizeDateKey(settings.relationshipStartDate);
  const relationshipItems = relationshipStartDate ? AUTO_ANNIVERSARY_DEFS.map((def) => ({
    id: `auto-${def.id}`,
    source: "auto",
    editable: false,
    title: def.title,
    icon: def.icon,
    date: def.days
      ? addRelationshipDays(relationshipStartDate, def.days)
      : addCalendarMonths(relationshipStartDate, Number(def.months || 0) + Number(def.years || 0) * 12),
    baseDate: relationshipStartDate,
    rule: def
  })) : [];

  const birthdayItems = [
    {
      id: "birthday-a",
      source: "birthday",
      editable: false,
      title: `${room.personAName} Birthday`,
      icon: room.personAEmoji,
      date: nextMonthDayKey(settings.cityABirthday, currentDate)
    },
    {
      id: "birthday-b",
      source: "birthday",
      editable: false,
      title: `${room.personBName} Birthday`,
      icon: room.personBEmoji,
      date: nextMonthDayKey(settings.cityBBirthday, currentDate)
    }
  ].filter((item) => item.date);

  const items = [
    ...relationshipItems,
    ...birthdayItems,
    ...listCustomAnniversaries()
  ].sort((a, b) => {
    const aUpcoming = a.date >= currentDate;
    const bUpcoming = b.date >= currentDate;
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    return aUpcoming ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
  });

  return {
    currentDate,
    relationshipStartDate,
    items
  };
}

function emitAnniversaries() {
  io.to(ROOM).emit("anniversaries:updated", buildAnniversaryPayload());
}

const uploadVideo = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, VIDEOS_DIR),
    filename: (_req, file, cb) => cb(null, safeUploadName(file.originalname))
  }),
  limits: {
    fileSize: config.maxVideoMb * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (isAllowedVideoUpload(file)) {
      return cb(null, true);
    }
    return cb(new Error(VIDEO_UPLOAD_ERROR));
  }
});

function weatherCodeLabel(code) {
  const value = Number(code);
  if (value === 0) return { text: "晴", icon: "☀" };
  if ([1, 2, 3].includes(value)) return { text: "多云", icon: "⛅" };
  if ([45, 48].includes(value)) return { text: "有雾", icon: "〰" };
  if ([51, 53, 55, 56, 57].includes(value)) return { text: "毛毛雨", icon: "☂" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(value)) return { text: "下雨", icon: "☔" };
  if ([71, 73, 75, 77, 85, 86].includes(value)) return { text: "下雪", icon: "❄" };
  if ([95, 96, 99].includes(value)) return { text: "雷雨", icon: "⚡" };
  return { text: "天气", icon: "○" };
}

function weatherCodeToOpenMeteoCondition(code) {
  const value = Number(code);
  if (value >= 200 && value < 300) return 95;
  if (value >= 300 && value < 600) return 63;
  if (value >= 600 && value < 700) return 73;
  if (value >= 700 && value < 800) return 45;
  if (value === 800) return 0;
  if (value === 801) return 1;
  if (value === 802) return 2;
  if (value === 803 || value === 804) return 3;
  return 3;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        "user-agent": "LoveRoom/1.0"
      },
      timeout: 12000
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("timeout", () => {
      request.destroy(new Error("Weather API timeout"));
    });
    request.on("error", reject);
  });
}

function cleanSetupText(value, fallback = "", maxLength = 80) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return (text || fallback).slice(0, maxLength);
}

function cleanSetupEmoji(value, fallback) {
  return cleanSetupText(value, fallback, 8);
}

function normalizeSetupTimezone(value, fallback = "UTC") {
  const timeZone = cleanSetupText(value, fallback, 64);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch (_error) {
    return fallback;
  }
}

function buildPublicConfigPayload() {
  const room = getRoomConfig();
  const needsSetup = roomNeedsSetup();
  const settings = needsSetup ? getSettings() : null;
  return {
    persons: {
      A: { name: room.personAName, emoji: room.personAEmoji },
      B: { name: room.personBName, emoji: room.personBEmoji }
    },
    games: {
      vttUrl: config.vttUrl,
      posioUrl: config.posioUrl
    },
    setup: {
      needsSetup,
      roomPath: config.roomPath,
      roomPathIsDefault: config.roomPath === "/love-room-demo",
      defaults: settings ? {
        cityAName: settings.cityAName,
        cityATimezone: settings.cityATimezone,
        cityABirthday: settings.cityABirthday,
        cityBName: settings.cityBName,
        cityBTimezone: settings.cityBTimezone,
        cityBBirthday: settings.cityBBirthday,
        relationshipStartDate: settings.relationshipStartDate,
        nextMeetingAt: settings.nextMeetingAt,
        nextMeetingLocation: settings.nextMeetingLocation,
        nextMeetingTitle: settings.nextMeetingTitle
      } : null
    }
  };
}

const geocodeCache = new Map();

function hasUsableCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return Math.abs(lat) > 0.0001 || Math.abs(lon) > 0.0001;
}

async function geocodeCity(name) {
  const query = String(name || "").trim();
  if (!query || ["City A", "City B"].includes(query)) return null;
  const cacheKey = query.toLowerCase();
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const data = await fetchJson(url);
  const picked = data.results?.[0] || null;
  const result = picked ? {
    name: picked.name || query,
    latitude: String(picked.latitude),
    longitude: String(picked.longitude),
    timezone: picked.timezone || "",
    country: picked.country || ""
  } : null;
  geocodeCache.set(cacheKey, result);
  return result;
}

async function resolveWeatherPlace(place) {
  if (hasUsableCoordinates(place.latitude, place.longitude)) {
    return place;
  }
  const geocoded = await geocodeCity(place.name);
  if (!geocoded) return place;
  return {
    ...place,
    latitude: geocoded.latitude,
    longitude: geocoded.longitude,
    resolvedName: [geocoded.name, geocoded.country].filter(Boolean).join(", "),
    resolvedTimezone: geocoded.timezone
  };
}

async function fetchWeather(place) {
  const resolvedPlace = await resolveWeatherPlace(place);
  const lat = Number(resolvedPlace.latitude);
  const lon = Number(resolvedPlace.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, name: place.name, error: "Missing coordinates" };
  }

  if (config.weatherProvider === "openweathermap" && config.weatherApiKey) {
    try {
      const url = new URL("https://api.openweathermap.org/data/2.5/weather");
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lon));
      url.searchParams.set("appid", config.weatherApiKey);
      url.searchParams.set("units", "metric");
      url.searchParams.set("lang", "zh_cn");
      const data = await fetchJson(url);
      const weather = data.weather?.[0] || {};
      const fallbackDetails = await fetchOpenMeteoWeather(resolvedPlace, lat, lon, weatherCodeToOpenMeteoCondition(weather.id)).catch(() => null);
      return {
        ok: true,
        name: resolvedPlace.name,
        resolvedName: resolvedPlace.resolvedName || "",
        temperature: Math.round(data.main?.temp ?? 0),
        feelsLike: Math.round(data.main?.feels_like ?? data.main?.temp ?? 0),
        condition: weather.description || "天气",
        icon: "",
        iconUrl: weather.icon ? `https://openweathermap.org/img/wn/${weather.icon}@2x.png` : "",
        windSpeed: Math.round(Number(data.wind?.speed || 0) * 36) / 10,
        uvIndex: fallbackDetails?.uvIndex ?? null,
        weatherCode: fallbackDetails?.weatherCode ?? null,
        source: "openweathermap"
      };
    } catch (error) {
      const fallback = await fetchOpenMeteoWeather(resolvedPlace, lat, lon);
      return {
        ...fallback,
        source: "openmeteo-fallback",
        providerError: error.message
      };
    }
  }

  return fetchOpenMeteoWeather(resolvedPlace, lat, lon);
}

async function fetchOpenMeteoWeather(place, lat, lon, fallbackWeatherCode = null) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code,wind_speed_10m");
  url.searchParams.set("daily", "uv_index_max");
  url.searchParams.set("timezone", "auto");
  const data = await fetchJson(url);
  const weatherCode = data.current?.weather_code ?? fallbackWeatherCode;
  const label = weatherCodeLabel(weatherCode);
  return {
    ok: true,
    name: place.name,
    resolvedName: place.resolvedName || "",
    temperature: Math.round(data.current?.temperature_2m ?? 0),
    feelsLike: Math.round(data.current?.apparent_temperature ?? data.current?.temperature_2m ?? 0),
    condition: label.text,
    icon: label.icon,
    iconUrl: "",
    windSpeed: Math.round(Number(data.current?.wind_speed_10m || 0) * 10) / 10,
    uvIndex: data.daily?.uv_index_max?.[0] !== undefined ? Math.round(Number(data.daily.uv_index_max[0]) * 10) / 10 : null,
    weatherCode,
    source: "openmeteo"
  };
}

app.use("/uploads", express.static(UPLOADS_DIR, {
  maxAge: "1d",
  fallthrough: false,
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
  }
}));
app.use(express.static(PUBLIC_DIR, {
  extensions: ["html"],
  index: false,
  maxAge: "1h"
}));

app.get("/", (_req, res) => {
  res.status(404).send("Not found");
});

app.get("/api/public-config", requireRoomPath, (_req, res) => {
  res.json(buildPublicConfigPayload());
});

app.post("/api/setup", requireRoomPath, (req, res) => {
  if (!roomNeedsSetup()) {
    return res.status(403).json({ error: "Setup has already been completed." });
  }

  const body = req.body || {};
  const personAName = cleanSetupText(body.personAName, "Person A", 40);
  const personBName = cleanSetupText(body.personBName, "Person B", 40);
  const personAEmoji = cleanSetupEmoji(body.personAEmoji, "💛");
  const personBEmoji = cleanSetupEmoji(body.personBEmoji, "🌙");
  const personAPasscode = cleanSetupText(body.personAPasscode, "", 80);
  const personBPasscode = cleanSetupText(body.personBPasscode, "", 80);
  const cityAName = cleanSetupText(body.cityAName, "City A", 80);
  const cityBName = cleanSetupText(body.cityBName, "City B", 80);
  const cityATimezone = normalizeSetupTimezone(body.cityATimezone, "UTC");
  const cityBTimezone = normalizeSetupTimezone(body.cityBTimezone, "UTC");
  const cityABirthday = cleanSetupText(body.cityABirthday, "", 10);
  const cityBBirthday = cleanSetupText(body.cityBBirthday, "", 10);
  const relationshipStartDate = normalizeDateKey(body.relationshipStartDate) || "";
  const nextMeetingLocation = cleanSetupText(body.nextMeetingLocation, "", 80);
  const nextMeetingTitle = cleanSetupText(body.nextMeetingTitle, "Next Meeting", 100);
  let nextMeetingAt = getSettings().nextMeetingAt;
  if (body.nextMeetingAt) {
    const nextMeetingDate = new Date(body.nextMeetingAt);
    if (Number.isNaN(nextMeetingDate.getTime())) {
      return res.status(400).json({ error: "Next meeting date is invalid." });
    }
    nextMeetingAt = nextMeetingDate.toISOString();
  }

  if (personAPasscode.length < 4 || personBPasscode.length < 4) {
    return res.status(400).json({ error: "Both passcodes must be at least 4 characters." });
  }
  if (personAPasscode === personBPasscode) {
    return res.status(400).json({ error: "Use two different passcodes." });
  }
  if (!cityAName || !cityBName) {
    return res.status(400).json({ error: "Both city names are required." });
  }

  updateRoomConfig({
    personAName,
    personAEmoji,
    personAPasscode: hashPasscode(personAPasscode),
    personBName,
    personBEmoji,
    personBPasscode: hashPasscode(personBPasscode),
    setupComplete: "1"
  });
  const settings = updateSettings({
    cityAName,
    cityATimezone,
    cityALatitude: "",
    cityALongitude: "",
    cityBName,
    cityBTimezone,
    cityBLatitude: "",
    cityBLongitude: "",
    cityABirthday,
    cityBBirthday,
    relationshipStartDate,
    nextMeetingAt,
    nextMeetingLocation,
    nextMeetingTitle
  });

  io.to(ROOM).emit("settings:updated", settings);
  emitAnniversaries();
  const accessToken = setAccessCookie(res, "A");
  res.json({
    ok: true,
    person: "A",
    accessToken,
    publicConfig: buildPublicConfigPayload(),
    settings
  });
});

app.get("/api/session", requireRoomPath, (req, res) => {
  const access = getAccessFromRequest(req);
  res.json({
    unlocked: Boolean(access),
    person: access?.person || null
  });
});

app.post("/api/unlock", requireRoomPath, (req, res) => {
  const person = asPerson(req.body.person);
  const passcode = String(req.body.passcode || "").trim();
  const attemptKey = unlockAttemptKey(req, person);
  if (isUnlockBlocked(attemptKey)) {
    return res.status(429).json({ error: "试太多次啦，等一会儿再进小房间。" });
  }
  const room = getRoomConfig();
  const expected = person === "B" ? room.personBPasscode : room.personAPasscode;
  if (!verifyPasscode(passcode, expected)) {
    registerUnlockFailure(attemptKey);
    return res.status(401).json({ error: "密码不对。" });
  }
  unlockAttempts.delete(attemptKey);
  clearAccessCookie(res);
  const accessToken = setAccessCookie(res, person);
  res.json({ ok: true, person, accessToken });
});

app.post("/api/lock", requireRoomPath, (_req, res) => {
  clearAccessCookie(res);
  res.json({ ok: true });
});

app.use("/api", requireRoom);

app.get("/api/settings", (_req, res) => {
  res.json(getSettings());
});

app.put("/api/settings", (req, res) => {
  const settings = updateSettings(req.body || {});
  io.to(ROOM).emit("settings:updated", settings);
  emitAnniversaries();
  res.json(settings);
});

app.get("/api/anniversaries", (_req, res) => {
  res.json(buildAnniversaryPayload());
});

app.post("/api/anniversaries", (req, res) => {
  const title = String(req.body.title || "").trim().slice(0, 80);
  const eventDate = normalizeDateKey(req.body.date || req.body.eventDate);
  const icon = String(req.body.icon || "♡").trim().slice(0, 12) || "♡";
  if (!title) return res.status(400).json({ error: "Title is required." });
  if (!eventDate) return res.status(400).json({ error: "Date is required." });
  const now = nowIso();
  db.prepare(`
    INSERT INTO anniversaries (title, event_date, icon, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(title, eventDate, icon, now, now);
  const payload = buildAnniversaryPayload();
  emitAnniversaries();
  res.status(201).json(payload);
});

app.put("/api/anniversaries/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM anniversaries WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Anniversary not found." });
  const title = req.body.title !== undefined ? String(req.body.title).trim().slice(0, 80) : existing.title;
  const eventDate = req.body.date !== undefined || req.body.eventDate !== undefined
    ? normalizeDateKey(req.body.date || req.body.eventDate)
    : existing.event_date;
  const icon = req.body.icon !== undefined ? String(req.body.icon || "♡").trim().slice(0, 12) || "♡" : existing.icon;
  if (!title) return res.status(400).json({ error: "Title is required." });
  if (!eventDate) return res.status(400).json({ error: "Date is required." });
  db.prepare(`
    UPDATE anniversaries
    SET title = ?, event_date = ?, icon = ?, updated_at = ?
    WHERE id = ?
  `).run(title, eventDate, icon, nowIso(), id);
  const payload = buildAnniversaryPayload();
  emitAnniversaries();
  res.json(payload);
});

app.delete("/api/anniversaries/:id", (req, res) => {
  db.prepare("DELETE FROM anniversaries WHERE id = ?").run(Number(req.params.id));
  const payload = buildAnniversaryPayload();
  emitAnniversaries();
  res.json(payload);
});

app.get("/api/weather", asyncHandler(async (_req, res) => {
  const settings = getSettings();
  const places = [
    {
      name: settings.cityAName,
      latitude: settings.cityALatitude,
      longitude: settings.cityALongitude
    },
    {
      name: settings.cityBName,
      latitude: settings.cityBLatitude,
      longitude: settings.cityBLongitude
    }
  ];

  const results = await Promise.all(places.map(async (place) => {
    try {
      return await fetchWeather(place);
    } catch (error) {
      return { ok: false, name: place.name, error: error.message };
    }
  }));

  res.json({
    provider: config.weatherProvider,
    places: results
  });
}));

app.get("/api/outfits", (req, res) => {
  res.json(listOutfits(req.query.date || todayKey()));
});

app.put("/api/outfits/:person", (req, res) => {
  const person = asPerson(req.params.person);
  const date = req.body.date || todayKey();
  const items = Array.isArray(req.body.items)
    ? req.body.items.map((item) => String(item).trim()).filter(Boolean).slice(0, 16)
    : [];
  db.prepare(`
    INSERT INTO outfit_logs (outfit_date, person, items_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(outfit_date, person) DO UPDATE SET
      items_json = excluded.items_json,
      updated_at = excluded.updated_at
  `).run(date, person, JSON.stringify(items), nowIso());
  const payload = listOutfits(date);
  emitOutfits(date);
  res.json(payload);
});

app.get("/api/stamps", (req, res) => {
  res.json(stampYearSummary(req.query.year));
});

app.post("/api/stamps/checkin", (req, res) => {
  const result = ensureStampCheckin(req.roomPerson);
  if (result.inserted) emitStamps(result.album.year);
  res.status(result.inserted ? 201 : 200).json({
    inserted: result.inserted,
    checkin: result.checkin ? {
      date: result.checkin.stamp_date,
      year: result.checkin.stamp_year,
      person: result.checkin.person,
      createdAt: result.checkin.created_at
    } : null,
    ...result.album
  });
});

app.get("/api/todos", (_req, res) => {
  res.json(listTodos());
});

app.post("/api/todos", (req, res) => {
  const title = String(req.body.title || "").trim();
  if (!title) return res.status(400).json({ error: "Title is required." });

  const now = nowIso();
  const result = db.prepare(`
    INSERT INTO todos (title, note, type, completed, created_at, completed_at, updated_at)
    VALUES (?, ?, ?, 0, ?, NULL, ?)
  `).run(
    title,
    String(req.body.note || "").trim(),
    String(req.body.type || "想一起做的事").trim(),
    now,
    now
  );

  const todo = toTodo(db.prepare("SELECT * FROM todos WHERE id = ?").get(result.lastInsertRowid));
  emitTodos();
  res.status(201).json(todo);
});

app.put("/api/todos/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM todos WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Todo not found." });

  const title = req.body.title !== undefined ? String(req.body.title).trim() : existing.title;
  if (!title) return res.status(400).json({ error: "Title is required." });

  const completed = req.body.completed !== undefined ? Boolean(req.body.completed) : toBool(existing.completed);
  const completedAt = completed
    ? existing.completed_at || nowIso()
    : null;

  db.prepare(`
    UPDATE todos
    SET title = ?, note = ?, type = ?, completed = ?, completed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(
    title,
    req.body.note !== undefined ? String(req.body.note).trim() : existing.note,
    req.body.type !== undefined ? String(req.body.type).trim() : existing.type,
    completed ? 1 : 0,
    completedAt,
    nowIso(),
    id
  );

  const todo = toTodo(db.prepare("SELECT * FROM todos WHERE id = ?").get(id));
  emitTodos();
  res.json(todo);
});

app.delete("/api/todos/:id", (req, res) => {
  db.prepare("DELETE FROM todos WHERE id = ?").run(Number(req.params.id));
  emitTodos();
  res.json({ ok: true });
});

app.get("/api/daily", (req, res) => {
  try {
    res.json(dailyPayload(req.roomPerson, req.query.date || currentQuestionDate()));
  } catch (error) {
    res.status(409).json({ error: error.message || "Daily question unavailable." });
  }
});

app.get("/api/daily/history", (req, res) => {
  try {
    res.json(dailyHistory(req.roomPerson));
  } catch (error) {
    res.status(409).json({ error: error.message || "Daily history unavailable." });
  }
});

app.post("/api/daily/answer", (req, res) => {
  const person = req.roomPerson;
  const answer = String(req.body.answer || "").trim();
  const questionDate = req.body.date || currentQuestionDate();
  if (!answer) return res.status(400).json({ error: "Answer is required." });

  let assignment;
  try {
    assignment = getOrCreateDailyAssignment(questionDate);
  } catch (error) {
    return res.status(409).json({ error: error.message || "Daily question unavailable." });
  }
  const existing = db.prepare(`
    SELECT id FROM answers
    WHERE question_date = ? AND person = ?
  `).get(questionDate, person);
  if (existing) {
    return res.status(409).json({ error: "这天已经回答过了，不能修改之前的答案。" });
  }

  const now = nowIso();
  db.prepare(`
    INSERT INTO answers (question_date, question_id, person, answer, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(questionDate, assignment.id, person, answer, now, now);

  const payload = dailyPayload(person, questionDate);
  emitDailyToAll(questionDate);
  notifyDailyAnswer(person, questionDate, assignment.text);
  res.json(payload);
});

app.get("/api/questions", (_req, res) => {
  res.json(listQuestions());
});

app.get("/api/questions/texts", (_req, res) => {
  res.json(listQuestionTexts());
});

app.post("/api/questions", (req, res) => {
  const texts = Array.isArray(req.body.questions)
    ? req.body.questions
    : String(req.body.text || "").split(/\r?\n/);
  const cleanTexts = texts
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 20);
  if (!cleanTexts.length) return res.status(400).json({ error: "Question text is required." });
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO daily_questions (text, active, created_at)
    VALUES (?, 1, ?)
  `);
  const now = nowIso();
  db.exec("BEGIN");
  try {
    for (const text of cleanTexts) {
      stmt.run(text, now);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  res.status(201).json(listQuestions());
});

app.put("/api/questions/:id", (req, res) => {
  const id = Number(req.params.id);
  const text = String(req.body.text || "").trim();
  if (!text) return res.status(400).json({ error: "Question text is required." });
  const existing = db.prepare("SELECT id FROM daily_questions WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Question not found." });
  db.prepare(`
    UPDATE daily_questions
    SET text = ?
    WHERE id = ?
      AND id NOT IN (SELECT question_id FROM daily_assignments)
  `).run(text, id);
  res.json(listQuestions());
});

app.delete("/api/questions/:id", (req, res) => {
  const id = Number(req.params.id);
  db.prepare(`
    UPDATE daily_questions
    SET active = 0
    WHERE id = ?
      AND id NOT IN (SELECT question_id FROM daily_assignments)
  `).run(id);
  res.json(listQuestions());
});

app.get("/api/movie", (_req, res) => {
  res.json({
    state: getMovieState(),
    messages: listMovieMessages()
  });
});

app.post("/api/movie/video", (req, res) => {
  const videoUrl = String(req.body.videoUrl || "").trim();
  if (!/^https?:\/\//i.test(videoUrl) && !videoUrl.startsWith("/uploads/videos/")) {
    return res.status(400).json({ error: "Use a direct http(s) video URL or an uploaded video path." });
  }
  const state = saveMovieState({
    videoUrl,
    videoName: String(req.body.videoName || videoUrl.split("/").pop() || "外部视频"),
    videoType: "external",
    position: 0,
    paused: true,
    playbackRate: 1
  });
  emitMovieState();
  res.json(state);
});

app.post("/api/movie/upload", uploadVideo.single("video"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Video file is required." });
  const videoUrl = `/uploads/videos/${req.file.filename}`;
  const state = saveMovieState({
    videoUrl,
    videoName: req.file.originalname,
    videoType: "upload",
    position: 0,
    paused: true,
    playbackRate: 1
  });
  emitMovieState();
  res.status(201).json(state);
});

app.get("/api/drawings", (_req, res) => {
  res.json(listDrawings());
});

app.post("/api/drawings", (req, res) => {
  const dataUrl = String(req.body.dataUrl || "");
  const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return res.status(400).json({ error: "A PNG data URL is required." });

  const buffer = Buffer.from(match[1], "base64");
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.png`;
  const absolutePath = path.join(DRAWINGS_DIR, filename);
  fs.writeFileSync(absolutePath, buffer);

  db.prepare(`
    INSERT INTO drawings (title, file_path, created_at)
    VALUES (?, ?, ?)
  `).run(
    String(req.body.title || "共同画板").trim(),
    `/uploads/drawings/${filename}`,
    nowIso()
  );

  const drawings = listDrawings();
  emitDrawingsSaved();
  res.status(201).json(drawings[0]);
});

app.get(config.roomPath, (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get(`${config.roomPath}/*`, (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.use((req, res) => {
  res.status(404).send("Not found");
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error instanceof multer.MulterError ? 400 : 500;
  res.status(status).json({ error: error.message || "Server error" });
});

io.use((socket, next) => {
  const roomPath = socket.handshake.auth?.roomPath;
  if (roomPath !== config.roomPath && roomPath !== config.roomPath.slice(1)) {
    return next(new Error("Invalid room."));
  }
  const cookieToken = parseCookies(socket.handshake.headers?.cookie || "").love_room_access || "";
  const token = socket.handshake.auth?.accessToken || cookieToken;
  const access = verifyAccessToken(token);
  if (!access) {
    return next(new Error("Room is locked."));
  }
  socket.data.person = access.person;
  return next();
});

io.on("connection", (socket) => {
  socket.data.person = asPerson(socket.data.person || socket.handshake.auth?.person);
  socket.data.drawingActive = false;
  socket.join(ROOM);

  try {
    socket.emit("settings:updated", getSettings());
    socket.emit("todos:updated", listTodos());
    socket.emit("daily:updated", dailyPayload(socket.data.person));
    socket.emit("movie:state", getMovieState());
    socket.emit("movie:messages", listMovieMessages());
    socket.emit("drawing:history", listDrawingStrokes());
    socket.emit("drawings:updated", listDrawings());
    socket.emit("outfits:updated", listOutfits());
    socket.emit("stamps:updated", stampYearSummary());
    socket.emit("anniversaries:updated", buildAnniversaryPayload());
    sendDrawGuessState(socket);
    emitOnline();
  } catch (error) {
    console.error("socket init failed:", error);
    socket.emit("app:error", { message: "初始化小房间时出错，刷新后再试一次。" });
  }

  socket.on("person:update", () => {
    socket.data.drawingActive = false;
    socket.emit("daily:updated", dailyPayload(socket.data.person));
    sendDrawGuessState(socket);
    emitOnline();
  });

  socket.on("movie:request-state", () => {
    socket.emit("movie:state", getMovieState());
    socket.emit("movie:messages", listMovieMessages());
  });

  socket.on("movie:control", (payload = {}) => {
    const state = saveMovieState({
      position: payload.position,
      paused: payload.paused,
      playbackRate: payload.playbackRate
    });
    io.to(ROOM).emit("movie:state", {
      ...state,
      sourceId: socket.id
    });
  });

  socket.on("movie:chat", (payload = {}) => {
    const message = String(payload.message || "").trim();
    if (!message) return;
    const author = asPerson(payload.person || socket.data.person);
    const result = db.prepare(`
      INSERT INTO movie_messages (room_id, author, message, created_at)
      VALUES ('main', ?, ?, ?)
    `).run(author, message.slice(0, 1000), nowIso());
    const row = db.prepare(`
      SELECT id, author, message, created_at
      FROM movie_messages
      WHERE id = ?
    `).get(result.lastInsertRowid);
    io.to(ROOM).emit("movie:message", {
      id: row.id,
      author: row.author,
      message: row.message,
      createdAt: row.created_at
    });
  });

  socket.on("drawing:activity", (payload = {}) => {
    setDrawingActive(socket, payload.active);
  });

  socket.on("drawing:preview", (stroke) => {
    setDrawingActive(socket, true);
    socket.to(ROOM).emit("drawing:preview", {
      stroke,
      sourceId: socket.id
    });
  });

  socket.on("drawing:stroke", (stroke) => {
    if (!stroke || !Array.isArray(stroke.points) || stroke.points.length < 2) return;
    const safeStroke = {
      tool: stroke.tool === "eraser" ? "eraser" : "pen",
      color: String(stroke.color || "#e85d75").slice(0, 32),
      size: Math.min(80, Math.max(1, Number(stroke.size || 4))),
      points: stroke.points
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        .slice(0, 2000)
        .map((point) => ({
          x: Math.min(1, Math.max(0, Number(point.x))),
          y: Math.min(1, Math.max(0, Number(point.y)))
        }))
    };
    if (safeStroke.points.length < 2) return;
    const result = db.prepare(`
      INSERT INTO drawing_strokes (stroke_json, created_at)
      VALUES (?, ?)
    `).run(JSON.stringify(safeStroke), nowIso());
    io.to(ROOM).emit("drawing:stroke", {
      id: result.lastInsertRowid,
      stroke: safeStroke,
      sourceId: socket.id
    });
    setDrawingActive(socket, false);
  });

  socket.on("drawing:undo", () => {
    db.prepare(`
      DELETE FROM drawing_strokes
      WHERE id = (SELECT id FROM drawing_strokes ORDER BY id DESC LIMIT 1)
    `).run();
    emitDrawingHistory();
  });

  socket.on("drawing:clear", () => {
    db.prepare("DELETE FROM drawing_strokes").run();
    emitDrawingHistory();
  });

  socket.on("drawguess:request-state", () => {
    sendDrawGuessState(socket);
  });

  socket.on("drawguess:new-round", (payload = {}) => {
    startDrawGuessRound(payload.drawer || socket.data.person);
  });

  socket.on("drawguess:pass-turn", () => {
    const nextDrawer = drawGuessGame.started
      ? otherPerson(drawGuessGame.drawer)
      : asPerson(socket.data.person);
    startDrawGuessRound(nextDrawer);
  });

  socket.on("drawguess:preview", (stroke) => {
    if (!isDrawGuessDrawer(socket)) return;
    const safeStroke = sanitizeDrawGuessStroke(stroke);
    if (!safeStroke) return;
    socket.to(ROOM).emit("drawguess:preview", {
      stroke: safeStroke,
      roundId: drawGuessGame.roundId,
      sourceId: socket.id
    });
  });

  socket.on("drawguess:stroke", (stroke) => {
    if (!isDrawGuessDrawer(socket)) return;
    const safeStroke = sanitizeDrawGuessStroke(stroke);
    if (!safeStroke) return;
    const entry = {
      id: `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
      stroke: safeStroke
    };
    drawGuessGame.strokes.push(entry);
    drawGuessGame.updatedAt = nowIso();
    io.to(ROOM).emit("drawguess:stroke", {
      ...entry,
      roundId: drawGuessGame.roundId,
      sourceId: socket.id
    });
  });

  socket.on("drawguess:undo", () => {
    if (!isDrawGuessDrawer(socket)) return;
    drawGuessGame.strokes.pop();
    drawGuessGame.updatedAt = nowIso();
    emitDrawGuessState();
  });

  socket.on("drawguess:clear", () => {
    if (!isDrawGuessDrawer(socket)) return;
    drawGuessGame.strokes = [];
    drawGuessGame.updatedAt = nowIso();
    emitDrawGuessState();
  });

  socket.on("drawguess:guess", (payload = {}) => {
    if (!drawGuessGame.started || drawGuessGame.winner) return;
    const text = String(payload.text || "").trim().slice(0, 80);
    if (!text) return;
    const person = asPerson(socket.data.person);
    const correct = person !== drawGuessGame.drawer &&
      normalizeGuess(text) === normalizeGuess(drawGuessGame.word);
    const guess = {
      id: `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
      person,
      text,
      correct,
      createdAt: nowIso()
    };
    drawGuessGame.guesses.push(guess);
    drawGuessGame.guesses = drawGuessGame.guesses.slice(-60);
    if (correct) {
      drawGuessGame.winner = person;
    }
    drawGuessGame.updatedAt = nowIso();
    emitDrawGuessState();
  });

  socket.on("disconnect", () => {
    socket.data.drawingActive = false;
    emitOnline();
  });
});

process.on("unhandledRejection", (error) => {
  console.error("unhandledRejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("uncaughtException:", error);
});

server.listen(config.port, config.host, () => {
  console.log(`Love Room is running at http://${config.host}:${config.port}${config.roomPath}`);
});
