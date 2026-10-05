# Portfolio — Abdalrahman Mahmoud

Static site: plain HTML/CSS/JS, Three.js and fonts from CDNs. No build step.

## Preview locally
    python -m http.server 8000      # run inside this folder, then open http://localhost:8000
(Opening index.html directly won't load the demo data; browsers block fetch() on file://.)

## Publish on GitHub Pages
1. Create a public repo named `s12217494-cell.github.io` on GitHub.
2. Upload the contents of this folder (not the folder itself) to the repo root.
3. Settings → Pages → Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
4. The site goes live at https://s12217494-cell.github.io within a minute or two.

## Regenerating the demo data
`tools/build_data.py` rebuilds `data/` from the library project's database and embeddings
and from the job-market report. Run it with the library project's venv:
    ..\.venv\Scripts\python tools\build_data.py
