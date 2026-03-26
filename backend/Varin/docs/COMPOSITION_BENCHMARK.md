# Composition Benchmark (Remotion-Style on Varin)

Date: 2026-03-23  
Machine: Windows (local developer workstation)

## Input

- Composition storyboard: `examples/composition_showcase_storyboard.json`
- Template storyboard reference: `examples/template_packs_showcase_storyboard.json`

## Render Settings

- Draft benchmark:
  - `--quality-profile draft`
  - `--no-hw-encode --max-threads 4 --cpu-ratio 0.35 --ram-ratio 0.4 --scene-workers 1`
- Standard benchmark:
  - `--quality-profile standard`
  - `--no-hw-encode --max-threads 4 --cpu-ratio 0.45 --ram-ratio 0.5 --scene-workers 1`

## Results

| Case | Time (s) | Output |
|---|---:|---|
| Composition Draft Cold | 63.72 | `output/composition-showcase-cold.mp4` |
| Composition Draft Warm | 8.10 | `output/composition-showcase-warm.mp4` |
| Composition Standard | 20.92 | `output/composition-showcase-standard.mp4` |

## Authoring LOC Snapshot

| Storyboard | Lines |
|---|---:|
| composition_showcase_storyboard.json | 52 |
| template_packs_showcase_storyboard.json | 84 |
| java_oops_explicit_storyboard_5min.json | 3486 |

## Notes

- Warm-cache speedup is significant due to scene and render segment cache reuse.
- Composition outputs now emit sidecar interaction metadata:
  - `*.chapters.json`
  - `*.hotspots.json`
- Sidecars are suitable for frontend interactive chapter navigation and timed hotspot UX while preserving MP4 compatibility.
