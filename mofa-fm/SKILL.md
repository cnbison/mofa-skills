---
name: mofa-fm
description: Voice management and TTS with custom voice cloning. Save named voices and reuse them. Triggers: voice clone, save voice, custom voice, my voice, TTS, text to speech, 语音克隆, 自定义声音.
version: 1.0.0
author: hagency
always: false
---

# MoFA FM

Voice management and text-to-speech with custom voice cloning support via OminiX-MLX on Apple Silicon.

## Interaction Guide

Before generating speech, gather preferences interactively. On Telegram, use inline keyboard buttons:

1. **Text** — What should be spoken?
2. **Voice** — List available voices, let user pick:
   - Call `fm_voice_list` first to show preset + custom voices
   - Recommend based on language/gender preference
3. **Language** — chinese, english, japanese, korean
4. **Custom voice** — If user wants their own voice, ask them to send a 3-10s audio clip

**Telegram inline keyboard example:**
```json
message(content="Choose a voice:", metadata={"inline_keyboard": [
  [{"text": "Vivian", "callback_data": "voice:vivian"}, {"text": "Ryan", "callback_data": "voice:ryan"}],
  [{"text": "Serena", "callback_data": "voice:serena"}, {"text": "Aiden", "callback_data": "voice:aiden"}],
  [{"text": "🎤 Use my voice", "callback_data": "voice:custom"}]
]})
```
User's button press arrives as `[callback] voice:vivian`.

## Features

- **Text-to-Speech** with preset or custom voices
- **Emotion/Style Control**: Use natural language prompts to control speaking style (excited, sad, cheerful, shout, sarcastic, soft, panic)
- **Speed Control**: Adjust speech speed from 0.5x to 2.0x
- **Voice Cloning**: Upload a 3-10s audio clip, save it as a named voice, reuse it anytime
- **Voice Management**: Save, list, and delete custom voice profiles

## Preset Voices

vivian (default), serena, ryan, aiden, eric, dylan, uncle_fu, ono_anna, sohee

## Custom Voice Workflow

1. User sends a voice clip (3-10 seconds of clear speech)
2. Agent calls `fm_voice_save` with the audio path and a name
3. For TTS, agent calls `fm_tts` with `voice` set to the saved name
4. List all voices with `fm_voice_list`
5. Delete a voice with `fm_voice_delete`

## Setup

Requires Apple Silicon (MLX framework).

1. Install ominix-api: `cargo install --git https://github.com/OminiX-ai/OminiX-MLX ominix-api --features tts`
2. Download models:
   - Preset voices: `ominix-api --download Qwen3-TTS-12Hz-1.7B-CustomVoice-8bit`
   - Voice cloning (optional): `ominix-api --download Qwen3-TTS-12Hz-1.7B-Base`
3. Start the server: `ominix-api --tts-port 8082 --clone-port 8083`

Or run the setup script: `./scripts/setup.sh`

## Configuration

Set `OMINIX_TTS_URL` and `OMINIX_CLONE_URL` for custom ports (defaults: `http://localhost:8082`, `http://localhost:8083`).
Set `CREW_DATA_DIR` for per-profile voice storage (set automatically by crew gateway).

## API Endpoints

Two separate ominix-api endpoints are used:

- **Preset voices** → `POST /v1/audio/speech` (uses CustomVoice model)
- **Custom/cloned voices** → `POST /v1/audio/speech/clone` (uses Base model with ECAPA-TDNN)

The plugin automatically routes to the correct endpoint based on the voice name.

### Audio Format

The default TTS API response format is **WAV** (16-bit PCM, mono, 24kHz). For long text, the API automatically splits input at sentence boundaries and synthesizes each sentence independently (sentence-level pseudo-streaming), so the client receives first audio quickly while later sentences are still generating.

The plugin auto-detects the response format:

- **WAV response** (RIFF header detected or `Content-Type: audio/wav`) → saves as-is
- **PCM response** (`Content-Type: audio/pcm`) → wraps in WAV header before saving

### Concurrency

The ominix-api inference thread is single-threaded (MLX models are not `Send`/`Sync`). Concurrent TTS requests queue sequentially. For production:

- Run separate ominix-api instances for ASR and TTS on different ports
- Point `OMINIX_API_URL` to the TTS instance for this skill

## Tools

### fm_tts

Synthesize speech from text. Supports preset voices and saved custom voices.

```json
{"text": "Hello world", "voice": "my_voice", "language": "english"}
```

### fm_voice_save

Save an audio file as a named custom voice.

```json
{"name": "my_voice", "audio_path": "/path/to/reference.wav"}
```

### fm_voice_list

List all available voices (preset + custom).

### fm_voice_delete

Delete a saved custom voice.

```json
{"name": "my_voice"}
```

## Languages

chinese, english, japanese, korean
