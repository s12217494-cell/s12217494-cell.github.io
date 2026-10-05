// Hand-drawn SVG pieces: the mihrab emblem, system diagrams, the transmutation and the astrolabe.
export const NS = "http://www.w3.org/2000/svg";

export function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") n.textContent = v;
    else n.setAttribute(k, v);
  }
  if (parent) parent.appendChild(n);
  return n;
}

export function starPoints(cx, cy, R, rot = 0, ri = R * 0.7654) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? ri : R;
    const a = rot + (i * Math.PI) / 8 - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

/* ───────── mihrab emblem (Chapter I) ───────── */
export function drawEmblem(svg) {
  const defs = el("defs", {}, svg);
  const grad = el("linearGradient", { id: "em-gold", x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
  [["0", "#8c6a28"], [".35", "#f0d48d"], [".6", "#c9a24b"], ["1", "#8c6a28"]].forEach(([o, c]) => el("stop", { offset: o, "stop-color": c }, grad));
  const bg = el("radialGradient", { id: "em-bg", cx: ".5", cy: ".42", r: ".7" }, defs);
  [["0", "#22397a"], [".7", "#13224f"], ["1", "#0a1330"]].forEach(([o, c]) => el("stop", { offset: o, "stop-color": c }, bg));
  const pat = el("pattern", { id: "em-pat", width: 40, height: 40, patternUnits: "userSpaceOnUse" }, defs);
  el("polygon", { points: starPoints(20, 20, 13), fill: "none", stroke: "#c9a24b", "stroke-opacity": ".28", "stroke-width": "1" }, pat);
  el("path", { d: "M0 0l7 7M40 0l-7 7M0 40l7-7M40 40l-7-7", stroke: "#c9a24b", "stroke-opacity": ".28" }, pat);

  const arch = "M18 412V176C18 92 92 40 150 8c58 32 132 84 132 168v236Z";
  const inner = "M38 396V182C38 108 100 62 150 32c50 30 112 76 112 150v214Z";
  el("clipPath", { id: "em-clip" }, defs).appendChild(el("path", { d: inner }));

  el("path", { d: arch, fill: "url(#em-gold)" }, svg);
  el("path", { d: "M26 404V178C26 98 96 50 150 18c54 32 124 80 124 160v226Z", fill: "#0a1330" }, svg);
  el("path", { d: inner, fill: "url(#em-bg)" }, svg);
  const g = el("g", { "clip-path": "url(#em-clip)" }, svg);
  el("rect", { width: 300, height: 420, fill: "url(#em-pat)" }, g);

  // hanging lamp chain
  el("path", { d: "M150 32v70", stroke: "url(#em-gold)", "stroke-width": "1.5" }, g);
  el("polygon", { points: starPoints(150, 110, 11), fill: "url(#em-gold)" }, g);

  // rotating outer star + medallion
  const spin = el("g", { class: "em-spin" }, g);
  el("polygon", { points: starPoints(150, 222, 104), fill: "#0d1a42", stroke: "url(#em-gold)", "stroke-width": "3" }, spin);
  el("polygon", { points: starPoints(150, 222, 92), fill: "none", stroke: "#c9a24b", "stroke-opacity": ".6", "stroke-width": "1" }, spin);
  el("circle", { cx: 150, cy: 222, r: 70, fill: "#f2e7cd", stroke: "url(#em-gold)", "stroke-width": "4" }, g);
  el("circle", { cx: 150, cy: 222, r: 62, fill: "none", stroke: "#b0432a", "stroke-width": "1" }, g);
  el("text", { x: 150, y: 236, "text-anchor": "middle", "font-family": "Cormorant Garamond, serif", "font-size": "50", "font-weight": "700", fill: "#2a1d12", text: "AM" }, g);
  el("text", { x: 150, "text-anchor": "middle", "font-family": "Cormorant Garamond, serif", "font-size": "10.5", "font-weight": "700", "letter-spacing": "2.5", fill: "#b0432a", text: "DATA ANALYST", y: 256 }, g);

  // base band of small stars
  for (let i = 0; i < 6; i++) el("polygon", { points: starPoints(63 + i * 35, 368, 9), fill: "url(#em-gold)" }, g);
  el("path", { d: "M38 350h224M38 386h224", stroke: "url(#em-gold)", "stroke-width": "1.5" }, g);

  const style = el("style", {}, svg);
  style.textContent = ".em-spin{transform-origin:150px 222px;animation:spin 60s linear infinite}@media (prefers-reduced-motion:reduce){.em-spin{animation:none}}";
}

/* ───────── generic node/link diagram ───────── */
function diagram(svg, nodes, links) {
  const pos = {};
  const gl = el("g", {}, svg);
  const gn = el("g", {}, svg);
  for (const n of nodes) {
    pos[n.id] = n;
    const g = el("g", { class: `pipe-node ${n.kind ? "is-" + n.kind : ""}` }, gn);
    el("rect", { x: n.x, y: n.y, width: n.w, height: n.h, rx: 3 }, g);
    el("text", { x: n.x + n.w / 2, y: n.y + (n.sub ? n.h / 2 - 3 : n.h / 2 + 5), "text-anchor": "middle", text: n.label }, g);
    if (n.sub) el("text", { class: "sub", x: n.x + n.w / 2, y: n.y + n.h / 2 + 15, "text-anchor": "middle", text: n.sub }, g);
  }
  for (const [a, b, side] of links) {
    const A = pos[a], B = pos[b];
    let d;
    if (side === "h") {
      const y = A.y + A.h / 2;
      d = `M${A.x + A.w} ${y}H${B.x}`;
    } else {
      const x1 = A.x + A.w / 2, y1 = A.y + A.h, x2 = B.x + B.w / 2, y2 = B.y;
      const my = (y1 + y2) / 2;
      d = `M${x1} ${y1}C${x1} ${my} ${x2} ${my} ${x2} ${y2}`;
    }
    el("path", { class: "pipe-link", d }, gl);
  }
}

export function drawLibraryPipeline(svg) {
  diagram(svg, [
    { id: "cat", x: 0, y: 0, w: 168, h: 56, label: "Najah catalogue", sub: "scraped OPAC records" },
    { id: "gr", x: 192, y: 0, w: 168, h: 56, label: "Goodreads", sub: "metadata · reviews" },
    { id: "sql", x: 0, y: 104, w: 168, h: 56, label: "SQLite", sub: "2,197 books · reviews", kind: "store" },
    { id: "chr", x: 192, y: 104, w: 168, h: 56, label: "ChromaDB", sub: "384-d embeddings", kind: "store" },
    { id: "absa", x: 0, y: 214, w: 168, h: 56, label: "Sentiment (ABSA)", sub: "MARBERT → CAMeLBERT", kind: "ai" },
    { id: "srch", x: 192, y: 214, w: 168, h: 56, label: "Semantic search", sub: "MiniLM · cosine", kind: "ai" },
    { id: "knn", x: 0, y: 290, w: 168, h: 56, label: "Recommender", sub: "hybrid KNN", kind: "ai" },
    { id: "rag", x: 192, y: 290, w: 168, h: 56, label: "RAG librarian", sub: "retrieve → LLM", kind: "ai" },
    { id: "app", x: 60, y: 384, w: 240, h: 44, label: "React web app · Express API" },
  ], [
    ["cat", "sql"], ["gr", "sql"], ["sql", "chr", "h"], ["sql", "absa"], ["chr", "srch"],
    ["chr", "rag"], ["absa", "knn"], ["knn", "app"], ["rag", "app"],
  ]);
}

/* ───────── messy sheet → validated dashboard (Folio 3) ───────── */
export function drawTransmute(svg, reduceMotion) {
  const style = el("style", {}, svg);
  style.textContent = `
    .tm-cell{transition:transform 1.1s cubic-bezier(.2,.7,.1,1),fill .8s;transform-box:fill-box;transform-origin:center}
    .tm-bad{fill:rgba(208,102,76,.8)}
    .clean .tm-cell{transform:none!important}
    .clean .tm-bad{fill:rgba(201,162,75,.4)}
    .tm-out{opacity:.15;transition:opacity .8s .9s}
    .clean .tm-out{opacity:1}
    .tm-bar{transform-box:fill-box;transform-origin:bottom;transform:scaleY(.1);transition:transform 1s cubic-bezier(.2,.7,.1,1) 1.1s}
    .clean .tm-bar{transform:none}
    .tm-sieve{transform-origin:210px 150px;transition:transform 1.4s cubic-bezier(.2,.7,.1,1)}
    .clean .tm-sieve{transform:rotate(45deg)}
    .tm-lbl{fill:#b3a88f;font:600 11px "Cormorant Garamond",serif;letter-spacing:.18em}
  `;
  const g = el("g", {}, svg);
  el("text", { class: "tm-lbl", x: 75, y: 28, "text-anchor": "middle", text: "RAW EXPORT" }, g);
  el("text", { class: "tm-lbl", x: 210, y: 28, "text-anchor": "middle", text: "VALIDATE" }, g);
  el("text", { class: "tm-lbl", x: 345, y: 28, "text-anchor": "middle", text: "REPORT" }, g);

  // spreadsheet
  let seed = 5;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 4; col++) {
      const bad = r() < 0.18;
      const w = col === 0 ? 40 : 30;
      const x = 10 + (col === 0 ? 0 : 40 + (col - 1) * 30 + col * 2);
      el("rect", {
        class: `tm-cell${bad ? " tm-bad" : ""}`, x, y: 48 + row * 26, width: w - 2, height: 22, rx: 1,
        fill: row === 0 ? "rgba(201,162,75,.45)" : "rgba(236,226,201,.16)",
        style: `transform:translate(${(r() - 0.5) * 26}px,${(r() - 0.5) * 18}px) rotate(${(r() - 0.5) * 30}deg)`,
      }, g);
    }
  }

  // arrows
  for (const [x1, x2] of [[150, 172], [248, 270]]) {
    el("path", { d: `M${x1} 150H${x2}`, stroke: "#c9a24b", "stroke-width": "1.5", "stroke-dasharray": "3 4", class: "pipe-link" }, g);
    el("path", { d: `M${x2 - 6} 145l6 5-6 5`, fill: "none", stroke: "#c9a24b", "stroke-width": "1.5" }, g);
  }

  // validation sieve
  const sv = el("g", { class: "tm-sieve" }, g);
  el("polygon", { points: starPoints(210, 150, 34), fill: "#0f1b42", stroke: "#c9a24b", "stroke-width": "2" }, sv);
  el("circle", { cx: 210, cy: 150, r: 17, fill: "none", stroke: "#c9a24b" }, g);
  el("path", { d: "M202 150l6 6 11-12", fill: "none", stroke: "#f0d48d", "stroke-width": "2.5", "stroke-linecap": "round", "stroke-linejoin": "round" }, g);

  // KPI tiles + bars
  const out = el("g", { class: "tm-out" }, g);
  for (let i = 0; i < 3; i++) {
    el("rect", { x: 280 + i * 45, y: 48, width: 40, height: 44, rx: 2, fill: "rgba(23,42,92,.9)", stroke: "#c9a24b" }, out);
    el("rect", { x: 287 + i * 45, y: 58, width: 18, height: 8, fill: "#f0d48d" }, out);
    el("rect", { x: 287 + i * 45, y: 74, width: 26, height: 4, fill: "rgba(236,226,201,.4)" }, out);
  }
  el("rect", { x: 280, y: 104, width: 130, height: 150, rx: 2, fill: "rgba(23,42,92,.9)", stroke: "#c9a24b" }, out);
  [62, 90, 48, 110, 80, 124].forEach((h, i) => el("rect", { class: "tm-bar", x: 292 + i * 19, y: 240 - h, width: 12, height: h, fill: i === 5 ? "#f0d48d" : "#c9a24b" }, out));
  el("path", { d: "M288 240h116", stroke: "rgba(201,162,75,.5)" }, out);

  // loop the transformation while visible
  let timer = 0;
  const cycle = () => { g.classList.toggle("clean"); timer = setTimeout(cycle, g.classList.contains("clean") ? 4200 : 1600); };
  new IntersectionObserver(([e]) => {
    clearTimeout(timer);
    if (!e.isIntersecting) return;
    if (reduceMotion) { g.classList.add("clean"); return; }
    timer = setTimeout(cycle, 500);
  }, { threshold: 0.4 }).observe(svg);
}

/* ───────── the astrolabe (Chapter IV) ───────── */
export const SKILL_RINGS = [
  { id: "bi", en: "Power BI", r: 96, speed: 90, dir: 1,
    skills: ["Power Query", "DAX", "Data modeling", "Interactive dashboards"],
    note: "Power Query, DAX, data modeling and interactive dashboards. I also teach it to hospital staff." },
  { id: "da", en: "Data Analysis & Reporting", r: 140, speed: 140, dir: -1,
    skills: ["Advanced Excel", "Complex formulas", "Pivot Tables", "Statistical summaries", "Periodic reporting"],
    note: "Advanced Excel, complex formulas, Pivot Tables, statistical summaries and periodic reports that come out on time." },
  { id: "pg", en: "Programming & Data Quality", r: 184, speed: 200, dir: 1,
    skills: ["Python", "pandas", "numpy", "matplotlib", "SQL", "Data validation", "Accuracy checks"],
    note: "Python and SQL for cleaning and analysis, plus validation routines that run before any number reaches management." },
  { id: "ai", en: "AI & Automation", r: 228, speed: 260, dir: -1,
    skills: ["RAG", "LangChain", "LLM APIs", "AI agents", "ChromaDB", "sentence-transformers", "Automated workflows", "Process optimization"],
    note: "RAG pipelines, LLM API integration, vector databases and automated workflows. Used in the library chatbot and the job market platform." },
];

export function drawAstrolabe(svg, legend, reduceMotion) {
  const defs = el("defs", {}, svg);
  const grad = el("radialGradient", { id: "as-bg" }, defs);
  [["0", "#1b2f68"], [".8", "#101d47"], ["1", "#0a1330"]].forEach(([o, c]) => el("stop", { offset: o, "stop-color": c }, grad));
  const gold = el("linearGradient", { id: "as-gold", x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
  [["0", "#8c6a28"], [".4", "#f0d48d"], [".7", "#c9a24b"], ["1", "#8c6a28"]].forEach(([o, c]) => el("stop", { offset: o, "stop-color": c }, gold));

  // mater: rim with degree scale
  el("circle", { r: 258, fill: "url(#as-gold)" }, svg);
  el("circle", { r: 250, fill: "url(#as-bg)" }, svg);
  const ticks = el("g", { stroke: "#c9a24b" }, svg);
  for (let i = 0; i < 360; i += 5) {
    const a = (i * Math.PI) / 180, long = i % 30 === 0;
    const r1 = 250, r2 = long ? 238 : 244;
    el("line", { x1: r1 * Math.cos(a), y1: r1 * Math.sin(a), x2: r2 * Math.cos(a), y2: r2 * Math.sin(a), "stroke-width": long ? 1.5 : 0.8 }, ticks);
  }
  el("circle", { r: 252, fill: "none", stroke: "#f0d48d", "stroke-width": ".6", opacity: ".6" }, svg);

  const style = el("style", {}, svg);
  let css = "";
  const groups = [];
  const cards = [];

  SKILL_RINGS.forEach((ring, i) => {
    const g = el("g", { class: "ring-group", "data-ring": ring.id, tabindex: "-1" }, svg);
    const rot = el("g", { class: `ring-rot ring-${ring.id}` }, g);
    el("circle", { class: "ring-band", r: ring.r, "stroke-width": 36 }, rot);
    el("circle", { class: "ring-edge", r: ring.r - 18 }, rot);
    el("circle", { class: "ring-edge", r: ring.r + 18 }, rot);
    const pid = `as-path-${ring.id}`;
    // text runs clockwise along a circle a hair below the band centre
    const rr = ring.r - 5;
    el("path", { id: pid, d: `M0 ${-rr}A${rr} ${rr} 0 1 1 0 ${rr}A${rr} ${rr} 0 1 1 0 ${-rr}`, fill: "none" }, defs);
    const text = el("text", {}, rot);
    const tp = el("textPath", { href: `#${pid}` }, text);
    ring.skills.forEach((s) => {
      el("tspan", { text: s.toUpperCase() }, tp);
      el("tspan", { class: "sep", text: "  ✦  " }, tp);
    });
    text.dataset.circ = String(2 * Math.PI * rr);
    css += `.ring-${ring.id}{animation:spin ${ring.speed}s linear infinite ${ring.dir < 0 ? "reverse" : ""}}`;
    groups.push(g);

    const card = document.createElement("button");
    card.className = "astro-card";
    card.type = "button";
    card.setAttribute("aria-pressed", "false");
    card.dataset.ring = ring.id;
    card.innerHTML = `<h4>${ring.en}</h4><p>${ring.note}</p>`;
    legend.appendChild(card);
    cards.push(card);
  });
  const extra = document.createElement("p");
  extra.className = "astro-extra";
  extra.innerHTML = "<em>Also:</em> Arabic (native) · English (B2) · Microsoft Office · working across teams · delivering training · problem solving";
  extra.style.cssText = "margin:8px 0 0;color:var(--text-dim);font-size:.9em";
  legend.appendChild(extra);
  style.textContent = reduceMotion ? "" : css + ".ring-group.is-on .ring-rot{animation-play-state:paused}";

  // alidade (the pointer) and the central star
  const ali = el("g", { class: "alidade" }, svg);
  el("path", { d: "M-6 0L0 -246L6 0L0 246Z", fill: "url(#as-gold)", opacity: ".9" }, ali);
  if (!reduceMotion) style.textContent += ".alidade{animation:spin 120s linear infinite}";
  el("polygon", { points: starPoints(0, 0, 56), fill: "#0a1330", stroke: "url(#as-gold)", "stroke-width": "3" }, svg);
  el("circle", { r: 34, fill: "#f2e7cd", stroke: "url(#as-gold)", "stroke-width": "2" }, svg);
  el("text", { y: 10, "text-anchor": "middle", "font-family": "Cormorant Garamond, serif", "font-size": "28", "font-weight": "700", fill: "#2a1d12", text: "AM" }, svg);

  // fit each ring's text to its circumference once fonts are ready
  document.fonts.ready.then(() => {
    svg.querySelectorAll("text[data-circ]").forEach((t) => {
      const circ = +t.dataset.circ;
      let len = t.getComputedTextLength();
      let size = 13.5;
      while (len > circ * 0.98 && size > 8) {
        size -= 0.5;
        t.style.fontSize = size + "px";
        len = t.getComputedTextLength();
      }
      t.setAttribute("textLength", (circ * 0.985).toFixed(1));
      t.setAttribute("lengthAdjust", "spacing");
    });
  });

  const instrument = svg.parentElement;
  const select = (id) => {
    instrument.classList.toggle("has-on", !!id);
    groups.forEach((g) => g.classList.toggle("is-on", g.dataset.ring === id));
    cards.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.ring === id)));
  };
  let locked = null;
  groups.forEach((g) => {
    g.addEventListener("pointerenter", () => !locked && select(g.dataset.ring));
    g.addEventListener("pointerleave", () => !locked && select(null));
    g.addEventListener("click", () => { locked = locked === g.dataset.ring ? null : g.dataset.ring; select(locked); });
  });
  cards.forEach((c) => {
    c.addEventListener("pointerenter", () => !locked && select(c.dataset.ring));
    c.addEventListener("pointerleave", () => !locked && select(null));
    c.addEventListener("click", () => { locked = locked === c.dataset.ring ? null : c.dataset.ring; select(locked); });
  });
}
