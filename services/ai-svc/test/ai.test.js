const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");

// A saved reading (input + calculated result incl. kundali), produced by the
// calculation code for Pokhara, 2002-05-13 10:00.
const { input, result } = require("./fixtures/reading.json");

// ---------- fake Ollama ----------
let guessReplies = [];
let generateCalls = 0;
const fakeOllama = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (req.url === "/api/tags") {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ models: [{ name: "qwen2.5:1.5b" }] }));
    }
    if (req.url === "/api/generate") {
      generateCalls++;
      const b = JSON.parse(body);
      if (b.stream) {
        res.setHeader("Content-Type", "application/x-ndjson");
        for (const w of ["## Your snapshot\n", "Hello ", "there."]) res.write(JSON.stringify({ response: w }) + "\n");
        return res.end(JSON.stringify({ done: true }) + "\n");
      }
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ response: guessReplies.shift() }));
    }
    res.statusCode = 404;
    res.end();
  });
});

let base, srv;
test.before(async () => {
  await new Promise((r) => fakeOllama.listen(0, r));
  process.env.OLLAMA_URL = `http://127.0.0.1:${fakeOllama.address().port}`;
  const { app } = require("../src/server"); // reads OLLAMA_URL on load
  srv = app.listen(0);
  await new Promise((r) => srv.once("listening", r));
  base = `http://127.0.0.1:${srv.address().port}`;
});
test.after(() => { srv.close(); fakeOllama.close(); });

const post = (path, body) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("AI guess prompt gets raw answers only, not the calculated lifespan or kundali", () => {
  const { buildGuessPrompt } = require("../src/ai");
  const prompt = buildGuessPrompt(input, result);
  assert.ok(prompt.includes("Smoking: never"));
  assert.ok(!prompt.includes(String(result.lifespan.estimatedAge)));
  assert.ok(!prompt.includes(String(result.health.metrics.bmi)));
  assert.ok(!/kundali|nakshatra|dasha|lagna/i.test(prompt));
});

test("AI guess is validated", () => {
  const { parseGuess } = require("../src/ai");
  const g = parseGuess('{"estimatedAge": 79.46, "reason": "Healthy habits."}', 24.4);
  assert.strictEqual(g.estimatedAge, 79.5);
  assert.strictEqual(g.remainingYears, 55.1);
  assert.strictEqual(g.reason, "Healthy habits.");
  assert.strictEqual(parseGuess("not json", 24), null);
  assert.strictEqual(parseGuess('{"estimatedAge": 20}', 24), null);
  assert.strictEqual(parseGuess('{"estimatedAge": 300}', 24), null);
  assert.strictEqual(parseGuess('{"estimatedAge": "eighty"}', 24), null);
});

test("insight prompt explains the kundali with the planet names", () => {
  const { buildPrompt } = require("../src/ai");
  const p = buildPrompt(result);
  assert.ok(p.includes("## Kundali reflection"));
  assert.ok(/current dasha (Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu)-/.test(p));
});

test("HTTP: /status reports the model as ready", async () => {
  const st = await (await fetch(base + "/status")).json();
  assert.deepStrictEqual(st, { reachable: true, model: "qwen2.5:1.5b", modelReady: true });
});

test("HTTP: /insight streams the model's text", async () => {
  const res = await post("/insight", { result });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(await res.text(), "## Your snapshot\nHello there.");
});

test("HTTP: /guess retries once on an invalid answer", async () => {
  guessReplies = ["not json", '{"estimatedAge": 80, "reason": "Balanced habits."}'];
  generateCalls = 0;
  const res = await post("/guess", { input, result });
  assert.strictEqual(res.status, 200);
  const g = await res.json();
  assert.strictEqual(g.estimatedAge, 80);
  assert.strictEqual(generateCalls, 2);
});

test("HTTP: /guess returns 502 after two invalid answers", async () => {
  guessReplies = ["nope", '{"estimatedAge": 5}'];
  const res = await post("/guess", { input, result });
  assert.strictEqual(res.status, 502);
});

test("HTTP: missing body is rejected", async () => {
  assert.strictEqual((await post("/insight", {})).status, 400);
  assert.strictEqual((await post("/guess", {})).status, 400);
});
