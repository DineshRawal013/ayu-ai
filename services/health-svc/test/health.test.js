const test = require("node:test");
const assert = require("node:assert");
const { app, analyze } = require("../src/server");
const { calculateAgeDetailed } = require("../src/age");

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
  const r = analyze({ dob: "2002-05-13", health });
  assert.strictEqual(r.health.metrics.bmi, 26.4);
  assert.strictEqual(r.health.metrics.bmiCat.key, "over");
  assert.ok(r.health.projection.length === 3);
  assert.strictEqual(r.kundali, undefined, "health-svc never computes a kundali");
});

test("lifespan estimate stays above current age", () => {
  const r = analyze({ dob: "1930-01-01", health: { ...health, smoking: "current", alcohol: 30 } });
  assert.ok(r.lifespan.estimatedAge > r.age.years);
});

test("invalid input is rejected", () => {
  assert.throws(() => analyze({ dob: "2002-05-13", health: { ...health, height: 20 } }));
  assert.throws(() => analyze({ dob: "2020-01-01", health }), /15 and over/);
});

test("HTTP: /analyze returns results and 400 with a message for bad input", async (t) => {
  const srv = app.listen(0);
  t.after(() => srv.close());
  const base = `http://127.0.0.1:${srv.address().port}`;
  const post = (body) => fetch(`${base}/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  const ok = await post({ dob: "2002-05-13", health });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual((await ok.json()).health.metrics.bmi, 26.4);

  const bad = await post({ dob: "2002-05-13", health: { ...health, sleep: 1 } });
  assert.strictEqual(bad.status, 400);
  assert.deepStrictEqual(await bad.json(), { error: "Sleep must be 2–16 hours." });

  const countries = await (await fetch(`${base}/countries`)).json();
  assert.strictEqual(countries.length, 12);
});
