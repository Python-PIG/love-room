const crypto = require("node:crypto");
const path = require("node:path");

const VIDEO_UPLOAD_ERROR = "Only mp4, webm, ogg, ogv, m4v, mov, or m3u8 video files are allowed.";
const allowedVideoMimesByExt = new Map([
  [".mp4", new Set(["video/mp4"])],
  [".m4v", new Set(["video/mp4", "video/x-m4v"])],
  [".webm", new Set(["video/webm"])],
  [".ogg", new Set(["video/ogg", "application/ogg"])],
  [".ogv", new Set(["video/ogg", "application/ogg"])],
  [".mov", new Set(["video/quicktime"])],
  [".m3u8", new Set(["application/vnd.apple.mpegurl", "application/x-mpegurl", "audio/mpegurl"])]
]);

function safeUploadName(originalName) {
  const ext = path.extname(originalName || "").toLowerCase();
  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
}

function isAllowedVideoUpload(file) {
  const ext = path.extname(file?.originalname || "").toLowerCase();
  const mimetype = String(file?.mimetype || "").toLowerCase();
  const allowedMimes = allowedVideoMimesByExt.get(ext);
  if (!allowedMimes) return false;
  if (!mimetype) return false;
  return allowedMimes.has(mimetype);
}

module.exports = {
  VIDEO_UPLOAD_ERROR,
  isAllowedVideoUpload,
  safeUploadName
};
