// The hero: a gilded tome that opens as you scroll and ends on a clickable table of contents.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const PI = Math.PI;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// book dimensions (world units)
const W = 3, H = 4.1, T = 0.55;          // page block
const WB = 3.16, HB = 4.3, TB = 0.07;     // boards
const HINGE = 0.04;

const INK = "#2a1d12", INK_SOFT = "#6a543a", VERMILION = "#a8402a", PARCH = "#f2e7cd";

export const CHAPTERS = [
  { id: "scholar", n: "I", en: "The Scholar", page: "1" },
  { id: "works", n: "II", en: "The Works", page: "7" },
  { id: "path", n: "III", en: "The Path", page: "41" },
  { id: "astrolabe", n: "IV", en: "The Astrolabe", page: "48" },
  { id: "scrolls", n: "V", en: "Scrolls & Licences", page: "55" },
  { id: "letter", n: "VI", en: "Correspondence", page: "62" },
];

/* ───────────── canvas painting ───────────── */
function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")];
}

function starPath(ctx, cx, cy, R, rot = 0, ri = R * 0.7654) {
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? ri : R;
    const a = rot + (i * PI) / 8 - PI / 2;
    ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
}

function ring(ctx, cx, cy, r) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, PI * 2); }

function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

function speckle(ctx, w, h, n, seed, light = "255,255,255", dark = "0,0,0", a = 0.05) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = `rgba(${r() > 0.5 ? light : dark},${r() * a})`;
    const s = 1 + r() * 3;
    ctx.fillRect(r() * w, r() * h, s, s);
  }
}

function goldGradient(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#8c6a28"); g.addColorStop(0.3, "#f0d48d"); g.addColorStop(0.5, "#c9a24b");
  g.addColorStop(0.7, "#f6e3a8"); g.addColorStop(1, "#8c6a28");
  return g;
}

/** Cover art. mode "color" paints the albedo; "mask" paints gold areas white on black
 *  (used as metalness, roughness and bump maps so the tooling catches the light). */
function paintCover(ctx, w, h, mode) {
  const color = mode === "color";
  if (color) {
    const bg = ctx.createRadialGradient(w * 0.45, h * 0.4, 50, w / 2, h / 2, h * 0.75);
    bg.addColorStop(0, "#1f3470"); bg.addColorStop(0.6, "#13224f"); bg.addColorStop(1, "#0a1330");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 14000, 7, "180,200,255", "0,0,10", 0.08);
  } else {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
  }
  const gold = color ? goldGradient(ctx, w, h) : "#fff";
  ctx.strokeStyle = gold; ctx.fillStyle = gold;
  const cx = w / 2, cy = h * 0.46;

  // frames
  ctx.lineWidth = 7; ctx.strokeRect(46, 46, w - 92, h - 92);
  ctx.lineWidth = 2.5; ctx.strokeRect(66, 66, w - 132, h - 132);
  for (let x = 86; x <= w - 86; x += 23) { ring(ctx, x, 86, 3.2); ctx.fill(); ring(ctx, x, h - 86, 3.2); ctx.fill(); }
  for (let y = 109; y <= h - 109; y += 23) { ring(ctx, 86, y, 3.2); ctx.fill(); ring(ctx, w - 86, y, 3.2); ctx.fill(); }
  ctx.lineWidth = 2.5; ctx.strokeRect(106, 106, w - 212, h - 212);

  // corner fleurons
  for (const [x, y] of [[106, 106], [w - 106, 106], [106, h - 106], [w - 106, h - 106]]) {
    ctx.save(); ctx.beginPath(); ctx.rect(106, 106, w - 212, h - 212); ctx.clip();
    ring(ctx, x, y, 120); ctx.lineWidth = 3; ctx.stroke();
    ring(ctx, x, y, 104); ctx.lineWidth = 1.5; ctx.stroke();
    starPath(ctx, x, y, 70, PI / 8); ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }

  // rays from the medallion (girih-like)
  ctx.save(); ctx.beginPath(); ctx.rect(106, 106, w - 212, h - 212); ctx.clip();
  ctx.lineWidth = 2;
  for (let i = 0; i < 16; i++) {
    const a = (i * PI) / 8 - PI / 2;
    const r0 = i % 2 ? 230 : 300;
    ctx.beginPath(); ctx.moveTo(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a));
    ctx.lineTo(cx + 900 * Math.cos(a), cy + 900 * Math.sin(a)); ctx.stroke();
  }
  ctx.restore();

  // central medallion
  if (color) { starPath(ctx, cx, cy, 300); ctx.fillStyle = "#0e1a40"; ctx.fill(); ctx.fillStyle = gold; }
  else { starPath(ctx, cx, cy, 300); ctx.fillStyle = "#000"; ctx.fill(); ctx.fillStyle = gold; }
  ctx.lineWidth = 7; starPath(ctx, cx, cy, 300); ctx.stroke();
  ctx.lineWidth = 2; starPath(ctx, cx, cy, 276); ctx.stroke();
  ctx.lineWidth = 4; ring(ctx, cx, cy, 196); ctx.stroke();
  ctx.lineWidth = 1.5; ring(ctx, cx, cy, 182); ctx.stroke();
  for (let i = 0; i < 48; i++) {
    const a = (i * PI) / 24;
    ring(ctx, cx + 189 * Math.cos(a), cy + 189 * Math.sin(a), 2.6); ctx.fill();
  }
  ctx.lineWidth = 2; starPath(ctx, cx, cy, 160, PI / 8); ctx.stroke();

  // pendants
  for (const s of [-1, 1]) {
    const py = cy + s * 372;
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy + s * 300); ctx.lineTo(cx, py - s * 30); ctx.stroke();
    starPath(ctx, cx, py, 30); ctx.fill();
  }

  // calligraphy
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = '700 150px "Cormorant Garamond", Georgia, serif';
  ctx.fillText("AM", cx, cy + 4);

  // name plate
  ctx.font = '600 44px "Cormorant Garamond", Georgia, serif';
  if ("letterSpacing" in ctx) ctx.letterSpacing = "10px";
  ctx.fillText("ABDALRAHMAN MAHMOUD", cx, h - 196);
  ctx.font = '600 24px "Cormorant Garamond", Georgia, serif';
  if ("letterSpacing" in ctx) ctx.letterSpacing = "8px";
  ctx.fillText("DATA · INSIGHT · AUTOMATION", cx, h - 150);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
}

function paintSpine(ctx, w, h, mode) {
  const color = mode === "color";
  ctx.fillStyle = color ? "#13224f" : "#000"; ctx.fillRect(0, 0, w, h);
  if (color) speckle(ctx, w, h, 2500, 3, "180,200,255", "0,0,10", 0.08);
  ctx.fillStyle = color ? goldGradient(ctx, w, h) : "#fff";
  for (const y of [0.08, 0.22, 0.78, 0.92]) ctx.fillRect(0, h * y - 5, w, 10);
  for (const y of [0.15, 0.85]) { starPath(ctx, w / 2, h * y, w * 0.28); ctx.fill(); }
}

function parchment(ctx, w, h, seed) {
  const g = ctx.createRadialGradient(w * 0.4, h * 0.35, 40, w / 2, h / 2, h * 0.8);
  g.addColorStop(0, "#f7eed8"); g.addColorStop(0.7, PARCH); g.addColorStop(1, "#dcc79c");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, 7000, seed, "255,255,240", "120,80,30", 0.06);
}

function pageFrame(ctx, w, h) {
  ctx.strokeStyle = "#b0892f"; ctx.lineWidth = 4; ctx.strokeRect(70, 70, w - 140, h - 140);
  ctx.strokeStyle = VERMILION; ctx.lineWidth = 1.5; ctx.strokeRect(84, 84, w - 168, h - 168);
}

function divider(ctx, cx, y, half) {
  ctx.strokeStyle = "#b0892f"; ctx.fillStyle = "#b0892f"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - half, y); ctx.lineTo(cx - 28, y); ctx.moveTo(cx + 28, y); ctx.lineTo(cx + half, y); ctx.stroke();
  starPath(ctx, cx, y, 18); ctx.fill();
}

function paintTitlePage(ctx, w, h) {
  parchment(ctx, w, h, 11); pageFrame(ctx, w, h);
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK_SOFT; ctx.font = 'italic 500 40px "Cormorant Garamond", Georgia, serif';
  ctx.fillText("The Book of Data of", w / 2, 330);
  ctx.fillStyle = INK; ctx.font = '600 118px "Cormorant Garamond", Georgia, serif';
  ctx.fillText("Abdalrahman", w / 2, 480);
  ctx.fillText("Mahmoud", w / 2, 600);
  divider(ctx, w / 2, 680, 220);
  ctx.fillStyle = VERMILION; ctx.font = '700 46px "Cormorant Garamond", Georgia, serif';
  if ("letterSpacing" in ctx) ctx.letterSpacing = "8px";
  ctx.fillText("DATA ANALYST", w / 2, 800);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  ctx.fillStyle = INK; ctx.font = 'italic 500 40px "Cormorant Garamond", Georgia, serif';
  ctx.fillText("Data Analysis · Power BI · AI Automation", w / 2, 900);
  ctx.fillStyle = INK_SOFT; ctx.font = '600 28px "Cormorant Garamond", Georgia, serif';
  if ("letterSpacing" in ctx) ctx.letterSpacing = "6px";
  ctx.fillText("NABLUS · PALESTINE · 2026", w / 2, h - 170);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
}

function wrap(ctx, text, x, y, maxW, lh) {
  let line = "";
  for (const word of text.split(" ")) {
    const t = line ? line + " " + word : word;
    if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y); y += lh; line = word; }
    else line = t;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lh;
}

function paintScribbles(ctx, w, h, seed) {
  parchment(ctx, w, h, seed); pageFrame(ctx, w, h);
  const r = rng(seed);
  ctx.fillStyle = "rgba(42,29,18,.28)";
  for (let y = 200; y < h - 160; y += 44) {
    const len = y > h - 260 ? 0.4 + r() * 0.3 : 0.86 + r() * 0.1;
    ctx.fillRect(140, y, (w - 280) * len, 9);
  }
}

function paintPreface(ctx, w, h) {
  parchment(ctx, w, h, 23); pageFrame(ctx, w, h);
  ctx.textAlign = "center"; ctx.fillStyle = VERMILION; ctx.font = 'italic 600 70px "Cormorant Garamond", Georgia, serif';
  ctx.fillText("Preface", w / 2, 235);
  ctx.textAlign = "left"; ctx.fillStyle = INK; ctx.font = '500 40px "EB Garamond", Georgia, serif';
  const p1 = "From raw, unclean data to validated reports with KPIs and dashboards: that is the craft practised in these pages.";
  const p2 = "Some chapters are spreadsheets and Power BI. Others are search engines, sentiment models and language models that answer from real sources.";
  let y = wrap(ctx, p1, 140, 340, w - 280, 54);
  wrap(ctx, p2, 140, y + 30, w - 280, 54);
  divider(ctx, w / 2, h - 210, 160);
}

function paintShamsa(ctx, w, h) {
  parchment(ctx, w, h, 31); pageFrame(ctx, w, h);
  const cx = w / 2, cy = h / 2;
  // sunburst
  for (let i = 0; i < 48; i++) {
    const a = (i * PI) / 24;
    const r1 = i % 2 ? 330 : 390;
    ctx.beginPath();
    ctx.moveTo(cx + 250 * Math.cos(a - 0.05), cy + 250 * Math.sin(a - 0.05));
    ctx.lineTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
    ctx.lineTo(cx + 250 * Math.cos(a + 0.05), cy + 250 * Math.sin(a + 0.05));
    ctx.fillStyle = i % 2 ? "#1f3a7a" : "#b0892f"; ctx.fill();
  }
  ring(ctx, cx, cy, 262); ctx.fillStyle = "#b0892f"; ctx.fill();
  ring(ctx, cx, cy, 250); ctx.fillStyle = "#13224f"; ctx.fill();
  ctx.strokeStyle = "#d9b862"; ctx.lineWidth = 3;
  starPath(ctx, cx, cy, 236); ctx.stroke();
  ring(ctx, cx, cy, 170); ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "#e9c873"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = '700 150px "Cormorant Garamond", Georgia, serif';
  ctx.fillText("AM", cx, cy - 6);
  ctx.font = '600 26px "Cormorant Garamond", Georgia, serif';
  if ("letterSpacing" in ctx) ctx.letterSpacing = "6px";
  ctx.fillText("EX LIBRIS", cx, cy + 92);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  ctx.textBaseline = "alphabetic";
}

function paintDoublure(ctx, w, h) {
  ctx.fillStyle = "#5a1a12"; ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, 6000, 41, "255,200,160", "20,0,0", 0.07);
  ctx.strokeStyle = "rgba(217,184,98,.55)"; ctx.lineWidth = 2;
  for (let y = 0; y <= h + 80; y += 96) for (let x = (y / 96) % 2 ? 48 : 0; x <= w + 80; x += 96) { starPath(ctx, x, y, 30); ctx.stroke(); }
  ctx.strokeStyle = "#d9b862"; ctx.lineWidth = 6; ctx.strokeRect(36, 36, w - 72, h - 72);
}

function paintContents(ctx, w, h, hover) {
  parchment(ctx, w, h, 53); pageFrame(ctx, w, h);
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = VERMILION; ctx.font = 'italic 600 96px "Cormorant Garamond", Georgia, serif';
  ctx.fillText("Contents", w / 2, 250);
  ctx.fillStyle = INK_SOFT; ctx.font = '700 26px "Cormorant Garamond", Georgia, serif';
  if ("letterSpacing" in ctx) ctx.letterSpacing = "10px";
  ctx.fillText("THE BOOK OF DATA", w / 2, 310);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  const rows = [];
  const top = 400, step = 142;
  CHAPTERS.forEach((c, i) => {
    const y = top + i * step;
    const y0 = y - 20, y1 = y + step - 20;
    if (hover === i) { ctx.fillStyle = "rgba(176,67,42,.1)"; ctx.fillRect(110, y0, w - 220, step - 8); }
    ctx.textAlign = "left";
    ctx.fillStyle = VERMILION; ctx.font = '700 46px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(c.n, 140, y + 70);
    ctx.fillStyle = INK; ctx.font = '700 54px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(c.en, 240, y + 70);
    const tw = ctx.measureText(c.en).width;
    ctx.textAlign = "right"; ctx.fillStyle = "#4a3824"; ctx.font = 'italic 600 44px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(c.page, w - 140, y + 70);
    const aw = ctx.measureText(c.page).width;
    ctx.fillStyle = "rgba(91,70,48,.55)";
    for (let x = 240 + tw + 22; x < w - 140 - aw - 20; x += 16) { ring(ctx, x, y + 62, 2.2); ctx.fill(); }
    rows.push({ v0: 1 - y1 / h, v1: 1 - y0 / h, id: c.id });
  });
  ctx.textAlign = "center"; ctx.fillStyle = INK_SOFT; ctx.font = 'italic 600 34px "Cormorant Garamond", Georgia, serif';
  ctx.fillText("Touch a chapter to turn to it", w / 2, h - 128);
  return rows;
}

function paintEdges(ctx, w, h, vertical) {
  const g = ctx.createLinearGradient(0, 0, vertical ? w : 0, vertical ? 0 : h);
  g.addColorStop(0, "#b8913c"); g.addColorStop(0.5, "#f0d48d"); g.addColorStop(1, "#a07a2e");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(90,60,20,.35)";
  for (let i = 0; i < (vertical ? w : h); i += 3) vertical ? ctx.fillRect(i, 0, 1, h) : ctx.fillRect(0, i, w, 1);
}

function tex(canvas, srgb = true, aniso = 8) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

/* ───────────── scene ───────────── */
export async function initTome({ canvas, stage, hero, reduceMotion, onNavigate }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return false;
  }

  // canvas text needs the web fonts first (but never wait forever)
  await Promise.race([
    Promise.all([

      document.fonts.load('600 60px "Cormorant Garamond"'), document.fonts.load('italic 500 40px "Cormorant Garamond"'),
      document.fonts.load('500 40px "EB Garamond"'), document.fonts.load('700 54px "Cormorant Garamond"'),
    ]),
    new Promise((r) => setTimeout(r, 2500)),
  ]);

  const small = Math.min(innerWidth, innerHeight) < 700;
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  // lights: warm candle key, cool rim
  scene.add(new THREE.HemisphereLight(0x5a6fb0, 0x1a1008, 0.5));
  const key = new THREE.DirectionalLight(0xffdcaa, 1.7);
  key.position.set(-4, 5, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
  key.shadow.bias = -0.0008;
  scene.add(key);
  const candle = new THREE.PointLight(0xffa850, 18, 14, 2);
  candle.position.set(3.5, -1.5, 4);
  scene.add(candle);
  const rim = new THREE.DirectionalLight(0x7f9cff, 1.4);
  rim.position.set(5, 3, -6);
  scene.add(rim);

  // textures
  const CW = 1024, CH = 1400;
  const [coverC, coverX] = makeCanvas(CW, CH); paintCover(coverX, CW, CH, "color");
  const [maskC, maskX] = makeCanvas(CW, CH); paintCover(maskX, CW, CH, "mask");
  const [spineC, spineX] = makeCanvas(128, 1024); paintSpine(spineX, 128, 1024, "color");
  const [spineMC, spineMX] = makeCanvas(128, 1024); paintSpine(spineMX, 128, 1024, "mask");
  const [titleC, titleX] = makeCanvas(CW, CH); paintTitlePage(titleX, CW, CH);
  const [scribC, scribX] = makeCanvas(CW, CH); paintScribbles(scribX, CW, CH, 17);
  const [prefC, prefX] = makeCanvas(CW, CH); paintPreface(prefX, CW, CH);
  const [shamC, shamX] = makeCanvas(CW, CH); paintShamsa(shamX, CW, CH);
  const [doubC, doubX] = makeCanvas(CW, CH); paintDoublure(doubX, CW, CH);
  const [tocC, tocX] = makeCanvas(CW, CH); let tocRows = paintContents(tocX, CW, CH, -1);
  const [edgeVC, edgeVX] = makeCanvas(256, 64); paintEdges(edgeVX, 256, 64, true);
  const [edgeHC, edgeHX] = makeCanvas(64, 256); paintEdges(edgeHX, 64, 256, false);

  const coverMap = tex(coverC, true, aniso), mask = tex(maskC, false, aniso);
  // the gold mask drives metalness and a slight emboss; leather stays non-metallic
  const leather = (map, m) => new THREE.MeshStandardMaterial({
    map, metalnessMap: m, bumpMap: m, bumpScale: 1.6, metalness: 1, roughness: 0.42,
  });
  const coverMat = leather(coverMap, mask);
  const spineMat = leather(tex(spineC, true, aniso), tex(spineMC, false, aniso));
  const plainLeather = new THREE.MeshStandardMaterial({ color: 0x13224f, roughness: 0.7, metalness: 0.1 });
  // a warm tint keeps the parchment from blowing out to white under the key light
  const paper = (c) => new THREE.MeshStandardMaterial({ map: tex(c, true, aniso), color: 0xe9dcc0, roughness: 0.92, metalness: 0 });
  const edgeV = new THREE.MeshStandardMaterial({ map: tex(edgeVC, true, aniso), roughness: 0.4, metalness: 0.75 });
  const edgeH = new THREE.MeshStandardMaterial({ map: tex(edgeHC, true, aniso), roughness: 0.4, metalness: 0.75 });
  const tocMat = paper(tocC);
  const doubMat = paper(doubC);

  // book
  const root = new THREE.Group();
  const book = new THREE.Group();
  root.add(book);
  scene.add(root);
  const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m; };

  // BoxGeometry material order: +x, -x, +y, -y, +z, -z
  const back = mesh(new THREE.BoxGeometry(WB, HB, TB), [plainLeather, plainLeather, plainLeather, plainLeather, plainLeather, coverMat]);
  back.position.set(WB / 2, 0, -T / 2 - TB / 2);
  book.add(back);

  const block = mesh(new THREE.BoxGeometry(W, H, T), [edgeV, edgeV, edgeH, edgeH, tocMat, tocMat]);
  block.position.set(HINGE + W / 2, 0, 0);
  book.add(block);

  // flush with the page block on top so it doesn't stand proud of the open book
  const spine = mesh(new THREE.BoxGeometry(TB, HB, T + TB), [plainLeather, spineMat, plainLeather, plainLeather, plainLeather, plainLeather]);
  spine.position.set(-TB / 2, 0, -TB / 2);
  book.add(spine);

  const frontPivot = new THREE.Group();
  book.add(frontPivot);
  const front = mesh(new THREE.BoxGeometry(WB, HB, TB), [plainLeather, plainLeather, plainLeather, plainLeather, coverMat, doubMat]);
  front.position.set(WB / 2, 0, 0);
  frontPivot.add(front);

  // two loose leaves that turn after the cover
  function leaf(frontCanvas, backCanvas) {
    const pivot = new THREE.Group();
    const g1 = new THREE.PlaneGeometry(W, H); g1.translate(W / 2, 0, 0);
    const g2 = new THREE.PlaneGeometry(W, H); g2.rotateY(PI); g2.translate(W / 2, 0, -0.002);
    const a = mesh(g1, paper(frontCanvas)); const b = mesh(g2, paper(backCanvas));
    pivot.add(a, b);
    pivot.position.x = HINGE;
    book.add(pivot);
    return pivot;
  }
  const leafA = leaf(titleC, scribC);
  const leafB = leaf(prefC, shamC);

  // gold dust
  const N = small ? 160 : 320;
  const dustGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), speed = new Float32Array(N);
  const r = rng(99);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (r() - 0.5) * 16; pos[i * 3 + 1] = (r() - 0.5) * 10; pos[i * 3 + 2] = (r() - 0.5) * 8;
    speed[i] = 0.08 + r() * 0.25;
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const [dotC, dotX] = makeCanvas(64, 64);
  const dg = dotX.createRadialGradient(32, 32, 0, 32, 32, 32);
  dg.addColorStop(0, "rgba(255,236,190,1)"); dg.addColorStop(0.3, "rgba(240,212,141,.55)"); dg.addColorStop(1, "rgba(240,212,141,0)");
  dotX.fillStyle = dg; dotX.fillRect(0, 0, 64, 64);
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: 0.09, map: new THREE.CanvasTexture(dotC), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.8,
  }));
  scene.add(dust);

  /* ───── layout & state ───── */
  let aspect = 1, dist = 12, sideShift = 0, lift = 0;
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const halfH = Math.tan((camera.fov * PI) / 360);
    // the open book (≈6.4 × 4.3) must fit with a margin, whichever side is tighter
    dist = Math.max((HB * 1.5) / (2 * halfH), 7.2 / (2 * halfH * aspect));
    const wide = aspect > 1.15;
    sideShift = wide ? dist * halfH * aspect * 0.42 : 0;  // closed book sits right of the intro text
    lift = wide ? 0 : dist * halfH * 0.32;                // on phones it sits above the text
  }
  resize();
  addEventListener("resize", resize);

  let target = 0, p = 0;
  function readScroll() {
    const rect = hero.getBoundingClientRect();
    const total = hero.offsetHeight - innerHeight;
    target = clamp01(-rect.top / total);
  }
  readScroll();
  addEventListener("scroll", readScroll, { passive: true });

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  stage.addEventListener("pointermove", (e) => {
    const b = stage.getBoundingClientRect();
    mouse.tx = ((e.clientX - b.left) / b.width) * 2 - 1;
    mouse.ty = ((e.clientY - b.top) / b.height) * 2 - 1;
    hoverTest(e);
  });
  stage.addEventListener("pointerleave", () => { mouse.tx = mouse.ty = 0; setHover(-1); });

  // table of contents hit-testing
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hover = -1;
  function pick(e) {
    if (p < 0.8) return -1;
    const b = stage.getBoundingClientRect();
    ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(block, false)[0];
    if (!hit || hit.face.materialIndex !== 4 || !hit.uv) return -1;
    return tocRows.findIndex((row) => hit.uv.y >= row.v0 && hit.uv.y <= row.v1);
  }
  function setHover(i) {
    if (i === hover) return;
    hover = i;
    tocRows = paintContents(tocX, CW, CH, i);
    tocMat.map.needsUpdate = true;
    stage.classList.toggle("is-hover-link", i >= 0);
  }
  function hoverTest(e) { if (e.pointerType === "mouse") setHover(pick(e)); }
  stage.addEventListener("click", (e) => {
    const i = pick(e);
    if (i >= 0) onNavigate(CHAPTERS[i].id);
  });

  /* ───── animation ───── */
  let running = false, raf = 0, last = performance.now();
  const clock0 = performance.now();

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = (now - clock0) / 1000;

    p += (target - p) * (reduceMotion ? 1 : 1 - Math.pow(0.0015, dt));
    stage.style.setProperty("--p", p.toFixed(4));
    mouse.x += (mouse.tx - mouse.x) * 0.06; mouse.y += (mouse.ty - mouse.y) * 0.06;

    const face = smooth(0, 0.22, p);
    const cover = smooth(0.1, 0.42, p);
    const la = smooth(0.42, 0.6, p);
    const lb = smooth(0.58, 0.76, p);
    const zoom = smooth(0.76, 0.96, p);
    const opened = smooth(0.1, 0.35, p);

    // cover and leaves swing over the hinge, then settle on the left stack
    frontPivot.rotation.y = -PI * cover;
    frontPivot.position.z = lerp(T / 2 + TB / 2, -T / 2 - TB / 2, smooth(0.45, 1, cover));
    leafA.rotation.y = -PI * la;
    leafA.position.z = lerp(T / 2 + 0.004, -T / 2 + 0.006, smooth(0.45, 1, la));
    leafB.rotation.y = -PI * lb;
    leafB.position.z = lerp(T / 2 + 0.008, -T / 2 + 0.012, smooth(0.45, 1, lb));

    const idle = reduceMotion ? 0 : (1 - face) * Math.sin(t * 0.6) * 0.06;
    root.rotation.set(
      lerp(-0.32, -0.16, face) + mouse.y * 0.06 * (1 - zoom * 0.5),
      lerp(-0.62, 0, face) + idle + mouse.x * 0.1 * (1 - zoom * 0.5),
      lerp(0.06, 0, face),
    );
    // keep the visual centre: closed book centred on its middle, open book on its hinge
    book.position.x = lerp(-WB / 2, 0, opened);
    root.position.set(lerp(sideShift, 0, face), lerp(lift, 0, face) + (reduceMotion ? 0 : (1 - face) * Math.sin(t * 0.8) * 0.06), 0);

    camera.position.set(0, -0.3, dist * lerp(1, 0.9, zoom));
    camera.lookAt(0, 0, 0);

    candle.intensity = reduceMotion ? 18 : 18 + Math.sin(t * 9) * 1.2 + Math.sin(t * 23.7) * 0.8;

    if (!reduceMotion) {
      const a = dustGeo.attributes.position;
      for (let i = 0; i < N; i++) {
        let y = a.array[i * 3 + 1] + speed[i] * dt * 0.5;
        if (y > 5) y = -5;
        a.array[i * 3 + 1] = y;
        a.array[i * 3] += Math.sin(t * 0.3 + i) * 0.0015;
      }
      a.needsUpdate = true;
    }
    renderer.render(scene, camera);
  }

  const start = () => { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(stage.parentElement);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  start();
  return true;
}
