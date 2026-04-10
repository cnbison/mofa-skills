---
name: mofa-frame
version: 0.1.0
description: "Extract a video frame at a specific timestamp. Triggers: extract frame, 提取画面, screenshot video, capture frame, 截图, grab frame, video frame at, 视频截图."
requires_bins: ffmpeg
requires_env:
---

# mofa-frame

Extracts a single frame from a video at a specific timestamp. Returns the frame as a PNG image.

## Usage

Use after `mofa_youtube` — read the transcript, identify interesting moments, then extract frames at those timestamps.

```
mofa frame --video-path ./video.mp4 --timestamp 120 --label "key diagram"
```

## Workflow

1. `mofa_youtube` downloads video + transcribes → returns transcript.md + video path
2. Agent reads transcript, identifies key moments with timestamps
3. Agent calls `mofa_frame` for each interesting timestamp
4. Each frame is delivered to chat

## Output

Single PNG file, resized to 800px wide. Filename includes timestamp and optional label.
