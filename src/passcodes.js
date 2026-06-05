const crypto = require("node:crypto");

const FORMAT = "scrypt";
const KEY_LENGTH = 32;
const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1
};

function hashPasscode(passcode) {
  const value = String(passcode || "");
  const salt = crypto.randomBytes(16).toString("base64url");
  const key = crypto.scryptSync(value, salt, KEY_LENGTH, SCRYPT_OPTIONS).toString("base64url");
  return `${FORMAT}$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt}$${key}`;
}

function isHashedPasscode(value) {
  return String(value || "").startsWith(`${FORMAT}$`);
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyHashedPasscode(passcode, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 6 || parts[0] !== FORMAT) return false;
  const [, n, r, p, salt, expected] = parts;
  const options = {
    N: Number(n),
    r: Number(r),
    p: Number(p)
  };
  if (
    options.N !== SCRYPT_OPTIONS.N
    || options.r !== SCRYPT_OPTIONS.r
    || options.p !== SCRYPT_OPTIONS.p
  ) {
    return false;
  }
  const actual = crypto.scryptSync(String(passcode || ""), salt, KEY_LENGTH, options).toString("base64url");
  return safeEqual(actual, expected);
}

function verifyPasscode(passcode, stored) {
  if (isHashedPasscode(stored)) {
    return verifyHashedPasscode(passcode, stored);
  }
  return safeEqual(passcode, stored);
}

module.exports = {
  hashPasscode,
  isHashedPasscode,
  verifyPasscode
};
