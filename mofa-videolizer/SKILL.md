---
name: mofa-videolizer
description: "Generate SRT subtitles from text + audio. Supports Whisper (word-level timestamps) and basic fallback mode. Triggers: subtitle, subtitles, 字幕, SRT, 字幕生成, generate subtitles"
requires_bins: [python3]
requires_env: []
---

# mofa-videolizer

Subtitle generator for video production. Produces `.srt` files from script text + audio, designed to work with mofa-video and mofa-fm outputs.

## Modes

- **Whisper** (when `openai-whisper` is installed): word-level timestamps, 3-word groups, high accuracy
- **Basic** (fallback): spreads words evenly across audio duration, 4-word groups. Requires `moviepy`

Graceful fallback: if Whisper is missing or fails, uses basic mode instead of crashing.

## Usage

```bash
python3 -m videolizer subtitles --text script.txt --audio voice.wav --out subs.srt
```

## Integration with mofa pipeline

Typical workflow combining mofa-fm + mofa-videolizer + mofa-video:

1. Write script text
2. `fm_tts` to generate voice audio (mofa-fm)
3. `videolizer subtitles` to generate `.srt` from text + audio
4. `mofa_video` to produce final video with subtitles

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `VIDEOLIZER_SUBTITLES_MODE` | `auto` | `auto` / `whisper` / `basic` |
| `VIDEOLIZER_SUBTITLES_WHISPER_MODEL` | `base` | Whisper model size |
| `VIDEOLIZER_SUBTITLES_WHISPER_GROUP_WORDS` | `3` | Words per subtitle group (Whisper) |
| `VIDEOLIZER_SUBTITLES_WORDS_PER_GROUP` | `4` | Words per subtitle group (basic) |
| `VIDEOLIZER_SUBTITLES_TIMING_OFFSET` | `0.0` | Shift all subtitles by N seconds |
| `VIDEOLIZER_SUBTITLES_OVERLAP` | `0.05` | Overlap between segments (seconds) |

## Install

```bash
pip install moviepy              # basic mode
pip install openai-whisper       # whisper mode (optional, better quality)
```
