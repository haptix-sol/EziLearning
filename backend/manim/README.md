# Manim (optional experiments)

All **Manim** tooling for this repo lives in **`backend/manim/`**. It is a **standalone** uv project for local experiments and golden-reference scenes; the FastAPI app does **not** import it.

## Install

From this directory:

```bash
cd backend/manim
uv sync
```

This creates a **local `.venv/`** here with **Manim Community** (`manim`) and **ManimGL** (`manimgl`).

Run CLIs via uv:

```bash
uv run manim --version
uv run manimgl --help
```

## Layout

| Path | Purpose |
|------|---------|
| `pyproject.toml` / `uv.lock` | Locked Manim dependencies |
| `ezilearning_manim/` | Minimal package stub (required for the uv project) |
| `scenes/` | Add your comparison / experiment scripts here |

## System dependencies

- **FFmpeg** — useful alongside Manim renders; see [`../README.md`](../README.md) for how the API resolves binaries.
- **Manim Community** — Cairo/Pango wheels on many platforms; LaTeX optional for math.
- **ManimGL** — OpenGL; interactive `manimgl` workflow.

If `uv lock` / `uv sync` ever fails with both forks, use two separate folders or drop one dependency from `pyproject.toml` temporarily.
