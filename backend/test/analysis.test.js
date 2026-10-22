const test = require("node:test");
const assert = require("node:assert");
const { runAnalysis } = require("../src/server");
const { calculateAgeDetailed } = require("../src/age");
const { transitSeries } = require("../src/kundali");
const { buildGuessPrompt, parseGuess } = require("../src/ai");

const health = {
  sex: "male", height: 172, weight: 78, activity: "1.375", waist: 88,
  sleep: 6, smoking: "never", alcohol: 4, country: "NP"
};

test("age is calculated from date of birth", () => {
  const a = calculateAgeDetailed("2000-01-15", new Date("2026-10-17T00:00:00"));
  assert.strictEqual(a.years, 26);
  assert.strictEqual(a.months, 9);
});

test("health metrics match the original HealthCheck formulas", () => {
  const r = runAnalysis({ dob: "2002-05-13", health });
  assert.strictEqual(r.health.metrics.bmi, 26.4);
  assert.strictEqual(r.health.metrics.bmiCat.key, "over");
  assert.ok(r.health.projection.length === 3);
  assert.strictEqual(r.kundali, null);
});

test("lifespan estimate stays above current age", () => {
  const r = runAnalysis({ dob: "1930-01-01", health: { ...health, smoking: "current", alcohol: 30 } });
  assert.ok(r.lifespan.estimatedAge > r.age.years);
});

test("kundali: known sidereal positions (Pokhara, 2002-05-13 10:00)", () => {
  const r = runAnalysis({
    dob: "2002-05-13", birthTime: "10:00", health,
    place: { lat: 28.2096, lon: 83.9856, name: "Pokhara" }
  });
  const k = r.kundali;
  assert.strictEqual(k.input.timezone, "Asia/Kathmandu");
  const sun = k.planets.find((p) => p.key === "Su");
  assert.ok(sun.sign === 0 && Math.abs(sun.degree - 28.35) < 0.1, "Sun ~28.35° Aries");
  assert.strictEqual(k.dasha.birthNakshatra.name, "Krittika");
  assert.strictEqual(k.dasha.mahadashas[0].lord, "Su");
});

test("invalid input is rejected", () => {
  assert.throws(() => runAnalysis({ dob: "2002-05-13", health: { ...health, height: 20 } }));
  assert.throws(() => runAnalysis({ dob: "2020-01-01", health }));
});

test("AI guess prompt gets raw answers only, not the calculated lifespan or kundali", () => {
  const input = {
    dob: "2002-05-13", birthTime: "10:00", health,
    place: { lat: 28.2096, lon: 83.9856, name: "Pokhara" }
  };
  const r = runAnalysis(input);
  const prompt = buildGuessPrompt(input, r);
  assert.ok(prompt.includes("Smoking: never"));
  assert.ok(!prompt.includes(String(r.lifespan.estimatedAge)));
  assert.ok(!prompt.includes(String(r.health.metrics.bmi)));
  assert.ok(!/kundali|nakshatra|dasha|lagna/i.test(prompt));
});

test("AI guess is validated", () => {
  const g = parseGuess('{"estimatedAge": 79.46, "reason": "Healthy habits."}', 24.4);
  assert.strictEqual(g.estimatedAge, 79.5);
  assert.strictEqual(g.remainingYears, 55.1);
  assert.strictEqual(g.reason, "Healthy habits.");
  assert.strictEqual(parseGuess("not json", 24), null);
  assert.strictEqual(parseGuess('{"estimatedAge": 20}', 24), null);
  assert.strictEqual(parseGuess('{"estimatedAge": 300}', 24), null);
  assert.strictEqual(parseGuess('{"estimatedAge": "eighty"}', 24), null);
});

test("transit series is compact", () => {
  const t = transitSeries("2000-01-01T00:00:00Z", "2026-01-01T00:00:00Z");
  assert.ok(t.frames <= 6001);
  assert.strictEqual(t.series.Su.length, t.frames);
});
