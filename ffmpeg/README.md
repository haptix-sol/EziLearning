# Local FFmpeg (optional)

Place a **Windows build** of FFmpeg here so the backend can use it without a system-wide install.

## Layout (required)

After extraction, you should have either:

- `ffmpeg/bin/ffmpeg.exe` — **recommended** (official “essentials” / full build zip from Gyan or BtbN), or  
- `ffmpeg/ffmpeg.exe` — if you put only the executable in this folder.

Example (Gyan full build):

1. Download a release from [Gyan FFmpeg builds](https://www.gyan.dev/ffmpeg/builds/) (e.g. `ffmpeg-release-essentials.zip`).
2. Extract the zip.
3. Rename the inner folder to `ffmpeg` and move it **into this directory** (next to this `README.md`), so `bin/ffmpeg.exe` lives at `EziLearnings/ffmpeg/bin/ffmpeg.exe`.

Resolution is centralized in `backend/core/ffmpeg_paths.py` (used by video merge and TTS audio helpers).

### Environment variables (`backend/.env`)

| Variable | Purpose |
|----------|---------|
| `FFMPEG_PATH` | Optional override. Example: `../ffmpeg/bin/ffmpeg.exe` (Windows) or `../ffmpeg/bin/ffmpeg` (Linux/macOS). Paths are resolved relative to the `backend/` directory unless absolute. |
| `FFPROBE_PATH` | Optional. Usually omitted — `ffprobe` is picked up next to `ffmpeg` in the same `bin/` folder. |

### Auto-discovery order (if env not set or path missing)

1. **`../ffmpeg/bin/`** at the repository root (this folder — preferred)
2. `backend/ffmpeg/bin/` (legacy)
3. Windows winget Gyan.FFmpeg install
4. `PATH`

Restart the backend after adding binaries or changing `.env`.
