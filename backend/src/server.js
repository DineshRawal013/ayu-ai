const express = require("express");
const { calculateAgeDetailed } = require("./age");
const { calculateHealth, validateHealth } = require("./health");
const { estimateLifespan, COUNTRIES } = require("./lifespan");
const { buildKundali, transitSeries, positionsNow } = require("./kundali");
const { searchPlaces } = require("./geo");
const ai = require("./ai");
const db = require("./db");

const app = express();
const port = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(express.json({ limit: "50kb" }));

const UUID_RE = /^[0-9a-f-]{36}$/i;
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- status ----------

app.get("/api/status", wrap(async (req, res) => {
  res.json({ ok: true, database: await db.ping(), ai: await ai.status() });
}));

app.get("/api/countries", (req, res) => {
  res.json(Object.entries(COUNTRIES).map(([code, c]) => ({ code, name: c.name })));
});

// ---------- age (original endpoint, kept for compatibility) ----------

app.post("/api/age", (req, res) => {
  const { dateOfBirth } = req.body || {};
  if (!dateOfBirth) return res.status(400).json({ error: "dateOfBirth is required" });
  try {
    res.json(calculateAgeDetailed(dateOfBirth));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

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

function runAnalysis(input) {
  const { dob, birthTime, place, health } = input;
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) throw httpError(400, "Date of birth is required (YYYY-MM-DD).");

  const age = calculateAgeDetailed(dob);
  if (age.years < 15) throw httpError(400, "Ayu AI's health formulas are for ages 15 and over.");
  if (age.years > 120) throw httpError(400, "Please check the date of birth.");

  const errors = validateHealth(health || {});
  if (errors.length) throw httpError(400, errors.join(" "));

  const h = health;
  const healthResult = calculateHealth(h, age.years);
  const lifespan = estimateLifespan(h, healthResult.metrics, age.decimalYears, dob);

  let kundali = null;
  if (place && place.lat != null && place.lon != null) {
    if (birthTime && !/^\d{2}:\d{2}$/.test(birthTime)) throw httpError(400, "Birth time must be HH:MM.");
    kundali = buildKundali({ date: dob, time: birthTime || "12:00", lat: place.lat, lon: place.lon, placeName: place.name });
    kundali.timeUnknown = !birthTime;
  }

  return {
    age,
    health: healthResult,
    lifespan,
    kundali,
    inputSex: h.sex,
    inputHabits: { sleep: Number(h.sleep), smoking: h.smoking, alcohol: Number(h.alcohol) }
  };
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

app.post("/api/analyze", wrap(async (req, res) => {
  const input = req.body || {};
  const result = runAnalysis(input);
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

// ---------- AI insight (streamed plain text) ----------

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

  const st = await ai.status();
  if (!st.reachable) return res.status(503).end("The AI service is offline right now. Your results are still saved.");
  if (!st.modelReady) return res.status(503).end("The AI model is still downloading. Please try again in a few minutes.");

  generating.set(id, true);
  const controller = new AbortController();
  res.on("close", () => { if (!res.writableEnded) controller.abort(); });
  try {
    const text = await ai.streamInsight(ai.buildPrompt(row.result), (chunk) => res.write(chunk), controller.signal);
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

  const st = await ai.status();
  if (!st.reachable) return res.status(503).json({ error: "The AI service is offline right now." });
  if (!st.modelReady) return res.status(503).json({ error: "The AI model is still downloading. Please try again in a few minutes." });

  guessing.add(id);
  const controller = new AbortController();
  res.on("close", () => { if (!res.writableEnded) controller.abort(); });
  try {
    const ageYears = row.result.age.decimalYears;
    const guess = await ai.guessLifespan(ai.buildGuessPrompt(row.input, row.result), ageYears, controller.signal);
    if (!guess) return res.status(502).json({ error: "The AI couldn't make a sensible guess this time." });
    await db.saveGuess(id, guess);
    res.json(guess);
  } finally {
    guessing.delete(id);
  }
}));

// ---------- planet timeline ----------

app.get("/api/kundali/transits", wrap(async (req, res) => {
  const from = String(req.query.from || "");
  const to = req.query.to ? String(req.query.to) : undefined;
  if (!from) return res.status(400).json({ error: "from is required" });
  if ((new Date(to || Date.now()) - new Date(from)) / (365.25 * 86400000) > 125) {
    return res.status(400).json({ error: "Range too long" });
  }
  try {
    res.set("Cache-Control", "public, max-age=3600");
    res.json(transitSeries(from, to));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}));

app.get("/api/kundali/now", (req, res) => {
  res.json(positionsNow());
});

// ---------- errors ----------

app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? "Something went wrong." : err.message });
});

if (require.main === module) {
  db.init();
  app.listen(port, () => console.log(`Ayu AI backend running on port ${port}`));
}

module.exports = { app, runAnalysis };
