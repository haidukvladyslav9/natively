# Natively

Natively is a cross-platform Electron meeting transcription companion for macOS and Windows.

It captures microphone and system audio, produces a live transcript, stores raw meeting history locally, and opens the real [ChatGPT web interface](https://chatgpt.com/) in a dedicated window. When the user explicitly sends a message, Natively can paste:

- a typed question
- the current raw transcript
- a selected saved meeting transcript
- screenshots captured by Natively

Natively does not call an LLM API, run a local answer model, generate meeting summaries, or read ChatGPT replies.

## Speech-to-text

The app retains its existing speech providers:

- Local Whisper/Nemotron
- Google Cloud Speech
- Groq Whisper
- OpenAI-compatible Whisper
- Deepgram
- ElevenLabs
- Azure Speech
- IBM Watson
- Soniox
- NVIDIA NIM
- Natively managed transcription

Provider credentials are encrypted with Electron `safeStorage` when available. Audio capture and permissions use the existing platform-specific macOS and Windows implementations.

## Development

Requirements:

- Node.js 22.6 or newer
- platform build tools required by Electron and the native audio module

```bash
npm install
npm run app:dev
```

Useful validation commands:

```bash
npm run typecheck:ts7
npm run typecheck:electron
npm run build
npm run build:electron
npm test
```

## Privacy boundary

Meeting history remains in the local SQLite database. Content is sent to `chatgpt.com` only after an explicit user action. The ChatGPT window uses an isolated persistent Electron session so the user can sign in normally, and Natively never extracts or processes the response.

## Platform support

Natively supports macOS and Windows. Changes to audio capture, global shortcuts, screenshots, window behavior, permissions, packaging, or paths must preserve both platform implementations.
