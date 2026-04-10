---
name: mofa-youtube
version: 0.1.0
description: "Download YouTube video or transcribe local audio files via ASR. Triggers: mofa youtube, transcribe video, youtube to text, 转录视频, YouTube转文字, extract transcript, video to text, 提取字幕, download youtube, 下载视频, transcribe, 转录, transcribe audio, transcribe mp3, 音频转文字, speech to text, ASR, 语音识别."
requires_bins: yt-dlp,ffmpeg,ffprobe,curl,jq
requires_env:
---

# mofa-youtube

Extracts structured content from a YouTube video: transcript, key frames, and metadata. Zero Python — all shell + curl + ffmpeg.

## Output Paths

Always use a unique per-request directory:

```
skill-output/mofa-youtube-<YYYYMMDD-HHMMSS>/
├── metadata.json            # {title, url, duration, chapters, topics, language}
├── transcript.txt           # Full ASR transcript
├── transcript_chapters/     # Per-chapter transcripts (if video has chapters)
│   ├── ch01.txt
│   └── ch02.txt
├── images/
│   ├── frame-01.png
│   ├── frame-02.png
│   ├── frame-03.png
│   └── frame-04.png
└── video.mp4                # Original (deleted unless keep_video=true)
```

## Onboarding

**Required:**
- `yt-dlp` — YouTube download. Install: `brew install yt-dlp` or `pip install yt-dlp`
- `ffmpeg` / `ffprobe` — audio extraction, frame capture, chunking. Install: `brew install ffmpeg`
- `curl` + `jq` — ASR API calls
- Local ASR server at `localhost:8080` running `qwen3-asr` model

**Check before running:**
```bash
yt-dlp --version
ffmpeg -version
curl -s http://localhost:8080/v1/models | jq .
```

## Pipeline

```
download → extract_audio → transcribe ──┐
    └──→ extract_frames ────────────────┼──→ deliver
                                summarize┘
```

| Step | What it does | Model |
|------|-------------|-------|
| download | `yt-dlp` downloads video + metadata JSON | cheap |
| extract_audio | `ffmpeg` converts to 16kHz mono WAV | cheap |
| transcribe | Chunks audio (4-min), base64 + POST to ASR | cheap |
| extract_frames | Smart frame extraction: chapter timestamps (preferred) or scene change detection (fallback) | cheap |
| summarize | LLM reads transcript, generates metadata.json | strong |
| deliver | Sends transcript, frames, and summary back to chat via `message` + `send_file` | cheap |

## ASR Details

- **Endpoint:** `http://localhost:8080/v1/audio/transcriptions`
- **Model:** `qwen3-asr`
- **Chunk size:** 240 seconds (4 minutes)
- **Audio format:** 16kHz, mono, PCM s16le WAV
- **Request:** JSON with base64-encoded file, model, and language fields
- **Timeout:** 300 seconds per chunk

### Transcription shell commands

IMPORTANT: Each 4-min audio chunk base64-encodes to ~10MB, which exceeds shell argument limits.
You MUST use file-based `curl -d @file`, never pass the base64 inline.

```bash
# Get duration
dur=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 audio.wav | cut -d. -f1)

# Chunk and transcribe
for start in $(seq 0 240 "$dur"); do
  ffmpeg -y -i audio.wav -ss "$start" -t 240 \
    -acodec pcm_s16le -ar 16000 -ac 1 /tmp/asr_chunk.wav 2>/dev/null
  # Base64 encode to file (strip newlines)
  base64 < /tmp/asr_chunk.wav | tr -d '\n' > /tmp/asr_chunk.b64
  # Build JSON by concatenating around the base64 file
  { printf '{"file":"'; cat /tmp/asr_chunk.b64; printf '","model":"qwen3-asr","language":"en"}'; } > /tmp/asr_req.json
  # POST using -d @file to avoid arg limits
  curl -s -X POST http://localhost:8080/v1/audio/transcriptions \
    -H 'Content-Type: application/json' --max-time 300 \
    -d @/tmp/asr_req.json \
    | jq -r '.text' >> transcript.txt
done
```

## Composability

This skill outputs a content package that `mofa-site` consumes directly:

```
mofa-youtube → mofa-site → mofa-publish
```

Also useful standalone for: transcription, subtitle generation, key frame extraction for mofa-slides.

## metadata.json Schema

```json
{
  "title": "The Essence of Calculus, Chapter 1",
  "url": "https://youtube.com/watch?v=WUvTyaaNkzM",
  "duration_secs": 1087,
  "language": "en",
  "topics": ["derivatives", "area under curve", "fundamental theorem"],
  "chapters": [
    {"title": "Introduction", "start_secs": 0},
    {"title": "The circle problem", "start_secs": 45}
  ],
  "key_concepts": ["limit", "infinitesimal", "integral"],
  "frame_timestamps": [163, 413, 674, 924]
}
```

## Timing

| Video Length | Chunks | Estimated Time |
|-------------|--------|----------------|
| 5 min | 2 | ~1 min |
| 20 min | 5 | ~3 min |
| 60 min | 15 | ~8 min |

Bottleneck is ASR (sequential chunk processing). Download and frame extraction are fast.
