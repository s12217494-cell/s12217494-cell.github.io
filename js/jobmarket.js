// Folio 2: charts from the Palestine job market report.
import { el, starPoints } from "./ornaments.js";

const REGIONS = [
  { id: "west_bank", en: "West Bank", ar: "الضفة الغربية", c: "#c9a24b" },
  { id: "gaza", en: "Gaza", ar: "غزة", c: "#2fa39b" },
  { id: "jerusalem", en: "Jerusalem", ar: "القدس", c: "#d0664c" },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (n) => n.toLocaleString("en-US");

export async function initJobMarket() {
  let d;
  try { d = await fetch("data/jobmarket.json").then((r) => r.json()); }
  catch { return; }

  /* ledger */
  const q = d.quality;
  const ledger = document.getElementById("jm-ledger");
  ledger.innerHTML = [
    ["Postings scraped", q.scraped],
    ["Duplicates removed", -q.duplicates_removed, "minus"],
    ["Unique jobs", q.jobs],
    ["Employers", d.summary.employers],
    ["Skill-extracted by LLM", q.analyzed],
  ].map(([k, v, cls]) => `<li class="${cls || ""}"><span>${k}</span><b>${v < 0 ? "−" + fmt(-v) : fmt(v)}</b></li>`).join("");

  demandChart(document.getElementById("jm-demand"), d.months);
  skillBars(d.skills);
  regions(document.getElementById("jm-regions"), d.regions);
}

/* Plate A: stacked area of monthly postings by region */
function demandChart(box, monthsAll) {
  // the current month is still in progress; leave it out
  const months = monthsAll.slice(0, -1);
  const Wd = 1000, Hd = 340, m = { l: 44, r: 12, t: 16, b: 40 };
  const svg = el("svg", { viewBox: `0 0 ${Wd} ${Hd}`, role: "img", "aria-label": `Monthly job postings by region from ${months[0].month} to ${months.at(-1).month}` });
  box.appendChild(svg);
  const max = Math.ceil(Math.max(...months.map((r) => r.west_bank + r.gaza + r.jerusalem)) / 100) * 100;
  const x = (i) => m.l + (i / (months.length - 1)) * (Wd - m.l - m.r);
  const y = (v) => Hd - m.b - (v / max) * (Hd - m.t - m.b);

  const grid = el("g", { class: "grid" }, svg);
  const axis = el("g", { class: "axis" }, svg);
  for (let v = 0; v <= max; v += 100) {
    el("line", { x1: m.l, x2: Wd - m.r, y1: y(v), y2: y(v) }, grid);
    el("text", { x: m.l - 8, y: y(v) + 4, "text-anchor": "end", text: v }, axis);
  }
  months.forEach((r, i) => {
    const [yr, mo] = r.month.split("-");
    if (mo === "01") {
      el("line", { x1: x(i), x2: x(i), y1: m.t, y2: Hd - m.b + 6, stroke: "rgba(201,162,75,.35)" }, grid);
      el("text", { class: "yr", x: x(i) + 6, y: Hd - m.b + 24, text: yr }, svg);
    }
  });

  // stack bottom→top: west bank, gaza, jerusalem
  let base = months.map(() => 0);
  const areas = [];
  for (const reg of REGIONS) {
    const top = months.map((r, i) => base[i] + r[reg.id]);
    const d = top.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("") +
      base.map((v, i) => `L${x(i).toFixed(1)} ${y(v).toFixed(1)}`).reverse().join("") + "Z";
    const line = top.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
    areas.push(el("path", { d, fill: reg.c, "fill-opacity": ".42" }, svg));
    el("path", { d: line, fill: "none", stroke: reg.c, "stroke-width": "1.8" }, svg);
    base = top;
  }
  // ink-drawing reveal
  svg.style.clipPath = "inset(0 100% 0 0)";
  svg.style.transition = "clip-path 2.2s cubic-bezier(.2,.7,.1,1)";
  // observe the container: a fully clipped element never counts as intersecting
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { svg.style.clipPath = "inset(0 0 0 0)"; o.disconnect(); } }, { threshold: 0.3 }).observe(box);

  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.innerHTML = REGIONS.map((r) => `<span style="--c:${r.c}">${r.en}</span>`).join("");
  box.appendChild(legend);

  // hover: crosshair + tooltip
  const marker = el("line", { class: "marker", y1: m.t, y2: Hd - m.b, opacity: 0 }, svg);
  const tip = document.createElement("div");
  tip.className = "tip";
  box.appendChild(tip);
  const hit = el("rect", { x: m.l, y: m.t, width: Wd - m.l - m.r, height: Hd - m.t - m.b, fill: "transparent" }, svg);
  const show = (evt) => {
    const b = svg.getBoundingClientRect();
    const px = ((evt.clientX - b.left) / b.width) * Wd;
    const i = Math.max(0, Math.min(months.length - 1, Math.round(((px - m.l) / (Wd - m.l - m.r)) * (months.length - 1))));
    const r = months[i];
    const [yr, mo] = r.month.split("-");
    marker.setAttribute("x1", x(i)); marker.setAttribute("x2", x(i)); marker.setAttribute("opacity", 1);
    tip.innerHTML = `<b>${MONTHS[+mo - 1]} ${yr} · ${fmt(r.jobs)} jobs</b>` +
      REGIONS.slice().reverse().map((g) => `<span><span><i style="--c:${g.c}"></i>${g.en}</span><span>${r[g.id]}</span></span>`).join("");
    const left = (x(i) / Wd) * b.width;
    tip.style.left = Math.min(Math.max(0, left - 90), b.width - 190) + "px";
    tip.style.top = "6px";
    tip.classList.add("on");
  };
  hit.addEventListener("pointermove", show);
  hit.addEventListener("pointerleave", () => { tip.classList.remove("on"); marker.setAttribute("opacity", 0); });
}

/* Plate B: top skills by kind */
function skillBars(skills) {
  const list = document.getElementById("jm-skills");
  const render = (kind) => {
    const rows = skills[kind];
    const max = Math.max(...rows.map((r) => r.s));
    list.innerHTML = rows.map((r) => `<li><span class="lbl">${r.n}</span>
      <span class="bar"><i data-w="${(r.s / max) * 100}"></i></span><span class="val">${r.s.toFixed(0)}%</span></li>`).join("");
    requestAnimationFrame(() => requestAnimationFrame(() => list.querySelectorAll("i").forEach((i) => (i.style.width = i.dataset.w + "%"))));
  };
  const seg = document.getElementById("jm-kind");
  seg.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    render(b.dataset.kind);
  }));
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { render("hard"); o.disconnect(); } }, { threshold: 0.3 }).observe(list);
}

/* Plate C: three medallions, each sized by share of jobs */
function regions(box, data) {
  const maxShare = Math.max(...REGIONS.map((r) => data[r.id].share));
  box.innerHTML = "";
  for (const reg of REGIONS) {
    const v = data[reg.id];
    const div = document.createElement("div");
    div.className = "region";
    const svg = el("svg", { viewBox: "-60 -60 120 120", "aria-hidden": "true" });
    const R = 22 + 32 * Math.sqrt(v.share / maxShare);
    el("polygon", { points: starPoints(0, 0, R + 5), fill: "none", stroke: reg.c, "stroke-opacity": ".55" }, svg);
    el("circle", { r: R - 4, fill: reg.c, "fill-opacity": ".22", stroke: reg.c }, svg);
    el("text", { y: 6, "text-anchor": "middle", fill: "#f0d48d", "font-family": "Cormorant Garamond, serif", "font-weight": "600", "font-size": "19", text: `${Math.round(v.share)}%` }, svg);
    div.appendChild(svg);
    div.insertAdjacentHTML("beforeend", `<h4>${reg.en}</h4>
      <dl><div><dt>Jobs</dt><dd>${fmt(v.jobs)}</dd></div>
      <div><dt>Posted in English</dt><dd>${Math.round(v.english)}%</dd></div>
      <div><dt>International employer</dt><dd>${Math.round(v.intl)}%</dd></div></dl>`);
    box.appendChild(div);
  }
}
