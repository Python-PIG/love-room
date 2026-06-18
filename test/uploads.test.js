const assert = require("node:assert/strict");
const test = require("node:test");

const { isAllowedVideoUpload } = require("../src/uploads");

test("isAllowedVideoUpload requires both a known video extension and compatible MIME", () => {
  assert.equal(isAllowedVideoUpload({ originalname: "movie.mp4", mimetype: "video/mp4" }), true);
  assert.equal(isAllowedVideoUpload({ originalname: "movie.mov", mimetype: "video/quicktime" }), true);
  assert.equal(isAllowedVideoUpload({ originalname: "playlist.m3u8", mimetype: "application/vnd.apple.mpegurl" }), true);
  assert.equal(isAllowedVideoUpload({ originalname: "attack.html", mimetype: "video/mp4" }), false);
  assert.equal(isAllowedVideoUpload({ originalname: "movie.mp4", mimetype: "text/html" }), false);
});
