// kundali-svc: Vedic birth chart, dasha, challenging periods and planet
// transits (Swiss Ephemeris). Internal service: only the gateway calls it.

const express = require("express");
const { buildKundali, transitSeries, positionsNow } = require("./kundali");

const app = express();
const port = Number(process.env.PORT) || 3002;

app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// Builds the chart. A missing birth time falls back to noon and sets timeUnknown.
function chart({ date, time, lat, lon, placeName } = {}) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw httpError(400, "Date of birth is required (YYYY-MM-DD).");
  if (lat == null || lon == null) throw httpError(400, "Birth place coordinates are required.");
  if (time && !/^\d{2}:\d{2}$/.test(time)) throw httpError(400, "Birth time must be HH:MM.");
  const k = buildKundali({ date, time: time || "12:00", lat, lon, placeName });
  k.timeUnknown = !time;
  return k;
}

app.get("/healthz", (req, res) => res.json({ ok: true, service: "kundali-svc" }));

app.post("/chart", (req, res) => {
  res.json(chart(req.body));
});

app.get("/transits", (req, res) => {
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
});

app.get("/now", (req, res) => {
  res.json(positionsNow());
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? "Something went wrong." : err.message });
});

if (require.main === module) {
  app.listen(port, () => console.log(`kundali-svc running on port ${port}`));
}

module.exports = { app, chart };
