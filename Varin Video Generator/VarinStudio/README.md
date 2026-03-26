# VarinStudio

Prompt-first React UI for the Rust `Varin` engine.

## Features

- Prompt Builder with title, topic details, sections, duration, audience, style, and smart options
- Generate storyboard-focused LLM prompt from your topic inputs
- Auto-generate section breakdown from duration
- Validate storyboard/scene JSON through `varin-cli build --input ...` before rendering
- Strict mode toggle: block render when validation fails (or allow render with warnings)
- Paste LLM output JSON and render directly
- Select final output path for MP4
- Uses repo FFmpeg by default: `ffmpeg/bin/ffmpeg.exe`
- Shows generation flow logs and live host resource snapshot
- Supports resource controls:
  - CPU ratio (max 0.70)
  - RAM ratio (max 0.70, default 0.65)
  - max threads
- Uses Varin live monitor mode by default (dynamic chunk resizing)

## Run

```powershell
cd VarinStudio
npm install
npm run dev
```

- UI: `http://localhost:5175` (or next free port)
- API: `http://localhost:8787`

## Notes

- API launches `cargo run --release -p varin-cli -- render ...` in `Varin/`.
- Prompt endpoint: `POST /api/llm-prompt/storyboard`.
- If Rust compilation fails with `link.exe not found`, install Visual C++ Build Tools workload (`Microsoft.VisualStudio.Workload.VCTools`).
