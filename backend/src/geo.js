// Birth-place search via OpenStreetMap Nominatim (proxied through the backend
// so we can set a proper User-Agent, cache results and respect the 1 req/s
// usage policy).

const tzlookup = require("@photostructure/tz-lookup");

const NOMINATIM = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const UA = process.env.NOMINATIM_USER_AGENT || "AyuAI/1.0 (https://github.com/DineshRawal013/ayu-ai)";

const cache = new Map();
let lastCall = 0;

async function searchPlaces(q) {
  const key = q.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);

  // Simple throttle: at most one upstream request per second
  const wait = Math.max(0, lastCall + 1000 - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  const url = `${NOMINATIM}/search?format=jsonv2&limit=6&addressdetails=0&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en" },
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const data = await res.json();

  const results = data.map((p) => {
    const lat = Number(p.lat);
    const lon = Number(p.lon);
    let timezone = null;
    try { timezone = tzlookup(lat, lon); } catch { /* ocean etc. */ }
    return { name: p.display_name, lat, lon, timezone };
  });

  if (cache.size > 500) cache.delete(cache.keys().next().value);
  cache.set(key, results);
  return results;
}

module.exports = { searchPlaces };
