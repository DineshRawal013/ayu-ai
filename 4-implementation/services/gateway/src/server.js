// gateway: the only service the frontend talks to. It exposes the public
// /api/* routes, owns the results database, share links, AI caching and the
// "already generating" locks, and calls health-svc, kundali-svc and ai-svc.

const express = require("express");
const { searchPlaces } = require("./geo");
const svc = require("./services");
const db = require("./db");

const app = express();
const port = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(express.json({ limit: "50kb" }));

const UUID_RE = /^[0-9a-f-]{36}$/i;
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const { httpError } = svc;

// ---------- status ----------

async function aiStatus() {
  try {
    return await svc.call("ai", "/status", { timeoutMs: 5000 });
  } catch {
    return { reachable: false, model: null, modelReady: false };
  }
}

app.get("/api/status", wrap(async (req, res) => {
  const [database, ai, health, kundali, aiSvc] = await Promise.all([
    db.ping(), aiStatus(), svc.healthy("health"), svc.healthy("kundali"), svc.healthy("ai")
  ]);
  res.json({ ok: true, database, ai, services: { health, kundali, ai: aiSvc } });
}));

// ---------- simple pass-through routes ----------

app.get("/api/countries", wrap(async (req, res) => {
  res.json(await svc.call("health", "/countries"));
}));

app.post("/api/age", wrap(async (req, res) => {
  res.json(await svc.call("health", "/age", { method: "POST", body: req.body || {} }));
}));

app.get("/api/kundali/transits", wrap(async (req, res) => {
  const qs = new URLSearchParams();
  if (req.query.from) qs.set("from", String(req.query.from));
  if (req.query.to) qs.set("to", String(req.query.to));
  const r = await svc.request("kundali", `/transits?${qs}`, { timeoutMs: 30000 });
  const cc = r.headers.get("cache-control");
  if (cc) res.set("Cache-Control", cc);
  res.status(r.status).json(await r.json());
}));

app.get("/api/kundali/now", wrap(async (req, res) => {
  res.json(await svc.call("kundali", "/now"));
}));

// ---------- place search ----------

app.get("/api/geo/search", wrap(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 3) return res.json([]);
  if (q.length > 120) return res.status(400).json({ error: "Query too long" });
  try {
    res.json(await searchPlaces(q));
  } catch (e) {
    res.status(502).json({ error: "Place search is unavailable right now. Try again in a moment." });
  }
}));

// ---------- main analysis ----------

// Combines health-svc (age, health, lifespan) and, when a place is given,
// kundali-svc (birth chart) into one result.
async function runAnalysis(input) {
  const { dob, birthTime, place, health } = input;
  const base = await svc.call("health", "/analyze", { method: "POST", body: { dob, health } });

  let kundali = null;
  if (place && place.lat != null && place.lon != null) {
    kundali = await svc.call("kundali", "/chart", {
      method: "POST",
      body: { date: dob, time: birthTime || null, lat: place.lat, lon: place.lon, placeName: place.name }
    });
  }

  const { age, health: healthResult, lifespan, inputSex, inputHabits } = base;
  return { age, health: healthResult, lifespan, kundali, inputSex, inputHabits };
}

app.post("/api/analyze", wrap(async (req, res) => {
  const input = req.body || {};
  const result = await runAnalysis(input);
  let id = null;
  try {
    id = await db.saveResult(
      { dob: input.dob, birthTime: input.birthTime || null, place: input.place || null, health: input.health },
      result
    );
  } catch (e) {
    console.error("Save failed:", e.message);
  }
  res.json({ id, ...result });
}));

app.get("/api/results/:id", wrap(async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const row = await db.getResult(req.params.id);
  if (!row) return res.status(404).json({ error: "Result not found" });
  res.json({ id: row.id, createdAt: row.created_at, input: row.input, insight: row.insight, aiGuess: row.ai_guess, ...row.result });
}));

// ---------- AI insight (streamed plain text, via ai-svc) ----------

const generating = new Map(); // id -> true while a generation is running

app.post("/api/results/:id/insight", wrap(async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: "Invalid id" });
  const row = await db.getResult(id);
  if (!row) return res.status(404).json({ error: "Result not found" });

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");

  if (row.insight) return res.end(row.insight);
  if (generating.get(id)) return res.status(409).end("Insight is already being generated. Refresh in a few seconds.");

  const st = await aiStatus();
  if (!st.reachable) return res.status(503).end("The AI service is offline right now. Your results are still saved.");
  if (!st.modelReady) return res.status(503).end("The AI model is still downloading. Please try again in a few minutes.");

  generating.set(id, true);
  const controller = new AbortController();
  res.on("close", () => { if (!res.writableEnded) controller.abort(); });
  try {
    const upstream = await svc.request("ai", "/insight", {
      method: "POST", body: { result: row.result }, signal: controller.signal, timeoutMs: 300000
    });
    if (!upstream.ok) throw new Error(`ai-svc returned ${upstream.status}`);
    const decoder = new TextDecoder();
    let text = "";
    for await (const chunk of upstream.body) {
      const s = decoder.decode(chunk, { stream: true });
      text += s;
      res.write(s);
    }
    await db.saveInsight(id, text.trim());
    res.end();
  } catch (e) {
    console.error("Insight failed:", e.message);
    if (!res.headersSent) res.status(500);
    res.end("\n\n_The AI insight could not be completed. Please try again._");
  } finally {
    generating.delete(id);
  }
}));

// ---------- AI lifespan guess (separate from the calculated estimate) ----------

const guessing = new Set(); // ids with a guess in progress

app.post("/api/results/:id/guess", wrap(async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: "Invalid id" });
  const row = await db.getResult(id);
  if (!row) return res.status(404).json({ error: "Result not found" });

  if (row.ai_guess) return res.json(row.ai_guess);
  if (guessing.has(id)) return res.status(409).json({ error: "The AI is already guessing. Refresh in a few seconds." });

  const st = await aiStatus();
  if (!st.reachable) return res.status(503).json({ error: "The AI service is offline right now." });
  if (!st.modelReady) return res.status(503).json({ error: "The AI model is still downloading. Please try again in a few minutes." });

  guessing.add(id);
  const controller = new AbortController();
  res.on("close", () => { if (!res.writableEnded) controller.abort(); });
  try {
    const guess = await svc.call("ai", "/guess", {
      method: "POST", body: { input: row.input, result: row.result }, signal: controller.signal, timeoutMs: 300000
    });
    await db.saveGuess(id, guess);
    res.json(guess);
  } finally {
    guessing.delete(id);
  }
}));

// ---------- errors ----------

app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500 && status !== 502 && status !== 503) console.error(err);
  const passOn = status < 500 || status === 502 || status === 503;
  res.status(status).json({ error: passOn ? err.message : "Something went wrong." });
});

if (require.main === module) {
  db.init();
  app.listen(port, () => console.log(`Ayu AI gateway running on port ${port}`));
}

module.exports = { app, runAnalysis };
