// health-svc: age, health metrics and the "just for fun" lifespan estimate.
// Internal service: only the gateway calls it (services-net, no public port).

const express = require("express");
const { calculateAgeDetailed } = require("./age");
const { calculateHealth, validateHealth } = require("./health");
const { estimateLifespan, COUNTRIES } = require("./lifespan");

const app = express();
const port = Number(process.env.PORT) || 3001;

app.disable("x-powered-by");
app.use(express.json({ limit: "50kb" }));

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// Validates the answers and computes age, health and lifespan.
function analyze({ dob, health } = {}) {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) throw httpError(400, "Date of birth is required (YYYY-MM-DD).");

  const age = calculateAgeDetailed(dob);
  if (age.years < 15) throw httpError(400, "Ayu AI's health formulas are for ages 15 and over.");
  if (age.years > 120) throw httpError(400, "Please check the date of birth.");

  const errors = validateHealth(health || {});
  if (errors.length) throw httpError(400, errors.join(" "));

  const h = health;
  const healthResult = calculateHealth(h, age.years);
  const lifespan = estimateLifespan(h, healthResult.metrics, age.decimalYears, dob);

  return {
    age,
    health: healthResult,
    lifespan,
    inputSex: h.sex,
    inputHabits: { sleep: Number(h.sleep), smoking: h.smoking, alcohol: Number(h.alcohol) }
  };
}

app.get("/healthz", (req, res) => res.json({ ok: true, service: "health-svc" }));

app.post("/analyze", (req, res) => {
  res.json(analyze(req.body));
});

app.post("/age", (req, res) => {
  const { dateOfBirth } = req.body || {};
  if (!dateOfBirth) return res.status(400).json({ error: "dateOfBirth is required" });
  try {
    res.json(calculateAgeDetailed(dateOfBirth));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/countries", (req, res) => {
  res.json(Object.entries(COUNTRIES).map(([code, c]) => ({ code, name: c.name })));
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? "Something went wrong." : err.message });
});

if (require.main === module) {
  app.listen(port, () => console.log(`health-svc running on port ${port}`));
}

module.exports = { app, analyze };
