# ManimGL golden reference scenes

Tiny scenes used to generate **golden** stills or clips for Varin parity work.

**Prerequisite:** `uv sync` in `backend/manim` (installs `manimgl` 1.7.x).

## Commands

Run from **`backend/manim`**:

```powershell
# Last frame PNG (smoke test)
uv run manimgl scenes/golden_reference/golden_scenes.py GoldenStaticSquare -s

# Write video file
uv run manimgl scenes/golden_reference/golden_scenes.py GoldenFadeInSquare -w

# List of scene classes: GoldenStaticSquare, GoldenFadeInSquare, GoldenTransformSquareToCircle, GoldenMovingSquare
```

Copy outputs next to Varin tests:

```text
backend/Varin/tests/golden/manim_gl/output/
```

(Create `output` if missing; it is gitignored at the Varin tree.)

## Scene list

| Class | Intent |
|-------|--------|
| `GoldenStaticSquare` | Baseline geometry + stroke |
| `GoldenFadeInSquare` | Opacity / fade-in motion |
| `GoldenTransformSquareToCircle` | `Transform` interpolation |
| `GoldenMovingSquare` | Simple translation over time |
