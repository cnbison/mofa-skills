---
name: mofa-video
description: "AI-animated video cards using Gemini image generation and Veo image-to-video. Triggers: mofa video, animated card, video card, 视频贺卡, Veo animation, animate my card, mofa animate, 动态视频, video greeting, make a video, 做个视频, 动画贺卡."
requires_bins: mofa,ffmpeg
requires_env: GEMINI_API_KEY
---

# mofa-video

CLI: `mofa video` | Styles: `mofa-video/styles/*.toml` | Config: `mofa/config.json`

Generates animated video cards in three phases: Gemini image generation, Veo image-to-video animation, and ffmpeg compositing into a final MP4 with optional background music.

## Output Paths

Always use a unique per-request directory to avoid conflicts:

```
/tmp/mofa-video-<YYYYMMDD-HHMMSS>/
├── cards/
│   ├── card-01.png       # Phase 1: Gemini still images
│   └── card-N.png
├── videos/
│   ├── card-01.mp4       # Phase 2: Veo animated clips (raw)
│   └── card-N.mp4
└── final-video.mp4       # Phase 3: ffmpeg composite with BGM
```

Never reuse a path like `/tmp/video/` across requests.

## Onboarding

**Required:**
- `GEMINI_API_KEY` — for both Gemini image generation and Gemini Veo animation
- `ffmpeg` — for Phase 3 compositing. Install: `brew install ffmpeg` (macOS) or `apt install ffmpeg` (Linux)

**Check before generating:**
```bash
echo $GEMINI_API_KEY   # must be set
ffmpeg -version        # must be installed
```

## Interaction Guide

Before generating, gather preferences interactively:

1. **Content** — What should each card show? Collect a prompt per card.
2. **Style** — Recommend based on content (see Styles table below)
3. **Animation** — Which animation variant? (shuimo is a safe default)
4. **Number of cards** — Keep under 5 per run; each Veo call takes 2-5 minutes
5. **Background music** — Optional. Ask if user wants BGM.

Present the card plan (names + prompts + animation style) for confirmation before generating.

## Styles

| Style | `--style` | Description |
|-------|-----------|-------------|
| Video Card (default) | `video-card` | Chinese art-inspired cards, 4 animation variants |
| Social Story | `social-story` | Vertical 9:16 social media format (Instagram/TikTok) |
| Product Reel | `product-reel` | Product showcase for marketing and e-commerce |

### video-card — Image + Animation Variants

| Variant (`--anim-style`) | Image Look | Animation Feel |
|--------------------------|-----------|---------------|
| `shuimo` (default) | Chinese ink wash | Gentle, peaceful — leaves swaying, steam rising |
| `festive` | Festive Chinese painting | Cheerful, lively — lanterns, plum blossoms |
| `gentle` | Dreamy, soft | Slow — petals drifting, light flickering |
| `dynamic` | Energetic scene | Graceful — characters moving, water flowing |

### social-story — Image Variants

| Image Variant (`card.style`) | Look |
|-----------------------------|------|
| `minimal` (default) | Soft gradient, bold typography — Instagram aesthetic |
| `bold` | High contrast, color blocking — TikTok aesthetic |
| `cinematic` | Film grain, moody — editorial photography |

Animation variants for social-story (pass as `card.anim_style`):

| Animation Variant | Motion |
|------------------|--------|
| `anim_minimal` | Soft gradient hue shift, light bloom pulse |
| `anim_bold` | Color field ripple, subtle glitch flicker |
| `anim_cinematic` | Film grain shift, dust motes, rack focus |

### product-reel — Image Variants

| Image Variant (`card.style`) | Look |
|-----------------------------|------|
| `tech` (default) | Dark background, neon rim glow |
| `lifestyle` | Warm natural lighting, editorial feel |
| `luxury` | Black and gold, dramatic hard light |

Animation variants for product-reel (pass as `card.anim_style`):

| Animation Variant | Motion |
|------------------|--------|
| `anim_tech` | Neon rim pulse, lens flare sweep, reflection ripple |
| `anim_lifestyle` | Soft light shift, drifting bokeh, dust motes |
| `anim_luxury` | Hard light sweep, gold particle shimmer |

## Pipeline Phases

### Phase 1: Image Generation (parallel)

Generates still PNG images via `gemini-3.1-flash-image-preview`. Runs with `--concurrency` parallel workers (default: 3).

- Caches results: if `cards/card-N.png` exists and is >10KB, it is reused. Delete to regenerate.
- Aspect ratio defaults to `9:16` for vertical video.

### Phase 2: Veo Animation (sequential)

Animates each PNG using `veo-3.1-generate-preview` via the Gemini API. Always sequential — Veo has strict rate limits that make parallel calls unreliable.

- Each card takes 2-5 minutes.
- Polls every 10 seconds, times out after 20 minutes per card.
- Caches results: if `videos/card-N.mp4` exists and is >10KB, it is reused.

### Phase 3: ffmpeg Composite

Stitches all animated clips into `final-video.mp4`:
- Shows still image for `--still-duration` seconds before animation
- Crossfades between cards (`--crossfade-dur`)
- Fades out at end (`--fade-out-dur`)
- Mixes in BGM at `--music-volume` with fade-in (`--music-fade-in`)

## Input JSON Schema

Top-level: array of card objects.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **yes** | Card identifier for output filenames (e.g. `"card-01"`) |
| `prompt` | string | **yes** | Image content description for Gemini |
| `style` | string | no | Image style variant (e.g. `"front"`). Defaults to style's default. |
| `anim_style` | string | no | Per-card animation override: `shuimo`, `festive`, `gentle`, `dynamic` |
| `anim_desc` | string | no | Extra text appended to the animation prompt |

## Examples

### Chinese New Year video (3 cards, ink wash animation)

```json
[
  {
    "name": "opening",
    "prompt": "A pair of red lanterns hanging above a snow-dusted plum blossom branch, ink wash painting, traditional Chinese art",
    "anim_style": "festive"
  },
  {
    "name": "blessing",
    "prompt": "Calligraphy brush writing '新年快乐' on aged rice paper with soft ink bloom, ink wash painting",
    "anim_style": "shuimo"
  },
  {
    "name": "closing",
    "prompt": "Sunrise over misty mountain peaks with pine trees, ink wash painting, peaceful and serene",
    "anim_style": "gentle"
  }
]
```

```bash
mofa video \
  --style video-card \
  --anim-style shuimo \
  --card-dir /tmp/mofa-video-20260315-143022 \
  --bgm bgm-cny.mp3 \
  --still-duration 2 \
  --crossfade-dur 1 \
  --music-volume 0.3 \
  -i cards.json
```

### Social media story (vertical, 2 cards)

```json
[
  {
    "name": "hook",
    "prompt": "Bold headline text 'NEW DROP' on a gradient purple-to-pink background, modern streetwear aesthetic",
    "style": "bold"
  },
  {
    "name": "product",
    "prompt": "Clean white sneaker floating on a soft gradient background, product photography, minimal",
    "style": "minimal"
  }
]
```

```bash
mofa video \
  --style social-story \
  --anim-style gentle \
  --aspect 9:16 \
  --card-dir /tmp/mofa-video-20260315-150000 \
  -i cards.json
```

### Per-card animation override

```json
[
  {
    "name": "intro",
    "prompt": "Misty mountain lake at dawn, Chinese ink wash style",
    "anim_style": "gentle",
    "anim_desc": "with mist slowly rolling across the water surface"
  },
  {
    "name": "celebration",
    "prompt": "Fireworks exploding over a city skyline, festive Chinese painting style",
    "anim_style": "dynamic"
  }
]
```

## CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--card-dir PATH` | *required* | Working directory for images and videos |
| `-i / --input PATH` | stdin | Input JSON file |
| `--style STRING` | `video-card` | Style template (see Styles table) |
| `--anim-style STRING` | `shuimo` | Animation variant: shuimo, festive, gentle, dynamic |
| `--aspect STRING` | `9:16` | Image aspect ratio |
| `--image-size STRING` | config | `1K`, `2K`, or `4K` |
| `--concurrency INT` | `3` | Parallel workers for image generation |
| `--still-duration F` | `2.0` | Still image duration in seconds before animation |
| `--crossfade-dur F` | `1.0` | Crossfade duration between cards in seconds |
| `--fade-out-dur F` | `1.5` | Final fade-out duration in seconds |
| `--music-volume F` | `0.3` | BGM volume (0.0 - 1.0) |
| `--music-fade-in F` | `2.0` | BGM fade-in duration in seconds |
| `--bgm PATH` | none | Background music file (MP3/WAV) |
| `--api STRING` | `rt` | `rt` (fast, realtime) or `batch` (50% cheaper, async) |

## Timing

Veo animation is sequential and rate-limited. Plan accordingly:

| Cards | Estimated Time |
|-------|---------------|
| 1 | ~3-7 min |
| 3 | ~10-20 min |
| 5 | ~15-30 min |

**Tool timeout is 3600 seconds (1 hour).** Keep card count under 5 per call. Cached clips are preserved on timeout — rerun and only missing cards regenerate.

## Goal Gates

**MANDATORY before returning output:**
- `final-video.mp4` must exist in `card_dir` and be larger than 100KB
- `videos/card-N.mp4` must exist for each card in the input
- Never parallelize Veo calls — always animate cards one at a time
- Always use a unique timestamped `card_dir` per request

## Integration with mofa-cards

Use mofa-cards to generate still card images first, then pass them directly to mofa-video as source images:

```json
[
  {
    "name": "card-01",
    "prompt": "Animate this greeting card",
    "style": "front"
  }
]
```

The mofa-video pipeline will read any existing PNGs in `cards/` and skip regenerating them (cache hit), going straight to Veo animation.

## Config

`mofa/config.json`:

```json
{
  "api_keys": {
    "gemini": "env:GEMINI_API_KEY"
  },
  "gen_model": "gemini-3.1-flash-image-preview",
  "defaults": {
    "video": { "style": "video-card", "anim_style": "shuimo", "concurrency": 3 }
  }
}
```

## Related Skills

| Skill | Relationship |
|-------|-------------|
| `mofa-cards` | Generate the source still images that mofa-video animates |
| `mofa-slides` | Same Gemini image generation pipeline, produces PPTX instead of MP4 |
| `mofa-comic` | Same parallel generation pattern, produces PNG strips |
| `mofa-fm` | TTS — add voiceover audio alongside mofa-video BGM |
