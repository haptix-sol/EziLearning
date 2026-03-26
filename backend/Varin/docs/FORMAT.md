# Varin Scene Format (v1)

Varin uses a declarative JSON scene model. A scene is **data**, not executable code.

## Top-level

```json
{
  "version": "v1",
  "duration_seconds": 10,
  "canvas": { "width": 1280, "height": 720, "fps": 30, "background_rgba": [20, 22, 34, 255] },
  "layers": [ ... ],
  "animations": [ ... ]
}
```

- `version`: must be `"v1"`.
- `duration_seconds`: total scene duration.
- `canvas`: output frame shape/FPS.
- `camera`: optional camera baseline (`x`, `y`, `zoom`, `rotation_deg`).
- `layers`: draw order (first = back).
- `animations`: keyframe tracks targeting layer IDs.
- `camera_animations`: keyframe tracks for camera movement/zoom/rotation.
- `timeline`: optional animation specs (`create`, `write`, `transform`, `fade_in`, `fade_out`) with lag timing.
  - also supports `uncreate`, `rotate`, `grow_from_center`, `move_along_path`, `homotopy`
  - plus lifecycle/segment metadata for `add`/`remove`/`replace` and play/wait spans
  - plus explicit group semantics (`animation_group`, `succession`)

Schema: `schemas/scene.v1.json`.

## Layers

Each layer has:

- `id` (unique)
- optional `transform`: `x`, `y`, `scale_x`, `scale_y`, `rotation_deg`
- optional `z_index`: draw order priority (higher renders on top)
- optional `style`: `fill_rgba`, `stroke_rgba`, `stroke_width`, `opacity`, `draw_progress`, `line_height_mult`, `text_max_width`
- primitive `type` and primitive fields

Supported primitives in v1:

- `rect`: `width`, `height`, optional `corner_radius`
- `circle`: `radius`
- `ellipse`: `radius_x`, `radius_y`
- `line`: `x1`, `y1`, `x2`, `y2` (local-space points)
- `arrow`: `x1`, `y1`, `x2`, `y2`, optional `tip_length`, `tip_width`
- `polyline`: `points` (`[[x,y], ...]`, min 2)
- `polygon`: `points` (`[[x,y], ...]`, min 3)
- `text`: `text`, optional `font_size`, optional `font_family`, optional `font_path`
- `image`: `path`, `width`, `height` (renders raster image or placeholder if not loadable)

## Animation tracks

`track_type = "float"`:

- `property`: `x`, `y`, `scale_x`, `scale_y`, `rotation_deg`, `opacity`, `stroke_width`, `width`, `height`, `radius`, `radius_x`, `radius_y`, `font_size`, `x1`, `y1`, `x2`, `y2`, `tip_length`, `tip_width`, `draw_progress`
- `keyframes`: `[{ "t": 0, "value": 0, "easing_to_next": "ease_in_out" }, ...]`

`track_type = "color"`:

- `property`: `fill_rgba` or `stroke_rgba`
- `keyframes`: `[{ "t": 0, "value": [r,g,b,a], "easing_to_next": "linear" }, ...]`

`camera_animations`:

- `track_type = "float"`
- `property`: `x`, `y`, `zoom`, `rotation_deg`
- `keyframes`: same float keyframe format

`timeline.specs`:

- `target`: layer id
- `kind`: `create`, `show_increasing_subsets`, `write`, `draw_border_then_fill`, `uncreate`, `transform`, `replacement_transform`, `fade_in`, `fade_out`, `v_fade_in`, `v_fade_out`, `fade_transform`, `fade_transform_pieces`, `rotate`, `grow_from_center`, `grow_from_point`, `move_along_path`, `homotopy`, `phase_flow`, `preset_enter_soft`, `preset_enter_rise`, `preset_exit_soft`, `preset_exit_drop`, `preset_emphasis_pulse`, `preset_transition_morph`, `preset_transition_crossfade`, `preset_text_typewriter`, `preset_text_pop_in`, `preset_text_glow_pulse`
- New shape/vector/math presets:
  - `preset_shape_draw_rect`, `preset_shape_draw_square`, `preset_shape_draw_circle`, `preset_shape_draw_line`, `preset_shape_draw_polygon`
  - `preset_arrow_outside_point`, `preset_connector_safe_route`
  - `preset_box_with_subbox_inside`, `preset_box_with_subbox_overlap`
  - `preset_formula_step_reveal`, `preset_vector_flow_block_reveal`
- `start`, `run_time`, `lag_ratio`, `group_index`, `group_size`
- optional transform/fade params: `shift_x`, `shift_y`, `scale_from`, `scale_to`, `path_arc_deg`, `replace_with`, `to_x`, `to_y`, `to_scale_x`, `to_scale_y`, `to_rotation_deg`
- optional preset input contract:
  - axes/anchor style inputs: `axis_x`, `axis_y`, `axis_width`, `axis_height`
  - style overrides: `preset_fill_rgba`, `preset_stroke_rgba`, `preset_text_rgba`
  - optional label/layout targeting: `label_text`, `layout_target`
  - optional sub-box composition: `sub_box_mode` (`inside` or `overlap`), `sub_box_offset_x`, `sub_box_offset_y`, `sub_box_width`, `sub_box_height`
  - opt-in readability safety: `avoid_overlap`, `arrows_outside`, `layout_padding`, `label_padding`
  - connector routing controls:
    - `connector_side_preference`: `auto`, `left`, `right`, `top`, `bottom`
    - `connector_path_mode`: `direct`, `elbow_horizontal_first`, `elbow_vertical_first`, `elbow_auto`
    - `connector_elbow_ratio`: bend ratio in `(0,1)` when elbow path mode is used
- movement/deformation params:
  - `path_points` for `move_along_path`
  - `homotopy_amp_x`, `homotopy_amp_y`, `homotopy_freq`, `homotopy_phase_deg` for `homotopy`
  - `to_x`/`to_y` drift + homotopy params for `phase_flow`

`timeline.lifecycle`:

- `t`: event time
- `action`: `add`, `remove`, `replace`
- `target`: layer id
- `with`: replacement layer id (for `replace`)

`timeline.segments`:

- `segment_type`: `play` or `wait`
- `play`: `start`, `run_time`, `spec_indices`
- `wait`: `start`, `duration`

`timeline.groups`:

- `mode`: `animation_group` or `succession`
- `start`, `run_time`, `spec_indices`
- optional `lag_ratio` (`animation_group` overlap control)

Easing values:

- `linear`
- `ease_in`
- `ease_out`
- `ease_in_out`
- `rush_into`
- `rush_from`
- `there_and_back`
- `overshoot`

`draw_progress` is useful for reveal animations (for example progressive line draws and staged text/shape writing).  
For dense text scenes, use `line_height_mult` and `text_max_width` to avoid line overlap.

## Predefined animation library (phase-1)

You can use the built-in preset `kind` values to avoid hand-tuning many fields:

- `preset_enter_soft`: gentle fade/scale in
- `preset_enter_rise`: fade in while rising upward
- `preset_exit_soft`: gentle fade/scale out
- `preset_exit_drop`: fade out while dropping downward
- `preset_emphasis_pulse`: short pulse emphasis
- `preset_transition_morph`: replacement transition that morphs source -> target
- `preset_transition_crossfade`: replacement transition that crossfades source -> target
- `preset_text_typewriter`: progressive text reveal using `draw_progress`
- `preset_text_pop_in`: text pop-in with fade/scale
- `preset_text_glow_pulse`: subtle text emphasis pulse via opacity shaping

Guardrails:

- transition presets require `replace_with`
- preset kinds reject manual transform/path override fields (`to_x`, `to_y`, `to_scale_x`, `to_scale_y`, `to_rotation_deg`, `path_points`) to avoid conflicting instructions
- text presets (`preset_text_*`) require the target layer to be of `type: text`
- layout safety behavior is opt-in and only applied when `avoid_overlap` and/or `arrows_outside` is true
- unknown preset `kind` values fail schema/serde validation

Font resolution order for text layers:

1. `font_path` on the text layer
2. `font_family` mapping (e.g. `arial`, `segoe_ui`, `consolas`, `dejavu_sans`)
3. `VARIN_FONT_PATH` environment variable
4. OS defaults

## Rust Scene API

Varin also ships a Rust authoring API (`varin_core::builder`) with `SceneBuilder`, `play`, `wait`, and animation constructors.

Generate a Rust-authored scene JSON scaffold:

```powershell
cargo run --release -p varin-cli -- scaffold-rust-scene --output .\examples\rust_api_demo.json
```

## CLI

```powershell
cargo run --release -p varin-cli -- render `
  --input .\examples\binary_search.json `
  --output .\output\binary-search.mp4 `
  --ffmpeg ffmpeg `
  --width 1280 --height 720 --fps 30 `
  --cpu-ratio 0.70 --ram-ratio 0.65 --max-threads 8
```

Storyboard render (scene-by-scene with narration):

```powershell
cargo run --release -p varin-cli -- render-storyboard `
  --input .\examples\oop_tutorial_storyboard.json `
  --output .\output\oop-tutorial-storyboard.mp4 `
  --ffmpeg ffmpeg
```

## Storyboard templates (`scene_template`)

Storyboard scenes can be authored in compact DSL form:

```json
{
  "id": "demo",
  "visual_instruction": "compact template scene",
  "narration": "Narration here",
  "scene_template": "flow_chain",
  "template_params": {
    "title": "Flow Chain",
    "count": 5,
    "labels": ["A", "B", "C", "D", "E"],
    "spacing": 210,
    "routing_mode": "elbow_auto",
    "multi_arrow": true,
    "layout_padding": 20,
    "label_padding": 22
  }
}
```

Supported template names:

- `flow_chain`
- `org_diagram`
- `process_swimlane`
- `math_formula_pack`
- `timeline_pack`
- `building_city_pack`

Also supported legacy templates:

- `house_bank_compare`
- `formula_vector_flow`
- `bank_flow_journey`
- `recap_board`

Shared `template_params` contract:

- `title` (`string`): scene title text.
- `count` (`number`): number of generated nodes/lanes/milestones/buildings.
- `labels` (`string[]`): optional labels for generated nodes.
- `spacing` (`number`): spacing between repeated generated items.
- `routing_mode` (`string`): `direct` | `elbow_horizontal_first` | `elbow_vertical_first` | `elbow_auto`.
- `multi_arrow` (`bool`): render additional connector routes where supported.
- `layout_padding` (`number`): connector layout safety padding.
- `label_padding` (`number`): connector-to-label clearance.
- `text_duration` (`number`): default text reveal duration.
- `shape_duration` (`number`): default shape reveal duration.
- `connector_duration` (`number`): default connector animation duration.

Template-specific notes:

- `math_formula_pack` supports `formula`, `step2`, `step3` (or `labels`) for formula reveals.
- `flow_chain` supports `y` for vertical positioning.
- `timeline_pack` uses `count` + `labels` for milestones.

## Storyboard composition mode (`scene_composition`)

`scene_composition` provides a Remotion-style authoring layer that expands into `scene_explanatory` at build/render time.

```json
{
  "id": "compose_demo",
  "visual_instruction": "composition based scene",
  "narration": "Narration here",
  "scene_composition": {
    "variant": "neon",
    "tracks": [
      { "id": "pan_right", "lane": "camera", "start": 1.0, "duration": 2.0 },
      { "id": "chroma_pulse", "lane": "fx", "start": 3.0, "duration": 1.2 }
    ],
    "components": [
      { "kind": "scene_title", "text": "Varin Composition", "x": 640, "y": 92, "start": 0.0, "duration": 0.9 },
      { "kind": "flow", "labels": ["Compose", "Expand", "Render"], "x": 640, "y": 350, "width": 760, "start": 0.7, "duration": 1.0 },
      { "kind": "metric_tile", "text": "Fast Authoring", "x": 640, "y": 560, "start": 1.4, "duration": 0.8 }
    ],
    "camera_moves": [
      { "kind": "pan_right", "start": 1.0, "duration": 2.0, "intensity": 1.0 },
      { "kind": "chroma_pulse", "start": 3.0, "duration": 1.2, "intensity": 1.0 }
    ]
  }
}
```

Supported component kinds:

- `scene_title`
- `flow`
- `card`
- `metric_tile`
- `callout`
- `grid`
- `chapter_bumper`
- `split_compare`
- `code_window`
- `montage_strip`

Supported camera/effects move kinds:

- `pan_left`
- `pan_right`
- `zoom_in`
- `parallax`
- `chroma_pulse`
- `camera_settle`
- `orbit`
- `elastic`
- `swipe`
- `wipe`
- `push`

Generated sidecars for interactive players:

- `<video>.chapters.json`
- `<video>.hotspots.json`

Run aliases:

```powershell
cargo run --release -p varin-cli -- run storyboard --input .\examples\oop_tutorial_storyboard.json --output .\output\oop-tutorial-storyboard.mp4
cargo run --release -p varin-cli -- run scene --input .\examples\binary_search.json --output .\output\binary-search.mp4
cargo run --release -p varin-cli -- run dev --port 4173 --dir .\output
```

Timing reconciliation and preflight:

```powershell
cargo run --release -p varin-cli -- sync --input .\examples\oop_tutorial_storyboard.json --output .\output\oop-tutorial-storyboard.srt
cargo run --release -p varin-cli -- build --input .\examples\oop_tutorial_storyboard.json
cargo run --release -p varin-cli -- build --input .\examples\preset_library_showcase.json
```

Brief-driven auto planning (scene count and pacing are generated from content length):

```json
{
  "version": "v1",
  "brief": "Explain Java OOP with practical examples.",
  "target_minutes": 5.0,
  "style": "high_quality"
}
```

Width/height/FPS flags override the JSON canvas values.

### Resource controls

- `--cpu-ratio` (default `0.70`, clamped max `0.70`): worker fraction of logical CPU cores.
- `--ram-ratio` (default `0.65`, clamped max `0.70`): max fraction of currently free RAM used for buffered frame chunks.
- `--max-threads`: hard cap for worker threads.
- `--no-hw-encode`: disables automatic NVENC selection.
- `--no-live-monitor`: disables dynamic chunk resizing and resource telemetry logs.

The renderer generates frames in parallel chunks bounded by the RAM budget, then streams those chunks to FFmpeg.
