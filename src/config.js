const path = require("node:path");
const crypto = require("node:crypto");
const dotenv = require("dotenv");

dotenv.config();

const rootDir = path.resolve(__dirname, "..");

function normalizeRoomPath(value) {
  const raw = (value || "/love-room-demo").trim();
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withSlash.replace(/\/+$/, "") || "/love-room-demo";
}

function resolveFromRoot(value, fallback) {
  const picked = value || fallback;
  return path.isAbsolute(picked) ? picked : path.join(rootDir, picked);
}

const config = {
  rootDir,
  isProduction: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || "127.0.0.1",
  baseUrl: process.env.BASE_URL || "",
  roomPath: normalizeRoomPath(process.env.ROOM_PATH),
  dbPath: resolveFromRoot(process.env.DB_PATH, "data/app.sqlite"),
  weatherProvider: (process.env.WEATHER_PROVIDER || "openmeteo").toLowerCase(),
  weatherApiKey: process.env.WEATHER_API_KEY || "",
  maxVideoMb: Number(process.env.MAX_VIDEO_MB || 500),
  personAName: process.env.PERSON_A_NAME || "Person A",
  personBName: process.env.PERSON_B_NAME || "Person B",
  personAEmoji: process.env.PERSON_A_EMOJI || "💛",
  personBEmoji: process.env.PERSON_B_EMOJI || "🌙",
  cityAName: process.env.CITY_A_NAME || "City A",
  cityATimezone: process.env.CITY_A_TIMEZONE || "UTC",
  cityALatitude: process.env.CITY_A_LATITUDE || "0",
  cityALongitude: process.env.CITY_A_LONGITUDE || "0",
  cityBName: process.env.CITY_B_NAME || "City B",
  cityBTimezone: process.env.CITY_B_TIMEZONE || "UTC",
  cityBLatitude: process.env.CITY_B_LATITUDE || "0",
  cityBLongitude: process.env.CITY_B_LONGITUDE || "0",
  cityABirthday: process.env.PERSON_A_BIRTHDAY || "",
  cityBBirthday: process.env.PERSON_B_BIRTHDAY || "",
  relationshipStartDate: process.env.RELATIONSHIP_START_DATE || "",
  nextMeetingLocation: process.env.NEXT_MEETING_LOCATION || "",
  nextMeetingTitle: process.env.NEXT_MEETING_TITLE || "Next Meeting",
  setupComplete: process.env.SETUP_COMPLETE === "1",
  pigPasscode: process.env.PERSON_A_PASSCODE || process.env.PIG_PASSCODE || "change-me-a",
  catPasscode: process.env.PERSON_B_PASSCODE || process.env.CAT_PASSCODE || "change-me-b",
  roomSecret: process.env.ROOM_SECRET || crypto.randomBytes(32).toString("hex"),
  trustProxy: process.env.TRUST_PROXY === "1",
  vttUrl: process.env.VTT_URL || "",
  posioUrl: process.env.POSIO_URL || ""
};

if (config.isProduction) {
  const insecureSecrets = new Set([
    "change-this-to-a-long-random-string",
    "dev-only-change-this-before-production"
  ]);
  if (!process.env.ROOM_SECRET || insecureSecrets.has(process.env.ROOM_SECRET)) {
    throw new Error("Set ROOM_SECRET before running in production.");
  }
}

module.exports = { config };
