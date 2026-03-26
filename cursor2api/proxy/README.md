# Cursor API proxy (EziLearning)

Local service that exposes Anthropic-style and OpenAI-compatible HTTP APIs for Cursor’s chat backend. Used by the EziLearning backend when `CURSOR_API_URL` is set.

- **Run:** from the repo, `cd cursor2api && npm install && npm run dev` (see `../README.md`).
- **Logs UI:** http://localhost:3010/logs  
- **Config:** copy `config.yaml.example` to `config.yaml` in this folder.

For backend wiring, see **`../../docs/EZILEARNING_CURSOR_PROXY_SETUP.md`**.
