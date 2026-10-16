// Health metrics, risk alerts and a 12-week weight projection.
// Formulas come from the original HealthCheck project, plus new inputs
// (sleep, smoking, alcohol).

const round = (v, d = 1) => Number(v.toFixed(d));

const ACTIVITY = {
  "1.2": "Sedentary",
  "1.375": "Light",
  "1.55": "Moderate",
  "1.725": "Very active",
  "1.9": "Extra active"
};

function bmiCategory(bmi) {
  if (bmi < 18.5) return { key: "under", label: "Below the reference range", tone: "warning" };
  if (bmi < 25) return { key: "normal", label: "Within the reference range", tone: "good" };
  if (bmi < 30) return { key: "over", label: "Above the reference range", tone: "warning" };
  return { key: "obese", label: "Well above the reference range", tone: "attention" };
}

function calcBMR(age, sex, weight, height) {
  // Mifflin-St Jeor
  const base = 10 * weight + 6.25 * height - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

function validateHealth(h) {
  const errors = [];
  const num = (k) => Number(h[k]);
  if (!["male", "female"].includes(h.sex)) errors.push("Sex is required.");
  if (!(num("height") >= 100 && num("height") <= 250)) errors.push("Height must be 100–250 cm.");
  if (!(num("weight") >= 25 && num("weight") <= 300)) errors.push("Weight must be 25–300 kg.");
  if (!ACTIVITY[String(h.activity)]) errors.push("Activity level is required.");
  if (h.waist && !(num("waist") >= 30 && num("waist") <= 250)) errors.push("Waist must be 30–250 cm.");
  if (!(num("sleep") >= 2 && num("sleep") <= 16)) errors.push("Sleep must be 2–16 hours.");
  if (!["never", "former", "current"].includes(h.smoking)) errors.push("Smoking status is required.");
  if (!(num("alcohol") >= 0 && num("alcohol") <= 100)) errors.push("Alcohol must be 0–100 drinks/week.");
  return errors;
}

function projectWeight({ age, sex, height, weight, activity }) {
  // Simple energy-balance model: 7700 kcal ≈ 1 kg, TDEE recalculated each week
  // as weight changes. Intake is fixed at (starting TDEE + offset).
  const startTdee = calcBMR(age, sex, weight, height) * activity;
  const scenarios = [
    { key: "maintain", label: "Current intake", offset: 0 },
    { key: "deficit", label: "−500 kcal/day", offset: -500 },
    { key: "surplus", label: "+300 kcal/day", offset: 300 }
  ];
  const hm2 = (height / 100) ** 2;
  return scenarios.map((s) => {
    const intake = startTdee + s.offset;
    let w = weight;
    const points = [{ week: 0, weight: round(w), bmi: round(w / hm2) }];
    for (let wk = 1; wk <= 12; wk++) {
      const tdee = calcBMR(age, sex, w, height) * activity;
      w += ((intake - tdee) * 7) / 7700;
      points.push({ week: wk, weight: round(w), bmi: round(w / hm2) });
    }
    return { ...s, intake: Math.round(intake), points };
  });
}

function buildAlerts(m, h, projection) {
  const alerts = [];
  const add = (level, title, detail) => alerts.push({ level, title, detail });

  if (m.bmiCat.key === "under") add("warning", "BMI below reference range", "A BMI under 18.5 can be linked to low energy reserves. Consider talking to a professional about nutrition.");
  if (m.bmiCat.key === "over") add("warning", "BMI above reference range", "A BMI of 25–29.9 is a common screening flag. Activity and diet habits can help shift it.");
  if (m.bmiCat.key === "obese") add("high", "BMI well above reference range", "A BMI of 30+ is associated with higher cardiometabolic risk. A check-up with a doctor is a good idea.");

  if (m.whtr != null) {
    if (m.whtr >= 0.6) add("high", "High waist-to-height ratio", `Ratio ${m.whtr} is above 0.6, a commonly used threshold for increased risk.`);
    else if (m.whtr >= 0.5) add("warning", "Waist-to-height ratio ≥ 0.5", `Ratio ${m.whtr}. Keeping waist under half your height is a common guideline.`);
  }

  const sleep = Number(h.sleep);
  if (sleep < 6) add("high", "Short sleep", `${sleep} h/night is well below the 7–9 h most adults need.`);
  else if (sleep < 7) add("warning", "Slightly short sleep", `${sleep} h/night is a little under the 7–9 h guideline.`);
  else if (sleep > 9.5) add("info", "Long sleep", `${sleep} h/night is above the usual range. Persistent long sleep can be worth mentioning to a doctor.`);

  if (h.smoking === "current") add("high", "Smoking", "Smoking is the single largest modifiable factor in this estimate. Quitting at any age adds years.");
  if (h.smoking === "former") add("info", "Former smoker", "Great step. Risk keeps falling the longer you stay smoke-free.");

  const alc = Number(h.alcohol);
  if (alc > 14) add(alc > 24 ? "high" : "warning", "Alcohol above low-risk level", `${alc} drinks/week is above the ~14/week low-risk guideline.`);

  if (Number(h.activity) <= 1.2) add("warning", "Low activity", "Adults are generally advised to get ~150 min of moderate activity per week.");

  // Projection-based predictions
  const hm2 = (Number(h.height) / 100) ** 2;
  for (const sc of projection) {
    const end = sc.points[sc.points.length - 1];
    if (sc.key === "surplus" && m.bmi < 25 && end.bmi >= 25) add("warning", "Prediction: weight gain", `At ${sc.label}, BMI may reach ${end.bmi} in 12 weeks (above 25).`);
    if (sc.key === "surplus" && m.bmi < 30 && end.bmi >= 30) add("high", "Prediction: weight gain", `At ${sc.label}, BMI may reach ${end.bmi} in 12 weeks (above 30).`);
    if (sc.key === "deficit" && m.bmi >= 18.5 && end.bmi < 18.5) add("warning", "Prediction: underweight risk", `A −500 kcal/day deficit could take BMI to ${end.bmi} in 12 weeks. Not recommended for you.`);
    if (sc.key === "deficit" && sc.intake < m.bmr) add("info", "Deficit below BMR", `A −500 kcal/day intake (${sc.intake} kcal) is below your BMR (${Math.round(m.bmr)}). Go gentler if you diet.`);
  }
  if (m.bmi >= 25) {
    const target = 24.9 * hm2;
    const def = projection.find((p) => p.key === "deficit");
    const perWeek = (Number(h.weight) - def.points[12].weight) / 12;
    if (perWeek > 0) {
      const weeks = Math.ceil((Number(h.weight) - target) / perWeek);
      add("info", "Prediction: reaching the reference range", `With a −500 kcal/day deficit, you could reach BMI 24.9 (~${round(target)} kg) in roughly ${weeks} weeks.`);
    }
  }

  const order = { high: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}

function calculateHealth(h, age) {
  const sex = h.sex;
  const height = Number(h.height);
  const weight = Number(h.weight);
  const activity = Number(h.activity);
  const waist = h.waist ? Number(h.waist) : null;

  const bmi = weight / (height / 100) ** 2;
  const bmiCat = bmiCategory(bmi);
  const bmr = calcBMR(age, sex, weight, height);
  const tdee = bmr * activity;
  const whtr = waist ? round(waist / height, 2) : null;

  const metrics = {
    bmi: round(bmi),
    bmiCat,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    water: round(weight * 0.033),
    weightRange: [round(18.5 * (height / 100) ** 2), round(24.9 * (height / 100) ** 2)],
    whtr,
    activityLabel: ACTIVITY[String(h.activity)]
  };

  const projection = projectWeight({ age, sex, height, weight, activity });
  const alerts = buildAlerts({ ...metrics, bmr }, h, projection);

  // 0-100 "habit scores" for the radar chart
  const scores = {
    BMI: bmiCat.key === "normal" ? 100 : Math.max(10, 100 - Math.abs(bmi - 22) * 8),
    Activity: Math.round(((activity - 1.2) / 0.7) * 80 + 20),
    Sleep: Math.max(10, 100 - Math.abs(Number(h.sleep) - 8) * 20),
    "Smoke-free": h.smoking === "never" ? 100 : h.smoking === "former" ? 70 : 15,
    Alcohol: Math.max(10, 100 - Math.max(0, Number(h.alcohol) - 7) * 4),
    Waist: whtr == null ? null : Math.max(10, Math.min(100, 100 - (whtr - 0.45) * 300))
  };
  for (const k of Object.keys(scores)) if (scores[k] != null) scores[k] = Math.round(Math.min(100, scores[k]));

  return { metrics, projection, alerts, scores };
}

module.exports = { calculateHealth, validateHealth, calcBMR };
