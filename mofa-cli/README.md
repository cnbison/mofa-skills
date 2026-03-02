# mofa-cli

Pure Rust replacement for the mofa JS engine. Single binary, zero Node.js dependency.

## Build

```bash
cd mofa-cli
cargo build --release
```

## Pipelines

### slides — PPTX presentations

```bash
mofa slides --style nb-pro --out deck.pptx --slide-dir /tmp/slides --input slides.json
```

Three text modes:

| Mode | JSON field | Editable in PPT? | How it works |
|------|-----------|-------------------|--------------|
| **autoLayout** | `"auto_layout": true` | Yes | Phase 1: generate ref image with text. Phase 2: VQA extracts text positions. Phase 3: generate/edit clean background. Build PPTX with text overlays. |
| **manual texts** | `"texts": [...]` | Yes | Generate image without text, overlay manually specified text boxes. |
| **baked** | *(neither)* | No | Text rendered directly in the image. |

Input JSON:

```json
[
  {
    "prompt": "TITLE: \"核心发现\"\n3 cards: Revenue +47%, Efficiency 3x, Scale 10M+",
    "style": "normal",
    "auto_layout": true
  },
  {
    "prompt": "Cover slide with dramatic wireframe background",
    "style": "cover",
    "auto_layout": true,
    "source_image": "/tmp/pdf-pages/page-01.png"
  }
]
```

Options:

| Flag | Default | Description |
|------|---------|-------------|
| `--style` | `nb-pro` | Style name (from `mofa-slides/styles/*.toml`) |
| `--out` | required | Output `.pptx` path |
| `--slide-dir` | required | Directory for intermediate PNGs |
| `--concurrency` | `5` | Parallel generation workers |
| `--image-size` | — | `1K`, `2K`, or `4K` |
| `--gen-model` | config | Gemini model for image generation |
| `--ref-image-size` | — | Lower-res size for Phase 1 reference images |
| `--vision-model` | config | Model for VQA text extraction |
| `--refine` | off | Use Qwen-Edit (Dashscope) for text removal |
| `--input` | stdin | JSON input file |
| `--root` | auto | Path to mofa-skills root directory |

#### source_image (PDF-to-PPTX)

Set `"source_image"` to use an existing image instead of generating one. Combined with `"auto_layout": true`, this enables PDF-to-PPTX conversion:

1. Export PDF pages as PNGs (`pdftoppm -png -r 300 input.pdf output`)
2. Create JSON with `source_image` pointing to each page PNG
3. Run with `--refine` for Qwen-Edit text removal, or without for Gemini-based clean generation

The pipeline extracts text positions via VQA and creates editable text overlays on top of the (cleaned) original page image.

#### autoLayout 3-phase pipeline

**Phase 1 — Reference image**: Generate image with all text rendered (or copy `source_image`). This is the "ground truth" for text extraction.

**Phase 2 — VQA text extraction**: Send ref image to Gemini vision. Extract every text element with position (percentage-based), font size, color, weight, alignment. Refine with a second pass that draws bounding boxes and asks the model to correct.

**Phase 3 — Clean background**: Remove text from the ref image:
- `--refine`: Qwen-Edit (Dashscope) inpaints text areas. Best for generated images with simple graphics. May damage complex diagrams.
- Without `--refine`: Gemini re-edit with ref image as reference and "remove text" instruction. Fallback when Qwen-Edit is unavailable.

**Build**: Assemble PPTX with clean background image + extracted text as editable PowerPoint text boxes.

### cards — PNG greeting cards

```bash
mofa cards --style cny-guochao --card-dir /tmp/cards --input cards.json
```

Input: `[{ "prompt": "...", "style": "normal" }]`

### comic — Multi-panel comic strips

```bash
mofa comic --style xkcd --out comic.png --input panels.json --layout grid --gutter 20
```

Input: `[{ "prompt": "Panel 1: ...", "style": "normal" }]`

Layouts: `horizontal`, `vertical`, `grid`. Panels stitched with configurable gutter.

### infographic — Multi-section infographics

```bash
mofa infographic --style cyberpunk-neon --out infographic.png --input sections.json
```

Input: `[{ "prompt": "...", "style": "header" }]`

Sections generated in parallel, stitched vertically.

### video — Animated video cards (Veo)

```bash
mofa video --style video-card --anim-style shuimo --card-dir /tmp/video --input cards.json --bgm music.mp3
```

Phase 1: Generate still images. Phase 2: Animate with Gemini Veo. Phase 3: Composite with ffmpeg (crossfade + BGM).

## Configuration

Reads `mofa/config.json` from the mofa root directory.

```json
{
  "api_keys": {
    "gemini": "env:GEMINI_API_KEY",
    "dashscope": "env:DASHSCOPE_API_KEY"
  },
  "gen_model": "gemini-3-pro-image-preview",
  "vision_model": "gemini-2.5-flash",
  "edit_model": "qwen-vl-max",
  "defaults": {
    "slides": { "style": "nb-pro", "image_size": "2K", "concurrency": 5, "auto_layout": true }
  }
}
```

API keys support two formats:
- `"env:GEMINI_API_KEY"` — read from environment variable
- `"AIzaSy..."` — literal value

Environment variables (`GEMINI_API_KEY`, `DASHSCOPE_API_KEY`) are also checked directly as fallback.

## Styles

TOML files in `mofa-<skill>/styles/`. Each style defines prompt variants:

```toml
[meta]
name = "nb-pro"
display_name = "NB Pro"

[variants]
default = "normal"

[variants.normal]
prompt = """
Create a presentation slide image. 3840x2160 pixels...
"""

[variants.cover]
prompt = """
Dark background, centered title...
"""
```

## Architecture

```
src/
├── main.rs              # CLI (clap): slides|cards|comic|infographic|video
├── config.rs            # config.json loading, env:VAR resolution
├── style.rs             # TOML style loading, variant lookup
├── gemini.rs            # Gemini image gen (retries, caching) + vision QA
├── dashscope.rs         # Dashscope Qwen-Edit text removal + OCR
├── layout.rs            # VQA text extraction, refinement, font calibration
├── pptx.rs              # Multi-slide PPTX builder (DrawingML XML)
├── image_util.rs        # Image stitching, overlay, thumbnail
├── veo.rs               # Gemini Veo video generation + polling
└── pipeline/
    ├── slides.rs         # 3-phase autoLayout pipeline
    ├── cards.rs          # Parallel card generation
    ├── comic.rs          # Panel gen + stitch (h/v/grid)
    ├── infographic.rs    # Section gen + vertical stitch
    └── video.rs          # Veo animation + ffmpeg compositing
```

## Dependencies

- **reqwest** (blocking, rustls-tls) — HTTP for Gemini/Dashscope APIs
- **image** — PNG I/O, stitching, overlay
- **zip** — PPTX packaging
- **rayon** — parallel generation
- **clap** — CLI argument parsing
- **serde/serde_json/toml** — config and style parsing
- **base64** — image encoding for API calls
