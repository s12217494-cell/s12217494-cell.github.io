// Entry point: wires up navigation, reveals, ornaments, and lazy-loads the heavier pieces.
import { drawEmblem, drawLibraryPipeline, drawTransmute, drawAstrolabe } from "./ornaments.js";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s) => document.querySelector(s);

/* ───── nav ───── */
const nav = $("#nav");
const hero = $(".hero");
const toggle = $(".nav__toggle");
const list = $("#nav-list");
toggle.addEventListener("click", () => {
  const open = toggle.getAttribute("aria-expanded") !== "true";
  toggle.setAttribute("aria-expanded", open);
  list.classList.toggle("open", open);
});
list.addEventListener("click", (e) => {
  if (e.target.closest("a")) { toggle.setAttribute("aria-expanded", "false"); list.classList.remove("open"); }
});
const onScroll = () => nav.classList.toggle("is-solid", scrollY > hero.offsetHeight - innerHeight * 1.2);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

const links = [...list.querySelectorAll("a")];
const spy = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    links.forEach((a) => a.setAttribute("aria-current", String(a.hash === "#" + e.target.id)));
  }
}, { rootMargin: "-45% 0px -50% 0px" });
document.querySelectorAll("main > section[id]").forEach((s) => spy.observe(s));

/* ───── reveals & counters ───── */
const countUp = (b) => {
  const end = +b.dataset.count;
  if (reduceMotion || end < 10) return;
  const t0 = performance.now(), dur = 1600;
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    b.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))).toLocaleString("en-US");
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
const revealer = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add("in");
    e.target.querySelectorAll("[data-count]").forEach(countUp);
    revealer.unobserve(e.target);
  }
}, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
document.querySelectorAll(".reveal").forEach((n, i) => {
  n.style.transitionDelay = `${(i % 4) * 70}ms`;
  revealer.observe(n);
});

/* ───── ornaments ───── */
drawEmblem($("#emblem"));
drawLibraryPipeline($("#lib-pipeline"));
drawTransmute($("#transmute"), reduceMotion);
drawAstrolabe($("#astro-svg"), $("#astro-legend"), reduceMotion);

/* ───── the tome (Three.js, from CDN) ───── */
const goTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
import("./tome.js")
  .then(({ initTome }) => initTome({ canvas: $("#tome"), stage: $(".hero__stage"), hero, reduceMotion, onNavigate: goTo }))
  .then((ok) => { if (!ok) throw new Error("no webgl"); })
  .catch((err) => {
    console.warn("3D tome unavailable:", err);
    document.documentElement.classList.add("no-webgl");
  });

/* ───── demos load when their section approaches ───── */
const lazy = (selector, load) => {
  const node = $(selector);
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    load(node);
  }, { rootMargin: "600px 0px" });
  io.observe(node);
};
lazy("#desk", (node) => import("./library.js").then((m) => m.initLibrary(node)));
lazy("#job-market", () => import("./jobmarket.js").then((m) => m.initJobMarket()));
