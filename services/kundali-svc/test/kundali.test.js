const test = require("node:test");
const assert = require("node:assert");
const { app, chart } = require("../src/server");
const { transitSeries } = require("../src/kundali");

const pokhara = { date: "2002-05-13", time: "10:00", lat: 28.2096, lon: 83.9856, placeName: "Pokhara" };

test("kundali: known sidereal positions (Pokhara, 2002-05-13 10:00)", () => {
  const k = chart(pokhara);
  assert.strictEqual(k.input.timezone, "Asia/Kathmandu");
  const sun = k.planets.find((p) => p.key === "Su");
  assert.ok(sun.sign === 0 && Math.abs(sun.degree - 28.35) < 0.1, "Sun ~28.35° Aries");
  assert.strictEqual(k.dasha.birthNakshatra.name, "Krittika");
  assert.strictEqual(k.dasha.mahadashas[0].lord, "Su");
  assert.strictEqual(k.timeUnknown, false);
});

test("missing birth time uses noon and flags timeUnknown", () => {
  const k = chart({ ...pokhara, time: null });
  assert.strictEqual(k.input.time, "12:00");
  assert.strictEqual(k.timeUnknown, true);
});

test("invalid birth time is rejected", () => {
  assert.throws(() => chart({ ...pokhara, time: "10am" }), /HH:MM/);
});

test("transit series is compact", () => {
  const t = transitSeries("2000-01-01T00:00:00Z", "2026-01-01T00:00:00Z");
  assert.ok(t.frames <= 6001);
  assert.strictEqual(t.series.Su.length, t.frames);
});

test("HTTP: /transits validates its range and /now lists nine planets", async (t) => {
  const srv = app.listen(0);
  t.after(() => srv.close());
  const base = `http://127.0.0.1:${srv.address().port}`;
  assert.strictEqual((await fetch(`${base}/transits`)).status, 400);
  assert.strictEqual((await fetch(`${base}/transits?from=1800-01-01`)).status, 400);
  const now = await (await fetch(`${base}/now`)).json();
  assert.strictEqual(now.planets.length, 9);
});
