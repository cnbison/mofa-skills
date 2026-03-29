---
name: mofa-fm
description: Voice management and TTS with custom voice cloning. Save named voices and reuse them. Triggers: voice clone, save voice, custom voice, my voice, TTS, text to speech, 语音克隆, 自定义声音.
version: 0.3.1
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
- **Emotion/Style Control**: Use natural language prompts to control speaking style (excited, sad, cheerful, shout, sarcastic, soft, panic). Works with both preset and cloned voices. Chinese prompts work best with Chinese speakers (vivian, serena, dylan, uncle_fu); English prompts work best with English speakers (ryan, aiden).
- **Speed Control**: Adjust speech speed from 0.5x to 2.0x
- **Voice Cloning**: Upload a 3-10s audio clip, save it as a named voice, reuse it anytime

> **Note on cloned voice + emotion**: Emotion control on cloned voices is experimental — the Base
> model was not specifically trained for this combination. Emotion effects are weaker than with
> preset speakers. Some emotions (sad, angry, soft) work well; others (fearful, surprised) may
> sound flat. Use short prompts like "用悲伤的语气说". Native support is expected with the upcoming
> Qwen3-TTS-25Hz-VoiceEditing model.

**Verified Chinese emotion prompts** (best with Chinese speakers: vivian, serena, dylan, uncle_fu):

| Style | Prompt |
|-------|--------|
| Excited | `用兴奋激动的语气说话，充满热情和活力` |
| Sad | `用悲伤失望的语气说话，声音低沉，语速缓慢` |
| Cheerful | `用开朗愉快的语气说话，声音明亮上扬，节奏轻快` |
| Shout | `用大声喊叫的方式说话，声音高亢有力，语速快` |
| Sarcastic | `用讽刺嘲讽的语气说话，语调阴阳怪气，拖长尾音` |
| Soft | `用温柔轻柔的语气说话` |
| Panic | `用惊慌恐惧的语气说话，声音颤抖，语速急促` |

**English emotion prompts** (best with English speakers: ryan, aiden):

| Style | Prompt |
|-------|--------|
| Excited | `Speak with excitement and enthusiasm, full of energy` |
| Sad | `Speak in a sad, disappointed tone, voice low and slow` |
| Cheerful | `Speak cheerfully with a bright, upbeat voice` |
| Shout | `Shout loudly with a powerful, high-pitched voice` |
| Sarcastic | `Speak sarcastically with a mocking, drawn-out tone` |
| Soft | `Speak gently and softly` |
| Panic | `Speak in a panicked, trembling voice, fast and breathless` |

Custom free-form prompts are also supported — include emotion + timbre + pace descriptors for strongest control.

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

Requires Apple Silicon with OminiX-MLX. Run `./scripts/setup.sh` or see source for manual setup.

Env vars: `OMINIX_API_URL` (server URL, auto-discovered), `OCTOS_DATA_DIR` (voice storage, auto-set by gateway).

## Tools

### fm_tts

Synthesize speech from text. Supports **long text** — the server automatically splits at sentence boundaries and streams audio, so pass the entire text in one call. Do NOT manually split text into smaller pieces. Supports preset voices, saved custom voices, emotion control, and speed adjustment.

**IMPORTANT: Always use `spawn` with `mode: "background"` for fm_tts.** TTS generation takes seconds to minutes. Backgrounding keeps the conversation responsive.

```
spawn(
  task: "Generate audio from this text and send it to the user: [text here]",
  system_prompt: "You are an audio producer. Use fm_tts to generate speech, then send_file to deliver the mp3. Leave prompt empty for natural content-aware tone, or set prompt to override with a consistent style.",
  allowed_tools: ["fm_tts", "send_file"],
  mode: "background"
)
```

Tell the user "Audio is being generated, I'll send it when ready" and continue the conversation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | **yes** | Text to speak |
| `voice` | string | no | Voice name: preset (vivian, ryan, etc.) or saved custom voice. Default: vivian |
| `language` | string | no | chinese, english, japanese, korean. Default: auto-detect |
| `prompt` | string | no | Style instruction to override content-based tone. Leave empty for natural prosody. |
| `speed` | float | no | Speed factor: 0.5 (slow) to 2.0 (fast). Default: 1.0 |

```json
{"text": "大家好，欢迎收听今天的节目", "voice": "vivian", "speed": 1.2}
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
