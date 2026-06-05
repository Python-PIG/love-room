const assert = require("node:assert/strict");
const test = require("node:test");

const {
  hashPasscode,
  isHashedPasscode,
  verifyPasscode
} = require("../src/passcodes");

test("hashPasscode stores passcodes without exposing plaintext", () => {
  const hash = hashPasscode("shared-secret");

  assert.equal(isHashedPasscode(hash), true);
  assert.notEqual(hash, "shared-secret");
  assert.equal(verifyPasscode("shared-secret", hash), true);
  assert.equal(verifyPasscode("wrong-secret", hash), false);
});

test("verifyPasscode accepts legacy plaintext values during migration", () => {
  assert.equal(verifyPasscode("legacy-secret", "legacy-secret"), true);
  assert.equal(verifyPasscode("wrong-secret", "legacy-secret"), false);
});

test("verifyPasscode rejects malformed or unsupported hashes", () => {
  const hash = hashPasscode("shared-secret");
  const unsupportedHash = hash.replace("scrypt$16384$8$1$", "scrypt$32768$8$1$");

  assert.equal(verifyPasscode("shared-secret", "scrypt$bad"), false);
  assert.equal(verifyPasscode("shared-secret", unsupportedHash), false);
});
