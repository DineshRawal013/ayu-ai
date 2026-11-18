const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");

// ---------- stub services ----------
const calls = [];
function stub(handler) {
  return http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      calls.push({ path: req.url, body: body ? JSON.parse(body) : null });
      res.setHeader("Content-Type", "application/json");
      handler(req, res, body ? JSON.parse(body) : null);
    });
  });
}

const healthStub = stub((req, res, b) => {
  if (req.url === "/healthz") return res.end('{"ok":true}');
  if (req.url === "/countries") return res.end('[{"code":"WORLD","name":"World average"}]');
  if (req.url === "/analyze") {
    if (b.health && b.health.height === 20) { res.statusCode = 400; return res.end('{"error":"Height must be 100–250 cm."}'); }
    return res.end(JSON.stringify({ age: { years: 24, decimalYears: 24.5 }, health: { metrics: { bmi: 26.4 } },
      lifespan: { estimatedAge: 71 }, inputSex: "male", inputHabits: { sleep: 6, smoking: "never", alcohol: 4 } }));
  }
  res.statusCode = 404; res.end("{}");
});

const kundaliStub = stub((req, res, b) => {
  if (req.url === "/healthz") return res.end('{"ok":true}');
  if (req.url === "/chart") return res.end(JSON.stringify({ lagna: { rashi: "Karka (Cancer)" }, timeUnknown: !b.time }));
  if (req.url.startsWith("/transits")) {
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.end('{"frames":4}');
  }
  res.statusCode = 404; res.end("{}");
});

let base, kundaliPort, srv;
test.before(async () => {
  for (const s of [healthStub, kundaliStub]) await new Promise((r) => s.listen(0, r));
  kundaliPort = kundaliStub.address().port;
  process.env.HEALTH_URL = `http://127.0.0.1:${healthStub.address().port}`;
  process.env.KUNDALI_URL = `http://127.0.0.1:${kundaliPort}`;
  process.env.AI_URL = "http://127.0.0.1:1"; // nothing listens: ai-svc "down"
  process.env.DATABASE_URL = "postgres://ayu@127.0.0.1:1/ayu"; // no database
  const { app } = require("../src/server");
  srv = app.listen(0);
  await new Promise((r) => srv.once("listening", r));
  base = `http://127.0.0.1:${srv.address().port}`;
});
test.after(() => { srv.close(); healthStub.close(); kundaliStub.close(); });

const post = (path, body) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const healthIn = { sex: "male", height: 172, weight: 78, activity: "1.375", sleep: 6, smoking: "never", alcohol: 4 };

test("analyze without a place calls only health-svc; id is null without a database", async () => {
  calls.length = 0;
  const res = await post("/api/analyze", { dob: "2002-05-13", health: healthIn });
  assert.strictEqual(res.status, 200);
  const r = await res.json();
  assert.strictEqual(r.id, null);
  assert.strictEqual(r.kundali, null);
  assert.strictEqual(r.health.metrics.bmi, 26.4);
  assert.deepStrictEqual(calls.map((c) => c.path), ["/analyze"]);
});

test("analyze with a place also calls kundali-svc, passing a missing time as null", async () => {
  calls.length = 0;
  const r = await (await post("/api/analyze", { dob: "2002-05-13", place: { lat: 28.2, lon: 83.9, name: "Pokhara" }, health: healthIn })).json();
  assert.strictEqual(r.kundali.timeUnknown, true);
  const chart = calls.find((c) => c.path === "/chart");
  assert.deepStrictEqual(chart.body, { date: "2002-05-13", time: null, lat: 28.2, lon: 83.9, placeName: "Pokhara" });
});

test("a validation error from health-svc reaches the browser unchanged", async () => {
  const res = await post("/api/analyze", { dob: "2002-05-13", health: { ...healthIn, height: 20 } });
  assert.strictEqual(res.status, 400);
  assert.deepStrictEqual(await res.json(), { error: "Height must be 100–250 cm." });
});

test("status reports each service, the database and the AI (ai-svc down here)", async () => {
  const st = await (await fetch(base + "/api/status")).json();
  assert.strictEqual(st.ok, true);
  assert.deepStrictEqual(st.services, { health: true, kundali: true, ai: false });
  assert.strictEqual(st.ai.reachable, false);
  assert.strictEqual(st.database, false);
});

test("transits pass through status and cache header from kundali-svc", async () => {
  const res = await fetch(base + "/api/kundali/transits?from=2026-01-01");
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get("cache-control"), "public, max-age=3600");
});

test("result ids are validated; unknown ids give 404", async () => {
  assert.strictEqual((await fetch(base + "/api/results/abc")).status, 400);
  assert.strictEqual((await fetch(base + "/api/results/00000000-0000-4000-8000-000000000000")).status, 404);
  assert.strictEqual((await post("/api/results/abc/guess", {})).status, 400);
});

test("countries come from health-svc; unknown API paths give 404", async () => {
  const c = await (await fetch(base + "/api/countries")).json();
  assert.strictEqual(c[0].code, "WORLD");
  assert.strictEqual((await fetch(base + "/api/nope")).status, 404);
});

test("health-svc down: analyze returns 503", async () => {
  healthStub.close();
  healthStub.closeAllConnections();
  const res = await post("/api/analyze", { dob: "2002-05-13", health: healthIn });
  assert.strictEqual(res.status, 503);
  assert.match((await res.json()).error, /health service is unavailable/);
});
