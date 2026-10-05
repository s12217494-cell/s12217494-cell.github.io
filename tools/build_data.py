"""
Build the static data files the portfolio's in-browser demos read.

  data/library-books.json   catalog metadata (2,197 books) + preset queries
  data/library-emb.i8       int8-quantized real book embeddings (N x 384)
  data/library-absa.json    real MARBERT + CAMeLBERT outputs aggregated per book
  data/jobmarket.json       subset of the Palestine job market report

Run with the library project's venv (it has torch + transformers):
    .venv\\Scripts\\python portfolio\\tools\\build_data.py
"""
from __future__ import annotations

import collections
import json
import sqlite3
import sys
from pathlib import Path

import numpy as np

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "portfolio" / "data"
DB = ROOT / "chroma_db" / "library.db"
JOB_REPORT = Path(r"C:\Users\Msys\Desktop\berzeit_project\data\report_all.json")
MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

CATEGORY_EN = {
    "روايات": "Fiction",
    "إسلام": "Islamic Studies",
    "فلسفة": "Philosophy",
    "تاريخ": "History",
    "البرمجة وعلم الحاسوب": "Programming & CS",
    "علم النفس": "Psychology",
    "اقتصاد": "Economics",
    "علم الاجتماع": "Sociology",
}

PRESET_QUERIES = [
    "a love story in English high society",
    "كتب عن الفلسفة اليونانية",
    "learning to write computer programs",
    "تاريخ الدولة العثمانية",
    "understanding the human mind and emotions",
    "a dystopian future society",
    "a boy wizard at a school of magic",
    "why some nations grow rich",
]

CHAT_QUESTIONS = [
    "Recommend a classic novel about love and social class",
    "أريد كتاباً يشرح الفلسفة الإسلامية للمبتدئين",
    "Is there a good book to start learning algorithms?",
    "كتاب عن تاريخ فلسطين",
]


def embed(texts: list[str]) -> np.ndarray:
    import torch
    from transformers import AutoModel, AutoTokenizer

    tok = AutoTokenizer.from_pretrained(MODEL)
    model = AutoModel.from_pretrained(MODEL).eval()
    with torch.no_grad():
        enc = tok(texts, padding=True, truncation=True, max_length=512, return_tensors="pt")
        out = model(**enc).last_hidden_state
        mask = enc["attention_mask"].unsqueeze(-1).float()
        vec = (out * mask).sum(1) / mask.sum(1)
        vec = torch.nn.functional.normalize(vec, dim=1)
    return vec.numpy()


def build_document(b: dict) -> str:
    """Same composition as scripts/data/rebuild_embeddings.py."""
    parts = []
    for label, key in (("العنوان", "title"), ("المؤلف", "author"), ("التصنيف", "main_category")):
        if (b.get(key) or "").strip():
            parts.append(f"{label}: {b[key].strip()}")
    sub = (b.get("sub_category") or "").strip()
    if sub and sub != (b.get("main_category") or "").strip():
        parts.append(f"الموضوع: {sub}")
    desc = (b.get("description") or "").strip() or (b.get("goodreads_description") or "").strip()
    if desc:
        parts.append(desc[:1800])
    return "\n".join(parts)


def short(text: str | None, n: int) -> str:
    t = " ".join((text or "").split())
    return t if len(t) <= n else t[: n - 1].rsplit(" ", 1)[0] + "…"


def build_library() -> None:
    ids = json.loads((ROOT / "chroma_db" / "embedding_ids.json").read_text(encoding="utf-8"))
    emb = np.fromfile(ROOT / "chroma_db" / "embeddings.bin", dtype=np.float32).reshape(-1, ids["dim"])

    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    rows = {str(r["book_id"]): dict(r) for r in con.execute("SELECT * FROM books")}

    books = []
    for bid in ids["ids"]:
        b = rows[bid]
        books.append({
            "id": int(bid),
            "t": short(b["title"], 90),
            "a": short(b["author"], 50),
            "c": CATEGORY_EN.get(b["main_category"], b["main_category"]),
            "l": b["language"],
            "y": b["publication_year"],
            "r": round(b["average_rating"], 2) if b["average_rating"] else None,
            "d": short(b["description"] or b["goodreads_description"], 170),
        })

    # Sanity check: re-embedding a stored book must land on its stored vector.
    probe = [0, 1, 2, len(books) // 3, len(books) // 2]
    check = embed([build_document(rows[ids["ids"][i]]) for i in probe])
    sims = [float(check[k] @ emb[i]) for k, i in enumerate(probe)]
    print("re-embed cosine vs stored:", [round(s, 4) for s in sims])
    # Some descriptions were rewritten after the April embedding build, so not
    # every book matches; an exact match on any probe confirms the same space.
    assert max(sims) > 0.99, "query embeddings are not in the stored vector space"

    q = embed(PRESET_QUERIES + CHAT_QUESTIONS)
    presets = []
    for text, v in zip(PRESET_QUERIES + CHAT_QUESTIONS, q):
        presets.append({"q": text, "v": np.round(v * 127).astype(np.int8).tolist()})
        top = np.argsort(-(emb @ v))[:3]
        print(f"  {text!r}: " + " | ".join(books[i]["t"][:40] for i in top))

    # int8 quantization of unit vectors; cosine ranking is preserved closely.
    (OUT / "library-emb.i8").write_bytes(np.round(emb * 127).clip(-127, 127).astype(np.int8).tobytes())
    (OUT / "library-books.json").write_text(
        json.dumps({"dim": ids["dim"], "books": books, "presets": presets}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    # ABSA: real model outputs cached by the app (aspect + argmax sentiment).
    taxonomy = json.loads((ROOT / "data" / "absa" / "aspect_taxonomy.json").read_text(encoding="utf-8"))
    best = json.loads((ROOT / "data" / "absa" / "best_models.json").read_text(encoding="utf-8"))
    picks = [169172, 213847, 130521, 209594, 251]
    out_books = []
    for bid in picks:
        b = rows[str(bid)]
        agg: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
        candidates = []
        n_reviews = 0
        for r in con.execute(
            """SELECT a.aspects_json, r.raw_text, r.arabic_text, r.raw_language, r.rating
               FROM absa_cache a JOIN reviews_live r ON r.id = a.review_id
               WHERE a.book_id = ?""",
            (bid,),
        ):
            n_reviews += 1
            aspects = json.loads(r["aspects_json"] or "[]")
            for a in aspects:
                agg[a["id"]][a["sentiment"]] += 1
            raw = " ".join((r["raw_text"] or "").split())
            # Only show confident predictions; p≈0.4 rows are the classifier's fallback.
            confident = aspects and all(a["sentiment_probs"][a["sentiment"]] >= 0.7 for a in aspects)
            if confident and 60 < len(raw) < 330 and r["raw_language"] in ("ar", "en"):
                candidates.append({
                    "raw": raw,
                    "ar": short(r["arabic_text"], 330) if r["raw_language"] != "ar" else None,
                    "aspects": [{"id": a["id"], "s": a["sentiment"], "p": round(a["sentiment_probs"][a["sentiment"]], 2)} for a in aspects],
                })
        # Prefer a spread of sentiments and multi-aspect reviews.
        samples, seen = [], set()
        for c in sorted(candidates, key=lambda c: -len(c["aspects"])):
            key = c["aspects"][0]["s"]
            if key not in seen or len(c["aspects"]) > 1:
                samples.append(c)
                seen.add(key)
            if len(samples) == 3:
                break
        out_books.append({
            "id": bid,
            "t": b["title"],
            "a": short(b["author"], 50),
            "c": CATEGORY_EN.get(b["main_category"], b["main_category"]),
            "n": n_reviews,
            "aspects": {k: dict(v) for k, v in sorted(agg.items(), key=lambda kv: -sum(kv[1].values()))},
            "samples": samples,
        })
        print(f"  absa {b['title'][:40]}: {n_reviews} reviews, {len(agg)} aspects, {len(samples)} samples")

    (OUT / "library-absa.json").write_text(json.dumps({
        "labels": {a["id"]: a["label_ar"] for a in taxonomy["aspects"]},
        "models": {
            "aspect": best["aspect_extractor"]["model_name"],
            "aspect_f1_micro": round(best["aspect_extractor"]["metrics"]["f1_micro"], 3),
            "sentiment": best["sentiment_classifier"]["model_name"],
            "sentiment_acc": round(best["sentiment_classifier"]["metrics"]["accuracy"], 3),
            "sentiment_f1_macro": round(best["sentiment_classifier"]["metrics"]["f1_macro"], 3),
        },
        "books": out_books,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def build_jobmarket() -> None:
    d = json.loads(JOB_REPORT.read_text(encoding="utf-8"))
    kinds = d["skills"]["by_kind"]
    out = {
        "summary": d["summary"],
        "quality": d["quality"],
        "months": d["demand"]["months"],
        "regions": {k: {"jobs": v["jobs"], "share": v["share"], "english": v["english_postings"], "intl": v["international_employers"]} for k, v in d["regions"].items()},
        "skills": {k: [{"n": s["name"], "ar": s["name_ar"], "s": s["share"]} for s in kinds[k][:8]] for k in ("hard", "tool", "soft")},
        "differentiators": [{"n": s["name"], "s": s["preferred_share"], "jobs": s["jobs"]} for s in d["skills"]["differentiators"][:8]],
        "categories": d["years"]["categories"][:8],
        "years": [r["year"] for r in d["years"]["rows"]],
        "salary": {k: d["salaries"][k] for k in ("n", "median", "p25", "p75")},
    }
    (OUT / "jobmarket.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    build_jobmarket()
    build_library()
    for p in sorted(OUT.iterdir()):
        print(f"{p.name:24s} {p.stat().st_size / 1024:8.1f} KB")
