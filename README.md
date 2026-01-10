# Chutes LTX-2 Video Studio

A full-stack video generation studio for the LTX-2 chute on Chutes. It ships with a CLI for testing every feature first, then the same core generation logic is used by a web UI styled in the Chutes dark design language.

## Why LTX-2

LTX-2 is a Lightricks video generation model that supports text-to-video, image-to-video, and video-to-video workflows. The public model card highlights a distilled variant and multiple LoRA adapters to control camera motion and IC (image conditioning) structure. This studio exposes the full adapter library and pipeline modes in one workflow.

Reference model card: `https://huggingface.co/Lightricks/LTX-2`

## Features

- Full LTX-2 request surface: text, image, keyframes, and video conditioning.
- All LoRAs available (IC control + camera motion), with strength sliders.
- Pipeline-aware validation for `two_stage`, `distilled`, `ic_lora`, and `keyframe_interp`.
- Chutes IDP (“Sign in with Chutes”) login for user-token inference, with API key fallback.
- CLI + web app share the same request builder and validation logic.

## Project layout

- `src/core`: shared request building, validation, and Chutes invocation helpers.
- `src/cli.js`: CLI entrypoint.
- `src/server.js`: Express server + IDP flow + API routes.
- `public/`: static UI assets.
- `tests/`: unit + integration tests.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3030`.

### Environment variables

Required for production:
- `CHUTES_API_KEY`
- `CHUTES_IDP_CLIENT_ID`
- `CHUTES_IDP_CLIENT_SECRET`
- `CHUTES_IDP_REDIRECT_URI`
- `SESSION_SECRET`
- `APP_URL`

Optional:
- `CHUTES_LTX2_BASE_URL` (defaults to `https://chutes-ltx-2.chutes.ai`)
- `CHUTES_IDP_DISABLE_PKCE` (set `true` only if the IDP returns errors for PKCE)

## CLI usage

List LoRAs:
```bash
node src/cli.js list-loras
```

Generate a short clip:
```bash
node src/cli.js generate \
  --prompt "An orbital dolly-in over neon dunes" \
  --width 768 --height 512 \
  --num-frames 24 --num-inference-steps 10 \
  --lora camera-dolly-in:1.1 \
  --out output.mp4
```

Dry-run and validate request payload:
```bash
node src/cli.js generate --prompt "Studio lighting" --dry-run
```

Keyframes via files:
```bash
node src/cli.js generate \
  --prompt "A sweeping canyon" \
  --pipeline keyframe_interp \
  --keyframe /path/a.png:0:1.0 \
  --keyframe /path/b.png:40:1.0
```

## Web API

- `GET /api/loras` → LoRA library metadata.
- `POST /api/generate` → LTX-2 generation request (JSON body mirrors chute input).
- `GET /api/auth/me` → session status for UI.
- `POST /api/auth/logout` → sign out.

## Sign in with Chutes (IDP)

1. Create an IDP app with the Chutes API key:
   ```bash
   curl -X POST "https://api.chutes.ai/idp/apps" \
     -H "Authorization: $CHUTES_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Chutes LTX Video Studio",
       "description": "LTX-2 studio",
       "redirect_uris": ["https://chutes-ltx-video-studio.onrender.com/auth/callback", "http://localhost:3030/auth/callback"],
       "homepage_url": "https://chutes-ltx-video-studio.onrender.com",
       "allowed_scopes": ["openid", "profile", "chutes:invoke"]
     }'
   ```
2. Store the returned client ID/secret in `.env` and Render env vars.

Reference docs:
- `/home/flori/Dev/chutes/chutes_idp/README.md`
- `/home/flori/Dev/chutes/chutes_idp/howto.md`

## Tests

```bash
npm test
```

## Deploy on Render

1. Push this repo to GitHub.
2. Create a Render Web Service pointing at `fstandhartinger/chutes-ltx-video-studio`.
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add env vars from `.env`.

## Related docs

- Chutes project memory: `/home/flori/Dev/chutes/affine/memory.md`
- Chutes design system: `/home/flori/Dev/chutes/style/chutes_style.md`
- Chutes IDP guide: `/home/flori/Dev/chutes/chutes_idp/howto.md`
