---
name: mofa-site
version: 0.1.0
description: "Build or scaffold websites from content using Quarto, Astro, Next.js, or React/Vite. Triggers: mofa site, build website, make a website, 建网站, 做个网站, generate site, mofa web, create website, 生成网页, build lesson site, build docs site, 做个教程网站."
requires_bins: quarto, node
requires_env:
---

# mofa-site

Transforms content, prompts, or extracted reference patterns into website source files.

Current implementation status:
- Fully implemented generation flow: `quarto-lesson`
- Extracted starter templates: `astro-site`, `nextjs-app`, `react-vite`
- Roadmap only: `quarto-notebook`

Use the bundled helpers when you want deterministic scaffolds:

```bash
bash mofa-site/scripts/bootstrap_quarto_lesson.sh \
  --out-dir ./skill-output/calc-site \
  --title "The Essence of Calculus" \
  --description "Interactive lesson notes with video, math, and visualizations."
```

```bash
bash mofa-site/scripts/bootstrap_template.sh \
  --template nextjs-app \
  --out-dir ./skill-output/forum-site \
  --site-name "AI Vision Forum" \
  --description "Static-export Next.js site scaffold with reusable sections."
```

The interactive studio is now server-backed. Start it with:

```bash
node mofa-site/studio/server.js
```

Then open:

```text
http://127.0.0.1:4310/
```

Session launch commands supported by the studio:

```text
/new site learning
/new site astro
/new site nextjs
/new site react
```

They map to:
- `learning` -> `quarto-lesson`
- `astro` -> `astro-site`
- `nextjs` -> `nextjs-app`
- `react` -> `react-vite`

Terminal helper for the same launch grammar:

```bash
bash mofa-site/scripts/new_site_session.sh "/new site nextjs" --format prompt
```

## Output Paths

```
skill-output/mofa-site-<YYYYMMDD-HHMMSS>/
├── docs/                        # Built static site — feed to mofa-publish
├── lessons/                     # Source page files (.qmd)
├── images/                      # Copied from content_dir + any generated
├── styles.css                   # Site styles
├── _quarto.yml                  # Quarto project config
└── site_plan.json               # Generated site plan (for debugging)
```

## Pipeline

```
plan → expand → visualize → assemble → build
```

| Step | What it does | Model |
|------|-------------|-------|
| plan | Read content, plan site structure: pages, sections, navigation, interactive components | strong |
| expand | Transform transcript into polished page content with LaTeX, prose, bilingual | strong |
| visualize | Generate Desmos graph configs, D3.js visualizations, interactive components | strong |
| assemble | Generate site config, CSS, index page, navigation, copy images | strong |
| build | Run `quarto render`, validate output | cheap |

The full five-step pipeline currently applies to `quarto-lesson`. The other templates are deterministic scaffolds exported by `bootstrap_template.sh` or the studio app.

## Onboarding

Required:
- `quarto`

Check before running:

```bash
quarto --version
```

## Templates

### quarto-lesson (implemented)

Best for: educational content, math/science courses, lecture series.

Features:
- Desmos API interactive graphing calculators
- D3.js animated SVG visualizations with slider controls
- LaTeX math (MathJax) for formulas and equations
- YouTube video embeds (responsive 16:9)
- Bilingual support (EN + ZH with navbar switcher)
- Collapsible prerequisite callouts
- Key formula summary boxes

Build: `quarto render` -> `docs/`

Requires: `quarto` CLI

### quarto-notebook (planned)

Best for: computational tutorials, data science notebooks.

Features:
- Observable JS (OJS) executable code cells
- Data tables and charts
- Narrative + code interleaving

Build: `quarto render` -> `docs/`

### astro-site (starter scaffold)

Best for: content-heavy websites, guides, docs, and polished static landing pages.

Features:
- Astro component layout
- Landing-page sections with reusable header, hero, grid, and footer
- Static build output
- Clean CSS variables for theme tuning

Build: `npm run build` -> `dist/`

Requires: `node`, `npm`

Reference pattern source:
- extracted from `/Users/yuechen/home/origin2025`
- cross-checked against `/Users/yuechen/home/adora-website`

### nextjs-app (starter scaffold)

Best for: app-like experiences, interactive dashboards.

Features:
- App Router
- Static export
- Contact/privacy routes and shared layout
- Section-driven components and theme tokens

Build: `npm run build` -> `out/`

Requires: `node`, `npm`

Reference pattern source:
- extracted from `/Users/yuechen/home/ai-vision-forum-paris-2026`

### react-vite (starter scaffold)

Best for: lightweight interactive shells and fast UI iteration.

Features:
- small React entrypoint
- reusable hero/header/feature sections
- CSS-variable-driven tuning

Build: `npm run build` -> `dist/`

Requires: `node`, `npm`

Reference pattern source:
- extracted from component and layout patterns in `/Users/yuechen/home/adora-website` and `/Users/yuechen/home/origin2025`

## Input Contract

Accepts output from `mofa-youtube` or any directory with content files:

```
content_dir/
├── metadata.json          # {title, topics, language, chapters} (optional)
├── transcript.txt         # Main content source (required)
├── transcript_chapters/   # Per-chapter splits (optional → multi-page site)
│   ├── ch01.txt
│   └── ch02.txt
└── images/                # Key frames or illustrations (optional)
    ├── frame-01.png
    └── frame-02.png
```

If `metadata.json` is missing, the LLM infers structure from the transcript.

If `content_dir` contains no transcript, the user's message is used as the topic and the LLM generates content from scratch.

## Composability

```
mofa-youtube ──content pkg──▶ mofa-site ──static HTML──▶ mofa-publish
                                  ▲
                                  │
                            also accepts:
                            - Manual markdown files
                            - Topic string (LLM generates from scratch)
                            - Existing lecture notes
```

## Template Extraction Sources

These templates are extracted from the structure and implementation patterns of real sites, not copied wholesale:

- `quarto-lesson` → `/Users/yuechen/home/sophie/3b1b-calculus`
- `astro-site` → `/Users/yuechen/home/origin2025` with cross-checks from `/Users/yuechen/home/adora-website`
- `nextjs-app` → `/Users/yuechen/home/ai-vision-forum-paris-2026`
- `react-vite` → simplified component patterns derived from `/Users/yuechen/home/adora-website` and `/Users/yuechen/home/origin2025`

The extraction rule is:
- keep framework structure, routing ideas, component decomposition, and design-token patterns
- remove private content, branding, external data, logos, event copy, and site-specific business logic

## Studio

Open the studio in a browser to:
- launch with a site-type command before the full editor opens
- let the backend scaffold a real site skeleton as soon as the session starts
- chat in the left panel to switch template, rename the site, or add/remove page briefs
- inspect the live iframe preview in the middle panel under `/sites/<site-slug>/`
- inspect the generated site tree and file contents in the right panel

The current chat parser supports structured commands such as:

```text
/new site astro
rename site to Signal Atlas Docs
set description to Docs site for onboarding and API reference
add page FAQ
set accent to #2563eb
rebuild
```

The studio writes additional runtime artifacts into the scaffold root:
- `mofa-site-session.json`
- `site-plan.json`
- `optimized-prompt.md`
- `content/*.md`

Direct launch URLs are also supported:

Mini / Caddy note:
- the backend preview surface expects to own `/sites/<slug>/`
- if `crew.ominix.io/sites/*` is already served statically, use a dedicated subdomain for the studio backend
- example config: `mofa-site/studio/Caddyfile.mini.example`

## quarto-lesson Template Details

### Page Structure

Each lesson page (`.qmd`) follows this structure:

```yaml
---
title: "Lesson Title"
subtitle: "Chapter N"
date: YYYY-MM-DD
---
```

1. Introduction paragraph with learning objectives
2. Prerequisites (collapsible callout)
3. Topics Covered list
4. Lecture Video (YouTube embed in responsive container)
5. Key Video Frames (image grid)
6. Key Concepts (formal math sections with LaTeX)
7. Interactive Desmos Graph (API-based calculator)
8. D3.js Animated Visualization (SVG + slider controls)
9. Summary (key formula box)

### Desmos Graph Pattern

```html
<div id="calc1" class="desmos-container"></div>
<script src="https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6"></script>
<script>
  var calc1 = Desmos.GraphingCalculator(document.getElementById('calc1'), {
    expressions: true, settingsMenu: false
  });
  calc1.setExpression({ id: 'f', latex: 'y = x^2', color: '#2d70b3' });
  calc1.setExpression({ id: 'a', latex: 'a = 1', sliderBounds: { min: -3, max: 3, step: 0.1 } });
  calc1.setMathBounds({ left: -5, right: 5, bottom: -2, top: 10 });
</script>
```

### D3.js Visualization Pattern

```html
<div class="d3-container">
  <div id="viz1"></div>
  <div class="d3-controls">
    <label>Parameter: <input type="range" id="slider1" min="1" max="100" value="10"></label>
    <span class="value-display" id="display1">n = 10</span>
  </div>
</div>
<script>
  // D3 v7 SVG visualization with interactive slider
</script>
```

### CSS Classes

| Class | Purpose |
|-------|---------|
| `.video-container` | Responsive 16:9 YouTube embed |
| `.desmos-container` | 500px interactive graph calculator |
| `.d3-container` | SVG visualization with controls |
| `.d3-controls` | Slider/button row below D3 viz |
| `.key-formula` | Blue-bordered summary box |

### Site Config (`_quarto.yml`)

```yaml
project:
  type: website
  output-dir: docs

website:
  title: "<site title>"
  navbar:
    left:
      - href: index.qmd
        text: Home
      - href: lessons.qmd
        text: Lessons

format:
  html:
    theme: cosmo
    css: styles.css
    toc: true
    include-in-header:
      text: |
        <script src="https://d3js.org/d3.v7.min.js"></script>
```

## Bundled Assets

- `templates/quarto-lesson/_quarto.yml.tmpl`
- `templates/quarto-lesson/index.qmd.tmpl`
- `templates/quarto-lesson/lessons.qmd.tmpl`
- `templates/quarto-lesson/lesson.qmd.example`
- `templates/quarto-lesson/styles.css`
- `scripts/bootstrap_quarto_lesson.sh`
- `scripts/bootstrap_template.sh`
- `scripts/new_site_session.sh`
- `templates/astro-site/`
- `templates/nextjs-app/`
- `templates/react-vite/`
- `studio/`

## Timing

| Content Size | Pages | Estimated Time |
|-------------|-------|----------------|
| Single video transcript | 1 | ~3 min |
| 12-chapter series | 12 | ~15-20 min |
| Short notes | 1 | ~2 min |

The `expand` and `visualize` nodes (strong model, content generation) are the bottleneck.
