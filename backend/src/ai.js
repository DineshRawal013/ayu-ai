// AI insight via the self-hosted Ollama container.
// The model only explains numbers the backend already calculated.

const { PLANET_NAME } = require("./kundali");

const OLLAMA_URL = process.env.OLLAMA_URL || "http://ollama:11434";
const MODEL = process.env.OLLAMA_MODEL || "qwen2.5:1.5b";

function buildPrompt(r) {
  const { age, health, lifespan, kundali } = r;
  const m = health.metrics;
  const lines = [];

  lines.push(`AGE: ${age.years} years, ${age.months} months, ${age.days} days.`);
  lines.push(`HEALTH: sex ${r.inputSex}; BMI ${m.bmi} (${m.bmiCat.label}); BMR ${m.bmr} kcal; TDEE ${m.tdee} kcal; activity ${m.activityLabel}; water ${m.water} L/day; healthy weight range ${m.weightRange[0]}-${m.weightRange[1]} kg${m.whtr != null ? `; waist-to-height ${m.whtr}` : ""}.`);
  lines.push(`HABITS: sleep ${r.inputHabits.sleep} h; smoking ${r.inputHabits.smoking}; alcohol ${r.inputHabits.alcohol} drinks/week.`);
  if (health.alerts.length) {
    lines.push("ALERTS: " + health.alerts.slice(0, 6).map((a) => `[${a.level}] ${a.title}`).join("; ") + ".");
  }
  lines.push(`FUN LIFESPAN ESTIMATE: baseline ${lifespan.baseline} y (${lifespan.country.name}), adjustment ${lifespan.totalAdjustment} y, estimate ${lifespan.estimatedAge} y, about ${lifespan.remainingYears} years remaining. Biggest factors: ${lifespan.adjustments.filter((a) => a.years !== 0).map((a) => `${a.factor} ${a.years > 0 ? "+" : ""}${a.years}`).join(", ") || "none"}.`);

  if (kundali) {
    const cur = kundali.current;
    const upcoming = kundali.challengingPeriods
      .filter((p) => new Date(p.end) > new Date())
      .slice(0, 3)
      .map((p) => `${p.kind} (age ${p.ageFrom}-${p.ageTo}, ${p.level})`);
    lines.push(`KUNDALI (traditional Vedic, cultural only): Lagna ${kundali.lagna.rashi}; Moon sign ${kundali.moonSign.rashi}; birth nakshatra ${kundali.dasha.birthNakshatra.name}; current dasha ${cur ? `${PLANET_NAME[cur.maha]}-${PLANET_NAME[cur.antar]}` : "unknown"}; upcoming traditionally challenging periods: ${upcoming.join("; ") || "none soon"}.`);
  }

  return `You are Ayu, a warm and encouraging wellness assistant. Write a short personal insight for the user using ONLY the data below. Do not invent numbers.

${lines.join("\n")}

Write in English, under 260 words, using exactly these markdown headings:
## Your snapshot
(2-3 sentences combining age and health.)
## What to focus on
(3 short bullet points with practical, encouraging tips based on the alerts.)
## Your fun lifespan note
(2 sentences. Light-hearted. Say clearly it is just for fun and that habits can change it.)
${kundali ? `## Kundali reflection
(2-3 sentences. Say it is traditional belief, not science. Mention the current dasha and frame any challenging period gently as a time to take extra care. Never predict death, illness or a lifespan from astrology.)` : ""}

Rules: never diagnose diseases, never scare the user, suggest seeing a doctor only for "high" alerts.`;
}

// Streams generated text; calls onChunk(text) for each piece. Returns full text.
async function streamInsight(prompt, onChunk, signal) {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: true,
      options: { temperature: 0.6, num_predict: 700 }
    }),
    signal
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);

  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.error) throw new Error(msg.error);
      if (msg.response) {
        full += msg.response;
        onChunk(msg.response);
      }
    }
  }
  return full;
}

async function status() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    const hasModel = (data.models || []).some((m) => m.name === MODEL || m.name.startsWith(MODEL));
    return { reachable: true, model: MODEL, modelReady: hasModel };
  } catch {
    return { reachable: false, model: MODEL, modelReady: false };
  }
}

module.exports = { buildPrompt, streamInsight, status, MODEL };
