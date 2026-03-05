---
name: mofa-slides
description: "AI-generated visual presentations with full-bleed Gemini images. Triggers: mofa, mofa ppt, mofa deck, slides, 幻灯片, generative slides, build a mofa ppt, 用mofa做PPT, AI deck, 做个PPT, make slides."
always: true
requires_env: GEMINI_API_KEY
---

# mofa-slides

CLI: `mofa slides`
Styles: `mofa-slides/styles/*.toml`
Config: `mofa/config.json`

## User Guide — How to Decide

### Mode: Image vs Editable

| User says | Mode | CLI flag |
|-----------|------|----------|
| "做PPT", "make slides" | Image (default) | *(none)* |
| "**可编辑**的PPT", "**editable** slides" | Editable PPTX | `--auto-layout` |
| "把PDF转成**可编辑**PPT" | Editable + source_image | `--auto-layout` + `source_image` per slide |

**Rule: if user says "可编辑" or "editable", add `--auto-layout`. Otherwise don't.**

Image mode bakes text into AI-generated images (fast, beautiful, not editable).
Editable mode extracts text, cleans the background, overlays editable text boxes (slower, requires DASHSCOPE_API_KEY).

### Style: How Users Choose

| User says | `--style` value |
|-----------|-----------------|
| 红色企业、华为风、商务红 | `agentic-enterprise-red` |
| 紫色企业、咨询风、McKinsey | `agentic-enterprise` |
| 极简、北欧、MUJI、IKEA | `nordic-minimal` |
| 专业、商务、正式 | `nb-pro` |
| 科幻、赛博朋克、Blade Runner | `nb-br` |
| 暗色、社区、开源社区 | `dark-community` |
| 学术、科研、论文、study notes | `what-is-life` |
| 开源、可爱、卡通鲸鱼 | `opensource` |
| 暖色、琥珀、电影感 | `cc-research` |
| 产品发布、DJI、大疆 | `vlinka-dji` |
| 多品牌对比、公司对比 | `multi-brand` |
| 简笔画、小人、greeting | `relevant` |
| 策略、咨询、薰衣草 | `tectonic` |
| 开源企业、红黑 | `openclaw-red` |
| 丰子恺、水墨、童趣、宣纸 | `fengzikai` |
| 岭南、国画、水彩、花鸟 | `lingnan` |
| 会议、峰会、conference、GOBI、开源峰会 | `gobi` |
| "有哪些模板？" / "list styles" | 列出上面所有选项 |
| *(不指定)* | `nb-pro` (default) |

**Rule: map user's描述 to the closest `--style` value. If unsure, use `nb-pro`.**

## CLI Usage

```bash
# Image mode (default)
mofa slides --style nb-pro --out deck.pptx --slide-dir /tmp/slides -i slides.json

# Editable PPTX mode
mofa slides --style nb-pro --auto-layout --out deck.pptx --slide-dir /tmp/slides -i slides.json
```

### Input JSON

```json
[
  { "prompt": "TITLE: \"项目报告\"\nCentered vertically.", "style": "cover" },
  { "prompt": "TITLE: \"核心发现\"\n3 cards: Revenue +47%, Efficiency 3x", "style": "normal" },
  { "prompt": "TITLE: \"数据对比\"\nTable comparing 3 products", "style": "data" }
]
```

Each slide object:

| Field | Type | Description |
|-------|------|-------------|
| `prompt` | string | Required. Slide content description |
| `style` | string | Variant within the style (e.g. "cover", "normal", "data", "warm") |
| `auto_layout` | bool | Per-slide override for editable mode |
| `images` | string[] | Reference image paths for style guidance |
| `source_image` | string | Existing image to use as-is (PDF-to-PPTX) |
| `gen_model` | string | Per-slide model override |

## CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--style` | `nb-pro` | Style name (see table above) |
| `--out` / `-o` | required | Output PPTX file path |
| `--slide-dir` | required | Directory for intermediate PNGs |
| `--auto-layout` | false | Enable editable text mode for ALL slides |
| `--concurrency` | 5 | Parallel generation (1-20) |
| `--image-size` | - | "1K" / "2K" / "4K" |
| `--gen-model` | gemini-3-pro-image-preview | Image generation model |
| `--vision-model` | gemini-2.5-flash | Vision model for text extraction |
| `--refine` | false | Use Qwen-Edit for text cleanup |
| `-i` / `--input` | stdin | Input JSON file |

## Config

`mofa/config.json`:

```json
{
  "api_keys": {
    "gemini": "env:GEMINI_API_KEY",
    "dashscope": "env:DASHSCOPE_API_KEY"
  },
  "gen_model": "gemini-3-pro-image-preview",
  "vision_model": "gemini-2.5-flash",
  "defaults": {
    "slides": { "style": "nb-pro", "image_size": "2K", "concurrency": 5 }
  }
}
```

DASHSCOPE_API_KEY is only needed for `--auto-layout` (editable mode).
