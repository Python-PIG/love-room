const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const appSource = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8").replace(/\r\n/g, "\n");

function extractBetween(startMarker, endMarker) {
  const start = appSource.indexOf(startMarker);
  assert.notEqual(start, -1, `missing marker: ${startMarker}`);
  const bodyStart = start + startMarker.length;
  const end = appSource.indexOf(endMarker, bodyStart);
  assert.notEqual(end, -1, `missing marker: ${endMarker}`);
  return appSource.slice(bodyStart, end);
}

function extractFunction(name, nextMarker) {
  const start = appSource.indexOf(`function ${name}()`);
  assert.notEqual(start, -1, `missing function: ${name}`);
  const end = appSource.indexOf(nextMarker, start);
  assert.notEqual(end, -1, `missing next marker: ${nextMarker}`);
  return appSource.slice(start, end);
}

test("question random pool contains 80 unique built-in prompts", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(
    `questionSeedGroups = ${extractBetween("const questionSeedGroups = ", ";\n\n  function escapeHtml")};`,
    context
  );

  const questions = context.questionSeedGroups.flat();
  assert.equal(questions.length, 80);
  assert.equal(new Set(questions).size, 80);
});

test("generated questions skip historical prompt text", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(
    `questionSeedGroups = ${extractBetween("const questionSeedGroups = ", ";\n\n  function escapeHtml")};`,
    context
  );

  const historicalTexts = context.questionSeedGroups.slice(0, 10).flat();
  assert.equal(historicalTexts.length, 50);

  const testContext = {
    state: {
      questions: [],
      questionTexts: historicalTexts
    },
    questionSeedGroups: context.questionSeedGroups,
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
    result: null
  };
  vm.createContext(testContext);
  vm.runInContext(
    `${extractFunction("pickGeneratedQuestions", "\n\n  async function loadDaily")}\nresult = pickGeneratedQuestions();`,
    testContext
  );

  assert.equal(testContext.result.length, 5);
  assert.equal(new Set(testContext.result).size, 5);
  assert.equal(testContext.result.filter((question) => historicalTexts.includes(question)).length, 0);
});
