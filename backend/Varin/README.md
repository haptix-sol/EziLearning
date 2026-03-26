# Varin Rust Engine

Varin is now a **Rust-native video engine** with a declarative scene format (JSON), frame rasterization, and FFmpeg encode.

## Layout

| Path | Purpose |
|------|---------|
| `Cargo.toml` | Rust workspace root |
| `crates/varin-core` | Scene types, timeline/keyframe evaluation, Rust scene builder API |
| `crates/varin-render` | Frame renderer + FFmpeg pipe (`RGBA -> H.264 MP4`) |
| `crates/varin-cli` | CLI (`varin render`, `varin run`, `varin sync`, `varin build`) |
| `schemas/scene.v1.json` | Scene JSON schema v1 |
| `examples/` | Example scenes (`binary_search.json`, `bubble_sort.json`, `geometry_showcase.json`, `preset_library_showcase.json`, `preset_transition_showcase.json`, `text_font_presets.json`, `oop_detailed_45s.json`, `oop_storyboard_scene_01_intro.json`, `oop_storyboard_scene_02_types.json`, `oop_tutorial_storyboard.json`) |
| `output/` | Rendered files (local build output, ignored) |
| `scripts/render_animations.ps1` | One-command render + copy to backend static assets |

## Requirements

- Rust toolchain (`cargo`)
- FFmpeg available on PATH (`ffmpeg`)

## Build

```powershell
cd Varin
cargo build --release
```

## Render examples

```powershell
cd Varin
cargo run --release -p varin-cli -- render --input .\examples\binary_search.json --output .\output\binary-search.mp4
cargo run --release -p varin-cli -- render --input .\examples\bubble_sort.json --output .\output\bubble-sort.mp4
```

Resource-aware tuning (defaults already apply):

```powershell
cargo run --release -p varin-cli -- render `
  --input .\examples\binary_search.json `
  --output .\output\binary-search.mp4 `
  --cpu-ratio 0.70 `
  --ram-ratio 0.65 `
  --max-threads 8
```

Disable dynamic chunk adjustment (fixed chunk mode):

```powershell
cargo run --release -p varin-cli -- render `
  --input .\examples\binary_search.json `
  --output .\output\binary-search.mp4 `
  --no-live-monitor
```

Or run the helper:

```powershell
.\scripts\render_animations.ps1
```

Generate a Rust-authored scene scaffold JSON:

```powershell
cargo run --release -p varin-cli -- scaffold-rust-scene --output .\examples\rust_api_demo.json
```

Render a scene-by-scene storyboard (JSON-first `scene_explanatory` + narration `edge-tts` audio):

```powershell
cargo run --release -p varin-cli -- render-storyboard `
  --input .\examples\oop_tutorial_storyboard.json `
  --output .\output\oop-tutorial-storyboard.mp4 `
  --ffmpeg ffmpeg
```

Render new preset/layout-safety demos:

```powershell
cargo run --release -p varin-cli -- render `
  --input .\examples\preset_shape_layout_safety_demo.json `
  --output .\output\preset-shape-layout-safety.mp4 `
  --ffmpeg ffmpeg

cargo run --release -p varin-cli -- render `
  --input .\examples\preset_vector_formula_demo.json `
  --output .\output\preset-vector-formula.mp4 `
  --ffmpeg ffmpeg

cargo run --release -p varin-cli -- render `
  --input .\examples\preset_polyline_elbow_flow_demo.json `
  --output .\output\preset-polyline-elbow-flow.mp4 `
  --ffmpeg ffmpeg

cargo run --release -p varin-cli -- render `
  --input .\examples\preset_polyline_elbow_vertical_demo.json `
  --output .\output\preset-polyline-elbow-vertical.mp4 `
  --ffmpeg ffmpeg
```

Ergonomic aliases:

```powershell
# run a storyboard
cargo run --release -p varin-cli -- run storyboard `
  --input .\examples\oop_tutorial_storyboard.json `
  --output .\output\oop-tutorial-storyboard.mp4 `
  --quality-profile standard

# run a single scene
cargo run --release -p varin-cli -- run scene `
  --input .\examples\binary_search.json `
  --output .\output\binary-search.mp4 `
  --quality-profile draft

# sync storyboard captions/timings only
cargo run --release -p varin-cli -- sync `
  --input .\examples\oop_tutorial_storyboard.json `
  --output .\output\oop-tutorial-storyboard.srt

# validate inputs/preflight
cargo run --release -p varin-cli -- build --input .\examples\oop_tutorial_storyboard.json

# local preview server
cargo run --release -p varin-cli -- run dev --port 4173 --dir .\output
```

Legacy brief/planner mode (optional, disabled by default):

```powershell
cargo run --release -p varin-cli -- run storyboard `
  --input .\examples\auto_brief_1min.json `
  --output .\output\auto-brief-1min.mp4 `
  --legacy-brief

cargo run --release -p varin-cli -- run storyboard `
  --input .\examples\auto_brief_5min.json `
  --output .\output\auto-brief-5min.mp4 `
  --legacy-brief
```

Full-feature Java OOP explainer (JSON-first DSL scenes):

```powershell
cargo run --release -p varin-cli -- run storyboard `
  --input .\examples\java_oops_full_explainer.json `
  --output .\output\java-oops-full-explainer.mp4 `
  --ffmpeg ffmpeg
```

Enhanced cinematic Java OOP 5-minute tutorial (Remotion + Manim inspired, Varin-native):

```powershell
cargo run --release -p varin-cli -- run storyboard `
  --input .\examples\java_oops_explicit_storyboard_5min.json `
  --output .\output\java-oops-5min-enhanced-varin.mp4 `
  --quality-profile standard
```

Coffee mug object-drawing sample (all geometry + animation from JSON):

```powershell
cargo run --release -p varin-cli -- run storyboard `
  --input .\examples\coffee_mug_scene_explanatory.json `
  --output .\output\coffee-mug-json-first.mp4 `
  --ffmpeg ffmpeg
```

Compact template-based storyboard example (very low LOC authoring):

```powershell
cargo run --release -p varin-cli -- run storyboard `
  --input .\examples\java_oops_compact_template_storyboard.json `
  --output .\output\java-oops-compact-template.mp4 `
  --quality-profile draft
```

Template packs (flow/org/process/math/timeline/building):

```powershell
cargo run --release -p varin-cli -- run storyboard `
  --input .\examples\template_packs_showcase_storyboard.json `
  --output .\output\template-packs-showcase.mp4 `
  --quality-profile draft
```

Composition showcase (Remotion-style authoring on Varin renderer):

```powershell
cargo run --release -p varin-cli -- compose scaffold --output .\examples\compose_scaffold_storyboard.json
cargo run --release -p varin-cli -- compose render `
  --input .\examples\composition_showcase_storyboard.json `
  --output .\output\composition-showcase.mp4 `
  --quality-profile standard
cargo run --release -p varin-cli -- compose preview --port 4173 --dir .\output
```

Benchmark reference for composition mode:

- `docs/COMPOSITION_BENCHMARK.md`

Single-pack examples:

```powershell
cargo run --release -p varin-cli -- run storyboard --input .\examples\template_flow_chain_storyboard.json --output .\output\template-flow-chain.mp4 --quality-profile draft
cargo run --release -p varin-cli -- run storyboard --input .\examples\template_org_diagram_storyboard.json --output .\output\template-org-diagram.mp4 --quality-profile draft
cargo run --release -p varin-cli -- run storyboard --input .\examples\template_process_swimlane_storyboard.json --output .\output\template-process-swimlane.mp4 --quality-profile draft
cargo run --release -p varin-cli -- run storyboard --input .\examples\template_math_formula_pack_storyboard.json --output .\output\template-math-formula-pack.mp4 --quality-profile draft
cargo run --release -p varin-cli -- run storyboard --input .\examples\template_timeline_pack_storyboard.json --output .\output\template-timeline-pack.mp4 --quality-profile draft
cargo run --release -p varin-cli -- run storyboard --input .\examples\template_building_city_pack_storyboard.json --output .\output\template-building-city-pack.mp4 --quality-profile draft
```

## Scene format

See [`docs/FORMAT.md`](docs/FORMAT.md) for scene structure, camera tracks, timeline animation specs, and Rust SceneBuilder usage.

## Notes

- The v1 renderer exposes feature flags `skia-backend` and `wgpu-backend`; v1 implementation uses the skia renderer path.
- Default storyboard mode expects explicit scenes with `scene_explanatory` blocks (JSON-first).
- Use `--legacy-brief` only when intentionally running old brief->planner->director flow.
- v1 `text` primitive is a compact label-block renderer aimed at speed and deterministic output.
- v1 now supports pseudo-3D `cube` / `cuboid` primitives (staged path toward future true-3D backend hooks).
- Text layers support optional `font_family` / `font_path` overrides with fallback to `VARIN_FONT_PATH` and OS defaults.
- Frame generation is parallelized in RAM-bounded chunks; RAM budget is capped to at most 70% of currently free memory and defaults to 65%.
- If NVIDIA GPU is present and FFmpeg supports NVENC, encoder switches to `h264_nvenc`; otherwise it uses `libx264`.
- Use `--quality-profile draft|standard|final` to switch runtime presets quickly (`draft` fastest, `final` most conservative quality pass).
- Storyboard scenes now support optional `scene_template` + `template_params` for compact reusable motif authoring.
- New template packs include: `flow_chain`, `org_diagram`, `process_swimlane`, `math_formula_pack`, `timeline_pack`, `building_city_pack`.
