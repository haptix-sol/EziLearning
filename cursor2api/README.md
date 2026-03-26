# Cursor API proxy

OpenAI-compatible service for the EziLearning backend. Implementation is in **`proxy/`**; this folder is a thin npm wrapper so you run everything from **`cursor2api/`**.

## Setup

```bash
cd cursor2api
npm install
```

(`postinstall` installs dependencies in `proxy/`.)

## Run

```bash
npm run dev
```

Default URL: **http://localhost:3010**

### Without postinstall (CI / offline)

```bash
npm install --prefix proxy --ignore-scripts
```

(from repo root you can use `.\scripts\setup-cursor2api.ps1`)

## Backend

In `backend/.env`:

```env
CURSOR_API_URL=http://localhost:3010/v1
CURSOR_API_KEY=ezilearning-local
CURSOR_API_MODEL=kimi-k2.5
```

See **`docs/EZILEARNING_CURSOR_PROXY_SETUP.md`**.
