// Vedic kundali using Swiss Ephemeris (Moshier mode, no data files needed)
// with Lahiri ayanamsa and whole-sign houses.
//
// Everything here is presented to users as cultural / traditional content.
// It never produces a lifespan or death prediction.

const sweph = require("sweph");
const { DateTime } = require("luxon");
const tzlookup = require("@photostructure/tz-lookup");

const C = sweph.constants;
sweph.set_sid_mode(C.SE_SIDM_LAHIRI, 0, 0);
const FLAGS = C.SEFLG_MOSEPH | C.SEFLG_SIDEREAL | C.SEFLG_SPEED;

const PLANETS = [
  { key: "Su", name: "Sun", id: C.SE_SUN },
  { key: "Mo", name: "Moon", id: C.SE_MOON },
  { key: "Ma", name: "Mars", id: C.SE_MARS },
  { key: "Me", name: "Mercury", id: C.SE_MERCURY },
  { key: "Ju", name: "Jupiter", id: C.SE_JUPITER },
  { key: "Ve", name: "Venus", id: C.SE_VENUS },
  { key: "Sa", name: "Saturn", id: C.SE_SATURN },
  { key: "Ra", name: "Rahu", id: C.SE_MEAN_NODE },
  { key: "Ke", name: "Ketu", id: null } // Rahu + 180°
];

const RASHIS = [
  "Mesha (Aries)", "Vrishabha (Taurus)", "Mithuna (Gemini)", "Karka (Cancer)",
  "Simha (Leo)", "Kanya (Virgo)", "Tula (Libra)", "Vrishchika (Scorpio)",
  "Dhanu (Sagittarius)", "Makara (Capricorn)", "Kumbha (Aquarius)", "Meena (Pisces)"
];
const SIGN_LORD = ["Ma", "Ve", "Me", "Mo", "Su", "Me", "Ve", "Ma", "Ju", "Sa", "Sa", "Ju"];

const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu",
  "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta",
  "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha",
  "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada",
  "Uttara Bhadrapada", "Revati"
];
const DASHA_ORDER = ["Ke", "Ve", "Su", "Mo", "Ma", "Ra", "Ju", "Sa", "Me"];
const DASHA_YEARS = { Ke: 7, Ve: 20, Su: 6, Mo: 10, Ma: 7, Ra: 18, Ju: 16, Sa: 19, Me: 17 };
const PLANET_NAME = Object.fromEntries(PLANETS.map((p) => [p.key, p.name]));
const MALEFICS = new Set(["Sa", "Ra", "Ke", "Ma"]);

const YEAR_MS = 365.25 * 86400000;
const norm = (d) => ((d % 360) + 360) % 360;

// ---------- time helpers ----------

function resolveBirthMoment({ date, time, lat, lon }) {
  const zone = tzlookup(Number(lat), Number(lon));
  const dt = DateTime.fromISO(`${date}T${time || "12:00"}`, { zone });
  if (!dt.isValid) throw new Error("Invalid birth date/time.");
  return { zone, local: dt, utc: dt.toUTC() };
}

function jdFromJsDate(d) {
  const r = sweph.utc_to_jd(
    d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds() + d.getUTCMilliseconds() / 1000,
    C.SE_GREG_CAL
  );
  if (r.flag < 0) throw new Error(r.error);
  return r.data[1]; // UT
}

// ---------- positions ----------

function positionsAt(jd) {
  const out = {};
  let rahu = null;
  for (const p of PLANETS) {
    if (p.key === "Ke") continue;
    const r = sweph.calc_ut(jd, p.id, FLAGS);
    out[p.key] = { lon: norm(r.data[0]), speed: r.data[3] };
    if (p.key === "Ra") rahu = out[p.key];
  }
  out.Ke = { lon: norm(rahu.lon + 180), speed: rahu.speed };
  return out;
}

function nakshatraOf(lon) {
  const size = 360 / 27;
  const idx = Math.floor(lon / size);
  const pada = Math.floor((lon % size) / (size / 4)) + 1;
  return { index: idx, name: NAKSHATRAS[idx], pada, lord: DASHA_ORDER[idx % 9], fraction: (lon % size) / size };
}

// ---------- Vimshottari dasha ----------

function vimshottari(moonLon, birth) {
  const nk = nakshatraOf(moonLon);
  const startIdx = DASHA_ORDER.indexOf(nk.lord);
  const elapsedYears = nk.fraction * DASHA_YEARS[nk.lord];
  // First dasha started before birth by the elapsed portion
  let cursor = birth.getTime() - elapsedYears * YEAR_MS;
  const mahas = [];
  for (let i = 0; i < 10; i++) {
    const lord = DASHA_ORDER[(startIdx + i) % 9];
    const len = DASHA_YEARS[lord];
    const start = cursor;
    const end = start + len * YEAR_MS;
    const antars = [];
    let ac = start;
    for (let j = 0; j < 9; j++) {
      const al = DASHA_ORDER[(DASHA_ORDER.indexOf(lord) + j) % 9];
      const alen = (len * DASHA_YEARS[al]) / 120;
      antars.push({ lord: al, start: new Date(ac).toISOString(), end: new Date(ac + alen * YEAR_MS).toISOString() });
      ac += alen * YEAR_MS;
    }
    mahas.push({ lord, years: len, start: new Date(start).toISOString(), end: new Date(end).toISOString(), antars });
    cursor = end;
    if (end - birth.getTime() > 105 * YEAR_MS) break;
  }
  return { birthNakshatra: nk, mahadashas: mahas };
}

// ---------- traditional "challenging periods" ----------

function saturnPeriods(birth, moonSign, years = 100) {
  // Sample Saturn every 3 days; find Sade Sati (12th/1st/2nd from Moon)
  // and Ashtama Shani (8th from Moon).
  const step = 3 * 86400000;
  const end = birth.getTime() + years * YEAR_MS;
  const raw = [];
  let cur = null;
  for (let t = birth.getTime(); t <= end; t += step) {
    const sat = sweph.calc_ut(jdFromJsDate(new Date(t)), C.SE_SATURN, FLAGS).data[0];
    const rel = (Math.floor(norm(sat) / 30) - moonSign + 12) % 12;
    const type = rel === 11 || rel === 0 || rel === 1 ? "sade-sati" : rel === 7 ? "ashtama" : null;
    if (type !== (cur && cur.type)) {
      if (cur) { cur.end = t; raw.push(cur); }
      cur = type ? { type, start: t } : null;
    }
  }
  if (cur) { cur.end = end; raw.push(cur); }

  // Merge segments separated by short retrograde gaps (< 300 days)
  const merged = [];
  for (const s of raw) {
    const last = merged[merged.length - 1];
    if (last && last.type === s.type && s.start - last.end < 300 * 86400000) last.end = s.end;
    else merged.push({ ...s });
  }
  return merged.filter((s) => s.end - s.start > 60 * 86400000);
}

function challengingPeriods(natal, lagnaSign, dasha, birth) {
  const moonSign = Math.floor(natal.Mo.lon / 30);
  const houseOf = (key) => ((Math.floor(natal[key].lon / 30) - lagnaSign + 12) % 12) + 1;
  const lordOfHouse = (h) => SIGN_LORD[(lagnaSign + h - 1) % 12];
  const eighthLord = lordOfHouse(8);
  const dusthanaLords = new Set([lordOfHouse(6), lordOfHouse(8), lordOfHouse(12)]);
  const ageAt = (iso) => Number(((new Date(iso) - birth) / YEAR_MS).toFixed(1));
  const periods = [];

  for (const s of saturnPeriods(birth, moonSign)) {
    const start = new Date(s.start).toISOString();
    const end = new Date(s.end).toISOString();
    periods.push(s.type === "sade-sati"
      ? { kind: "Sade Sati", level: "notable", start, end, ageFrom: ageAt(start), ageTo: ageAt(end),
          reason: "Saturn transits the 12th, 1st and 2nd signs from your Moon sign — traditionally a slow, testing phase.",
          guidance: "Traditionally a time for patience, steady routines, good sleep and regular health check-ups." }
      : { kind: "Ashtama Shani", level: "mild", start, end, ageFrom: ageAt(start), ageTo: ageAt(end),
          reason: "Saturn transits the 8th sign from your Moon sign.",
          guidance: "Traditionally advised to avoid overwork and take care with stress and rest." });
  }

  for (const m of dasha.mahadashas) {
    for (const a of m.antars) {
      const bothMalefic = MALEFICS.has(m.lord) && MALEFICS.has(a.lord) && m.lord !== a.lord;
      const eighth = a.lord === eighthLord || houseOf(a.lord) === 8;
      const dusthana = dusthanaLords.has(a.lord) && dusthanaLords.has(m.lord);
      if (!(bothMalefic || eighth || dusthana)) continue;
      if (new Date(a.end) < birth) continue;
      const reasons = [];
      if (bothMalefic) reasons.push(`both ${PLANET_NAME[m.lord]} and ${PLANET_NAME[a.lord]} are natural malefics`);
      if (eighth) reasons.push(`${PLANET_NAME[a.lord]} is linked to your 8th house`);
      if (dusthana && !eighth) reasons.push(`both lords rule difficult houses (6/8/12)`);
      periods.push({
        kind: `${PLANET_NAME[m.lord]}–${PLANET_NAME[a.lord]} dasha`,
        level: bothMalefic && (eighth || dusthana) ? "notable" : "mild",
        start: a.start, end: a.end, ageFrom: Math.max(0, ageAt(a.start)), ageTo: ageAt(a.end),
        reason: `Traditionally considered challenging because ${reasons.join(" and ")}.`,
        guidance: "A good period to be a little more careful with health, rest and big decisions."
      });
    }
  }
  return periods
    .filter((p) => p.ageFrom < 100)
    .sort((a, b) => new Date(a.start) - new Date(b.start));
}

// ---------- public API ----------

function buildKundali({ date, time, lat, lon, placeName }) {
  const moment = resolveBirthMoment({ date, time, lat, lon });
  const birth = moment.utc.toJSDate();
  const jd = jdFromJsDate(birth);

  const houses = sweph.houses_ex2(jd, C.SEFLG_SIDEREAL, Number(lat), Number(lon), "W");
  const ascLon = norm(houses.data.points[0]);
  const lagnaSign = Math.floor(ascLon / 30);

  const pos = positionsAt(jd);
  const planets = PLANETS.map((p) => {
    const lon = pos[p.key].lon;
    const sign = Math.floor(lon / 30);
    return {
      key: p.key,
      name: p.name,
      lon: Number(lon.toFixed(4)),
      sign,
      rashi: RASHIS[sign],
      degree: Number((lon % 30).toFixed(2)),
      house: ((sign - lagnaSign + 12) % 12) + 1,
      retrograde: p.key === "Ra" || p.key === "Ke" ? true : pos[p.key].speed < 0,
      nakshatra: nakshatraOf(lon)
    };
  });

  const dasha = vimshottari(pos.Mo.lon, birth);
  const now = new Date();
  const currentMaha = dasha.mahadashas.find((m) => new Date(m.start) <= now && new Date(m.end) > now);
  const currentAntar = currentMaha && currentMaha.antars.find((a) => new Date(a.start) <= now && new Date(a.end) > now);

  return {
    input: { date, time, lat: Number(lat), lon: Number(lon), placeName, timezone: moment.zone,
             utc: moment.utc.toISO(), localOffset: moment.local.toFormat("ZZ") },
    ayanamsa: Number(sweph.get_ayanamsa_ut(jd).toFixed(4)),
    lagna: { lon: Number(ascLon.toFixed(4)), sign: lagnaSign, rashi: RASHIS[lagnaSign],
             degree: Number((ascLon % 30).toFixed(2)), nakshatra: nakshatraOf(ascLon) },
    moonSign: { sign: Math.floor(pos.Mo.lon / 30), rashi: RASHIS[Math.floor(pos.Mo.lon / 30)] },
    sunSign: { sign: Math.floor(pos.Su.lon / 30), rashi: RASHIS[Math.floor(pos.Su.lon / 30)] },
    planets,
    dasha,
    current: currentMaha ? { maha: currentMaha.lord, antar: currentAntar && currentAntar.lord,
                             mahaEnd: currentMaha.end, antarEnd: currentAntar && currentAntar.end } : null,
    challengingPeriods: challengingPeriods(pos, lagnaSign, dasha, birth),
    rashis: RASHIS,
    note: "Traditional Vedic astrology content for cultural interest. It has no proven predictive power over health or lifespan."
  };
}

// Compact planet longitudes from `fromISO` to `toISO` for the animated wheel.
function transitSeries(fromISO, toISO, maxFrames = 6000) {
  const from = new Date(fromISO);
  const to = toISO ? new Date(toISO) : new Date();
  if (Number.isNaN(from.getTime()) || to <= from) throw new Error("Invalid range.");
  const spanDays = (to - from) / 86400000;
  const stepDays = Math.max(1, Math.ceil(spanDays / maxFrames));
  const keys = PLANETS.map((p) => p.key);
  const series = Object.fromEntries(keys.map((k) => [k, []]));
  const frames = Math.floor(spanDays / stepDays) + 1;
  for (let i = 0; i < frames; i++) {
    const pos = positionsAt(jdFromJsDate(new Date(from.getTime() + i * stepDays * 86400000)));
    for (const k of keys) series[k].push(Math.round(pos[k].lon * 100) / 100);
  }
  return { start: from.toISOString(), stepDays, frames, series };
}

function positionsNow() {
  const now = new Date();
  const pos = positionsAt(jdFromJsDate(now));
  return {
    time: now.toISOString(),
    planets: PLANETS.map((p) => ({
      key: p.key, name: p.name, lon: Number(pos[p.key].lon.toFixed(4)),
      speed: Number(pos[p.key].speed.toFixed(5)), rashi: RASHIS[Math.floor(pos[p.key].lon / 30)]
    }))
  };
}

module.exports = { buildKundali, transitSeries, positionsNow, PLANET_NAME };
