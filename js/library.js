// The reading desk: in-browser semantic search, ABSA results and a RAG trace for An-Najah Library.
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const arNum = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[d]);
const isArabic = (s) => /[؀-ۿ]/.test(s || "");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ASPECT_EN = {
  plot: "Plot", style: "Style", characters: "Characters", pacing: "Pacing", cover: "Title & cover",
  translation: "Translation", academic_value: "Knowledge value", reader_fit: "Reader fit", language: "Arabic quality",
  ending: "Ending",
};
const SENTS = ["negative", "mixed", "neutral", "positive"];

// Answers written for this page from the books retrieval actually returns (see the note in the UI).
const ANSWERS = [
  {
    text: "For love across class lines, try <b>Jane Eyre</b><sup data-cite='jane eyre'></sup>: a governess and her employer, with more passion and more danger than Austen allows. If you'd rather have society comedy with a sharper edge, Edith Wharton's <b>The Buccaneers</b><sup data-cite='buccaneers'></sup> sends American heiresses into the English aristocracy. Both are in the catalogue.",
  },
  {
    text: "ابدأ بكتاب <b>«مدخل إلى الفلسفة الإسلامية»</b><sup data-cite='مدخل إلى الفلسفة الإسلامية'></sup> لمصطفى كمال المعاني، فهو مكتوب كمدخل للمبتدئين. وبعده يأتي <b>«التفكير الفلسفي في الإسلام»</b><sup data-cite='التفكير الفلسفي في الإسلام'></sup> لعبد الحليم محمود ليعمّق الصورة. كلاهما متوفر في مكتبة الجامعة.",
    rtl: true,
  },
  {
    text: "The standard is <b>Introduction to Algorithms</b><sup data-cite='introduction to algorithms'></sup> by Cormen et al. The library holds several editions. It's thorough rather than gentle, so read it alongside practice. If your interest leans toward data science, <b>Mathematics and Programming for Machine Learning with R</b><sup data-cite='mathematics and programming'></sup> builds the maths from the ground up.",
  },
  {
    text: "للتاريخ الشامل اقرأ <b>Palestine: A Four Thousand Year History</b><sup data-cite='four thousand year'></sup> لنور مصالحة. ولو أردت التاريخ كما ترويه الرواية، فإن <b>Mornings in Jenin</b><sup data-cite='mornings in jenin'></sup> لسوزان أبو الهوى من أهم الروايات الفلسطينية الحديثة، وكلاهما في المجموعة.",
    rtl: true,
  },
];

export async function initLibrary(root) {
  const $ = (s) => root.querySelector(s);
  const status = $("#seek-status");

  /* tabs */
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const selectTab = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => selectTab(t));
    t.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      const n = tabs[(i + d + tabs.length) % tabs.length];
      selectTab(n); n.focus();
    });
  });

  /* data */
  let books, presets, emb, dim, absa;
  try {
    const [meta, bin, ab] = await Promise.all([
      fetch("data/library-books.json").then((r) => r.json()),
      fetch("data/library-emb.i8").then((r) => r.arrayBuffer()),
      fetch("data/library-absa.json").then((r) => r.json()),
    ]);
    ({ books, presets, dim } = meta);
    emb = new Int8Array(bin);
    absa = ab;
  } catch (e) {
    status.innerHTML = '<span class="err">The catalogue could not be loaded. Open the site through a web server (or GitHub Pages), not as a local file.</span>';
    return;
  }

  function rank(qv, k = 6) {
    const scores = new Float32Array(books.length);
    let qn = 0;
    for (let j = 0; j < dim; j++) qn += qv[j] * qv[j];
    qn = Math.sqrt(qn);
    for (let i = 0; i < books.length; i++) {
      let s = 0, n = 0;
      const o = i * dim;
      for (let j = 0; j < dim; j++) { const v = emb[o + j]; s += v * qv[j]; n += v * v; }
      scores[i] = s / (Math.sqrt(n) * qn);
    }
    const idx = [...scores.keys()].sort((a, b) => scores[b] - scores[a]);
    // the catalogue holds several copies/editions of some titles: show each title once
    const seen = new Set(), out = [];
    for (const i of idx) {
      const key = books[i].t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ b: books[i], s: scores[i] });
      if (out.length === k) break;
    }
    return out;
  }

  /* ───── search ───── */
  const results = $("#seek-results");
  const input = $("#seek-input");
  const presetBox = $("#seek-presets");
  const searchPresets = presets.slice(0, 8);
  const chatPresets = presets.slice(8);

  function renderResults(list) {
    const max = list[0]?.s || 1;
    results.innerHTML = list.map(({ b, s }, i) => {
      const rtlT = isArabic(b.t), rtlD = isArabic(b.d);
      return `<li class="result" style="animation-delay:${i * 60}ms">
        <span class="result__rank" aria-hidden="true">${arNum(i + 1)}</span>
        <div>
          <h5 class="result__title" dir="${rtlT ? "rtl" : "ltr"}">${esc(b.t)}</h5>
          <p class="result__meta">${esc(b.a || "Unknown author")} · ${esc(b.c)}${b.y ? " · " + b.y : ""} · ${b.l === "ar" ? "Arabic" : "English"}</p>
          ${b.d ? `<p class="result__desc" dir="${rtlD ? "rtl" : "ltr"}">${esc(b.d)}</p>` : ""}
          <span class="score" title="cosine similarity">${s.toFixed(2)}<i style="--w:${Math.max(6, (s / max) * 100)}%"></i></span>
        </div></li>`;
    }).join("");
  }

  function runPreset(i, btn) {
    presetBox.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    input.value = searchPresets[i].q;
    const t0 = performance.now();
    const list = rank(searchPresets[i].v);
    status.textContent = `Compared against ${books.length.toLocaleString()} books in ${(performance.now() - t0).toFixed(0)} ms.`;
    renderResults(list);
  }

  searchPresets.forEach((p, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = p.q;
    if (isArabic(p.q)) { b.lang = "ar"; b.dir = "rtl"; }
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => runPreset(i, b));
    presetBox.appendChild(b);
  });
  runPreset(6, presetBox.children[6]);

  // free text: load the real model in the browser, on request only
  let extractor = null, loading = null;
  async function loadModel() {
    if (extractor) return extractor;
    if (!loading) {
      loading = (async () => {
        const { pipeline, env } = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2");
        env.allowLocalModels = false;
        return pipeline("feature-extraction", "Xenova/paraphrase-multilingual-MiniLM-L12-v2", {
          dtype: "q8",
          progress_callback: (e) => {
            if (e.status === "progress" && e.file?.endsWith(".onnx")) status.textContent = `Downloading the model… ${Math.round(e.progress)}%`;
          },
        });
      })();
    }
    extractor = await loading;
    return extractor;
  }

  $("#seek-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    const pre = searchPresets.findIndex((p) => p.q === q);
    if (pre >= 0) return runPreset(pre, presetBox.children[pre]);
    presetBox.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
    if (!extractor) {
      status.innerHTML = `Your own queries need the embedding model in your browser (about 120&nbsp;MB, downloaded once and then cached). <button type="button" id="load-model">Load it and search</button>`;
      $("#load-model").addEventListener("click", () => searchFree(q), { once: true });
      return;
    }
    searchFree(q);
  });

  async function searchFree(q) {
    try {
      status.textContent = extractor ? "Embedding your query…" : "Preparing the model…";
      const model = await loadModel();
      const t0 = performance.now();
      const out = await model(q, { pooling: "mean", normalize: true });
      const v = Array.from(out.data, (x) => x * 127);
      renderResults(rank(v));
      status.textContent = `Embedded and compared against ${books.length.toLocaleString()} books in ${(performance.now() - t0).toFixed(0)} ms, all in your browser.`;
    } catch (err) {
      console.error(err);
      loading = null;
      status.innerHTML = '<span class="err">The model could not be loaded here. Try the example queries above.</span>';
    }
  }

  /* ───── ABSA ───── */
  const shelf = $("#absa-shelf");
  const view = $("#absa-view");
  const shelfColors = ["#13224f", "#5a1a12", "#1d4d4a", "#3b2a14", "#2b2f6b"];
  $("#absa-note").innerHTML = `These are the real outputs of the project's two-stage pipeline, cached by the app. Aspect extractor <code>${esc(absa.models.aspect)}</code> (micro-F1 ${absa.models.aspect_f1_micro}); sentiment classifier <code>${esc(absa.models.sentiment)}</code> (accuracy ${absa.models.sentiment_acc}, macro-F1 ${absa.models.sentiment_f1_macro}). Reviews in other languages are machine-translated to Arabic before classification.`;

  function showBook(bk, btn) {
    shelf.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    const rows = Object.entries(bk.aspects).filter(([id]) => ASPECT_EN[id]).slice(0, 7);
    const legend = SENTS.slice().reverse().map((s) => `<span class="s-${s}">${s}</span>`).join("");
    const bars = rows.map(([id, counts]) => {
      const total = SENTS.reduce((a, s) => a + (counts[s] || 0), 0);
      const segs = ["positive", "neutral", "mixed", "negative"]
        .filter((s) => counts[s])
        .map((s) => `<i class="s-${s}" data-w="${(counts[s] / total) * 100}" title="${counts[s]} ${s}"></i>`).join("");
      return `<div class="asp-row"><span class="asp-label">${ASPECT_EN[id]}<span lang="ar">${esc(absa.labels[id])}</span></span>
        <span class="asp-bar" role="img" aria-label="${ASPECT_EN[id]}: ${SENTS.map((s) => `${counts[s] || 0} ${s}`).join(", ")}">${segs}</span><span class="asp-n">${total}</span></div>`;
    }).join("");
    const quotes = bk.samples.length ? bk.samples.map((s, i) => {
      const rtl = isArabic(s.raw);
      return `<blockquote class="quote" style="animation-delay:${i * 90}ms">
        <p dir="${rtl ? "rtl" : "ltr"}">“${esc(s.raw)}”</p>
        ${s.ar ? `<details><summary>What the model read (Arabic translation)</summary><p dir="rtl" lang="ar">${esc(s.ar)}</p></details>` : ""}
        <div class="tags">${s.aspects.map((a) => `<span class="tag s-${a.s}">${ASPECT_EN[a.id] || a.id} · ${a.s}<small>${Math.round(a.p * 100)}%</small></span>`).join("")}</div>
      </blockquote>`;
    }).join("") : `<p class="desk__note" style="border:0;margin:0">No review for this book cleared the confidence bar for display, but the aggregate on the left still counts every prediction.</p>`;
    view.innerHTML = `<div><h4>${bk.n} reviews · what readers talk about</h4><div class="legend">${legend}</div>${bars}</div>
      <div><h4>Sample reviews · model output</h4>${quotes}</div>`;
    requestAnimationFrame(() => view.querySelectorAll(".asp-bar i").forEach((i) => (i.style.width = i.dataset.w + "%")));
  }

  absa.books.forEach((bk, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "spine";
    b.style.setProperty("--c", shelfColors[i % shelfColors.length]);
    b.style.minHeight = `${58 + ((i * 17) % 34)}px`;
    b.textContent = bk.t.length > 42 ? bk.t.slice(0, 40) + "…" : bk.t;
    if (isArabic(bk.t)) { b.lang = "ar"; b.dir = "rtl"; }
    b.title = `${bk.t}: ${bk.n} reviews`;
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => showBook(bk, b));
    shelf.appendChild(b);
  });
  showBook(absa.books[0], shelf.children[0]);

  /* ───── RAG trace ───── */
  const chatBox = $("#chat-presets");
  const trace = $("#chat-trace");
  let runId = 0;

  async function ask(i, btn) {
    const id = ++runId;
    chatBox.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    const p = chatPresets[i], ans = ANSWERS[i];
    const rtl = isArabic(p.q);
    const step = (n, label, body) => `<div class="step"><div class="step__dot"><b>${arNum(n)}</b></div><div class="step__body"><p class="step__label">${label}</p>${body}</div></div>`;
    trace.innerHTML = step(1, "The question", `<p class="step__q" dir="${rtl ? "rtl" : "ltr"}">${esc(p.q)}</p>`);
    await sleep(650); if (id !== runId) return;

    const bars = p.v.map((x) => `<i class="${x >= 0 ? "s-positive" : "s-negative"}" style="--h:${Math.min(100, Math.max(6, (Math.abs(x) / 127) * 340))}%"></i>`).join("");
    trace.insertAdjacentHTML("beforeend", step(2, "Embedded into 384 dimensions", `<div class="vec" aria-hidden="true">${bars}</div><p class="vec-cap">The real query vector from <code>paraphrase-multilingual-MiniLM-L12-v2</code>. Each bar is one dimension.</p>`));
    await sleep(900); if (id !== runId) return;

    const hits = rank(p.v, 4);
    trace.insertAdjacentHTML("beforeend", step(3, `Retrieved from ${books.length.toLocaleString()} books`, `<ol class="hits">${hits.map(({ b, s }, k) => `
      <li class="hit" style="animation-delay:${k * 110}ms"><span class="hit__n">${rtl ? arNum(k + 1) : k + 1}</span>
      <span class="hit__t" dir="${isArabic(b.t) ? "rtl" : "ltr"}">${esc(b.t)}<small>${esc(b.a || "")} · ${esc(b.c)}</small></span><span class="hit__s">${s.toFixed(2)}</span></li>`).join("")}</ol>`));
    await sleep(1200); if (id !== runId) return;

    trace.insertAdjacentHTML("beforeend", step(4, "Grounded answer", `<p class="answer caret" dir="${ans.rtl ? "rtl" : "ltr"}"></p>`));
    const out = trace.querySelector(".answer");
    // number each citation by the position of that book in the retrieved list
    const text = ans.text.replace(/<sup data-cite='([^']+)'><\/sup>/g, (_, key) => {
      const k = hits.findIndex(({ b }) => b.t.toLowerCase().includes(key));
      return k < 0 ? "" : `<sup>[${rtl ? arNum(k + 1) : k + 1}]</sup>`;
    });
    // type out the answer, keeping inline tags intact
    const parts = text.split(/(<[^>]+>)/);
    let html = "";
    for (const part of parts) {
      if (part.startsWith("<")) { html += part; continue; }
      for (let c = 0; c < part.length; c += 3) {
        if (id !== runId) return;
        out.innerHTML = html + part.slice(0, c + 3);
        await sleep(16);
      }
      html += part;
    }
    out.innerHTML = html;
    out.classList.remove("caret");
  }

  chatPresets.forEach((p, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = p.q;
    if (isArabic(p.q)) { b.lang = "ar"; b.dir = "rtl"; }
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => ask(i, b));
    chatBox.appendChild(b);
  });
  // start the first trace when the tab is opened the first time
  document.getElementById("tab-chat").addEventListener("click", () => { if (!trace.childElementCount) ask(0, chatBox.children[0]); });
}
