---
name: mofa-slides
description: "AI-generated visual presentations with full-bleed Gemini images. Triggers: mofa, mofa ppt, mofa deck, slides, 幻灯片, generative slides, build a mofa ppt, 用mofa做PPT, AI deck, 做个PPT, make slides."
always: true
requires_bins: mofa
requires_env: GEMINI_API_KEY
---

# mofa-slides

CLI: `mofa slides` | Styles: `mofa-slides/styles/*.toml` | Config: `mofa/config.json`

## Output Paths

**IMPORTANT**: Always use relative paths under `skill-output/` with a unique per-request subdirectory:

```
skill-output/mofa-slides-<YYYYMMDD-HHMMSS>/slides.pptx
skill-output/mofa-slides-<YYYYMMDD-HHMMSS>/slide-dir/
```

Example: `"out": "skill-output/mofa-slides-20260308-143022/deck.pptx"`, `"slide_dir": "skill-output/mofa-slides-20260308-143022/imgs"`

**Never use absolute paths like `/tmp/slides.pptx`** — they are outside the sandbox and `send_file` will reject them. Always use relative paths which resolve within the profile's data directory.

## Interaction Guide

Before generating, gather preferences interactively. On Telegram, use inline keyboard buttons when possible:

1. **Topic/content** — Ask what the presentation is about
2. **Style** — Recommend based on content, show options:
   - Business/corporate → `agentic-enterprise-red` or `nb-pro`
   - Academic/research → `what-is-life`
   - Creative/artsy → `fengzikai` or `lingnan`
   - Tech/startup → `nb-br` or `dark-community`
   - Product launch → `vlinka-dji`
   - Conference/summit → `gobi`
3. **Number of slides** — Suggest 5-8 for a pitch, 10-15 for a full deck
4. **Resolution** — Default 2K; suggest 4K for print or large screens
5. **API keys** — Check if GEMINI_API_KEY is configured. If not, ask the user to provide it. This is required for image generation.

Present a slide plan (titles + variants) for confirmation before generating.

**Telegram inline keyboard example** for style selection:
```json
message(content="Choose a style:", metadata={"inline_keyboard": [
  [{"text": "商务 nb-pro", "callback_data": "style:nb-pro"}, {"text": "科幻 nb-br", "callback_data": "style:nb-br"}],
  [{"text": "学术 what-is-life", "callback_data": "style:what-is-life"}, {"text": "国潮 fengzikai", "callback_data": "style:fengzikai"}]
]})
```
User's button press arrives as `[callback] style:nb-pro`.

## Two Modes

**Image mode** (default) — text baked into AI image. Beautiful, but not editable in PowerPoint.
- User says: "做PPT", "make slides"
- `prompt` describes everything (background + text content)
- Models: `gemini-3.1-flash-image-preview` (image generation)

**Editable mode** (`--auto-layout`) — text is editable in PowerPoint.
- User says: "可编辑PPT", "editable slides"
- Add `--auto-layout` flag
- Requires both `GEMINI_API_KEY` and `DASHSCOPE_API_KEY`

Editable mode pipeline (4 phases):
1. **Generate**: `gemini-3.1-flash-image-preview` generates full slide image with text baked in (same as image mode)
2. **Extract**: `gemini-2.5-flash` (VQA) reads the image and extracts every text element — content, position, font size, color, weight, alignment. Returns structured JSON with percentage-based coordinates.
3. **Remove text**: `qwen-image-edit-max` (via Dashscope API) takes the reference image and removes all text, producing a clean background. This is the step that requires `DASHSCOPE_API_KEY`.
4. **Assemble**: PPTX built with clean background image + editable text boxes from step 2 placed on top.

Also works for PDF-to-PPTX: provide `source_image` + `auto_layout: true` per slide (skips step 1, uses existing image).

## Styles (17)

| User says | `--style` | Variants |
|-----------|-----------|----------|
| 红色企业、华为风、商务红 | `agentic-enterprise-red` | normal, cover, data |
| 紫色企业、咨询风、McKinsey | `agentic-enterprise` | normal, warm, cover, data |
| 极简、北欧、MUJI、IKEA | `nordic-minimal` | normal, data, cover |
| 专业、商务、正式 | `nb-pro` | normal |
| 科幻、赛博朋克、Blade Runner | `nb-br` | normal |
| 暗色、社区、开源社区 | `dark-community` | normal |
| 学术、科研、论文、study notes | `what-is-life` | cover, physics_dark, biology_light, overview |
| 开源、可爱、卡通鲸鱼 | `opensource` | normal, data, cover |
| 暖色、琥珀、电影感 | `cc-research` | normal |
| 产品发布、DJI、大疆 | `vlinka-dji` | cover, hero, feature, scene, data |
| 多品牌对比、公司对比 | `multi-brand` | amazon_light, amazon_dark, google, microsoft, tesla_light, tesla_dark, nvidia_light, nvidia_dark, spacex, overview, cover |
| 简笔画、小人、greeting | `relevant` | front, greeting, scene, festive |
| 策略、咨询、薰衣草 | `tectonic` | normal, data, cover |
| 开源企业、红黑 | `openclaw-red` | normal, cover, data |
| 丰子恺、水墨、童趣、宣纸 | `fengzikai` | normal, cover, data |
| 岭南、国画、水彩、花鸟 | `lingnan` | normal, cover, data, warm |
| 会议、峰会、conference、GOBI | `gobi` | cover, normal, data, warm |
| "有哪些模板？" / "list styles" | Show all above | |
| *(not specified)* | `nb-pro` | |

Set per-slide variant via JSON `"style"` field (e.g. `"style": "cover"`). Defaults to `"normal"`.

## API Modes

| `--api` | Speed | Cost | How it works |
|---------|-------|------|--------------|
| `rt` (default) | Fast (~2-4 min for 10 slides) | Standard pricing | Parallel sync calls via rayon thread pool |
| `batch` | Slow (5-30 min) | **50% cheaper** | Gemini Batch API, async processing. Falls back to `rt` on timeout. |

Use `--api batch` for large decks (15+ slides) where cost matters more than speed.

## Timing & Timeouts

Each slide takes ~15-30 seconds to generate. Total time depends on slide count and concurrency:

| Slides | Concurrency | Estimated Time |
|--------|-------------|----------------|
| 5 | 5 | ~30-60s |
| 10 | 5 | ~1-2 min |
| 15 | 5 | ~2-3 min |
| 25 | 5 | ~4-6 min |

**Tool timeout is 600 seconds (10 min).** To avoid timeouts:

- **Keep slide count under 15** for a single call
- **Increase concurrency**: `"concurrency": 5` or higher (default: 5)
- **Use smaller images**: `"1K"` or `"2K"` instead of `"4K"`
- **Don't use `--api batch`** in crew.rs tool calls — batch can take 5-30 min
- **`--auto-layout` adds ~10-20s per slide** for VQA extraction + Qwen-Edit text removal

If a generation times out, **cached slides are preserved** — rerun and only missing slides will be regenerated.

## Models

| Role | Default model | Flag / config key | API key |
|------|---------------|-------------------|---------|
| Image generation | `gemini-3.1-flash-image-preview` | `--gen-model` | `GEMINI_API_KEY` |
| Text extraction (VQA) | `gemini-2.5-flash` | `--vision-model` | `GEMINI_API_KEY` |
| Text removal (inpainting) | `qwen-image-edit-max-2026-01-16` | `edit_model` in config | `DASHSCOPE_API_KEY` |

Per-slide generation model override: `"gen_model": "model-name"` in JSON.

## Resolution

| Flag | Values | Description |
|------|--------|-------------|
| `--image-size` | `1K`, `2K`, `4K` | Image resolution. Higher = sharper but slower. |
| `--ref-image-size` | `1K`, `2K` | Lower-res for auto-layout reference image (faster generation, VQA still accurate) |
| `--concurrency` | 1-20 | Parallel slide generation (default: 5) |

## Input JSON Schema

Top-level: array of slide objects.

### Slide Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | **yes** | Content description for AI (what to render on the slide) |
| `style` | string | no | Variant within the style: `"cover"`, `"normal"`, `"data"`, `"warm"`, etc. Default: `"normal"` |
| `auto_layout` | bool | no | Per-slide override for editable mode |
| `images` | string[] | no | Reference image paths — Gemini uses these for visual style guidance |
| `source_image` | string | no | Existing image path to use as-is (skip AI generation). For PDF-to-PPTX. |
| `gen_model` | string | no | Per-slide generation model override |
| `texts` | TextOverlay[] | no | Manual text overlays — full control over text positioning and styling |

### TextOverlay (manual text boxes)

When `texts` is provided, these text boxes are placed on top of the slide image. AI generates a text-free background automatically. In auto-layout mode, VQA-extracted text is used instead.

Slide canvas: **13.333" wide x 7.5" tall** (16:9 widescreen). All positions in inches.

| Field | JSON key | Type | Default | Description |
|-------|----------|------|---------|-------------|
| Text content | `text` | string | — | Plain text. Use `\n` for line breaks. |
| Rich text | `runs` | TextRun[] | — | Alternative to `text` — mixed formatting per run (see below) |
| Left | `x` | float | 0.5 | Inches from left edge |
| Top | `y` | float | 0.5 | Inches from top edge |
| Width | `w` | float | 6.0 | Text box width in inches |
| Height | `h` | float | 1.0 | Text box height in inches |
| Font | `fontFace` | string | Arial | Font family (Arial, Calibri, Times New Roman, Courier New, Microsoft YaHei, SimSun, etc.) |
| Size | `fontSize` | float | 18 | Font size in points |
| Color | `color` | string | FFFFFF | Hex RGB without # (e.g. `"333333"`, `"CC0000"`) |
| Bold | `bold` | bool | false | Bold weight |
| Italic | `italic` | bool | false | Italic style |
| H-Align | `align` | string | l | `"l"` left, `"c"` or `"ctr"` center, `"r"` right, `"j"` or `"just"` justify |
| V-Align | `valign` | string | t | `"t"` top, `"m"` or `"ctr"` middle, `"b"` bottom |
| Rotation | `rotate` | float | — | Rotation in degrees (optional) |

### TextRun (rich text within one text box)

Use `runs` instead of `text` when you need mixed formatting (e.g. bold title + normal subtitle in one box, or multi-color text).

| Field | JSON key | Type | Description |
|-------|----------|------|-------------|
| Content | `text` | string | Text for this run |
| Color | `color` | string | Hex RGB override (optional) |
| Bold | `bold` | bool | Bold override (optional) |
| Italic | `italic` | bool | Italic override (optional) |
| Size | `fontSize` | float | Font size override in pt (optional) |
| Font | `fontFace` | string | Font family override (optional) |
| Line break | `breakLine` | bool | Insert line break before this run (optional) |

## Examples

### Image mode (not editable)

```json
[
  { "prompt": "TITLE: \"AI战略报告\"\nCentered, dramatic background", "style": "cover" },
  { "prompt": "TITLE: \"核心发现\"\n3 metric cards: Revenue +47%, Users 10M, NPS 72", "style": "normal" }
]
```

### Editable mode (`--auto-layout`)

Same JSON as image mode — just add `--auto-layout` flag. The tool generates the image, uses Gemini VQA to extract text, then qwen-image-edit to remove text from the image, and assembles editable PPTX automatically.

```bash
mofa slides --auto-layout --style nb-pro --out skill-output/editable.pptx --slide-dir skill-output/edit -i slides.json
```

```json
[
  { "prompt": "TITLE: \"AI战略报告\"\nCentered, dramatic background", "style": "cover" },
  { "prompt": "TITLE: \"核心发现\"\n3 metric cards: Revenue +47%, Users 10M, NPS 72", "style": "normal" }
]
```

### PDF-to-PPTX conversion

Provide existing page images as `source_image`. The tool skips image generation, runs VQA + qwen-image-edit on the existing images.

```json
[
  { "prompt": "page 1", "source_image": "skill-output/pdf-pages/page-01.png", "auto_layout": true },
  { "prompt": "page 2", "source_image": "skill-output/pdf-pages/page-02.png", "auto_layout": true }
]
```
```bash
mofa slides --auto-layout --style nb-pro --out skill-output/editable.pptx --slide-dir skill-output/edit -i pages.json
```

### Manual text overlays (`texts` field)

For pixel-perfect control over text positioning. AI generates a text-free background, you specify text boxes manually. No `--auto-layout` or DASHSCOPE_API_KEY needed.

```json
{
  "prompt": "Dark gradient background with subtle geometric patterns, no text anywhere",
  "texts": [
    { "text": "2026 战略规划", "x": 0.5, "y": 2.5, "w": 12.333, "h": 1.5, "fontSize": 48, "bold": true, "color": "FFFFFF", "align": "c" }
  ]
}
```

### Reference images for visual consistency

```json
[
  {
    "prompt": "TITLE: \"Product Overview\"\nFeature grid with icons",
    "images": ["/path/to/brand-guide.png", "/path/to/example-slide.png"]
  }
]
```

## CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--style` | `nb-pro` | Style name (see Styles table) |
| `-o` / `--out` | *required* | Output PPTX file path |
| `--slide-dir` | *required* | Directory for intermediate PNGs |
| `-i` / `--input` | stdin | Input JSON file path |
| `--auto-layout` | false | Enable editable mode (VQA + qwen-image-edit) for ALL slides |
| `--concurrency` | 5 | Parallel generation (1-20) |
| `--image-size` | config | `"1K"` / `"2K"` / `"4K"` |
| `--gen-model` | gemini-3.1-flash-image-preview | Image generation model |
| `--ref-image-size` | same as image-size | Lower-res for auto-layout reference (faster) |
| `--vision-model` | gemini-2.5-flash | VQA model for text extraction in auto-layout |
| `--api` | `rt` | API mode: `rt` (realtime, fast parallel) or `batch` (50% cheaper, async 5-30 min) |
| `--root` | auto-detected | Path to mofa root directory |

## Config

`mofa/config.json`:

```json
{
  "api_keys": {
    "gemini": "env:GEMINI_API_KEY",
    "dashscope": "env:DASHSCOPE_API_KEY"
  },
  "gen_model": "gemini-3.1-flash-image-preview",
  "vision_model": "gemini-2.5-flash",
  "edit_model": "qwen-image-edit-max-2026-01-16",
  "defaults": {
    "slides": { "style": "nb-pro", "image_size": "2K", "concurrency": 5 }
  }
}
```

- `GEMINI_API_KEY` — required for all modes (image generation + VQA)
- `DASHSCOPE_API_KEY` — required for `--auto-layout` (qwen-image-edit text removal)
