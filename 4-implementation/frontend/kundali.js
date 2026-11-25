/* Kundali rendering: North Indian chart, planet table, animated planet wheel,
   dasha timeline and traditionally challenging periods. */
(function () {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";
  const DAY = 86400000;
  const YEAR = 365.25 * DAY;
  const NAMES = { Su: "Sun", Mo: "Moon", Ma: "Mars", Me: "Mercury", Ju: "Jupiter", Ve: "Venus", Sa: "Saturn", Ra: "Rahu", Ke: "Ketu" };
  const ORDER = ["Su", "Mo", "Ma", "Me", "Ju", "Ve", "Sa", "Ra", "Ke"];
  const COLORS = { Su: "#F2C46B", Mo: "#E9E4D2", Ma: "#E07A5F", Me: "#8FD3B6", Ju: "#F4A259", Ve: "#F2B5D4", Sa: "#9DB4E8", Ra: "#B8A1E3", Ke: "#C9B79C" };
  const RASHI_SHORT = ["Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya", "Tula", "Vrishchika", "Dhanu", "Makara", "Kumbha", "Meena"];
  const SLOW = new Set(["Ju", "Sa", "Ra"]);

  const el = (id) => document.getElementById(id);
  const svgEl = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };
  const fmtDate = (d) => d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const fmtMonth = (d) => d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------------- North Indian chart ----------------
  const HOUSES = [
    [[200, 0], [300, 100], [200, 200], [100, 100]],
    [[0, 0], [200, 0], [100, 100]],
    [[0, 0], [100, 100], [0, 200]],
    [[0, 200], [100, 100], [200, 200], [100, 300]],
    [[0, 200], [100, 300], [0, 400]],
    [[0, 400], [100, 300], [200, 400]],
    [[200, 400], [100, 300], [200, 200], [300, 300]],
    [[200, 400], [300, 300], [400, 400]],
    [[400, 400], [300, 300], [400, 200]],
    [[400, 200], [300, 300], [200, 200], [300, 100]],
    [[400, 200], [300, 100], [400, 0]],
    [[400, 0], [300, 100], [200, 0]]
  ];

  function renderNorthChart(k) {
    const svg = el("northChart");
    svg.innerHTML = "";
    svgEl("rect", { x: 1, y: 1, width: 398, height: 398, fill: "#1C2747", stroke: "#4A5A8A", "stroke-width": 2, rx: 4 }, svg);
    const lines = [[0, 0, 400, 400], [400, 0, 0, 400], [200, 0, 400, 200], [400, 200, 200, 400], [200, 400, 0, 200], [0, 200, 200, 0]];
    for (const [x1, y1, x2, y2] of lines) svgEl("line", { x1, y1, x2, y2, stroke: "#4A5A8A", "stroke-width": 1.5 }, svg);

    const byHouse = {};
    for (const p of k.planets) (byHouse[p.house] = byHouse[p.house] || []).push(p);

    HOUSES.forEach((poly, i) => {
      const house = i + 1;
      const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
      const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
      const sign = ((k.lagna.sign + i) % 12) + 1;

      if (house === 1) svgEl("polygon", { points: poly.map((p) => p.join(",")).join(" "), fill: "rgba(242,196,107,.10)" }, svg);

      // Sign number sits near the house's corner closest to the chart centre
      const inner = poly.reduce((best, p) => (Math.hypot(p[0] - 200, p[1] - 200) < Math.hypot(best[0] - 200, best[1] - 200) ? p : best));
      const sx = cx + (inner[0] - cx) * 0.68;
      const sy = cy + (inner[1] - cy) * 0.68 + 4;
      const st = svgEl("text", { x: sx, y: sy, "text-anchor": "middle", "font-size": 13, fill: "#A7AEC6", "font-family": "Atkinson Hyperlegible, sans-serif" }, svg);
      st.textContent = sign;

      const items = (byHouse[house] || []).map((p) => ({ text: p.key + (p.retrograde && p.key !== "Ra" && p.key !== "Ke" ? "℞" : ""), color: COLORS[p.key], deg: Math.floor(p.degree) }));
      if (house === 1) items.unshift({ text: "Asc", color: "#F2C46B", deg: Math.floor(k.lagna.degree) });
      const lineH = 17;
      const startY = cy - ((items.length - 1) * lineH) / 2 - (house === 1 || house === 4 || house === 7 || house === 10 ? 6 : 0);
      items.forEach((it, j) => {
        const t = svgEl("text", { x: cx, y: startY + j * lineH + 5, "text-anchor": "middle", "font-size": 14, "font-weight": 700, fill: it.color, "font-family": "Atkinson Hyperlegible, sans-serif" }, svg);
        t.textContent = it.text;
        const d = svgEl("tspan", { "font-size": 10, "font-weight": 400, fill: "#A7AEC6", dx: 2 }, t);
        d.textContent = it.deg + "°";
      });
    });
  }

  function renderPlanetTable(k) {
    const rows = [`<tr><td style="color:#F2C46B">Lagna</td><td>${esc(k.lagna.rashi)}</td><td>${k.lagna.degree.toFixed(2)}°</td><td>1</td><td>${esc(k.lagna.nakshatra.name)} ${k.lagna.nakshatra.pada}</td></tr>`];
    for (const p of k.planets) {
      const retro = p.retrograde && p.key !== "Ra" && p.key !== "Ke" ? '<span class="r" title="Retrograde">℞</span>' : "";
      rows.push(`<tr><td style="color:${COLORS[p.key]}">${esc(p.name)}${retro}</td><td>${esc(p.rashi)}</td><td>${p.degree.toFixed(2)}°</td><td>${p.house}</td><td>${esc(p.nakshatra.name)} ${p.nakshatra.pada}</td></tr>`);
    }
    el("planetRows").innerHTML = rows.join("");
  }

  // ---------------- dasha helpers ----------------
  function dashaAt(k, date) {
    const t = date.getTime();
    const maha = k.dasha.mahadashas.find((m) => new Date(m.start).getTime() <= t && new Date(m.end).getTime() > t);
    if (!maha) return null;
    const antar = maha.antars.find((a) => new Date(a.start).getTime() <= t && new Date(a.end).getTime() > t);
    return { maha, antar };
  }

  function periodLevel(k, maha, antar) {
    const p = k.challengingPeriods.find((c) => c.start === antar.start && c.kind.endsWith("dasha") && c.kind.startsWith(NAMES[maha.lord]));
    return p ? p.level : null;
  }

  function renderDasha(k, birth) {
    const box = el("dashaTimeline");
    const now = Date.now();
    const limit = birth.getTime() + 100 * YEAR;
    const rows = [];
    for (const m of k.dasha.mahadashas) {
      const ms = new Date(m.start).getTime();
      const me = new Date(m.end).getTime();
      if (me < birth.getTime() || ms > limit) continue;
      const span = me - ms;
      const isCur = ms <= now && me > now;
      const segs = m.antars.map((a) => {
        const as = new Date(a.start).getTime();
        const ae = new Date(a.end).getTime();
        const lvl = periodLevel(k, m, a);
        const left = ((as - ms) / span) * 100;
        const width = ((ae - as) / span) * 100;
        const title = `${NAMES[m.lord]}–${NAMES[a.lord]}: ${fmtMonth(new Date(as))} to ${fmtMonth(new Date(ae))}${lvl ? ` (traditionally challenging, ${lvl})` : ""}`;
        return `<div class="dasha-seg ${lvl || ""}" style="left:${left}%;width:${width}%" title="${esc(title)}"><span class="lbl">${width > 7 ? a.lord : ""}</span></div>`;
      }).join("");
      const nowMark = isCur ? `<div class="dasha-now" style="left:${((now - ms) / span) * 100}%" title="Today"></div>` : "";
      const ageFrom = Math.max(0, Math.round((ms - birth) / YEAR));
      const ageTo = Math.round((me - birth) / YEAR);
      rows.push(`<div class="dasha-row${isCur ? " current" : ""}">
        <div class="lord">${NAMES[m.lord]}<br><small>age ${ageFrom}–${ageTo}</small></div>
        <div class="dasha-bar" role="img" aria-label="${NAMES[m.lord]} mahadasha, ${new Date(ms).getFullYear()} to ${new Date(me).getFullYear()}">${segs}${nowMark}</div>
      </div>`);
    }
    box.innerHTML = rows.join("");
  }

  function renderPeriods(k) {
    const list = el("periods");
    const btn = el("morePeriods");
    const now = Date.now();
    const all = k.challengingPeriods;
    const upcoming = all.filter((p) => new Date(p.end).getTime() > now);
    let showAll = false;

    function draw() {
      const items = showAll ? all : upcoming.slice(0, 6);
      if (!items.length) {
        list.innerHTML = `<li>No traditionally challenging periods ahead in this chart's timeline.</li>`;
      } else {
        list.innerHTML = items.map((p) => {
          const s = new Date(p.start), e = new Date(p.end);
          const cur = s.getTime() <= now && e.getTime() > now;
          return `<li class="${p.level}${cur ? " current" : ""}">
            <span class="when">${fmtMonth(s)} to ${fmtMonth(e)}, age ${p.ageFrom}–${p.ageTo}${cur ? ", happening now" : ""}</span>
            <b>${esc(p.kind)}</b>
            <p>${esc(p.reason)} ${esc(p.guidance)}</p>
          </li>`;
        }).join("");
      }
      btn.hidden = all.length <= 6 && upcoming.length === all.length;
      btn.textContent = showAll ? "Show upcoming only" : `Show all ${all.length} periods, including past`;
    }
    btn.onclick = () => { showAll = !showAll; draw(); };
    draw();
  }

  // ---------------- animated wheel ----------------
  const R_OUT = 250, R_SIGN = 214, R_FIRST = 192, R_STEP = 14;
  const orbitR = (i) => R_FIRST - i * R_STEP;
  const pt = (lon, r) => {
    const a = (lon * Math.PI) / 180;
    return [-r * Math.cos(a), r * Math.sin(a)];
  };
  const lerpAngle = (a, b, t) => {
    const d = ((b - a + 540) % 360) - 180;
    return (a + d * t + 360) % 360;
  };

  const Wheel = {
    k: null, birth: null, data: null, raf: null, playing: false, live: false, liveSnap: null, liveTimer: null,
    pos: 0, lastSigns: null, nodes: {},

    async init(k, birth) {
      this.stop();
      this.k = k; this.birth = birth; this.live = false; this.lastSigns = null;
      this.buildStatic();
      el("wheelEvents").innerHTML = "";
      el("wheelDate").textContent = "Loading the sky…";
      try {
        const res = await fetch(`/api/kundali/transits?from=${encodeURIComponent(birth.toISOString())}`);
        if (!res.ok) throw new Error((await res.json()).error || "Could not load planet timeline.");
        this.data = await res.json();
        this.end = this.data.start ? new Date(new Date(this.data.start).getTime() + (this.data.frames - 1) * this.data.stepDays * DAY) : new Date();
      } catch (e) {
        el("wheelDate").textContent = e.message;
        return;
      }
      this.bindControls();
      this.setPos(0);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduced) this.observeAndAutoplay();
    },

    buildStatic() {
      const svg = el("wheel");
      svg.innerHTML = "";
      svgEl("circle", { r: R_OUT, fill: "#1C2747", stroke: "#4A5A8A", "stroke-width": 1.5 }, svg);
      svgEl("circle", { r: R_SIGN - 10, fill: "#121A33", stroke: "#4A5A8A", "stroke-width": 1 }, svg);
      for (let i = 0; i < 12; i++) {
        const [x1, y1] = pt(i * 30, R_SIGN - 10);
        const [x2, y2] = pt(i * 30, R_OUT);
        svgEl("line", { x1, y1, x2, y2, stroke: "#4A5A8A", "stroke-width": 1 }, svg);
        const [tx, ty] = pt(i * 30 + 15, (R_OUT + R_SIGN - 10) / 2);
        const t = svgEl("text", { x: tx, y: ty + 4, "text-anchor": "middle", "font-size": 11.5, fill: "#A7AEC6", "font-family": "Atkinson Hyperlegible, sans-serif" }, svg);
        t.textContent = RASHI_SHORT[i];
      }
      // Orbits
      ORDER.forEach((key, i) => svgEl("circle", { r: orbitR(i), fill: "none", stroke: "rgba(74,90,138,.35)", "stroke-width": 1, "stroke-dasharray": "2 4" }, svg));

      // Lagna line
      const [lx, ly] = pt(this.k.lagna.lon, R_OUT);
      svgEl("line", { x1: 0, y1: 0, x2: lx, y2: ly, stroke: "#F2C46B", "stroke-width": 1.5, "stroke-dasharray": "5 4", opacity: .7 }, svg);
      const [ax, ay] = pt(this.k.lagna.lon + 4, R_SIGN - 20);
      const at = svgEl("text", { x: ax, y: ay + 4, "text-anchor": "middle", "font-size": 11, fill: "#F2C46B", "font-weight": 700 }, svg);
      at.textContent = "Asc";

      // Natal ghosts
      ORDER.forEach((key, i) => {
        const p = this.k.planets.find((x) => x.key === key);
        const [x, y] = pt(p.lon, orbitR(i));
        svgEl("circle", { cx: x, cy: y, r: 7, fill: "none", stroke: COLORS[key], "stroke-width": 1.2, opacity: .45 }, svg);
      });

      // Moving planets
      this.nodes = {};
      ORDER.forEach((key, i) => {
        const g = svgEl("g", {}, svg);
        const line = svgEl("line", { x1: 0, y1: 0, x2: 0, y2: 0, stroke: COLORS[key], "stroke-width": .6, opacity: .25 }, g);
        const c = svgEl("circle", { r: 9, fill: COLORS[key] }, g);
        const t = svgEl("text", { "text-anchor": "middle", "font-size": 9, "font-weight": 700, fill: "#121A33", dy: 3.2 }, g);
        t.textContent = key;
        const title = svgEl("title", {}, g);
        this.nodes[key] = { g, line, c, t, title, r: orbitR(i) };
      });
      svgEl("circle", { r: 4, fill: "#F2C46B" }, svg);
    },

    frameLon(f) {
      const s = this.data.series;
      const i = Math.min(Math.floor(f), this.data.frames - 1);
      const j = Math.min(i + 1, this.data.frames - 1);
      const t = f - i;
      const out = {};
      for (const k of ORDER) out[k] = lerpAngle(s[k][i], s[k][j], t);
      return out;
    },

    draw(lons, date) {
      const signs = {};
      for (const key of ORDER) {
        const n = this.nodes[key];
        const [x, y] = pt(lons[key], n.r);
        n.c.setAttribute("cx", x); n.c.setAttribute("cy", y);
        n.t.setAttribute("x", x); n.t.setAttribute("y", y);
        n.line.setAttribute("x2", x); n.line.setAttribute("y2", y);
        signs[key] = Math.floor(lons[key] / 30);
        n.title.textContent = `${NAMES[key]}: ${RASHI_SHORT[signs[key]]} ${(lons[key] % 30).toFixed(1)}°`;
      }
      // Rashi-change events for slow planets
      if (this.lastSigns && this.playing) {
        for (const key of SLOW) {
          if (signs[key] !== this.lastSigns[key]) this.addEvent(`${NAMES[key]}${key === "Ra" ? " and Ketu" : ""} entered ${RASHI_SHORT[signs[key]]}`, date);
        }
      }
      this.lastSigns = signs;

      el("wheelDate").textContent = this.live ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" }) : fmtDate(date);
      const ageY = (date - this.birth) / YEAR;
      el("wheelAge").textContent = ageY < 0.08 ? "The day you were born" : `You were ${plural(Math.floor(ageY), "year")} ${plural(Math.floor((ageY % 1) * 12), "month")} old`;
      if (this.live) el("wheelAge").textContent = "Right now";
      const d = dashaAt(this.k, date);
      el("wheelDasha").innerHTML = d ? `Running dasha: <b>${NAMES[d.maha.lord]} mahadasha</b>, ${NAMES[d.antar.lord]} antardasha` : "";
    },

    addEvent(text, date) {
      const list = el("wheelEvents");
      const li = document.createElement("li");
      li.className = "flash";
      li.textContent = `${fmtMonth(date)}: ${text}`;
      list.prepend(li);
      while (list.children.length > 8) list.lastChild.remove();
    },

    setPos(p) {
      this.pos = Math.max(0, Math.min(1000, p));
      el("timeSlider").value = Math.round(this.pos);
      const startMs = new Date(this.data.start).getTime();
      const span = this.end.getTime() - startMs;
      const date = new Date(startMs + (this.pos / 1000) * span);
      const f = ((date.getTime() - startMs) / DAY) / this.data.stepDays;
      this.draw(this.frameLon(f), date);
    },

    play() {
      if (this.live) this.exitLive();
      if (this.pos >= 1000) { this.setPos(0); el("wheelEvents").innerHTML = ""; }
      this.playing = true;
      el("playBtn").textContent = "❚❚"; el("playBtn").setAttribute("aria-label", "Pause");
      const spanDays = (this.end - new Date(this.data.start)) / DAY;
      let last = performance.now();
      const tick = (now) => {
        const dt = (now - last) / 1000; last = now;
        const speed = Number(el("speedSel").value);
        const daysPerSec = 30 * speed;
        this.setPos(this.pos + (daysPerSec * dt / spanDays) * 1000);
        if (this.pos >= 1000) { this.pause(); this.goLive(); return; }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    },

    pause() {
      this.playing = false;
      cancelAnimationFrame(this.raf);
      el("playBtn").textContent = "▶"; el("playBtn").setAttribute("aria-label", "Play");
    },

    async goLive() {
      this.pause();
      this.setPos(1000);
      try {
        const res = await fetch("/api/kundali/now");
        const snap = await res.json();
        this.liveSnap = { t: new Date(snap.time).getTime(), planets: Object.fromEntries(snap.planets.map((p) => [p.key, p])) };
      } catch { return; }
      this.live = true;
      el("wheelLive").hidden = false;
      clearInterval(this.liveTimer);
      const step = () => {
        const now = Date.now();
        const days = (now - this.liveSnap.t) / DAY;
        const lons = {};
        for (const key of ORDER) { const p = this.liveSnap.planets[key]; lons[key] = (((p.lon + p.speed * days) % 360) + 360) % 360; }
        this.draw(lons, new Date(now));
        if (now - this.liveSnap.t > 10 * 60000) this.goLive();
      };
      step();
      this.liveTimer = setInterval(step, 1000);
    },

    exitLive() {
      this.live = false;
      clearInterval(this.liveTimer);
      el("wheelLive").hidden = true;
    },

    stop() {
      this.pause();
      this.exitLive();
      if (this.observer) this.observer.disconnect();
    },

    bindControls() {
      el("playBtn").onclick = () => (this.playing ? this.pause() : this.play());
      el("timeSlider").oninput = (e) => {
        this.pause();
        if (this.live) this.exitLive();
        this.lastSigns = null;
        const v = Number(e.target.value);
        if (v >= 1000) this.goLive(); else this.setPos(v);
      };
      el("liveBtn").onclick = () => this.goLive();
    },

    observeAndAutoplay() {
      // Start playing once the wheel scrolls into view (only once)
      let started = false;
      this.observer = new IntersectionObserver((entries) => {
        if (!started && entries.some((e) => e.isIntersecting)) {
          started = true;
          this.observer.disconnect();
          this.play();
        }
      }, { threshold: 0.5 });
      this.observer.observe(el("wheel"));
    }
  };

  // ---------------- entry point ----------------
  window.AyuKundali = {
    render(k) {
      const birth = new Date(k.input.utc);
      const cur = k.current;
      el("kSummary").innerHTML =
        `Lagna <b>${esc(k.lagna.rashi)}</b>, Moon sign <b>${esc(k.moonSign.rashi)}</b>, birth nakshatra <b>${esc(k.dasha.birthNakshatra.name)}</b> (pada ${k.dasha.birthNakshatra.pada}). ` +
        (cur ? `You are now in the <b>${NAMES[cur.maha]}</b> mahadasha, <b>${NAMES[cur.antar]}</b> antardasha until ${fmtMonth(new Date(cur.antarEnd))}.` : "");
      el("kTimeNote").hidden = !k.timeUnknown;
      renderNorthChart(k);
      renderPlanetTable(k);
      renderDasha(k, birth);
      renderPeriods(k);
      Wheel.init(k, birth);
    },
    stop() { Wheel.stop(); }
  };
})();
