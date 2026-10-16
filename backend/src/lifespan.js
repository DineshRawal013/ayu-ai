// "Just for fun" remaining-lifespan estimate.
// Baseline: life expectancy at birth by country & sex (UN Population Division
// estimates via Worldometer, 2026 page). Adjustments are rough, rounded effect
// sizes from large population studies (smoking ≈ −10 y, BMI bands, activity,
// alcohol >14/wk, sleep). This is NOT a medical prediction.

const COUNTRIES = {
  WORLD: { name: "World average", male: 71.2, female: 76.4 },
  KR: { name: "South Korea", male: 81.56, female: 87.51 },
  NP: { name: "Nepal", male: 69.56, female: 72.7 },
  IN: { name: "India", male: 71.16, female: 74.39 },
  LK: { name: "Sri Lanka", male: 74.85, female: 81.04 },
  BD: { name: "Bangladesh", male: 73.82, female: 77.22 },
  JP: { name: "Japan", male: 82.13, female: 88.18 },
  CN: { name: "China", male: 76.38, female: 81.78 },
  US: { name: "United States", male: 77.39, female: 82.23 },
  GB: { name: "United Kingdom", male: 79.89, female: 83.57 },
  DE: { name: "Germany", male: 79.62, female: 84.11 },
  AU: { name: "Australia", male: 82.59, female: 86.07 }
};

function adjustments(h, metrics) {
  const list = [];
  const add = (factor, years, note) => list.push({ factor, years, note });
  const bmi = metrics.bmi;

  if (bmi < 18.5) add("BMI", -3, "Below 18.5");
  else if (bmi < 25) add("BMI", 0, "Reference range");
  else if (bmi < 30) add("BMI", -1, "25–29.9");
  else if (bmi < 35) add("BMI", -3, "30–34.9");
  else if (bmi < 40) add("BMI", -5, "35–39.9");
  else add("BMI", -8, "40+");

  const act = Number(h.activity);
  if (act <= 1.2) add("Activity", -2, "Sedentary");
  else if (act <= 1.375) add("Activity", 0, "Light");
  else if (act <= 1.55) add("Activity", 1.5, "Moderate");
  else add("Activity", 3, "Very active");

  if (h.smoking === "current") add("Smoking", -10, "Current smoker");
  else if (h.smoking === "former") add("Smoking", -2, "Former smoker");
  else add("Smoking", 0, "Never smoked");

  const alc = Number(h.alcohol);
  if (alc <= 7) add("Alcohol", 0, `${alc}/week`);
  else if (alc <= 14) add("Alcohol", -0.5, `${alc}/week`);
  else if (alc <= 24) add("Alcohol", -2, `${alc}/week`);
  else add("Alcohol", -4, `${alc}/week`);

  const sleep = Number(h.sleep);
  if (sleep < 6) add("Sleep", -1.5, `${sleep} h`);
  else if (sleep < 7) add("Sleep", -0.5, `${sleep} h`);
  else if (sleep <= 9) add("Sleep", 0, `${sleep} h`);
  else add("Sleep", -1, `${sleep} h`);

  if (metrics.whtr != null) {
    if (metrics.whtr >= 0.6) add("Waist", -2, `Ratio ${metrics.whtr}`);
    else if (metrics.whtr >= 0.5) add("Waist", -1, `Ratio ${metrics.whtr}`);
    else add("Waist", 0.5, `Ratio ${metrics.whtr}`);
  }
  return list;
}

function estimateLifespan(h, metrics, ageYears, dobISO) {
  const country = COUNTRIES[h.country] || COUNTRIES.WORLD;
  const baseline = country[h.sex];
  const adj = adjustments(h, metrics);
  // Life expectancy at birth includes deaths in childhood/youth. Someone who has
  // already reached their current age can expect a bit more; approximate that
  // with a bonus that is larger where baseline life expectancy is lower.
  const survivorBonus = Math.min(ageYears, baseline) * Math.max(0, 90 - baseline) / 130;
  if (survivorBonus >= 0.1) adj.unshift({ factor: "Reached current age", years: Number(survivorBonus.toFixed(1)), note: `Survived to ${Math.floor(ageYears)}` });
  const total = adj.reduce((s, a) => s + a.years, 0);
  let estimated = baseline + total;

  // People who have already passed the average have a higher conditional
  // expectancy, so never show less than a sensible minimum remaining.
  const minRemaining = Math.max(2, (105 - ageYears) * 0.18);
  if (estimated - ageYears < minRemaining) estimated = ageYears + minRemaining;

  const remaining = estimated - ageYears;
  const dob = new Date(dobISO);
  const estDate = new Date(dob.getTime() + estimated * 365.2425 * 86400000);

  return {
    country: { code: h.country in COUNTRIES ? h.country : "WORLD", name: country.name },
    baseline: Number(baseline.toFixed(1)),
    adjustments: adj,
    totalAdjustment: Number(total.toFixed(1)),
    estimatedAge: Number(estimated.toFixed(1)),
    remainingYears: Number(remaining.toFixed(1)),
    remainingDays: Math.round(remaining * 365.2425),
    lifeUsedPercent: Number(((ageYears / estimated) * 100).toFixed(1)),
    estimatedYear: estDate.getFullYear(),
    disclaimer: "Just for fun — a rough population-average estimate, not a medical prediction."
  };
}

module.exports = { estimateLifespan, COUNTRIES };
