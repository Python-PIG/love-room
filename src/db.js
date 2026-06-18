const fs = require("node:fs");
const path = require("node:path");
const { config } = require("./config");
const { hashPasscode, isHashedPasscode } = require("./passcodes");

function createDatabase(filePath) {
  try {
    const { DatabaseSync } = require("node:sqlite");
    return new DatabaseSync(filePath);
  } catch (error) {
    if (error.code !== "ERR_UNKNOWN_BUILTIN_MODULE" && error.code !== "MODULE_NOT_FOUND") {
      throw error;
    }
    const Database = require("better-sqlite3");
    return new Database(filePath);
  }
}

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
fs.mkdirSync(path.join(config.rootDir, "uploads", "videos"), { recursive: true });
fs.mkdirSync(path.join(config.rootDir, "uploads", "drawings"), { recursive: true });

const db = createDatabase(config.dbPath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

const DEFAULT_SETTINGS = {
  cityAName: config.cityAName,
  cityATimezone: config.cityATimezone,
  cityALatitude: config.cityALatitude,
  cityALongitude: config.cityALongitude,
  cityBName: config.cityBName,
  cityBTimezone: config.cityBTimezone,
  cityBLatitude: config.cityBLatitude,
  cityBLongitude: config.cityBLongitude,
  cityAColdPreference: "normal",
  cityBColdPreference: "normal",
  cityABirthday: config.cityABirthday,
  cityBBirthday: config.cityBBirthday,
  cycleLastStart: "",
  cycleLastEnd: "",
  cycleLength: "28",
  cyclePeriodLength: "5",
  cycleNote: "",
  relationshipStartDate: config.relationshipStartDate,
  nextMeetingAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString(),
  nextMeetingLocation: config.nextMeetingLocation,
  nextMeetingTitle: config.nextMeetingTitle
};

const DEFAULT_ROOM_CONFIG = {
  personAName: config.personAName,
  personAEmoji: config.personAEmoji,
  personAPasscode: seedPasscode(config.pigPasscode, "change-me-a"),
  personBName: config.personBName,
  personBEmoji: config.personBEmoji,
  personBPasscode: seedPasscode(config.catPasscode, "change-me-b"),
  setupComplete: config.setupComplete ? "1" : "0"
};

const DEFAULT_QUESTIONS = [
  "如果我现在在你身边，我们会去哪？",
  "今天最想和我分享的一件小事是什么？",
  "如果今晚能一起吃饭，你想吃什么？",
  "今天有没有哪一秒突然想我？",
  "今天哪件事让你觉得被生活温柔了一下？",
  "如果我们今晚能一起散步，你想牵我走哪条路？",
  "今天最想听我对你说哪句话？",
  "如果把今天拍成一张照片，会是什么画面？",
  "下次见面你最想先做什么？",
  "今天有没有一个瞬间想立刻给我发消息？"
];

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS room_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      note TEXT,
      type TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_assignments (
      question_date TEXT PRIMARY KEY,
      question_id INTEGER NOT NULL REFERENCES daily_questions(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_date TEXT NOT NULL,
      question_id INTEGER NOT NULL REFERENCES daily_questions(id),
      person TEXT NOT NULL CHECK(person IN ('A', 'B')),
      answer TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(question_date, person)
    );

    CREATE TABLE IF NOT EXISTS movie_rooms (
      id TEXT PRIMARY KEY,
      video_url TEXT,
      video_name TEXT,
      video_type TEXT,
      position REAL NOT NULL DEFAULT 0,
      paused INTEGER NOT NULL DEFAULT 1,
      playback_rate REAL NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS movie_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      author TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS drawings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS drawing_strokes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stroke_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stamp_checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stamp_date TEXT NOT NULL UNIQUE,
      stamp_year INTEGER NOT NULL,
      person TEXT NOT NULL CHECK(person IN ('A', 'B')),
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_stamp_checkins_year
      ON stamp_checkins(stamp_year, stamp_date);

    CREATE TABLE IF NOT EXISTS anniversaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      event_date TEXT NOT NULL,
      icon TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS outfit_logs (
      outfit_date TEXT NOT NULL,
      person TEXT NOT NULL CHECK(person IN ('A', 'B')),
      items_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(outfit_date, person)
    );
  `);

  const now = new Date().toISOString();
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
  `);
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    insertSetting.run(key, value, now);
  }

  const insertRoomConfig = db.prepare(`
    INSERT OR IGNORE INTO room_config (key, value, updated_at)
    VALUES (?, ?, ?)
  `);
  for (const [key, value] of Object.entries(DEFAULT_ROOM_CONFIG)) {
    insertRoomConfig.run(key, value, now);
  }
  migrateLegacyPasscodes(now);

  const insertQuestion = db.prepare(`
    INSERT OR IGNORE INTO daily_questions (text, active, created_at)
    VALUES (?, 1, ?)
  `);
  for (const question of DEFAULT_QUESTIONS) {
    insertQuestion.run(question, now);
  }

  db.prepare(`
    INSERT OR IGNORE INTO movie_rooms
      (id, video_url, video_name, video_type, position, paused, playback_rate, updated_at)
    VALUES ('main', NULL, NULL, NULL, 0, 1, 1, ?)
  `).run(now);
}

function seedPasscode(value, placeholder) {
  const passcode = String(value || placeholder);
  return passcode === placeholder ? placeholder : hashPasscode(passcode);
}

function isSetupPlaceholder(key, value) {
  return (key === "personAPasscode" && value === "change-me-a")
    || (key === "personBPasscode" && value === "change-me-b");
}

function migrateLegacyPasscodes(updatedAt) {
  const stmt = db.prepare("UPDATE room_config SET value = ?, updated_at = ? WHERE key = ?");
  const rows = db.prepare(`
    SELECT key, value FROM room_config
    WHERE key IN ('personAPasscode', 'personBPasscode')
  `).all();
  for (const row of rows) {
    if (!isSetupPlaceholder(row.key, row.value) && !isHashedPasscode(row.value)) {
      stmt.run(hashPasscode(row.value), updatedAt, row.key);
    }
  }
}

function getSettings() {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

function getRoomConfig() {
  const rows = db.prepare("SELECT key, value FROM room_config").all();
  return {
    ...DEFAULT_ROOM_CONFIG,
    ...rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {})
  };
}

function roomNeedsSetup() {
  const room = getRoomConfig();
  return room.setupComplete !== "1"
    || room.personAPasscode === "change-me-a"
    || room.personBPasscode === "change-me-b";
}

function updateRoomConfig(values) {
  const allowed = new Set(Object.keys(DEFAULT_ROOM_CONFIG));
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO room_config (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);
  db.exec("BEGIN");
  try {
    for (const [key, value] of Object.entries(values)) {
      if (allowed.has(key) && value !== undefined && value !== null) {
        stmt.run(key, String(value), now);
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getRoomConfig();
}

function updateSettings(values) {
  const allowed = new Set(Object.keys(DEFAULT_SETTINGS));
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);
  db.exec("BEGIN");
  try {
    for (const [key, value] of Object.entries(values)) {
      if (allowed.has(key) && value !== undefined && value !== null) {
        stmt.run(key, String(value), now);
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getSettings();
}

function asStampPerson(value) {
  return value === "B" ? "B" : "A";
}

function dateKeyInTimezone(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function currentStampDateKey() {
  const settings = getSettings();
  return dateKeyInTimezone(settings.cityATimezone || "Asia/Shanghai");
}

function stampYearFromDateKey(dateKey) {
  const year = Number(String(dateKey || "").slice(0, 4));
  return Number.isInteger(year) && year > 1900 ? year : new Date().getUTCFullYear();
}

function stampDateToUtc(dateKey) {
  const normalized = String(dateKey || "").slice(0, 10);
  return new Date(`${normalized}T00:00:00.000Z`);
}

function formatStampDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function daysInStampYear(year) {
  return new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
}

function dayOfStampYear(dateKey) {
  const year = stampYearFromDateKey(dateKey);
  const date = stampDateToUtc(dateKey);
  if (Number.isNaN(date.getTime())) return 1;
  const firstDay = new Date(Date.UTC(year, 0, 1));
  return Math.max(1, Math.floor((date - firstDay) / 86400000) + 1);
}

function offsetStampDateKey(dateKey, offsetDays) {
  const date = stampDateToUtc(dateKey);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return formatStampDateKey(date);
}

function collectStampRows() {
  return db.prepare(`
    SELECT id, stamp_date, stamp_year, person, created_at
    FROM stamp_checkins
    ORDER BY stamp_date ASC
  `).all();
}

function stampYearsSummary(rows, currentYear, selectedYear) {
  const counts = new Map();
  rows.forEach((row) => {
    counts.set(row.stamp_year, (counts.get(row.stamp_year) || 0) + 1);
  });
  counts.set(currentYear, counts.get(currentYear) || 0);
  counts.set(selectedYear, counts.get(selectedYear) || 0);
  return Array.from(counts.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, count]) => {
      const total = daysInStampYear(year);
      return {
        year,
        count,
        total,
        progress: total ? Math.round((count / total) * 1000) / 10 : 0
      };
    });
}

function stampYearSummary(yearValue) {
  const currentDate = currentStampDateKey();
  const currentYear = stampYearFromDateKey(currentDate);
  const requestedYear = Number(yearValue);
  const year = Number.isInteger(requestedYear) && requestedYear >= 1900 ? requestedYear : currentYear;
  const rows = collectStampRows();
  const yearRows = rows.filter((row) => row.stamp_year === year);
  let previousDate = null;
  let streak = 0;
  const entries = yearRows.map((row) => {
    const expected = previousDate ? offsetStampDateKey(previousDate, 1) : null;
    streak = expected && row.stamp_date === expected ? streak + 1 : 1;
    previousDate = row.stamp_date;
    return {
      id: row.id,
      date: row.stamp_date,
      year: row.stamp_year,
      person: row.person,
      createdAt: row.created_at,
      dayOfYear: dayOfStampYear(row.stamp_date),
      streak,
      milestone: streak > 0 && streak % 30 === 0 ? "gold" : streak > 0 && streak % 7 === 0 ? "diamond" : ""
    };
  });
  const latest = entries[entries.length - 1] || null;
  const totalDays = daysInStampYear(year);
  const done = entries.length;
  return {
    year,
    currentYear,
    currentDate,
    lastCheckinDate: latest?.date || null,
    lastCheckinPerson: latest?.person || null,
    currentStreak: latest?.streak || 0,
    currentBadge: latest?.streak >= 30 ? "gold" : latest?.streak >= 7 ? "diamond" : "",
    yearProgress: {
      done,
      total: totalDays,
      percent: totalDays ? Math.round((done / totalDays) * 1000) / 10 : 0
    },
    years: stampYearsSummary(rows, currentYear, year),
    entries
  };
}

function ensureStampCheckin(person, dateKey = currentStampDateKey()) {
  const stampDate = /^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))
    ? String(dateKey).slice(0, 10)
    : currentStampDateKey();
  const stampYear = stampYearFromDateKey(stampDate);
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT OR IGNORE INTO stamp_checkins (stamp_date, stamp_year, person, created_at)
    VALUES (?, ?, ?, ?)
  `).run(stampDate, stampYear, asStampPerson(person), now);
  const checkin = db.prepare(`
    SELECT id, stamp_date, stamp_year, person, created_at
    FROM stamp_checkins
    WHERE stamp_date = ?
  `).get(stampDate);
  return {
    inserted: Boolean(result.changes),
    checkin,
    album: stampYearSummary(stampYear)
  };
}

function getOrCreateDailyAssignment(questionDate) {
  const existing = db.prepare(`
    SELECT a.question_date, q.id, q.text
    FROM daily_assignments a
    JOIN daily_questions q ON q.id = a.question_id
    WHERE a.question_date = ?
  `).get(questionDate);
  if (existing) return existing;

  const questions = db.prepare(`
    SELECT id, text FROM daily_questions
    WHERE active = 1
      AND id NOT IN (SELECT question_id FROM daily_assignments)
    ORDER BY id ASC
  `).all();

  const picked = questions[0] || db.prepare(`
    SELECT id, text FROM daily_questions
    WHERE active = 1
    ORDER BY id ASC
    LIMIT 1
  `).get() || db.prepare(`
    SELECT id, text FROM daily_questions
    ORDER BY id ASC
    LIMIT 1
  `).get();

  if (!picked) {
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO daily_questions (text, active, created_at)
      VALUES (?, 1, ?)
    `).run("今天聊点别的吧～", now);
    const fallback = {
      id: result.lastInsertRowid,
      text: "今天聊点别的吧～"
    };
    db.prepare(`
      INSERT INTO daily_assignments (question_date, question_id, created_at)
      VALUES (?, ?, ?)
    `).run(questionDate, fallback.id, now);
    return {
      question_date: questionDate,
      id: fallback.id,
      text: fallback.text
    };
  }

  db.prepare(`
    INSERT INTO daily_assignments (question_date, question_id, created_at)
    VALUES (?, ?, ?)
  `).run(questionDate, picked.id, new Date().toISOString());

  return {
    question_date: questionDate,
    id: picked.id,
    text: picked.text
  };
}

function closeDb() {
  db.close();
}

migrate();

module.exports = {
  db,
  config,
  getSettings,
  getRoomConfig,
  updateRoomConfig,
  roomNeedsSetup,
  updateSettings,
  asStampPerson,
  currentStampDateKey,
  stampYearSummary,
  ensureStampCheckin,
  getOrCreateDailyAssignment,
  closeDb
};
