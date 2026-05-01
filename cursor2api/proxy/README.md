# Cursor API proxy (EziLearning)

Local service that exposes Anthropic-style and OpenAI-compatible HTTP APIs for Cursor’s chat backend. Used by the EziLearning backend when `CURSOR_API_URL` is set.

- **Run:** from the repo, `cd cursor2api && npm install && npm run dev` (see `../README.md`).
- **Logs UI:** http://localhost:3010/logs  
- **Config:** copy `config.yaml.example` to `config.yaml` in this folder.

For backend wiring, see **`../../docs/EZILEARNING_CURSOR_PROXY_SETUP.md`**.

## GPT model + smoke test

`config.yaml` / `config.yaml.example` use `cursor_model: "gpt-4o-mini"` so clients (e.g. MyGuide `LLM_MODEL`) stay aligned.

With the proxy running (`npm run dev`), check OpenAI chat completions:

```bash
cd proxy
npm run test:smoke-gpt
```

Or raw HTTP:

```bash
curl -s http://127.0.0.1:3010/v1/chat/completions -H "Content-Type: application/json" -d "{\"model\":\"gpt-4o-mini\",\"messages\":[{\"role\":\"user\",\"content\":\"Say hi\"}],\"max_tokens\":50}"
```

If you see **403 / Access denied** from Cursor upstream, complete Cursor session setup per `../../docs/EZILEARNING_CURSOR_PROXY_SETUP.md` (cookies / `x-is-human` as documented there).
