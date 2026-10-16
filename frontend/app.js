/* Ayu AI main page: form, place search, results, charts, AI insight stream. */
(function () {
  "use strict";

  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => Number(n).toLocaleString();

  const form = el("mainForm");
  const errorBox = el("formError");
  const submitBtn = el("submitBtn");
  let selectedPlace = null;
  let currentId = null;
  let liveTimer = null;
  let charts = [];

  // ---------------- countries ----------------
  async function loadCountries() {
    const sel = el("country");
    try {
      const list = await (await fetch("/api/countries")).json();
      sel.innerHTML = list.map((c) => `<option value="${c.code}">${esc(c.name)}</option>`).join("");
    } catch {
      sel.innerHTML = `<option value="WORLD">World average</option>`;
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const guess = { "Asia/Seoul": "KR", "Asia/Kathmandu": "NP", "Asia/Katmandu": "NP", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Colombo": "LK", "Asia/Dhaka": "BD", "Asia/Tokyo": "JP", "Asia/Shanghai": "CN", "Europe/London": "GB", "Europe/Berlin": "DE" }[tz]
      || (tz.startsWith("America/") ? "US" : tz.startsWith("Australia/") ? "AU" : "WORLD");
    if ([...sel.options].some((o) => o.value === guess)) sel.value = guess;
  }

  // ---------------- place search ----------------
  const placeInput = el("placeInput");
  const placeList = el("placeList");
  let searchTimer = null;
  let activeIdx = -1;
  let lastResults = [];

  function closeList() { placeList.hidden = true; placeInput.setAttribute("aria-expanded", "false"); activeIdx = -1; }

  function showResults(items) {
    lastResults = items;
    activeIdx = -1;
    placeList.innerHTML = items.length
      ? items.map((p, i) => `<li role="option" id="place-${i}" data-i="${i}">${esc(p.name)}</li>`).join("")
      : `<li class="empty">No places found. Try adding the country, e.g. "Pokhara, Nepal".</li>`;
    placeList.hidden = false;
    placeInput.setAttribute("aria-expanded", "true");
  }

  function choosePlace(p) {
    selectedPlace = p;
    placeInput.value = p.name;
    el("placeMeta").textContent = `${p.lat.toFixed(4)}°, ${p.lon.toFixed(4)}°${p.timezone ? `, time zone ${p.timezone}` : ""}`;
    closeList();
  }

  placeInput.addEventListener("input", () => {
    selectedPlace = null;
    el("placeMeta").textContent = "";
    clearTimeout(searchTimer);
    const q = placeInput.value.trim();
    if (q.length < 3) { closeList(); return; }
    searchTimer = setTimeout(async () => {
      el("placeMeta").textContent = "Searching…";
      try {
        const res = await fetch(`/api/geo/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (placeInput.value.trim() !== q) return;
        el("placeMeta").textContent = "";
        showResults(data);
      } catch (e) {
        el("placeMeta").textContent = e.message || "Place search is unavailable right now.";
      }
    }, 550);
  });

  placeInput.addEventListener("keydown", (e) => {
    if (placeList.hidden || !lastResults.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      activeIdx = (activeIdx + (e.key === "ArrowDown" ? 1 : -1) + lastResults.length) % lastResults.length;
      [...placeList.children].forEach((li, i) => li.setAttribute("aria-selected", i === activeIdx));
      placeInput.setAttribute("aria-activedescendant", `place-${activeIdx}`);
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      choosePlace(lastResults[activeIdx]);
    } else if (e.key === "Escape") closeList();
  });
  placeList.addEventListener("mousedown", (e) => {
    const li = e.target.closest("li[data-i]");
    if (li) { e.preventDefault(); choosePlace(lastResults[Number(li.dataset.i)]); }
  });
  placeInput.addEventListener("blur", () => setTimeout(closeList, 150));

  // ---------------- submit ----------------
  function collect() {
    return {
      dob: el("dob").value,
      birthTime: el("birthTime").value || null,
      place: selectedPlace ? { lat: selectedPlace.lat, lon: selectedPlace.lon, name: selectedPlace.name } : null,
      health: {
        sex: el("sex").value,
        country: el("country").value,
        height: el("height").value,
        weight: el("weight").value,
        waist: el("waist").value || null,
        activity: el("activity").value,
        sleep: el("sleep").value,
        alcohol: el("alcohol").value === "" ? "" : el("alcohol").value,
        smoking: (form.querySelector('input[name="smoking"]:checked') || {}).value
      }
    };
  }

  function checkClient(d) {
    if (!d.dob) return "Enter your date of birth.";
    if (!d.health.sex) return "Choose your sex. The calorie formulas differ for male and female.";
    if (!d.health.height || !d.health.weight) return "Enter your height and weight.";
    if (!d.health.activity) return "Choose your usual activity level.";
    if (!d.health.sleep) return "Enter your usual hours of sleep.";
    if (d.health.alcohol === "") return "Enter drinks per week (0 if none).";
    if (placeInput.value.trim() && !selectedPlace) return "Pick your birth place from the list, or clear the field.";
    return "";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = collect();
    const msg = checkClient(data);
    if (msg) { errorBox.textContent = msg; return; }
    errorBox.textContent = "";
    submitBtn.disabled = true;
    submitBtn.textContent = "Reading…";
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Something went wrong.");
      currentId = out.id;
      if (out.id) history.replaceState(null, "", `?r=${out.id}`);
      render(out, data);
      el("results").scrollIntoView({ behavior: "smooth", block: "start" });
      startInsight(out.id);
    } catch (err) {
      errorBox.textContent = err.message === "Failed to fetch" ? "Ayu's server can't be reached. Check that the backend container is running." : err.message;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Read my results";
    }
  });

  el("resetBtn").addEventListener("click", () => {
    form.reset();
    selectedPlace = null;
    el("placeMeta").textContent = "";
    el("results").hidden = true;
    clearInterval(liveTimer);
    window.AyuKundali && window.AyuKundali.stop();
    history.replaceState(null, "", "/");
    loadCountries();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  el("shareBtn").addEventListener("click", async () => {
    const url = `${location.origin}/?r=${currentId}`;
    try { await navigator.clipboard.writeText(url); el("shareBtn").textContent = "Link copied"; }
    catch { prompt("Copy this link:", url); }
    setTimeout(() => (el("shareBtn").textContent = "Copy share link"), 2500);
  });

  // ---------------- render ----------------
  function render(r, input) {
    el("results").hidden = false;
    el("shareBtn").hidden = !r.id;
    renderAge(r.age, input);
    renderLifespan(r.lifespan, r.age);
    renderHealth(r.health);
    renderKundali(r.kundali);
  }

  function renderAge(a, input) {
    el("ageYears").textContent = a.years;
    el("ageMonths").textContent = a.months;
    el("ageDays").textContent = a.days;
    el("totalDays").textContent = fmt(a.totalDays);
    el("totalHours").textContent = fmt(a.totalHours);
    el("totalMinutes").textContent = fmt(a.totalMinutes);
    el("nextBirthday").textContent = a.daysToBirthday === 365 || a.daysToBirthday === 366 ? "Today" : `in ${a.daysToBirthday} days`;
    const birth = new Date(`${a.dateOfBirth}T${(input && input.birthTime) || "00:00"}`);
    clearInterval(liveTimer);
    const tick = () => (el("liveSeconds").textContent = fmt(Math.max(0, Math.floor((Date.now() - birth) / 1000))));
    tick();
    liveTimer = setInterval(tick, 1000);
  }

  function renderLifespan(l, age) {
    el("remainingYears").textContent = l.remainingYears;
    const pct = Math.min(100, l.lifeUsedPercent);
    requestAnimationFrame(() => {
      el("lifelineFill").style.width = pct + "%";
      el("lifelineMark").style.left = pct + "%";
    });
    const now = el("lifelineNow");
    now.style.left = pct + "%";
    now.textContent = `You, ${age.years}`;
    el("lifelineEnd").textContent = `about ${Math.round(l.estimatedAge)} (${l.estimatedYear})`;
    el("lifeExplain").textContent = `Average life expectancy in ${l.country.name} for your sex: ${l.baseline} years. Your factors add up to ${l.totalAdjustment > 0 ? "+" : ""}${l.totalAdjustment} years, for an estimate of about ${l.estimatedAge}.`;
    el("lifeFactors").innerHTML = l.adjustments.map((f) => {
      const cls = f.years > 0 ? "plus" : f.years < 0 ? "minus" : "";
      return `<li class="${cls}">${esc(f.factor)}: <b>${f.years > 0 ? "+" : ""}${f.years} y</b> <span class="muted">${esc(f.note)}</span></li>`;
    }).join("");
  }

  function renderHealth(h) {
    const m = h.metrics;
    el("mBmi").textContent = m.bmi;
    el("mBmiCat").textContent = m.bmiCat.label;
    el("mBmi").parentElement.className = "metric " + (m.bmiCat.tone === "good" ? "good" : m.bmiCat.tone === "attention" ? "bad" : "warn");
    el("mBmr").textContent = fmt(m.bmr);
    el("mTdee").textContent = fmt(m.tdee);
    el("mWater").textContent = m.water;
    el("mRange").textContent = `${m.weightRange[0]}–${m.weightRange[1]}`;
    el("mWhtr").textContent = m.whtr ?? "—";
    const w = el("mWhtr").parentElement;
    if (m.whtr == null) { el("mWhtrNote").textContent = "add your waist to see this"; w.className = "metric"; }
    else { el("mWhtrNote").textContent = m.whtr < 0.5 ? "below 0.5, the usual guide" : "at or above 0.5"; w.className = "metric " + (m.whtr < 0.5 ? "good" : m.whtr < 0.6 ? "warn" : "bad"); }

    const levelName = { high: "Act on this", warning: "Watch", info: "Note" };
    el("alerts").innerHTML = h.alerts.length
      ? h.alerts.map((a) => `<li class="${a.level}"><span class="lvl">${levelName[a.level]}</span><div><b>${esc(a.title)}</b><span class="d">${esc(a.detail)}</span></div></li>`).join("")
      : `<li class="none"><div><b>Nothing flagged</b><span class="d">Your numbers sit inside the common reference ranges.</span></div></li>`;

    drawCharts(h);
  }

  function drawCharts(h) {
    charts.forEach((c) => c.destroy());
    charts = [];
    if (!window.Chart) return;
    Chart.defaults.font.family = '"Atkinson Hyperlegible", system-ui, sans-serif';
    Chart.defaults.color = "#5E6B68";

    const labels = Object.keys(h.scores).filter((k) => h.scores[k] != null);
    charts.push(new Chart(el("radarChart"), {
      type: "radar",
      data: { labels, datasets: [{ label: "Score", data: labels.map((k) => h.scores[k]), fill: true, backgroundColor: "rgba(46,107,88,.18)", borderColor: "#2E6B58", pointBackgroundColor: "#2E6B58", borderWidth: 2 }] },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { r: { min: 0, max: 100, ticks: { stepSize: 25, display: false }, grid: { color: "#D9E0DA" }, angleLines: { color: "#D9E0DA" }, pointLabels: { font: { size: 13 }, color: "#1A2624" } } }
      }
    }));

    const colors = { maintain: "#2E6B58", deficit: "#3D5A80", surplus: "#C28A1E" };
    const weeks = h.projection[0].points.map((p) => `W${p.week}`);
    const datasets = h.projection.map((s) => ({
      label: `${s.label} (${fmt(s.intake)} kcal)`,
      data: s.points.map((p) => p.weight),
      borderColor: colors[s.key], backgroundColor: colors[s.key],
      borderWidth: s.key === "maintain" ? 3 : 2, pointRadius: 0, tension: .25
    }));
    const [lo, hi] = h.metrics.weightRange;
    datasets.push(
      { label: "Reference range", data: weeks.map(() => hi), borderColor: "rgba(46,107,88,.0)", backgroundColor: "rgba(46,107,88,.08)", pointRadius: 0, fill: "+1", borderWidth: 0 },
      { label: "_lo", data: weeks.map(() => lo), borderColor: "rgba(46,107,88,.0)", pointRadius: 0, borderWidth: 0 }
    );
    const all = h.projection.flatMap((s) => s.points.map((p) => p.weight));
    charts.push(new Chart(el("projChart"), {
      type: "line",
      data: { labels: weeks, datasets },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 14, filter: (i) => !i.text.startsWith("_") } },
          tooltip: { filter: (i) => !i.dataset.label.startsWith("_") && i.dataset.label !== "Reference range", callbacks: { label: (c) => `${c.dataset.label.split(" (")[0]}: ${c.parsed.y} kg` } }
        },
        scales: {
          y: { title: { display: true, text: "kg" }, suggestedMin: Math.min(...all, lo) - 1, suggestedMax: Math.max(...all) + 1, grid: { color: "#E7ECE8" } },
          x: { grid: { display: false } }
        }
      }
    }));
  }

  function renderKundali(k) {
    const has = !!k;
    el("kundaliEmpty").hidden = has;
    el("kundaliContent").hidden = !has;
    if (has) window.AyuKundali.render(k);
    else window.AyuKundali.stop();
  }

  // ---------------- AI insight ----------------
  function mdToHtml(md) {
    const lines = esc(md).split("\n");
    let html = "", inList = false;
    for (let line of lines) {
      line = line.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
      const li = line.match(/^\s*[-*•]\s+(.*)/);
      if (li) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${li[1]}</li>`; continue; }
      if (inList) { html += "</ul>"; inList = false; }
      const hm = line.match(/^#{1,4}\s+(.*)/);
      if (hm) html += `<h3>${hm[1]}</h3>`;
      else if (line.trim()) html += `<p>${line}</p>`;
    }
    if (inList) html += "</ul>";
    return html;
  }

  async function startInsight(id, existing) {
    const body = el("insightBody");
    const status = el("aiStatus");
    el("retryInsight").hidden = true;
    if (existing) { body.innerHTML = mdToHtml(existing); status.textContent = "Saved"; return; }
    if (!id) {
      body.innerHTML = `<p class="placeholder">The AI read needs the database to be running, so it is unavailable right now.</p>`;
      status.textContent = "Unavailable";
      return;
    }
    body.innerHTML = `<p class="placeholder">Ayu is reading your numbers…</p>`;
    body.classList.add("writing");
    status.textContent = "Writing…";
    let text = "";
    try {
      const res = await fetch(`/api/results/${id}/insight`, { method: "POST" });
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let pending = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        if (!pending) { pending = true; requestAnimationFrame(() => { body.innerHTML = mdToHtml(text); pending = false; }); }
      }
      body.innerHTML = mdToHtml(text);
      if (!res.ok) {
        status.textContent = "Unavailable";
        body.innerHTML = `<p class="placeholder">${esc(text)}</p>`;
        el("retryInsight").hidden = false;
      } else status.textContent = "Done";
    } catch {
      status.textContent = "Unavailable";
      body.innerHTML = `<p class="placeholder">The AI read stopped before finishing. Your results above are complete.</p>`;
      el("retryInsight").hidden = false;
    } finally {
      body.classList.remove("writing");
    }
  }
  el("retryInsight").addEventListener("click", () => startInsight(currentId));

  // ---------------- shared link ----------------
  async function loadShared(id) {
    try {
      const res = await fetch(`/api/results/${encodeURIComponent(id)}`);
      const r = await res.json();
      if (!res.ok) throw new Error(r.error);
      currentId = r.id;
      render(r, r.input);
      startInsight(r.id, r.insight);
      el("results").scrollIntoView({ block: "start" });
    } catch (e) {
      errorBox.textContent = `That shared reading couldn't be opened: ${e.message}.`;
      history.replaceState(null, "", "/");
    }
  }

  // ---------------- boot ----------------
  const today = new Date().toISOString().slice(0, 10);
  el("dob").max = today;
  form.querySelectorAll("input, select").forEach((f) => f.addEventListener("input", () => { if (errorBox.textContent) errorBox.textContent = ""; }));
  loadCountries();
  const shared = new URLSearchParams(location.search).get("r");
  if (shared) loadShared(shared);
})();
