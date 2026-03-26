use crate::director::{materialize_planned_scene, SceneRenderConfig};
use crate::planner::{plan_from_brief, BriefInput, PlannedScene, SceneTemplate};
use crate::cache;
use anyhow::{anyhow, bail, Context, Result};
use rayon::prelude::*;
use rayon::ThreadPoolBuilder;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use varin_core::{
    AnimationKind, AnimationSpec, Canvas, Easing, Layer, Primitive, Scene, SceneTimeline, Style,
    ConnectorPathMode, ConnectorSidePreference, SubBoxMode, TimelineSegment, Transform,
};
use varin_render::{render_scene_to_mp4, RenderOptions};

#[derive(Debug, Deserialize)]
struct Storyboard {
    version: String,
    scenes: Vec<StoryboardScene>,
}

#[derive(Debug, Deserialize)]
struct StoryboardBrief {
    version: String,
    #[serde(default)]
    title: Option<String>,
    brief: String,
    target_minutes: Option<f32>,
    #[serde(default)]
    style: Option<String>,
    #[serde(default)]
    sections: Vec<String>,
    #[serde(default)]
    concept_density: Option<String>,
    #[serde(default)]
    animation_intensity: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct StoryboardScene {
    id: String,
    #[serde(default)]
    scene_path: Option<String>,
    #[serde(default)]
    visual_instruction: String,
    #[serde(default)]
    narration: String,
    #[serde(default)]
    caption: String,
    #[serde(default)]
    scene_explanatory: Option<SceneExplanatory>,
    #[serde(default)]
    scene_template: Option<String>,
    #[serde(default)]
    template_params: Option<Value>,
    #[serde(default)]
    scene_composition: Option<SceneComposition>,
    #[serde(default)]
    shot_list: Vec<ShotDescriptor>,
    duration_seconds: Option<f32>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
struct ShotDescriptor {
    #[serde(default)]
    angle: String,
    #[serde(default)]
    start: f32,
    #[serde(default = "default_anim_run_time")]
    duration: f32,
    #[serde(default)]
    intensity: Option<f32>,
    #[serde(default)]
    effect: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
struct SceneComposition {
    #[serde(default)]
    variant: Option<String>,
    #[serde(default)]
    tracks: Vec<CompositionTrack>,
    #[serde(default)]
    components: Vec<CompositionComponent>,
    #[serde(default)]
    camera_moves: Vec<CompositionCameraMove>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
struct CompositionTrack {
    id: String,
    #[serde(default)]
    lane: Option<String>,
    #[serde(default)]
    start: f32,
    #[serde(default = "default_anim_run_time")]
    duration: f32,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
struct CompositionComponent {
    kind: String,
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    text: Option<String>,
    #[serde(default)]
    labels: Vec<String>,
    #[serde(default)]
    x: Option<f32>,
    #[serde(default)]
    y: Option<f32>,
    #[serde(default)]
    width: Option<f32>,
    #[serde(default)]
    height: Option<f32>,
    #[serde(default)]
    color: Option<[u8; 4]>,
    #[serde(default)]
    start: Option<f32>,
    #[serde(default)]
    duration: Option<f32>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
struct CompositionCameraMove {
    kind: String,
    #[serde(default)]
    start: f32,
    #[serde(default = "default_anim_run_time")]
    duration: f32,
    #[serde(default)]
    intensity: f32,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
struct SceneExplanatory {
    #[serde(default = "default_scene_version")]
    version: String,
    #[serde(default)]
    width: Option<u32>,
    #[serde(default)]
    height: Option<u32>,
    #[serde(default)]
    fps: Option<u32>,
    #[serde(default)]
    background_rgba: Option<[u8; 4]>,
    #[serde(default)]
    layers: Vec<ExplainLayer>,
    #[serde(default)]
    beats: Vec<ExplainBeat>,
    #[serde(default)]
    camera: Option<ExplainCameraState>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct ExplainCameraState {
    #[serde(default)]
    x: f32,
    #[serde(default)]
    y: f32,
    #[serde(default)]
    z: f32,
    #[serde(default = "default_scale")]
    zoom: f32,
    #[serde(default)]
    rotation_deg: f32,
    #[serde(default)]
    yaw_deg: f32,
    #[serde(default)]
    pitch_deg: f32,
    #[serde(default)]
    roll_deg: f32,
    #[serde(default = "default_camera_fov")]
    fov: f32,
    #[serde(default = "default_camera_near")]
    near: f32,
    #[serde(default = "default_camera_far")]
    far: f32,
}

impl Default for ExplainCameraState {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            z: 0.0,
            zoom: default_scale(),
            rotation_deg: 0.0,
            yaw_deg: 0.0,
            pitch_deg: 0.0,
            roll_deg: 0.0,
            fov: default_camera_fov(),
            near: default_camera_near(),
            far: default_camera_far(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct ExplainLayer {
    id: String,
    primitive: ExplainPrimitive,
    #[serde(default)]
    z_index: i32,
    #[serde(default)]
    transform: ExplainTransform,
    #[serde(default)]
    style: ExplainStyle,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
struct ExplainTransform {
    #[serde(default)]
    x: f32,
    #[serde(default)]
    y: f32,
    #[serde(default = "default_scale")]
    scale_x: f32,
    #[serde(default = "default_scale")]
    scale_y: f32,
    #[serde(default)]
    rotation_deg: f32,
    #[serde(default)]
    z: f32,
    #[serde(default)]
    yaw_deg: f32,
    #[serde(default)]
    pitch_deg: f32,
    #[serde(default)]
    roll_deg: f32,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
struct ExplainStyle {
    #[serde(default)]
    fill_rgba: Option<[u8; 4]>,
    #[serde(default)]
    stroke_rgba: Option<[u8; 4]>,
    #[serde(default)]
    stroke_width: Option<f32>,
    #[serde(default)]
    opacity: Option<f32>,
    #[serde(default)]
    draw_progress: Option<f32>,
    #[serde(default)]
    line_height_mult: Option<f32>,
    #[serde(default)]
    text_max_width: Option<f32>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ExplainPrimitive {
    Rect {
        width: f32,
        height: f32,
        #[serde(default)]
        corner_radius: f32,
    },
    Circle {
        radius: f32,
    },
    Ellipse {
        radius_x: f32,
        radius_y: f32,
    },
    Line {
        x1: f32,
        y1: f32,
        x2: f32,
        y2: f32,
    },
    Arrow {
        x1: f32,
        y1: f32,
        x2: f32,
        y2: f32,
        #[serde(default = "default_arrow_tip_length")]
        tip_length: f32,
        #[serde(default = "default_arrow_tip_width")]
        tip_width: f32,
    },
    Polyline {
        points: Vec<[f32; 2]>,
    },
    Polygon {
        points: Vec<[f32; 2]>,
    },
    Cube {
        size: f32,
        #[serde(default = "default_cube_depth_ratio")]
        depth_ratio: f32,
        #[serde(default = "default_projection_x")]
        projection_x: f32,
        #[serde(default = "default_projection_y")]
        projection_y: f32,
    },
    Cuboid {
        width: f32,
        height: f32,
        depth: f32,
        #[serde(default = "default_projection_x")]
        projection_x: f32,
        #[serde(default = "default_projection_y")]
        projection_y: f32,
    },
    MeshBlock {
        width: f32,
        height: f32,
        depth: f32,
        #[serde(default = "default_albedo")]
        albedo: [u8; 4],
        #[serde(default = "default_emissive")]
        emissive: [u8; 4],
        #[serde(default = "default_roughness")]
        roughness: f32,
        #[serde(default = "default_metallic")]
        metallic: f32,
    },
    Text {
        text: String,
        #[serde(default = "default_font_size")]
        font_size: f32,
        #[serde(default)]
        font_family: Option<String>,
        #[serde(default)]
        font_path: Option<String>,
    },
    Image {
        path: String,
        width: f32,
        height: f32,
    },
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct ExplainBeat {
    target: String,
    kind: AnimationKind,
    #[serde(default)]
    start: f32,
    #[serde(default = "default_anim_run_time")]
    duration: f32,
    #[serde(default)]
    easing: Easing,
    #[serde(default)]
    shift_x: f32,
    #[serde(default)]
    shift_y: f32,
    #[serde(default = "default_scale")]
    scale_from: f32,
    #[serde(default = "default_scale")]
    scale_to: f32,
    #[serde(default)]
    path_arc_deg: f32,
    #[serde(default)]
    path_points: Option<Vec<[f32; 2]>>,
    #[serde(default)]
    replace_with: Option<String>,
    #[serde(default)]
    to_x: Option<f32>,
    #[serde(default)]
    to_y: Option<f32>,
    #[serde(default)]
    to_scale_x: Option<f32>,
    #[serde(default)]
    to_scale_y: Option<f32>,
    #[serde(default)]
    to_rotation_deg: Option<f32>,
    #[serde(default)]
    homotopy_amp_x: f32,
    #[serde(default)]
    homotopy_amp_y: f32,
    #[serde(default = "default_homotopy_freq")]
    homotopy_freq: f32,
    #[serde(default)]
    homotopy_phase_deg: f32,
    #[serde(default)]
    axis_x: Option<f32>,
    #[serde(default)]
    axis_y: Option<f32>,
    #[serde(default)]
    axis_width: Option<f32>,
    #[serde(default)]
    axis_height: Option<f32>,
    #[serde(default)]
    label_text: Option<String>,
    #[serde(default)]
    layout_target: Option<String>,
    #[serde(default)]
    sub_box_mode: Option<SubBoxMode>,
    #[serde(default)]
    sub_box_offset_x: Option<f32>,
    #[serde(default)]
    sub_box_offset_y: Option<f32>,
    #[serde(default)]
    sub_box_width: Option<f32>,
    #[serde(default)]
    sub_box_height: Option<f32>,
    #[serde(default)]
    preset_fill_rgba: Option<[u8; 4]>,
    #[serde(default)]
    preset_stroke_rgba: Option<[u8; 4]>,
    #[serde(default)]
    preset_text_rgba: Option<[u8; 4]>,
    #[serde(default)]
    avoid_overlap: bool,
    #[serde(default)]
    arrows_outside: bool,
    #[serde(default = "default_layout_padding")]
    layout_padding: f32,
    #[serde(default = "default_label_padding")]
    label_padding: f32,
    #[serde(default)]
    connector_side_preference: Option<ConnectorSidePreference>,
    #[serde(default)]
    connector_path_mode: Option<ConnectorPathMode>,
    #[serde(default)]
    connector_elbow_ratio: Option<f32>,
}

impl Default for ExplainBeat {
    fn default() -> Self {
        Self {
            target: String::new(),
            kind: AnimationKind::Create,
            start: 0.0,
            duration: default_anim_run_time(),
            easing: Easing::Linear,
            shift_x: 0.0,
            shift_y: 0.0,
            scale_from: default_scale(),
            scale_to: default_scale(),
            path_arc_deg: 0.0,
            path_points: None,
            replace_with: None,
            to_x: None,
            to_y: None,
            to_scale_x: None,
            to_scale_y: None,
            to_rotation_deg: None,
            homotopy_amp_x: 0.0,
            homotopy_amp_y: 0.0,
            homotopy_freq: default_homotopy_freq(),
            homotopy_phase_deg: 0.0,
            axis_x: None,
            axis_y: None,
            axis_width: None,
            axis_height: None,
            label_text: None,
            layout_target: None,
            sub_box_mode: None,
            sub_box_offset_x: None,
            sub_box_offset_y: None,
            sub_box_width: None,
            sub_box_height: None,
            preset_fill_rgba: None,
            preset_stroke_rgba: None,
            preset_text_rgba: None,
            avoid_overlap: false,
            arrows_outside: false,
            layout_padding: 0.0,
            label_padding: 0.0,
            connector_side_preference: None,
            connector_path_mode: None,
            connector_elbow_ratio: None,
        }
    }
}

fn default_scene_version() -> String {
    "v1".to_string()
}

fn default_scale() -> f32 {
    1.0
}

fn default_font_size() -> f32 {
    30.0
}

fn default_arrow_tip_length() -> f32 {
    18.0
}

fn default_arrow_tip_width() -> f32 {
    12.0
}

fn default_projection_x() -> f32 {
    18.0
}

fn default_projection_y() -> f32 {
    -14.0
}

fn default_cube_depth_ratio() -> f32 {
    0.62
}

fn default_albedo() -> [u8; 4] {
    [160, 180, 220, 255]
}

fn default_emissive() -> [u8; 4] {
    [0, 0, 0, 0]
}

fn default_roughness() -> f32 {
    0.65
}

fn default_metallic() -> f32 {
    0.15
}

fn default_camera_fov() -> f32 {
    900.0
}

fn default_camera_near() -> f32 {
    0.1
}

fn default_camera_far() -> f32 {
    2000.0
}

fn default_anim_run_time() -> f32 {
    1.0
}

fn default_homotopy_freq() -> f32 {
    1.0
}

fn default_layout_padding() -> f32 {
    10.0
}

fn default_label_padding() -> f32 {
    16.0
}

const EDGE_TTS_VOICE: &str = "en-US-AriaNeural";

pub fn render_storyboard_cmd(
    input: &Path,
    output: &Path,
    options: &RenderOptions,
    allow_legacy_brief: bool,
    scene_workers: usize,
    timings_json: Option<&Path>,
) -> Result<()> {
    let total_t0 = Instant::now();
    let parse_t0 = Instant::now();
    let raw = fs::read_to_string(input)
        .with_context(|| format!("failed reading storyboard file: {}", input.display()))?;
    let out_parent = output
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));
    fs::create_dir_all(&out_parent)
        .with_context(|| format!("failed creating output dir: {}", out_parent.display()))?;

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let work_dir = out_parent.join(format!(".varin_storyboard_{}", ts));
    let video_dir = work_dir.join("video");
    let generated_scene_dir = work_dir.join("generated_scenes");
    fs::create_dir_all(&video_dir)?;
    fs::create_dir_all(&generated_scene_dir)?;

    let storyboard_root = input
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));
    let storyboard = load_storyboard_input(
        &raw,
        &storyboard_root,
        &generated_scene_dir,
        options.width.unwrap_or(1280),
        options.height.unwrap_or(720),
        options.fps.unwrap_or(30),
        allow_legacy_brief,
    )?;
    let parse_ms = parse_t0.elapsed().as_millis();

    let scene_compile_t0 = Instant::now();
    cache::ensure_cache_dirs()?;
    ensure_edge_tts_available();

    let target_total: f32 = storyboard
        .scenes
        .iter()
        .map(|s| s.duration_seconds.unwrap_or(20.0).max(0.1))
        .sum();
    let scene_count = storyboard.scenes.len().max(1);
    let logical_cores = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
        .max(1);
    let worker_count = resolve_scene_workers(scene_workers, scene_count, logical_cores);
    let mut per_scene_render_threads = (logical_cores / worker_count).max(1);
    if let Some(max_t) = options.max_threads {
        per_scene_render_threads = per_scene_render_threads.min(max_t.max(1));
    }
    let pool = ThreadPoolBuilder::new()
        .num_threads(worker_count)
        .build()
        .context("failed creating storyboard worker pool")?;

    let mut jobs: Vec<SceneRenderJob> = pool
        .install(|| {
            storyboard
                .scenes
                .par_iter()
                .enumerate()
                .map(|(idx, scene_item)| -> Result<SceneRenderJob> {
                    let mut scene = load_scene_for_storyboard_item(
                        scene_item,
                        &storyboard_root,
                        &generated_scene_dir,
                        options.width.unwrap_or(1280),
                        options.height.unwrap_or(720),
                        options.fps.unwrap_or(30),
                    )?;
                    scene
                        .validate()
                        .with_context(|| format!("scene validation failed '{}'", scene_item.id))?;
                    if let Some(d) = scene_item.duration_seconds {
                        scene.duration_seconds = d.max(0.1);
                    }
                    let target_duration = scene.duration_seconds.max(0.1);
                    Ok(SceneRenderJob {
                        index: idx + 1,
                        id: scene_item.id.clone(),
                        caption: scene_item.caption.clone(),
                        narration: scene_item.narration.clone(),
                        scene,
                        target_duration,
                        measured_audio: target_duration.max(0.5),
                        tts_source: None,
                        final_duration: target_duration,
                        composition_signature: scene_item
                            .scene_composition
                            .as_ref()
                            .and_then(|c| c.variant.as_ref())
                            .map(|v| format!("comp-v1-theme-{}", v.trim()))
                            .unwrap_or_else(|| "comp-none".to_string()),
                    })
                })
                .collect::<Result<Vec<_>>>()
        })
        .with_context(|| "parallel scene compile/load failed".to_string())?;
    jobs.sort_by_key(|j| j.index);
    let scene_compile_ms = scene_compile_t0.elapsed().as_millis();
    let tts_t0 = Instant::now();
    let prep_results: Vec<Result<AudioPrep>> = pool.install(|| {
        jobs.par_iter()
            .map(|job| prepare_scene_audio(&options.ffmpeg, &job.narration, job.target_duration))
            .collect()
    });
    for (idx, prep) in prep_results.into_iter().enumerate() {
        let prep = prep.with_context(|| format!("failed preparing scene audio {}", idx + 1))?;
        jobs[idx].measured_audio = prep.measured_seconds;
        jobs[idx].tts_source = prep.tts_source;
    }
    let tts_ms = tts_t0.elapsed().as_millis();

    let retime_t0 = Instant::now();
    retime_jobs_to_audio(&mut jobs, target_total.max(0.1));
    let retime_ms = retime_t0.elapsed().as_millis();

    let render_mux_t0 = Instant::now();
    let mut rendered: Vec<RenderedSegment> = pool
        .install(|| {
            jobs.par_iter_mut()
                .map(|job| -> Result<RenderedSegment> {
                    job.scene.duration_seconds = job.final_duration.max(0.1);
                    retime_scene_timeline(&mut job.scene, job.final_duration.max(0.1));

                    let scene_video = video_dir.join(format!("seg_{:02}_raw.mp4", job.index));
                    let mut scene_options = options.clone();
                    scene_options.max_threads = Some(per_scene_render_threads);
                    let scene_muxed = video_dir.join(format!("seg_{:02}.mp4", job.index));
                    let scene_payload = serde_json::to_string(&job.scene)
                        .with_context(|| format!("failed serializing scene '{}' for cache key", job.id))?;
                    let tts_fingerprint = job
                        .tts_source
                        .as_ref()
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_else(|| "none".to_string());
                    let seg_key = cache::stable_hash(&[
                        "render-seg-v1",
                        &job.id,
                        &job.composition_signature,
                        &format!("{:.3}", job.final_duration.max(0.1)),
                        &scene_options.width.unwrap_or(0).to_string(),
                        &scene_options.height.unwrap_or(0).to_string(),
                        &scene_options.fps.unwrap_or(0).to_string(),
                        &format!("{:.3}", scene_options.cpu_ratio),
                        &format!("{:.3}", scene_options.ram_ratio),
                        if scene_options.prefer_hw_encode {
                            "hw-1"
                        } else {
                            "hw-0"
                        },
                        if scene_options.benchmark_fast {
                            "bf-1"
                        } else {
                            "bf-0"
                        },
                        match scene_options.render_mode {
                            varin_render::RenderMode::TwoD => "rm-2d",
                            varin_render::RenderMode::ThreeD => "rm-3d",
                        },
                        match scene_options.effects_tier {
                            varin_render::EffectsTier::Basic => "fx-basic",
                            varin_render::EffectsTier::Cinematic => "fx-cinematic",
                            varin_render::EffectsTier::Vfx => "fx-vfx",
                        },
                        if scene_options.force_wgpu_backend {
                            "wgpu-1"
                        } else {
                            "wgpu-0"
                        },
                        &tts_fingerprint,
                        &scene_payload,
                    ]);
                    if let Some(cached_seg) = cache::load_render_segment_cache(&seg_key) {
                        fs::copy(&cached_seg, &scene_muxed).with_context(|| {
                            format!(
                                "failed copying cached render segment {} -> {}",
                                cached_seg.display(),
                                scene_muxed.display()
                            )
                        })?;
                        return Ok(RenderedSegment {
                            index: job.index,
                            path: scene_muxed,
                            duration: job.final_duration.max(0.1),
                            caption: if !job.caption.trim().is_empty() {
                                job.caption.trim().to_string()
                            } else {
                                job.narration.trim().to_string()
                            },
                        });
                    }

                    render_scene_to_mp4(&job.scene, &scene_video, &scene_options)
                        .with_context(|| format!("failed rendering scene '{}'", job.id))?;

                    mux_scene_one_pass(
                        &options.ffmpeg,
                        &scene_video,
                        job.tts_source.as_deref(),
                        &scene_muxed,
                        job.final_duration.max(0.1),
                        options.benchmark_fast,
                    )
                    .with_context(|| format!("failed muxing scene '{}'", job.id))?;
                    let _ = fs::remove_file(&scene_video);
                    let _ = cache::store_render_segment_cache(&seg_key, &scene_muxed);
                    Ok(RenderedSegment {
                        index: job.index,
                        path: scene_muxed,
                        duration: job.final_duration.max(0.1),
                        caption: if !job.caption.trim().is_empty() {
                            job.caption.trim().to_string()
                        } else {
                            job.narration.trim().to_string()
                        },
                    })
                })
                .collect::<Result<Vec<_>>>()
        })
        .with_context(|| "parallel storyboard render failed".to_string())?;
    let render_mux_ms = render_mux_t0.elapsed().as_millis();
    rendered.sort_by_key(|r| r.index);
    let segment_paths: Vec<PathBuf> = rendered.iter().map(|r| r.path.clone()).collect();
    let mut time_cursor = 0.0f32;
    let mut srt_rows = Vec::new();
    for seg in &rendered {
        if !seg.caption.is_empty() {
            srt_rows.push((time_cursor, time_cursor + seg.duration, seg.caption.clone()));
        }
        time_cursor += seg.duration;
    }

    let concat_t0 = Instant::now();
    concat_segments(&options.ffmpeg, &segment_paths, output, options.benchmark_fast)?;
    let concat_ms = concat_t0.elapsed().as_millis();
    let srt_t0 = Instant::now();
    if !srt_rows.is_empty() {
        let srt_path = output.with_extension("srt");
        write_srt(&srt_path, &srt_rows)?;
        println!("Wrote captions -> {}", srt_path.display());
        write_interaction_sidecars(output, &rendered)?;
    }
    let srt_ms = srt_t0.elapsed().as_millis();
    let total_ms = total_t0.elapsed().as_millis();
    let timings = serde_json::json!({
        "input": input.to_string_lossy(),
        "output": output.to_string_lossy(),
        "scene_workers_requested": scene_workers,
        "scene_workers_effective": worker_count,
        "logical_cores": logical_cores,
        "per_scene_render_threads": per_scene_render_threads,
        "benchmark_fast": options.benchmark_fast,
        "stage_ms": {
            "parse_and_load_storyboard": parse_ms,
            "compile_or_load_scenes": scene_compile_ms,
            "tts_prepare": tts_ms,
            "retime": retime_ms,
            "render_and_mux": render_mux_ms,
            "concat": concat_ms,
            "srt": srt_ms,
            "total": total_ms
        }
    });
    println!("Stage timings: {}", timings);
    if let Some(path) = timings_json {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, serde_json::to_string_pretty(&timings)?)
            .with_context(|| format!("failed writing timings JSON {}", path.display()))?;
    }
    println!("Rendered storyboard -> {}", output.display());
    Ok(())
}

struct SceneRenderJob {
    index: usize,
    id: String,
    caption: String,
    narration: String,
    scene: Scene,
    target_duration: f32,
    measured_audio: f32,
    tts_source: Option<PathBuf>,
    final_duration: f32,
    composition_signature: String,
}

struct RenderedSegment {
    index: usize,
    path: PathBuf,
    duration: f32,
    caption: String,
}

struct AudioPrep {
    tts_source: Option<PathBuf>,
    measured_seconds: f32,
}

fn prepare_scene_audio(
    ffmpeg: &str,
    narration: &str,
    target_duration: f32,
) -> Result<AudioPrep> {
    if narration.trim().is_empty() {
        return Ok(AudioPrep {
            tts_source: None,
            measured_seconds: target_duration.max(0.5),
        });
    }
    let key = cache::stable_hash(&[
        "tts-v1",
        EDGE_TTS_VOICE,
        narration.trim(),
        "edge-tts",
        "ffprobe:format=duration",
    ]);
    if let Some((cached_audio, meta)) = cache::load_tts_cache(&key)? {
        return Ok(AudioPrep {
            tts_source: Some(cached_audio),
            measured_seconds: meta.duration_seconds.max(0.5),
        });
    }
    let temp_mp3 = std::env::temp_dir().join(format!("varin_tts_{}.mp3", key));
    run_edge_tts(EDGE_TTS_VOICE, narration.trim(), &temp_mp3)?;
    let measured = probe_media_duration(ffmpeg, &temp_mp3).unwrap_or(target_duration);
    let cached_path = cache::store_tts_cache(&key, &temp_mp3, measured.max(0.5), EDGE_TTS_VOICE)?;
    let _ = fs::remove_file(&temp_mp3);
    Ok(AudioPrep {
        tts_source: Some(cached_path),
        measured_seconds: measured.max(0.5),
    })
}

fn retime_jobs_to_audio(jobs: &mut [SceneRenderJob], target_total: f32) {
    if jobs.is_empty() {
        return;
    }
    let mut desired = Vec::with_capacity(jobs.len());
    let mut measured_total = 0.0f32;
    let mut narration_jobs = 0usize;
    for job in jobs.iter() {
        let target = job.target_duration.max(0.1);
        let measured = job.measured_audio.max(0.1);
        measured_total += measured;
        let base = if job.tts_source.is_some() {
            narration_jobs += 1;
            // Narration-led pacing: keep visuals close to spoken pace with a small settle pad.
            let settle_pad = (0.55 + measured * 0.06).clamp(0.55, 1.8);
            let narrative_led = measured + settle_pad;
            (0.15 * target + 0.85 * narrative_led).max(3.0)
        } else {
            target.max(4.0)
        };
        desired.push(base.max(3.0));
    }
    let sum_desired: f32 = desired.iter().sum::<f32>().max(0.1);
    let narration_led_total = (measured_total + narration_jobs as f32 * 0.75).max(3.0);
    // Keep total close to narration when audio exists; only lightly bias toward authored total.
    let scaled_target_total = if narration_jobs > 0 {
        (0.2 * target_total + 0.8 * narration_led_total)
            .clamp(narration_led_total, narration_led_total + jobs.len() as f32 * 0.35)
    } else {
        target_total.max(jobs.len() as f32 * 3.0)
    };
    let scale = scaled_target_total / sum_desired;
    let mut acc = 0.0f32;
    for i in 0..jobs.len() {
        let mut v = (desired[i] * scale).max(3.0);
        if i + 1 == jobs.len() {
            v = (scaled_target_total - acc).max(3.0);
        } else {
            acc += v;
        }
        jobs[i].final_duration = v;
    }
}

fn resolve_scene_workers(requested: usize, scene_count: usize, logical_cores: usize) -> usize {
    if requested > 0 {
        return requested.max(1).min(scene_count.max(1)).min(logical_cores.max(1));
    }
    // Auto mode: prefer fewer, heavier workers to reduce CPU/FFmpeg oversubscription.
    let cores_per_worker = if logical_cores >= 20 {
        8
    } else if logical_cores >= 12 {
        6
    } else {
        4
    };
    let by_core_budget = (logical_cores / cores_per_worker).max(1);
    let soft_cap = 4usize.min(scene_count.max(1));
    by_core_budget.min(soft_cap).max(1)
}

pub fn materialize_storyboard_scenes_cmd(
    input: &Path,
    out_dir: &Path,
    width: u32,
    height: u32,
    fps: u32,
) -> Result<()> {
    let raw = fs::read_to_string(input)
        .with_context(|| format!("failed reading storyboard file: {}", input.display()))?;
    let parsed: Storyboard = serde_json::from_str(&raw)
        .with_context(|| "materialize-scenes expects explicit storyboard scenes JSON".to_string())?;
    if parsed.version != "v1" {
        bail!("unsupported storyboard version '{}', expected 'v1'", parsed.version);
    }
    fs::create_dir_all(out_dir)
        .with_context(|| format!("failed creating output dir {}", out_dir.display()))?;
    let storyboard_root = input
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));
    let total = parsed.scenes.len();
    let mut scene_no = 0usize;
    for s in parsed.scenes.into_iter() {
        scene_no += 1;
        let has_explicit_scene_ref = s.scene_path.as_deref().map(str::trim).filter(|v| !v.is_empty()).is_some();
        let has_inline_dsl = s.scene_explanatory.is_some();
        let has_template = s
            .scene_template
            .as_deref()
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .is_some();
        let has_composition = s.scene_composition.is_some();
        if has_explicit_scene_ref || has_inline_dsl || has_template || has_composition {
            let scene = load_scene_for_storyboard_item(
                &s,
                &storyboard_root,
                out_dir,
                width,
                height,
                fps,
            )?;
            let out = out_dir.join(format!("{:02}_{}_materialized.json", scene_no, s.id));
            fs::write(&out, serde_json::to_string_pretty(&scene)?)
                .with_context(|| format!("failed writing materialized scene {}", out.display()))?;
            continue;
        }
        let planned = PlannedScene {
            id: s.id.clone(),
            title: if s.caption.trim().is_empty() {
                s.id.clone()
            } else {
                s.caption.clone()
            },
            visual_instruction: effective_visual_instruction(&s),
            narration: s.narration.clone(),
            caption: if s.caption.trim().is_empty() {
                s.narration.clone()
            } else {
                s.caption.clone()
            },
            duration_seconds: s.duration_seconds.unwrap_or(26.0).max(8.0),
            template: template_for_materialization(scene_no, total),
        };
        materialize_planned_scene(
            out_dir,
            &planned,
            SceneRenderConfig { width, height, fps },
        )?;
    }
    println!(
        "Materialized {} storyboard scenes into {}",
        scene_no,
        out_dir.display()
    );
    Ok(())
}

fn template_for_materialization(idx1: usize, total: usize) -> SceneTemplate {
    if idx1 == 1 {
        return SceneTemplate::IntroUnderline;
    }
    if idx1 == total {
        return SceneTemplate::RecapOutro;
    }
    let middle = [
        SceneTemplate::HeadingDiagram,
        SceneTemplate::ConceptCards,
        SceneTemplate::FormulaFlow,
        SceneTemplate::ArrayCompareSwap,
        SceneTemplate::SplitCompare,
        SceneTemplate::TimelineLadder,
    ];
    middle[(idx1 - 2) % middle.len()].clone()
}

fn retime_scene_timeline(scene: &mut Scene, target_duration: f32) {
    let Some(tl) = scene.timeline.as_mut() else {
        return;
    };
    let mut max_end = 0.0f32;
    for spec in &tl.specs {
        max_end = max_end.max(spec.start + spec.run_time.max(0.0));
    }
    if max_end <= 0.05 {
        return;
    }
    // Keep animation activity closely aligned with narration instead of long visual tails.
    let active_target = (target_duration * 0.95).min(target_duration - 0.08).max(1.2);
    let factor = (active_target / max_end).clamp(0.80, 8.0);
    for spec in &mut tl.specs {
        spec.start = (spec.start * factor).max(0.0);
        spec.run_time = (spec.run_time * factor).max(0.05);
    }
    for ev in &mut tl.lifecycle {
        ev.t = (ev.t * factor).max(0.0);
    }
    for seg in &mut tl.segments {
        match seg {
            TimelineSegment::Play {
                start, run_time, ..
            } => {
                *start = (*start * factor).max(0.0);
                *run_time = (*run_time * factor).max(0.05);
            }
            TimelineSegment::Wait { start, duration } => {
                *start = (*start * factor).max(0.0);
                *duration = (*duration * factor).max(0.0);
            }
        }
    }
    for group in &mut tl.groups {
        group.start = (group.start * factor).max(0.0);
        group.run_time = (group.run_time * factor).max(0.05);
    }
}

pub fn sync_storyboard_cmd(input: &Path, output_srt: &Path, allow_legacy_brief: bool) -> Result<()> {
    let raw = fs::read_to_string(input)
        .with_context(|| format!("failed reading storyboard file: {}", input.display()))?;
    let storyboard_root = input
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));
    let temp_gen = output_srt
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(format!(".varin_sync_gen_{}", now_millis()));
    fs::create_dir_all(&temp_gen)?;
    let storyboard = load_storyboard_input(
        &raw,
        &storyboard_root,
        &temp_gen,
        1280,
        720,
        30,
        allow_legacy_brief,
    )?;
    let mut cursor = 0.0f32;
    let mut rows = Vec::new();
    for scene in &storyboard.scenes {
        let scene_json = load_scene_for_storyboard_item(
            scene,
            &storyboard_root,
            &temp_gen,
            1280,
            720,
            30,
        )?;
        let duration = scene
            .duration_seconds
            .unwrap_or(scene_json.duration_seconds)
            .max(0.1);
        let cap = if !scene.caption.trim().is_empty() {
            scene.caption.trim().to_string()
        } else {
            scene.narration.trim().to_string()
        };
        if !cap.is_empty() {
            rows.push((cursor, cursor + duration, cap));
        }
        cursor += duration;
    }
    write_srt(output_srt, &rows)?;
    println!("Synced storyboard timings -> {}", output_srt.display());
    Ok(())
}

pub fn preflight_storyboard_cmd(input: &Path, allow_legacy_brief: bool) -> Result<()> {
    let raw = fs::read_to_string(input)
        .with_context(|| format!("failed reading storyboard file: {}", input.display()))?;
    let storyboard_root = input
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));
    let temp_gen = std::env::temp_dir().join(format!(".varin_preflight_gen_{}", now_millis()));
    fs::create_dir_all(&temp_gen)?;
    let storyboard = load_storyboard_input(
        &raw,
        &storyboard_root,
        &temp_gen,
        1280,
        720,
        30,
        allow_legacy_brief,
    )?;
    let mut scene_errors = Vec::new();
    let mut scene_warnings = Vec::new();
    for scene in &storyboard.scenes {
        let scene_json = load_scene_for_storyboard_item(
            scene,
            &storyboard_root,
            &temp_gen,
            1280,
            720,
            30,
        )?;
        if let Err(err) = scene_json.validate() {
            scene_errors.push(format!("{}: {}", scene.id, err));
        }
        if narration_looks_instructional(&scene.narration) {
            scene_warnings.push(format!(
                "{}: narration looks instruction-like; move drawing instructions to visual_instruction",
                scene.id
            ));
        }
    }
    let _ = fs::remove_dir_all(&temp_gen);
    if !scene_errors.is_empty() {
        bail!(
            "storyboard preflight failed:\n{}",
            scene_errors.join("\n")
        );
    }
    if !scene_warnings.is_empty() {
        eprintln!("storyboard warnings:\n{}", scene_warnings.join("\n"));
    }
    Ok(())
}

fn load_storyboard_input(
    raw: &str,
    storyboard_root: &Path,
    generated_scene_dir: &Path,
    width: u32,
    height: u32,
    fps: u32,
    allow_legacy_brief: bool,
) -> Result<Storyboard> {
    let mut storyboard = if let Ok(sb) = serde_json::from_str::<Storyboard>(raw) {
        sb
    } else if allow_legacy_brief {
        let brief: StoryboardBrief = serde_json::from_str(raw).with_context(|| {
            "invalid storyboard JSON (expected explicit storyboard or legacy brief input)"
                .to_string()
        })?;
            if brief.version != "v1" {
                bail!("unsupported storyboard brief version '{}', expected 'v1'", brief.version);
            }
            let plan = plan_from_brief(&BriefInput {
                title: brief.title,
                brief: brief.brief,
                target_minutes: brief.target_minutes,
                style: brief.style,
                sections: brief.sections,
                concept_density: brief.concept_density,
                animation_intensity: brief.animation_intensity,
            });
            let mut scenes = Vec::with_capacity(plan.len());
            for p in plan {
                let scene_path = materialize_planned_scene(
                    generated_scene_dir,
                    &p,
                    SceneRenderConfig { width, height, fps },
                )?;
                scenes.push(StoryboardScene {
                    id: p.id,
                    scene_path: Some(relativize_or_abs(storyboard_root, &scene_path)),
                    visual_instruction: p.visual_instruction,
                    narration: p.narration,
                    caption: p.caption,
                    scene_explanatory: None,
                    scene_template: None,
                    template_params: None,
                    scene_composition: None,
                    shot_list: vec![],
                    duration_seconds: Some(p.duration_seconds),
                });
            }
            Storyboard {
                version: "v1".to_string(),
                scenes,
            }
    } else {
        bail!(
            "invalid storyboard JSON for default mode. provide explicit `scenes` with scene_path/scene_explanatory/scene_template/scene_composition, or pass --legacy-brief"
        );
    };
    for scene in &mut storyboard.scenes {
        if scene.visual_instruction.trim().is_empty() {
            scene.visual_instruction = effective_visual_instruction(scene);
        }
    }
    if storyboard.version != "v1" {
        bail!(
            "unsupported storyboard version '{}', expected 'v1'",
            storyboard.version
        );
    }
    if storyboard.scenes.is_empty() {
        bail!("storyboard must include at least one scene");
    }
    Ok(storyboard)
}

fn param_str(params: Option<&Value>, key: &str, default: &str) -> String {
    params
        .and_then(|v| v.get(key))
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or_else(|| default.to_string())
}

fn param_f32(params: Option<&Value>, key: &str, default: f32) -> f32 {
    params
        .and_then(|v| v.get(key))
        .and_then(Value::as_f64)
        .map(|v| v as f32)
        .unwrap_or(default)
}

fn param_usize(params: Option<&Value>, key: &str, default: usize) -> usize {
    params
        .and_then(|v| v.get(key))
        .and_then(Value::as_u64)
        .map(|v| v as usize)
        .unwrap_or(default)
}

fn param_bool(params: Option<&Value>, key: &str, default: bool) -> bool {
    params
        .and_then(|v| v.get(key))
        .and_then(Value::as_bool)
        .unwrap_or(default)
}

fn param_labels(params: Option<&Value>) -> Vec<String> {
    params
        .and_then(|v| v.get("labels"))
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

#[derive(Debug, Clone)]
struct TemplateContract {
    title: String,
    count: usize,
    spacing: f32,
    routing_mode: String,
    multi_arrow: bool,
    layout_padding: f32,
    label_padding: f32,
    text_duration: f32,
    shape_duration: f32,
    connector_duration: f32,
    labels: Vec<String>,
}

fn template_contract(params: Option<&Value>, title_default: &str, count_default: usize) -> TemplateContract {
    TemplateContract {
        title: param_str(params, "title", title_default),
        count: param_usize(params, "count", count_default).max(1),
        spacing: param_f32(params, "spacing", 220.0).max(80.0),
        routing_mode: param_str(params, "routing_mode", "elbow_auto"),
        multi_arrow: param_bool(params, "multi_arrow", false),
        layout_padding: param_f32(params, "layout_padding", 18.0).max(0.0),
        label_padding: param_f32(params, "label_padding", 20.0).max(0.0),
        text_duration: param_f32(params, "text_duration", 0.75).max(0.2),
        shape_duration: param_f32(params, "shape_duration", 0.75).max(0.2),
        connector_duration: param_f32(params, "connector_duration", 0.85).max(0.2),
        labels: param_labels(params),
    }
}

fn parse_routing_mode(mode: &str) -> Option<ConnectorPathMode> {
    match mode {
        "direct" => Some(ConnectorPathMode::Direct),
        "elbow_horizontal_first" => Some(ConnectorPathMode::ElbowHorizontalFirst),
        "elbow_vertical_first" => Some(ConnectorPathMode::ElbowVerticalFirst),
        _ => Some(ConnectorPathMode::ElbowAuto),
    }
}

fn simple_rect_layer(
    id: &str,
    w: f32,
    h: f32,
    x: f32,
    y: f32,
    fill: [u8; 4],
    stroke: [u8; 4],
) -> ExplainLayer {
    ExplainLayer {
        id: id.to_string(),
        primitive: ExplainPrimitive::Rect {
            width: w,
            height: h,
            corner_radius: 16.0,
        },
        z_index: 0,
        transform: ExplainTransform { x, y, scale_x: 1.0, scale_y: 1.0, ..Default::default() },
        style: ExplainStyle {
            fill_rgba: Some(fill),
            stroke_rgba: Some(stroke),
            stroke_width: Some(2.0),
            opacity: Some(0.0),
            draw_progress: Some(0.0),
            line_height_mult: None,
            text_max_width: None,
        },
    }
}

fn simple_text_layer(id: &str, text: String, font_size: f32, x: f32, y: f32, color: [u8; 4]) -> ExplainLayer {
    ExplainLayer {
        id: id.to_string(),
        primitive: ExplainPrimitive::Text {
            text,
            font_size,
            font_family: None,
            font_path: None,
        },
        z_index: 1,
        transform: ExplainTransform { x, y, scale_x: 1.0, scale_y: 1.0, ..Default::default() },
        style: ExplainStyle {
            fill_rgba: Some(color),
            stroke_rgba: None,
            stroke_width: None,
            opacity: Some(0.0),
            draw_progress: Some(0.0),
            line_height_mult: Some(1.18),
            text_max_width: Some(420.0),
        },
    }
}

fn simple_circle_layer(id: &str, radius: f32, x: f32, y: f32, fill: [u8; 4], stroke: [u8; 4]) -> ExplainLayer {
    ExplainLayer {
        id: id.to_string(),
        primitive: ExplainPrimitive::Circle { radius: radius.max(1.0) },
        z_index: 0,
        transform: ExplainTransform { x, y, scale_x: 1.0, scale_y: 1.0, ..Default::default() },
        style: ExplainStyle {
            fill_rgba: Some(fill),
            stroke_rgba: Some(stroke),
            stroke_width: Some(2.0),
            opacity: Some(0.0),
            draw_progress: Some(0.0),
            line_height_mult: None,
            text_max_width: None,
        },
    }
}

fn simple_polyline_layer(id: &str, points: Vec<[f32; 2]>, x: f32, y: f32, stroke: [u8; 4], width: f32) -> ExplainLayer {
    ExplainLayer {
        id: id.to_string(),
        primitive: ExplainPrimitive::Polyline { points },
        z_index: 2,
        transform: ExplainTransform { x, y, scale_x: 1.0, scale_y: 1.0, ..Default::default() },
        style: ExplainStyle {
            fill_rgba: None,
            stroke_rgba: Some(stroke),
            stroke_width: Some(width.max(1.0)),
            opacity: Some(0.0),
            draw_progress: Some(0.0),
            line_height_mult: None,
            text_max_width: None,
        },
    }
}

fn composition_theme_colors(variant: &str) -> ([u8; 4], [u8; 4], [u8; 4], [u8; 4]) {
    match variant {
        "sunset" => ([94, 52, 144, 255], [244, 136, 92, 255], [254, 210, 120, 255], [232, 242, 255, 255]),
        "neon" => ([24, 24, 56, 255], [60, 218, 255, 255], [188, 255, 116, 255], [230, 250, 255, 255]),
        "mint" => ([22, 52, 62, 255], [74, 176, 132, 255], [146, 224, 192, 255], [226, 250, 238, 255]),
        "cinematic" => ([10, 16, 34, 255], [78, 136, 226, 255], [255, 202, 118, 255], [236, 245, 255, 255]),
        "pastel" => ([36, 40, 66, 255], [156, 188, 250, 255], [202, 236, 212, 255], [246, 248, 255, 255]),
        "dark_tech" => ([8, 12, 26, 255], [72, 124, 244, 255], [88, 214, 198, 255], [226, 236, 255, 255]),
        _ => ([8, 14, 30, 255], [64, 126, 224, 255], [158, 236, 198, 255], [236, 242, 255, 255]),
    }
}

fn materialize_scene_composition(
    item: &StoryboardScene,
    width: u32,
    height: u32,
    fps: u32,
) -> Result<SceneExplanatory> {
    let composition = item
        .scene_composition
        .as_ref()
        .ok_or_else(|| anyhow!("scene '{}' missing scene_composition block", item.id))?;
    let variant = composition
        .variant
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .unwrap_or("default");
    let (bg, primary, accent, text_color) = composition_theme_colors(variant);
    let mut scene = SceneExplanatory {
        version: "v1".to_string(),
        width: Some(width),
        height: Some(height),
        fps: Some(fps),
        background_rgba: Some(bg),
        layers: vec![],
        beats: vec![],
        camera: None,
    };

    let mut track_map = std::collections::HashMap::<String, (f32, f32)>::new();
    for track in &composition.tracks {
        if !track.id.trim().is_empty() {
            track_map.insert(
                track.id.trim().to_string(),
                (track.start.max(0.0), track.duration.max(0.1)),
            );
        }
    }

    for (idx, c) in composition.components.iter().enumerate() {
        let cid = c
            .id
            .as_deref()
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| format!("cmp_{}_{}", c.kind, idx + 1));
        let x = c.x.unwrap_or(width as f32 * 0.5);
        let y = c.y.unwrap_or(height as f32 * 0.5);
        let w = c.width.unwrap_or(260.0).max(20.0);
        let h = c.height.unwrap_or(120.0).max(20.0);
        let fill = c.color.unwrap_or([primary[0], primary[1], primary[2], 82]);
        let stroke = [accent[0], accent[1], accent[2], 255];
        let start = c.start.unwrap_or(0.2 + idx as f32 * 0.18).max(0.0);
        let duration = c.duration.unwrap_or(0.8).max(0.1);
        let text = c.text.clone().unwrap_or_else(|| c.kind.clone());

        match c.kind.as_str() {
            "scene_title" => {
                scene.layers.push(simple_text_layer(&cid, text, 52.0, x, y, text_color));
                scene.beats.push(ExplainBeat {
                    target: cid,
                    kind: AnimationKind::PresetFormulaStepReveal,
                    start,
                    duration,
                    easing: Easing::EaseOut,
                    ..Default::default()
                });
            }
            "flow" => {
                let labels = if c.labels.is_empty() {
                    vec!["A".to_string(), "B".to_string(), "C".to_string()]
                } else {
                    c.labels.clone()
                };
                let spacing = (c.width.unwrap_or(640.0) / labels.len() as f32).max(120.0);
                let start_x = x - spacing * ((labels.len() as f32 - 1.0) * 0.5);
                for (li, label) in labels.iter().enumerate() {
                    let bx = start_x + li as f32 * spacing;
                    let bid = format!("{cid}_node_{}", li + 1);
                    scene.layers.push(simple_rect_layer(&bid, 180.0, 84.0, bx, y, fill, stroke));
                    scene.layers.push(simple_text_layer(&format!("{bid}_t"), label.clone(), 20.0, bx, y, text_color));
                    let st = start + li as f32 * 0.14;
                    scene.beats.push(ExplainBeat { target: bid.clone(), kind: AnimationKind::PresetShapeDrawRect, start: st, duration: duration * 0.85, easing: Easing::EaseInOut, axis_x: Some(bx), axis_y: Some(y), axis_width: Some(180.0), axis_height: Some(84.0), ..Default::default() });
                    scene.beats.push(ExplainBeat { target: format!("{bid}_t"), kind: AnimationKind::PresetFormulaStepReveal, start: st + 0.08, duration: duration * 0.7, easing: Easing::EaseOut, ..Default::default() });
                    if li + 1 < labels.len() {
                        let conn = format!("{cid}_conn_{}", li + 1);
                        scene.layers.push(simple_polyline_layer(&conn, vec![[0.0, 0.0], [45.0, 0.0], [45.0, 0.0], [90.0, 0.0]], bx + 90.0, y, text_color, 2.5));
                        scene.beats.push(ExplainBeat {
                            target: conn,
                            kind: AnimationKind::PresetConnectorSafeRoute,
                            start: st + 0.05,
                            duration: duration * 0.7,
                            easing: Easing::EaseInOut,
                            axis_x: Some(bx + 90.0),
                            axis_y: Some(y),
                            layout_target: Some(format!("{cid}_node_{}", li + 2)),
                            arrows_outside: true,
                            avoid_overlap: true,
                            layout_padding: 18.0,
                            label_padding: 20.0,
                            connector_path_mode: Some(ConnectorPathMode::ElbowAuto),
                            connector_side_preference: Some(ConnectorSidePreference::Left),
                            ..Default::default()
                        });
                    }
                }
            }
            "card" | "metric_tile" | "callout" => {
                scene.layers.push(simple_rect_layer(&cid, w, h, x, y, fill, stroke));
                scene.layers.push(simple_text_layer(&format!("{cid}_t"), text, 24.0, x, y, text_color));
                scene.beats.push(ExplainBeat {
                    target: cid.clone(),
                    kind: AnimationKind::PresetVectorFlowBlockReveal,
                    start,
                    duration,
                    easing: Easing::EaseOut,
                    axis_x: Some(x),
                    axis_y: Some(y),
                    ..Default::default()
                });
                scene.beats.push(ExplainBeat { target: format!("{cid}_t"), kind: AnimationKind::PresetFormulaStepReveal, start: start + 0.08, duration: duration * 0.62, easing: Easing::EaseOut, ..Default::default() });
            }
            "grid" => {
                let labels = if c.labels.is_empty() {
                    vec!["One".to_string(), "Two".to_string(), "Three".to_string(), "Four".to_string()]
                } else {
                    c.labels.clone()
                };
                let cols = 2usize;
                let cell_w = (w * 0.46).max(120.0);
                let cell_h = (h * 0.42).max(66.0);
                for (li, label) in labels.iter().enumerate() {
                    let col = li % cols;
                    let row = li / cols;
                    let gx = x - cell_w * 0.55 + col as f32 * (cell_w + 28.0);
                    let gy = y - cell_h * 0.55 + row as f32 * (cell_h + 24.0);
                    let gid = format!("{cid}_grid_{}", li + 1);
                    scene.layers.push(simple_rect_layer(&gid, cell_w, cell_h, gx, gy, fill, stroke));
                    scene.layers.push(simple_text_layer(&format!("{gid}_t"), label.clone(), 18.0, gx, gy, text_color));
                    let st = start + li as f32 * 0.10;
                    scene.beats.push(ExplainBeat { target: gid.clone(), kind: AnimationKind::PresetShapeDrawRect, start: st, duration: duration * 0.7, easing: Easing::EaseInOut, axis_x: Some(gx), axis_y: Some(gy), axis_width: Some(cell_w), axis_height: Some(cell_h), ..Default::default() });
                    scene.beats.push(ExplainBeat { target: format!("{gid}_t"), kind: AnimationKind::PresetFormulaStepReveal, start: st + 0.08, duration: duration * 0.5, easing: Easing::EaseOut, ..Default::default() });
                }
            }
            "chapter_bumper" => {
                scene.layers.push(simple_rect_layer(&format!("{cid}_band"), width as f32 * 0.88, 110.0, x, y, [primary[0], primary[1], primary[2], 86], stroke));
                scene.layers.push(simple_text_layer(&format!("{cid}_text"), text, 40.0, x, y, text_color));
                scene.beats.push(ExplainBeat { target: format!("{cid}_band"), kind: AnimationKind::PresetTransitionWipe, start, duration, easing: Easing::EaseInOut, axis_x: Some(x), axis_y: Some(y), ..Default::default() });
                scene.beats.push(ExplainBeat { target: format!("{cid}_text"), kind: AnimationKind::PresetFormulaStepReveal, start: start + 0.1, duration: duration * 0.65, easing: Easing::EaseOut, ..Default::default() });
            }
            "split_compare" => {
                let lw = (w * 0.46).max(160.0);
                let rw = lw;
                let left_id = format!("{cid}_left");
                let right_id = format!("{cid}_right");
                scene.layers.push(simple_rect_layer(&left_id, lw, h, x - lw * 0.56, y, fill, stroke));
                scene.layers.push(simple_rect_layer(&right_id, rw, h, x + rw * 0.56, y, [accent[0], accent[1], accent[2], 86], stroke));
                let left_label = c.labels.get(0).cloned().unwrap_or_else(|| "Before".to_string());
                let right_label = c.labels.get(1).cloned().unwrap_or_else(|| "After".to_string());
                scene.layers.push(simple_text_layer(&format!("{left_id}_t"), left_label, 24.0, x - lw * 0.56, y, text_color));
                scene.layers.push(simple_text_layer(&format!("{right_id}_t"), right_label, 24.0, x + rw * 0.56, y, text_color));
                scene.beats.push(ExplainBeat { target: left_id.clone(), kind: AnimationKind::PresetTransitionSwipe, start, duration: duration * 0.8, easing: Easing::EaseInOut, ..Default::default() });
                scene.beats.push(ExplainBeat { target: right_id.clone(), kind: AnimationKind::PresetTransitionPush, start: start + 0.12, duration: duration * 0.8, easing: Easing::EaseInOut, ..Default::default() });
                scene.beats.push(ExplainBeat { target: format!("{left_id}_t"), kind: AnimationKind::PresetFormulaStepReveal, start: start + 0.18, duration: duration * 0.55, easing: Easing::EaseOut, ..Default::default() });
                scene.beats.push(ExplainBeat { target: format!("{right_id}_t"), kind: AnimationKind::PresetFormulaStepReveal, start: start + 0.26, duration: duration * 0.55, easing: Easing::EaseOut, ..Default::default() });
            }
            "code_window" => {
                let panel_id = format!("{cid}_panel");
                scene.layers.push(simple_rect_layer(&panel_id, w.max(420.0), h.max(220.0), x, y, [22, 34, 62, 210], [118, 174, 255, 255]));
                scene.layers.push(simple_text_layer(&format!("{cid}_text"), text, 20.0, x, y, text_color));
                scene.beats.push(ExplainBeat { target: panel_id, kind: AnimationKind::PresetTransitionBlurFade, start, duration, easing: Easing::EaseOut, ..Default::default() });
                scene.beats.push(ExplainBeat { target: format!("{cid}_text"), kind: AnimationKind::PresetFormulaStepReveal, start: start + 0.12, duration: duration * 0.65, easing: Easing::EaseOut, ..Default::default() });
            }
            "montage_strip" => {
                let labels = if c.labels.is_empty() {
                    vec!["Part A".to_string(), "Part B".to_string(), "Part C".to_string()]
                } else {
                    c.labels.clone()
                };
                let bw = (w / labels.len() as f32).max(140.0);
                let sx = x - bw * ((labels.len() as f32 - 1.0) * 0.5);
                for (li, label) in labels.iter().enumerate() {
                    let bx = sx + li as f32 * bw;
                    let bid = format!("{cid}_m_{}", li + 1);
                    scene.layers.push(simple_rect_layer(&bid, bw - 14.0, h.max(88.0), bx, y, [primary[0], primary[1], primary[2], 82], stroke));
                    scene.layers.push(simple_text_layer(&format!("{bid}_t"), label.clone(), 18.0, bx, y, text_color));
                    let st = start + li as f32 * 0.10;
                    scene.beats.push(ExplainBeat { target: bid.clone(), kind: AnimationKind::PresetTransitionColorWash, start: st, duration: duration * 0.75, easing: Easing::EaseInOut, ..Default::default() });
                    scene.beats.push(ExplainBeat { target: format!("{bid}_t"), kind: AnimationKind::PresetFormulaStepReveal, start: st + 0.08, duration: duration * 0.45, easing: Easing::EaseOut, ..Default::default() });
                }
            }
            _ => {
                scene.layers.push(simple_rect_layer(&cid, w, h, x, y, fill, stroke));
                scene.layers.push(simple_text_layer(&format!("{cid}_t"), text, 22.0, x, y, text_color));
                scene.beats.push(ExplainBeat { target: cid.clone(), kind: AnimationKind::PresetShapeDrawRect, start, duration, easing: Easing::EaseInOut, axis_x: Some(x), axis_y: Some(y), axis_width: Some(w), axis_height: Some(h), ..Default::default() });
                scene.beats.push(ExplainBeat { target: format!("{cid}_t"), kind: AnimationKind::PresetFormulaStepReveal, start: start + 0.08, duration: duration * 0.6, easing: Easing::EaseOut, ..Default::default() });
            }
        }
    }

    // Track-controlled cinematic motion overlays.
    for m in &composition.camera_moves {
        let (track_start, track_dur) = track_map
            .get(&m.kind)
            .copied()
            .unwrap_or((m.start.max(0.0), m.duration.max(0.1)));
        if let Some(first_id) = scene.layers.first().map(|l| l.id.clone()) {
            let intensity = if m.intensity.abs() > 0.001 { m.intensity } else { 1.0 };
            match m.kind.as_str() {
                "pan_left" => scene.beats.push(ExplainBeat { target: first_id, kind: AnimationKind::PresetCameraPan, start: track_start, duration: track_dur, easing: Easing::EaseInOut, to_x: Some(-40.0 * intensity), ..Default::default() }),
                "pan_right" => scene.beats.push(ExplainBeat { target: first_id, kind: AnimationKind::PresetCameraPan, start: track_start, duration: track_dur, easing: Easing::EaseInOut, to_x: Some(40.0 * intensity), ..Default::default() }),
                "zoom_in" => scene.beats.push(ExplainBeat { target: first_id, kind: AnimationKind::PresetCameraZoom, start: track_start, duration: track_dur, easing: Easing::EaseOut, to_scale_x: Some(1.0 + 0.08 * intensity), to_scale_y: Some(1.0 + 0.08 * intensity), ..Default::default() }),
                "parallax" => scene.beats.push(ExplainBeat { target: first_id, kind: AnimationKind::PresetParallaxDrift, start: track_start, duration: track_dur, easing: Easing::EaseInOut, to_y: Some(-18.0 * intensity), ..Default::default() }),
                "chroma_pulse" => scene.beats.push(ExplainBeat { target: first_id, kind: AnimationKind::PresetChromaPulse, start: track_start, duration: track_dur, easing: Easing::EaseOut, ..Default::default() }),
                "camera_settle" => scene.beats.push(ExplainBeat { target: first_id, kind: AnimationKind::PresetCameraSettle, start: track_start, duration: track_dur, easing: Easing::EaseOut, ..Default::default() }),
                "orbit" => scene.beats.push(ExplainBeat { target: first_id, kind: AnimationKind::PresetMotionOrbitDrift, start: track_start, duration: track_dur, easing: Easing::EaseInOut, ..Default::default() }),
                "elastic" => scene.beats.push(ExplainBeat { target: first_id, kind: AnimationKind::PresetElasticEmphasis, start: track_start, duration: track_dur, easing: Easing::EaseOut, ..Default::default() }),
                "swipe" => scene.beats.push(ExplainBeat { target: first_id, kind: AnimationKind::PresetTransitionSwipe, start: track_start, duration: track_dur, easing: Easing::EaseInOut, ..Default::default() }),
                "wipe" => scene.beats.push(ExplainBeat { target: first_id, kind: AnimationKind::PresetTransitionWipe, start: track_start, duration: track_dur, easing: Easing::EaseInOut, ..Default::default() }),
                "push" => scene.beats.push(ExplainBeat { target: first_id, kind: AnimationKind::PresetTransitionPush, start: track_start, duration: track_dur, easing: Easing::EaseInOut, ..Default::default() }),
                _ => {}
            }
        }
    }
    Ok(scene)
}

fn load_global_shot_list_from_env() -> Vec<ShotDescriptor> {
    let Ok(path) = std::env::var("VARIN_COMPOSE_SHOT_LIST") else {
        return Vec::new();
    };
    let raw = match fs::read_to_string(&path) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    serde_json::from_str::<Vec<ShotDescriptor>>(&raw).unwrap_or_default()
}

fn apply_shot_list_to_expl(scene: &mut SceneExplanatory, shot_list: &[ShotDescriptor]) {
    if shot_list.is_empty() || scene.layers.is_empty() {
        return;
    }
    let target = scene.layers[0].id.clone();
    for shot in shot_list {
        let start = shot.start.max(0.0);
        let dur = shot.duration.max(0.1);
        let intensity = shot.intensity.unwrap_or(1.0).max(0.1);
        match shot.angle.trim() {
            "front" => scene.beats.push(ExplainBeat {
                target: target.clone(),
                kind: AnimationKind::PresetShotFront,
                start,
                duration: dur,
                easing: Easing::EaseOut,
                to_scale_x: Some(1.04 * intensity),
                to_scale_y: Some(1.04 * intensity),
                ..Default::default()
            }),
            "back" => scene.beats.push(ExplainBeat {
                target: target.clone(),
                kind: AnimationKind::PresetShotBack,
                start,
                duration: dur,
                easing: Easing::EaseInOut,
                to_x: Some(-26.0 * intensity),
                ..Default::default()
            }),
            "left" => scene.beats.push(ExplainBeat {
                target: target.clone(),
                kind: AnimationKind::PresetShotLeft,
                start,
                duration: dur,
                easing: Easing::EaseInOut,
                to_x: Some(-42.0 * intensity),
                ..Default::default()
            }),
            "right" => scene.beats.push(ExplainBeat {
                target: target.clone(),
                kind: AnimationKind::PresetShotRight,
                start,
                duration: dur,
                easing: Easing::EaseInOut,
                to_x: Some(42.0 * intensity),
                ..Default::default()
            }),
            "low_angle_hero" => scene.beats.push(ExplainBeat {
                target: target.clone(),
                kind: AnimationKind::PresetShotLowHero,
                start,
                duration: dur,
                easing: Easing::EaseOut,
                to_scale_x: Some(1.10 * intensity),
                to_scale_y: Some(1.10 * intensity),
                ..Default::default()
            }),
            _ => {}
        }
        if let Some(effect) = shot.effect.as_deref() {
            let kind = match effect.trim() {
                "swipe" => Some(AnimationKind::PresetTransitionSwipe),
                "wipe" => Some(AnimationKind::PresetTransitionWipe),
                "push" => Some(AnimationKind::PresetTransitionPush),
                "blur_fade" => Some(AnimationKind::PresetTransitionBlurFade),
                "color_wash" => Some(AnimationKind::PresetTransitionColorWash),
                "orbit" => Some(AnimationKind::PresetMotionOrbitDrift),
                "elastic" => Some(AnimationKind::PresetElasticEmphasis),
                _ => None,
            };
            if let Some(kind) = kind {
                scene.beats.push(ExplainBeat {
                    target: target.clone(),
                    kind,
                    start: start + 0.02,
                    duration: dur,
                    easing: Easing::EaseInOut,
                    ..Default::default()
                });
            }
        }
    }
}

fn materialize_scene_template(
    item: &StoryboardScene,
    width: u32,
    height: u32,
    fps: u32,
) -> Result<SceneExplanatory> {
    let template = item
        .scene_template
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or_else(|| anyhow!("scene '{}' missing scene_template name", item.id))?;
    let params = item.template_params.as_ref();

    if template == "edu_preset" {
        let preset_id = param_str(params, "preset_id", "");
        let preset_index = params
            .and_then(|p| p.get("preset_index"))
            .and_then(|v| v.as_u64())
            .map(|x| x as usize);
        let entry = crate::preset_catalog::resolve_preset(&preset_id, preset_index, &item.id)?;
        if entry.base.trim() == "edu_preset" {
            bail!("edu_preset cannot reference another edu_preset (preset_id={})", entry.id);
        }
        let merged = crate::preset_catalog::merge_template_params(entry.params.clone(), params);
        let mut next = item.clone();
        next.scene_template = Some(entry.base);
        next.template_params = Some(merged);
        return materialize_scene_template(&next, width, height, fps);
    }

    let mut scene = SceneExplanatory {
        version: "v1".to_string(),
        width: Some(width),
        height: Some(height),
        fps: Some(fps),
        background_rgba: Some([8, 14, 30, 255]),
        layers: vec![],
        beats: vec![],
        camera: None,
    };

    match template {
        "house_bank_compare" => {
            let tc = template_contract(params, "Class vs Object", 2);
            let left_title = param_str(params, "left_title", "Class");
            let right_title = param_str(params, "right_title", "Object");
            scene.layers.push(simple_text_layer(
                "title",
                tc.title,
                50.0,
                640.0,
                90.0,
                [236, 242, 255, 255],
            ));
            scene.layers.push(simple_rect_layer(
                "left",
                480.0,
                420.0,
                360.0,
                360.0,
                [64, 126, 224, 76],
                [146, 205, 255, 255],
            ));
            scene.layers.push(simple_rect_layer(
                "right",
                480.0,
                420.0,
                920.0,
                360.0,
                [74, 176, 132, 76],
                [158, 236, 198, 255],
            ));
            scene.layers.push(simple_text_layer("left_t", left_title, 28.0, 360.0, 250.0, [228, 240, 255, 255]));
            scene.layers.push(simple_text_layer("right_t", right_title, 28.0, 920.0, 250.0, [228, 246, 236, 255]));
            scene.layers.push(ExplainLayer {
                id: "flow".to_string(),
                primitive: ExplainPrimitive::Polyline {
                    points: vec![[0.0, 0.0], [80.0, 0.0], [80.0, 0.0], [160.0, 0.0]],
                },
                z_index: 2,
                transform: ExplainTransform { x: 500.0, y: 360.0, scale_x: 1.0, scale_y: 1.0, ..Default::default() },
                style: ExplainStyle {
                    fill_rgba: None,
                    stroke_rgba: Some([224, 236, 255, 255]),
                    stroke_width: Some(3.0),
                    opacity: Some(0.0),
                    draw_progress: Some(0.0),
                    line_height_mult: None,
                    text_max_width: None,
                },
            });
            scene.beats = vec![
                ExplainBeat { target: "title".to_string(), kind: AnimationKind::PresetFormulaStepReveal, start: 0.0, duration: tc.text_duration, easing: Easing::EaseOut, ..Default::default() },
                ExplainBeat { target: "left".to_string(), kind: AnimationKind::PresetShapeDrawRect, start: 0.7, duration: tc.shape_duration, easing: Easing::EaseInOut, axis_x: Some(360.0), axis_y: Some(360.0), axis_width: Some(480.0), axis_height: Some(420.0), ..Default::default() },
                ExplainBeat { target: "right".to_string(), kind: AnimationKind::PresetShapeDrawRect, start: 0.9, duration: tc.shape_duration, easing: Easing::EaseInOut, axis_x: Some(920.0), axis_y: Some(360.0), axis_width: Some(480.0), axis_height: Some(420.0), ..Default::default() },
                ExplainBeat { target: "left_t".to_string(), kind: AnimationKind::PresetFormulaStepReveal, start: 1.3, duration: tc.text_duration, easing: Easing::EaseOut, ..Default::default() },
                ExplainBeat { target: "right_t".to_string(), kind: AnimationKind::PresetFormulaStepReveal, start: 1.45, duration: tc.text_duration, easing: Easing::EaseOut, ..Default::default() },
                ExplainBeat { target: "flow".to_string(), kind: AnimationKind::PresetConnectorSafeRoute, start: 1.7, duration: tc.connector_duration, easing: Easing::EaseInOut, axis_x: Some(500.0), axis_y: Some(360.0), layout_target: Some("right".to_string()), arrows_outside: true, avoid_overlap: true, layout_padding: tc.layout_padding, label_padding: tc.label_padding, connector_path_mode: parse_routing_mode(&tc.routing_mode), connector_side_preference: Some(ConnectorSidePreference::Left), ..Default::default() },
            ];
        }
        "formula_vector_flow" => {
            let tc = template_contract(params, "Formula + Data Flow", 3);
            let formula = param_str(params, "formula", "SI = (P * R * T) / 100");
            scene.layers.push(simple_text_layer(
                "title",
                tc.title,
                50.0,
                640.0,
                90.0,
                [236, 242, 255, 255],
            ));
            scene.layers.push(simple_rect_layer("fbox", 980.0, 220.0, 640.0, 250.0, [64, 126, 224, 76], [146, 205, 255, 255]));
            scene.layers.push(simple_text_layer("formula", formula, 42.0, 640.0, 250.0, [232, 242, 255, 255]));
            let n = tc.count.max(2);
            let start_x = 640.0 - ((n as f32 - 1.0) * tc.spacing * 0.5);
            for idx in 0..n {
                let x = start_x + idx as f32 * tc.spacing;
                let label = tc.labels.get(idx).cloned().unwrap_or_else(|| format!("Block {}", idx + 1));
                scene.layers.push(simple_rect_layer(
                    &format!("b{}", idx + 1),
                    250.0,
                    120.0,
                    x,
                    530.0,
                    [74, 176, 132, 78],
                    [158, 236, 198, 255],
                ));
                scene.layers.push(simple_text_layer(
                    &format!("bt{}", idx + 1),
                    label,
                    22.0,
                    x,
                    530.0,
                    [228, 246, 236, 255],
                ));
            }
            scene.beats.push(ExplainBeat { target: "title".to_string(), kind: AnimationKind::PresetFormulaStepReveal, start: 0.0, duration: tc.text_duration, easing: Easing::EaseOut, ..Default::default() });
            scene.beats.push(ExplainBeat { target: "fbox".to_string(), kind: AnimationKind::PresetVectorFlowBlockReveal, start: 0.7, duration: tc.shape_duration, easing: Easing::EaseOut, axis_x: Some(640.0), axis_y: Some(250.0), ..Default::default() });
            scene.beats.push(ExplainBeat { target: "formula".to_string(), kind: AnimationKind::PresetFormulaStepReveal, start: 1.4, duration: tc.text_duration, easing: Easing::EaseOut, ..Default::default() });
            for idx in 0..n {
                let x = start_x + idx as f32 * tc.spacing;
                let st = 2.0 + idx as f32 * 0.18;
                let id = format!("b{}", idx + 1);
                scene.beats.push(ExplainBeat { target: id.clone(), kind: AnimationKind::PresetVectorFlowBlockReveal, start: st, duration: tc.shape_duration * 0.8, easing: Easing::EaseOut, axis_x: Some(x), axis_y: Some(530.0), ..Default::default() });
                scene.beats.push(ExplainBeat { target: format!("bt{}", idx + 1), kind: AnimationKind::PresetFormulaStepReveal, start: st + 0.16, duration: tc.text_duration * 0.75, easing: Easing::EaseOut, ..Default::default() });
                if idx + 1 < n {
                    let conn_id = format!("bf_conn_{}", idx + 1);
                    scene.layers.push(simple_polyline_layer(
                        &conn_id,
                        vec![[0.0, 0.0], [70.0, 0.0], [70.0, 0.0], [140.0, 0.0]],
                        x + 125.0,
                        530.0,
                        [224, 236, 255, 255],
                        3.0,
                    ));
                    scene.beats.push(ExplainBeat {
                        target: conn_id,
                        kind: AnimationKind::PresetConnectorSafeRoute,
                        start: st + 0.1,
                        duration: tc.connector_duration * 0.7,
                        easing: Easing::EaseInOut,
                        axis_x: Some(x + 125.0),
                        axis_y: Some(530.0),
                        layout_target: Some(format!("b{}", idx + 2)),
                        arrows_outside: true,
                        avoid_overlap: true,
                        layout_padding: tc.layout_padding,
                        label_padding: tc.label_padding,
                        connector_path_mode: parse_routing_mode(&tc.routing_mode),
                        connector_side_preference: Some(ConnectorSidePreference::Left),
                        ..Default::default()
                    });
                    if tc.multi_arrow {
                        let conn_id2 = format!("bf_conn_{}_alt", idx + 1);
                        scene.layers.push(simple_polyline_layer(
                            &conn_id2,
                            vec![[0.0, 0.0], [70.0, 0.0], [70.0, -55.0], [140.0, -55.0]],
                            x + 125.0,
                            565.0,
                            [180, 220, 255, 255],
                            2.0,
                        ));
                        scene.beats.push(ExplainBeat {
                            target: conn_id2,
                            kind: AnimationKind::PresetConnectorSafeRoute,
                            start: st + 0.2,
                            duration: tc.connector_duration * 0.65,
                            easing: Easing::EaseInOut,
                            axis_x: Some(x + 125.0),
                            axis_y: Some(565.0),
                            layout_target: Some(format!("b{}", idx + 2)),
                            arrows_outside: true,
                            avoid_overlap: true,
                            layout_padding: tc.layout_padding,
                            label_padding: tc.label_padding,
                            connector_path_mode: parse_routing_mode(&tc.routing_mode),
                            connector_side_preference: Some(ConnectorSidePreference::Left),
                            ..Default::default()
                        });
                    }
                }
            }
        }
        "bank_flow_journey" => {
            let tc = template_contract(params, "Bank Flow Journey", 4);
            scene.layers.push(simple_text_layer("title", tc.title, 50.0, 640.0, 90.0, [236, 242, 255, 255]));
            scene.layers.push(simple_rect_layer("user", 120.0, 120.0, 140.0, 360.0, [96, 150, 238, 140], [190, 222, 255, 255]));
            scene.layers.push(simple_rect_layer("app", 260.0, 210.0, 390.0, 360.0, [226, 208, 176, 180], [246, 236, 212, 255]));
            scene.layers.push(simple_rect_layer("service", 300.0, 210.0, 720.0, 360.0, [74, 176, 132, 78], [158, 236, 198, 255]));
            scene.layers.push(simple_rect_layer("notify", 280.0, 170.0, 1040.0, 360.0, [92, 136, 230, 78], [172, 210, 255, 255]));
            scene.beats = vec![
                ExplainBeat { target: "title".to_string(), kind: AnimationKind::PresetFormulaStepReveal, start: 0.0, duration: tc.text_duration, easing: Easing::EaseOut, ..Default::default() },
                ExplainBeat { target: "user".to_string(), kind: AnimationKind::PresetShapeDrawCircle, start: 0.7, duration: tc.shape_duration, easing: Easing::EaseInOut, axis_x: Some(140.0), axis_y: Some(360.0), axis_width: Some(120.0), axis_height: Some(120.0), ..Default::default() },
                ExplainBeat { target: "app".to_string(), kind: AnimationKind::PresetShapeDrawRect, start: 0.9, duration: tc.shape_duration, easing: Easing::EaseInOut, axis_x: Some(390.0), axis_y: Some(360.0), axis_width: Some(260.0), axis_height: Some(210.0), ..Default::default() },
                ExplainBeat { target: "service".to_string(), kind: AnimationKind::PresetVectorFlowBlockReveal, start: 1.1, duration: tc.shape_duration, easing: Easing::EaseOut, axis_x: Some(720.0), axis_y: Some(360.0), ..Default::default() },
                ExplainBeat { target: "notify".to_string(), kind: AnimationKind::PresetShapeDrawRect, start: 1.3, duration: tc.shape_duration, easing: Easing::EaseInOut, axis_x: Some(1040.0), axis_y: Some(360.0), axis_width: Some(280.0), axis_height: Some(170.0), ..Default::default() },
            ];
        }
        "recap_board" => {
            let tc = template_contract(params, "Final Recap", 1);
            let recap = param_str(
                params,
                "recap",
                "1) Class/Object\n2) Encapsulation\n3) Abstraction\n4) Inheritance\n5) Polymorphism",
            );
            let title_fs = param_f32(params, "title_font_size", 52.0).clamp(36.0, 64.0);
            let recap_fs = param_f32(params, "recap_font_size", 30.0).clamp(22.0, 42.0);
            let board_w = param_f32(params, "board_width", 1080.0).clamp(720.0, 1180.0);
            let board_h = param_f32(params, "board_height", 420.0).clamp(280.0, 520.0);
            scene.layers.push(simple_text_layer(
                "title",
                tc.title,
                title_fs,
                640.0,
                100.0,
                [236, 244, 255, 255],
            ));
            scene.layers.push(simple_rect_layer(
                "board",
                board_w,
                board_h,
                640.0,
                380.0,
                [26, 44, 86, 114],
                [124, 188, 255, 255],
            ));
            let mut recap_layer = simple_text_layer("recap", recap, recap_fs, 640.0, 360.0, [228, 238, 255, 255]);
            recap_layer.style.text_max_width =
                Some(param_f32(params, "recap_max_width", 920.0).clamp(400.0, 1000.0));
            scene.layers.push(recap_layer);
            scene.beats = vec![
                ExplainBeat { target: "title".to_string(), kind: AnimationKind::PresetFormulaStepReveal, start: 0.0, duration: tc.text_duration, easing: Easing::EaseOut, ..Default::default() },
                ExplainBeat { target: "board".to_string(), kind: AnimationKind::PresetShapeDrawRect, start: 0.7, duration: tc.shape_duration, easing: Easing::EaseInOut, axis_x: Some(640.0), axis_y: Some(380.0), axis_width: Some(board_w), axis_height: Some(board_h), ..Default::default() },
                ExplainBeat { target: "recap".to_string(), kind: AnimationKind::PresetFormulaStepReveal, start: 1.5, duration: tc.text_duration * 1.2, easing: Easing::EaseOut, ..Default::default() },
            ];
        }
        "flow_chain" => {
            let tc = template_contract(params, "Flow Chain", 5);
            let n = tc.count.max(2);
            let y = param_f32(params, "y", 360.0);
            let start_x = 640.0 - ((n as f32 - 1.0) * tc.spacing * 0.5);
            scene.layers.push(simple_text_layer("title", tc.title.clone(), 50.0, 640.0, 90.0, [236, 242, 255, 255]));
            for idx in 0..n {
                let x = start_x + idx as f32 * tc.spacing;
                let label = tc.labels.get(idx).cloned().unwrap_or_else(|| format!("Step {}", idx + 1));
                scene.layers.push(simple_rect_layer(&format!("box_{}", idx + 1), 190.0, 95.0, x, y, [64, 126, 224, 76], [146, 205, 255, 255]));
                scene.layers.push(simple_text_layer(&format!("box_t_{}", idx + 1), label, 22.0, x, y, [228, 240, 255, 255]));
            }
            scene.beats.push(ExplainBeat { target: "title".to_string(), kind: AnimationKind::PresetFormulaStepReveal, start: 0.0, duration: tc.text_duration, easing: Easing::EaseOut, ..Default::default() });
            for idx in 0..n {
                let x = start_x + idx as f32 * tc.spacing;
                let st = 0.7 + idx as f32 * 0.20;
                scene.beats.push(ExplainBeat { target: format!("box_{}", idx + 1), kind: AnimationKind::PresetShapeDrawRect, start: st, duration: tc.shape_duration, easing: Easing::EaseInOut, axis_x: Some(x), axis_y: Some(y), axis_width: Some(190.0), axis_height: Some(95.0), ..Default::default() });
                scene.beats.push(ExplainBeat { target: format!("box_t_{}", idx + 1), kind: AnimationKind::PresetFormulaStepReveal, start: st + 0.14, duration: tc.text_duration * 0.8, easing: Easing::EaseOut, ..Default::default() });
                if idx + 1 < n {
                    let conn_id = format!("conn_{}", idx + 1);
                    scene.layers.push(simple_polyline_layer(&conn_id, vec![[0.0,0.0],[70.0,0.0],[70.0,0.0],[140.0,0.0]], x + 95.0, y, [224,236,255,255], 3.0));
                    scene.beats.push(ExplainBeat { target: conn_id.clone(), kind: AnimationKind::PresetConnectorSafeRoute, start: st + 0.08, duration: tc.connector_duration, easing: Easing::EaseInOut, axis_x: Some(x + 95.0), axis_y: Some(y), layout_target: Some(format!("box_{}", idx + 2)), arrows_outside: true, avoid_overlap: true, layout_padding: tc.layout_padding, label_padding: tc.label_padding, connector_path_mode: parse_routing_mode(&tc.routing_mode), connector_side_preference: Some(ConnectorSidePreference::Left), ..Default::default() });
                    if tc.multi_arrow {
                        let conn2 = format!("conn_{}_alt", idx + 1);
                        scene.layers.push(simple_polyline_layer(&conn2, vec![[0.0,0.0],[70.0,0.0],[70.0,-45.0],[140.0,-45.0]], x + 95.0, y + 28.0, [180,220,255,255], 2.0));
                        scene.beats.push(ExplainBeat { target: conn2, kind: AnimationKind::PresetConnectorSafeRoute, start: st + 0.18, duration: tc.connector_duration * 0.8, easing: Easing::EaseInOut, axis_x: Some(x + 95.0), axis_y: Some(y + 28.0), layout_target: Some(format!("box_{}", idx + 2)), arrows_outside: true, avoid_overlap: true, layout_padding: tc.layout_padding, label_padding: tc.label_padding, connector_path_mode: parse_routing_mode(&tc.routing_mode), connector_side_preference: Some(ConnectorSidePreference::Left), ..Default::default() });
                    }
                }
            }
        }
        "org_diagram" => {
            let tc = template_contract(params, "Org Diagram", 4);
            let children = tc.count.max(3);
            let root_x = 640.0;
            let root_y = 200.0;
            let child_y = 470.0;
            let start_x = 640.0 - ((children as f32 - 1.0) * tc.spacing * 0.5);
            scene.layers.push(simple_text_layer("title", tc.title.clone(), 50.0, 640.0, 90.0, [236,242,255,255]));
            scene.layers.push(simple_rect_layer("org_root", 250.0, 100.0, root_x, root_y, [84, 132, 220, 82], [172, 210, 255, 255]));
            scene.layers.push(simple_text_layer("org_root_t", tc.labels.get(0).cloned().unwrap_or_else(|| "Root".to_string()), 24.0, root_x, root_y, [228,240,255,255]));
            scene.beats.push(ExplainBeat { target: "title".to_string(), kind: AnimationKind::PresetFormulaStepReveal, start: 0.0, duration: tc.text_duration, easing: Easing::EaseOut, ..Default::default() });
            scene.beats.push(ExplainBeat { target: "org_root".to_string(), kind: AnimationKind::PresetShapeDrawRect, start: 0.7, duration: tc.shape_duration, easing: Easing::EaseInOut, axis_x: Some(root_x), axis_y: Some(root_y), axis_width: Some(250.0), axis_height: Some(100.0), ..Default::default() });
            scene.beats.push(ExplainBeat { target: "org_root_t".to_string(), kind: AnimationKind::PresetFormulaStepReveal, start: 0.9, duration: tc.text_duration * 0.8, easing: Easing::EaseOut, ..Default::default() });
            for i in 0..children {
                let x = start_x + i as f32 * tc.spacing;
                let box_id = format!("org_child_{}", i + 1);
                let txt_id = format!("org_child_t_{}", i + 1);
                let conn_id = format!("org_conn_{}", i + 1);
                scene.layers.push(simple_rect_layer(&box_id, 210.0, 90.0, x, child_y, [74, 176, 132, 76], [158, 236, 198, 255]));
                scene.layers.push(simple_text_layer(&txt_id, tc.labels.get(i + 1).cloned().unwrap_or_else(|| format!("Node {}", i + 1)), 21.0, x, child_y, [228,246,236,255]));
                scene.layers.push(simple_polyline_layer(&conn_id, vec![[0.0,0.0],[0.0,110.0],[x-root_x,110.0],[x-root_x,220.0]], root_x, root_y + 50.0, [224,236,255,255], 3.0));
                let st = 1.2 + i as f32 * 0.2;
                scene.beats.push(ExplainBeat { target: box_id.clone(), kind: AnimationKind::PresetShapeDrawRect, start: st, duration: tc.shape_duration, easing: Easing::EaseInOut, axis_x: Some(x), axis_y: Some(child_y), axis_width: Some(210.0), axis_height: Some(90.0), ..Default::default() });
                scene.beats.push(ExplainBeat { target: conn_id, kind: AnimationKind::PresetConnectorSafeRoute, start: st - 0.05, duration: tc.connector_duration, easing: Easing::EaseInOut, axis_x: Some(root_x), axis_y: Some(root_y + 50.0), layout_target: Some(box_id), arrows_outside: true, avoid_overlap: true, layout_padding: tc.layout_padding, label_padding: tc.label_padding, connector_path_mode: parse_routing_mode(&tc.routing_mode), connector_side_preference: Some(ConnectorSidePreference::Top), ..Default::default() });
                scene.beats.push(ExplainBeat { target: txt_id, kind: AnimationKind::PresetFormulaStepReveal, start: st + 0.1, duration: tc.text_duration * 0.8, easing: Easing::EaseOut, ..Default::default() });
            }
        }
        "process_swimlane" => {
            let tc = template_contract(params, "Process Swimlane", 3);
            let lanes = tc.count.max(2);
            let lane_h = 130.0;
            let lane_w = 1080.0;
            let start_y = 230.0;
            scene.layers.push(simple_text_layer("title", tc.title.clone(), 50.0, 640.0, 90.0, [236,242,255,255]));
            scene.beats.push(ExplainBeat { target: "title".to_string(), kind: AnimationKind::PresetFormulaStepReveal, start: 0.0, duration: tc.text_duration, easing: Easing::EaseOut, ..Default::default() });
            for i in 0..lanes {
                let y = start_y + i as f32 * lane_h;
                let lane = format!("lane_{}", i + 1);
                let step = format!("lane_step_{}", i + 1);
                let st = 0.7 + i as f32 * 0.22;
                scene.layers.push(simple_rect_layer(&lane, lane_w, lane_h - 12.0, 640.0, y, [40, 72, 118, 92], [150, 204, 255, 255]));
                scene.layers.push(simple_rect_layer(&step, 260.0, 70.0, 360.0 + i as f32 * 220.0, y, [74, 176, 132, 78], [158, 236, 198, 255]));
                scene.layers.push(simple_text_layer(&format!("lane_t_{}", i + 1), tc.labels.get(i).cloned().unwrap_or_else(|| format!("Lane {}", i + 1)), 20.0, 140.0, y, [228,240,255,255]));
                scene.beats.push(ExplainBeat { target: lane, kind: AnimationKind::PresetShapeDrawRect, start: st, duration: tc.shape_duration, easing: Easing::EaseInOut, axis_x: Some(640.0), axis_y: Some(y), axis_width: Some(lane_w), axis_height: Some(lane_h - 12.0), ..Default::default() });
                scene.beats.push(ExplainBeat { target: step.clone(), kind: AnimationKind::PresetVectorFlowBlockReveal, start: st + 0.1, duration: tc.shape_duration * 0.9, easing: Easing::EaseOut, axis_x: Some(360.0 + i as f32 * 220.0), axis_y: Some(y), ..Default::default() });
                scene.beats.push(ExplainBeat { target: format!("lane_t_{}", i + 1), kind: AnimationKind::PresetFormulaStepReveal, start: st + 0.18, duration: tc.text_duration * 0.75, easing: Easing::EaseOut, ..Default::default() });
                if i + 1 < lanes {
                    let conn = format!("lane_conn_{}", i + 1);
                    scene.layers.push(simple_polyline_layer(&conn, vec![[0.0,0.0],[100.0,0.0],[100.0,110.0],[200.0,110.0]], 360.0 + i as f32 * 220.0, y, [224,236,255,255], 3.0));
                    scene.beats.push(ExplainBeat { target: conn, kind: AnimationKind::PresetConnectorSafeRoute, start: st + 0.2, duration: tc.connector_duration, easing: Easing::EaseInOut, axis_x: Some(360.0 + i as f32 * 220.0), axis_y: Some(y), layout_target: Some(format!("lane_step_{}", i + 2)), arrows_outside: true, avoid_overlap: true, layout_padding: tc.layout_padding, label_padding: tc.label_padding, connector_path_mode: parse_routing_mode(&tc.routing_mode), connector_side_preference: Some(ConnectorSidePreference::Left), ..Default::default() });
                }
            }
        }
        "math_formula_pack" => {
            let tc = template_contract(params, "Math Formula Pack", 3);
            let steps = tc.labels.clone();
            let s1 = steps.get(0).cloned().unwrap_or_else(|| param_str(params, "formula", "f(x) = x^2 + 2x + 1"));
            let s2 = steps.get(1).cloned().unwrap_or_else(|| param_str(params, "step2", "f(x) = (x+1)^2"));
            let s3 = steps.get(2).cloned().unwrap_or_else(|| param_str(params, "step3", "x = 2 => f(x) = 9"));
            scene.layers.push(simple_text_layer("title", tc.title.clone(), 50.0, 640.0, 90.0, [236,242,255,255]));
            scene.layers.push(simple_rect_layer("formula_box", 980.0, 300.0, 640.0, 300.0, [64,126,224,76], [146,205,255,255]));
            scene.layers.push(simple_text_layer("f1", s1, 42.0, 640.0, 240.0, [232,242,255,255]));
            scene.layers.push(simple_text_layer("f2", s2, 38.0, 640.0, 305.0, [232,242,255,255]));
            scene.layers.push(simple_text_layer("f3", s3, 38.0, 640.0, 370.0, [255,236,176,255]));
            scene.beats = vec![
                ExplainBeat { target: "title".to_string(), kind: AnimationKind::PresetFormulaStepReveal, start: 0.0, duration: tc.text_duration, easing: Easing::EaseOut, ..Default::default() },
                ExplainBeat { target: "formula_box".to_string(), kind: AnimationKind::PresetVectorFlowBlockReveal, start: 0.7, duration: tc.shape_duration, easing: Easing::EaseOut, axis_x: Some(640.0), axis_y: Some(300.0), ..Default::default() },
                ExplainBeat { target: "f1".to_string(), kind: AnimationKind::PresetFormulaStepReveal, start: 1.3, duration: tc.text_duration, easing: Easing::EaseOut, ..Default::default() },
                ExplainBeat { target: "f2".to_string(), kind: AnimationKind::PresetFormulaStepReveal, start: 2.0, duration: tc.text_duration, easing: Easing::EaseOut, ..Default::default() },
                ExplainBeat { target: "f3".to_string(), kind: AnimationKind::PresetFormulaStepReveal, start: 2.7, duration: tc.text_duration, easing: Easing::EaseOut, ..Default::default() },
            ];
        }
        "timeline_pack" => {
            let tc = template_contract(params, "Timeline Pack", 5);
            let n = tc.count.max(3);
            let y = 390.0;
            let start_x = 220.0;
            let end_x = 1060.0;
            let step = if n <= 1 { 0.0 } else { (end_x - start_x) / (n as f32 - 1.0) };
            scene.layers.push(simple_text_layer("title", tc.title.clone(), 50.0, 640.0, 90.0, [236,242,255,255]));
            scene.layers.push(simple_polyline_layer("timeline_line", vec![[0.0,0.0],[end_x-start_x,0.0]], start_x, y, [172,210,255,255], 4.0));
            scene.beats.push(ExplainBeat { target: "title".to_string(), kind: AnimationKind::PresetFormulaStepReveal, start: 0.0, duration: tc.text_duration, easing: Easing::EaseOut, ..Default::default() });
            scene.beats.push(ExplainBeat { target: "timeline_line".to_string(), kind: AnimationKind::PresetShapeDrawLine, start: 0.7, duration: tc.shape_duration, easing: Easing::EaseInOut, axis_width: Some(end_x - start_x), axis_height: Some(0.0), ..Default::default() });
            for i in 0..n {
                let x = start_x + i as f32 * step;
                let id = format!("mile_{}", i + 1);
                let t = format!("mile_t_{}", i + 1);
                scene.layers.push(simple_circle_layer(&id, 22.0, x, y, [92,136,230,84], [172,210,255,255]));
                scene.layers.push(simple_text_layer(&t, tc.labels.get(i).cloned().unwrap_or_else(|| format!("M{}", i + 1)), 18.0, x, y + 58.0, [228,240,255,255]));
                let st = 1.1 + i as f32 * 0.18;
                scene.beats.push(ExplainBeat { target: id, kind: AnimationKind::PresetShapeDrawCircle, start: st, duration: tc.shape_duration * 0.75, easing: Easing::EaseInOut, axis_x: Some(x), axis_y: Some(y), axis_width: Some(44.0), axis_height: Some(44.0), ..Default::default() });
                scene.beats.push(ExplainBeat { target: t, kind: AnimationKind::PresetFormulaStepReveal, start: st + 0.08, duration: tc.text_duration * 0.7, easing: Easing::EaseOut, ..Default::default() });
            }
        }
        "building_city_pack" => {
            let tc = template_contract(params, "Building City Pack", 5);
            let n = tc.count.max(3);
            let spacing = tc.spacing.min(180.0).max(120.0);
            let start_x = 640.0 - ((n as f32 - 1.0) * spacing * 0.5);
            scene.layers.push(simple_text_layer("title", tc.title.clone(), 50.0, 640.0, 90.0, [236,242,255,255]));
            scene.layers.push(simple_rect_layer("ground", 1120.0, 90.0, 640.0, 620.0, [30,52,88,130], [120,186,255,255]));
            scene.beats.push(ExplainBeat { target: "title".to_string(), kind: AnimationKind::PresetFormulaStepReveal, start: 0.0, duration: tc.text_duration, easing: Easing::EaseOut, ..Default::default() });
            scene.beats.push(ExplainBeat { target: "ground".to_string(), kind: AnimationKind::PresetShapeDrawRect, start: 0.6, duration: tc.shape_duration, easing: Easing::EaseInOut, axis_x: Some(640.0), axis_y: Some(620.0), axis_width: Some(1120.0), axis_height: Some(90.0), ..Default::default() });
            for i in 0..n {
                let x = start_x + i as f32 * spacing;
                let h = 140.0 + (i % 3) as f32 * 80.0;
                let bid = format!("bld_{}", i + 1);
                let label = format!("bld_t_{}", i + 1);
                scene.layers.push(simple_rect_layer(&bid, 96.0, h, x, 620.0 - 45.0 - h * 0.5, [74,176,132,82], [158,236,198,255]));
                scene.layers.push(simple_text_layer(&label, tc.labels.get(i).cloned().unwrap_or_else(|| format!("B{}", i + 1)), 16.0, x, 620.0 - h - 18.0, [228,246,236,255]));
                let st = 1.0 + i as f32 * 0.16;
                scene.beats.push(ExplainBeat { target: bid, kind: AnimationKind::PresetShapeDrawRect, start: st, duration: tc.shape_duration, easing: Easing::EaseInOut, axis_x: Some(x), axis_y: Some(620.0 - 45.0 - h * 0.5), axis_width: Some(96.0), axis_height: Some(h), ..Default::default() });
                scene.beats.push(ExplainBeat { target: label, kind: AnimationKind::PresetFormulaStepReveal, start: st + 0.1, duration: tc.text_duration * 0.65, easing: Easing::EaseOut, ..Default::default() });
                if i + 1 < n {
                    let conn = format!("bld_conn_{}", i + 1);
                    scene.layers.push(simple_polyline_layer(&conn, vec![[0.0,0.0],[60.0,0.0],[60.0,-30.0],[120.0,-30.0]], x + 48.0, 620.0 - 50.0 - h * 0.4, [224,236,255,255], 2.5));
                    scene.beats.push(ExplainBeat { target: conn, kind: AnimationKind::PresetConnectorSafeRoute, start: st + 0.15, duration: tc.connector_duration * 0.7, easing: Easing::EaseInOut, axis_x: Some(x + 48.0), axis_y: Some(620.0 - 50.0 - h * 0.4), layout_target: Some(format!("bld_{}", i + 2)), arrows_outside: true, avoid_overlap: true, layout_padding: tc.layout_padding, label_padding: tc.label_padding, connector_path_mode: parse_routing_mode(&tc.routing_mode), connector_side_preference: Some(ConnectorSidePreference::Left), ..Default::default() });
                }
            }
        }
        _ => {
            bail!(
                "scene '{}' uses unknown scene_template '{}'. supported: edu_preset (250 catalog layouts), house_bank_compare, formula_vector_flow, bank_flow_journey, recap_board, flow_chain, org_diagram, process_swimlane, math_formula_pack, timeline_pack, building_city_pack",
                item.id,
                template
            );
        }
    }
    Ok(scene)
}

fn load_scene_for_storyboard_item(
    item: &StoryboardScene,
    storyboard_root: &Path,
    generated_scene_dir: &Path,
    width: u32,
    height: u32,
    fps: u32,
) -> Result<Scene> {
    let mut merged_shots = load_global_shot_list_from_env();
    if !item.shot_list.is_empty() {
        merged_shots.extend(item.shot_list.clone());
    }
    if let Some(expl) = &item.scene_explanatory {
        let mut expl_scene = expl.clone();
        apply_shot_list_to_expl(&mut expl_scene, &merged_shots);
        let expl_raw = serde_json::to_string(&expl_scene)?;
        let key = cache::stable_hash(&[
            "scene-dsl-v2",
            &item.id,
            &format!("{:.3}", item.duration_seconds.unwrap_or(0.0)),
            &width.to_string(),
            &height.to_string(),
            &fps.to_string(),
            &expl_raw,
        ]);
        if let Some(scene) = cache::load_scene_cache(&key)? {
            return Ok(scene);
        }
        let scene = compile_scene_explanatory(item, &expl_scene, width, height, fps)?;
        let out = generated_scene_dir.join(format!("{}_dsl_scene.json", item.id));
        fs::write(&out, serde_json::to_string_pretty(&scene)?)
            .with_context(|| format!("failed writing generated DSL scene {}", out.display()))?;
        let _ = cache::store_scene_cache(&key, &scene);
        return Ok(scene);
    }

    if item.scene_composition.is_some() {
        let mut expl = materialize_scene_composition(item, width, height, fps)?;
        apply_shot_list_to_expl(&mut expl, &merged_shots);
        let expl_raw = serde_json::to_string(&expl)?;
        let comp_variant = item
            .scene_composition
            .as_ref()
            .and_then(|c| c.variant.as_ref())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "default".to_string());
        let key = cache::stable_hash(&[
            "scene-composition-v2",
            &item.id,
            &comp_variant,
            &format!("{:.3}", item.duration_seconds.unwrap_or(0.0)),
            &width.to_string(),
            &height.to_string(),
            &fps.to_string(),
            &expl_raw,
        ]);
        if let Some(scene) = cache::load_scene_cache(&key)? {
            return Ok(scene);
        }
        let scene = compile_scene_explanatory(item, &expl, width, height, fps)?;
        let out = generated_scene_dir.join(format!("{}_composition_scene.json", item.id));
        fs::write(&out, serde_json::to_string_pretty(&scene)?)
            .with_context(|| format!("failed writing generated composition scene {}", out.display()))?;
        let _ = cache::store_scene_cache(&key, &scene);
        return Ok(scene);
    }

    if item
        .scene_template
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .is_some()
    {
        let mut expl = materialize_scene_template(item, width, height, fps)?;
        apply_shot_list_to_expl(&mut expl, &merged_shots);
        let expl_raw = serde_json::to_string(&expl)?;
        let key = cache::stable_hash(&[
            "scene-template-v2",
            &item.id,
            &format!("{:.3}", item.duration_seconds.unwrap_or(0.0)),
            &width.to_string(),
            &height.to_string(),
            &fps.to_string(),
            &expl_raw,
        ]);
        if let Some(scene) = cache::load_scene_cache(&key)? {
            return Ok(scene);
        }
        let scene = compile_scene_explanatory(item, &expl, width, height, fps)?;
        let out = generated_scene_dir.join(format!("{}_template_scene.json", item.id));
        fs::write(&out, serde_json::to_string_pretty(&scene)?)
            .with_context(|| format!("failed writing generated template scene {}", out.display()))?;
        let _ = cache::store_scene_cache(&key, &scene);
        return Ok(scene);
    }

    let scene_ref = item
        .scene_path
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or_else(|| {
            anyhow!(
                "scene '{}' must provide one of scene_path, scene_explanatory, scene_template, or scene_composition",
                item.id
            )
        })?;
    let scene_path = resolve_scene_path(storyboard_root, scene_ref);
    let scene_raw = fs::read_to_string(&scene_path)
        .with_context(|| format!("failed reading scene '{}'", scene_path.display()))?;
    let key = cache::stable_hash(&[
        "scene-json-v1",
        &scene_path.to_string_lossy(),
        &scene_raw,
    ]);
    if let Some(scene) = cache::load_scene_cache(&key)? {
        return Ok(scene);
    }
    let scene: Scene = serde_json::from_str(&scene_raw)
        .with_context(|| format!("invalid scene JSON '{}'", scene_path.display()))?;
    let _ = cache::store_scene_cache(&key, &scene);
    Ok(scene)
}

fn compile_scene_explanatory(
    item: &StoryboardScene,
    dsl: &SceneExplanatory,
    default_w: u32,
    default_h: u32,
    default_fps: u32,
) -> Result<Scene> {
    let width = dsl.width.unwrap_or(default_w).max(1);
    let height = dsl.height.unwrap_or(default_h).max(1);
    let fps = dsl.fps.unwrap_or(default_fps).max(1);
    let mut layers: Vec<Layer> = Vec::with_capacity(dsl.layers.len());
    for src in &dsl.layers {
        layers.push(Layer {
            id: src.id.clone(),
            z_index: src.z_index,
            transform: Transform {
                x: src.transform.x,
                y: src.transform.y,
                scale_x: src.transform.scale_x,
                scale_y: src.transform.scale_y,
                rotation_deg: src.transform.rotation_deg,
                z: src.transform.z,
                yaw_deg: src.transform.yaw_deg,
                pitch_deg: src.transform.pitch_deg,
                roll_deg: src.transform.roll_deg,
            },
            style: Style {
                fill_rgba: src.style.fill_rgba.unwrap_or([65, 127, 224, 255]),
                stroke_rgba: src.style.stroke_rgba.unwrap_or([220, 220, 240, 255]),
                stroke_width: src.style.stroke_width.unwrap_or(2.0),
                opacity: src.style.opacity.unwrap_or(1.0),
                draw_progress: src.style.draw_progress.unwrap_or(1.0),
                line_height_mult: src.style.line_height_mult.unwrap_or(1.15),
                text_max_width: src.style.text_max_width.unwrap_or(0.0),
            },
            primitive: compile_explain_primitive(&src.primitive),
        });
    }

    let specs: Vec<AnimationSpec> = dsl
        .beats
        .iter()
        .map(|b| AnimationSpec {
            target: b.target.clone(),
            kind: b.kind,
            start: b.start.max(0.0),
            run_time: b.duration.max(0.05),
            lag_ratio: 0.0,
            group_index: 0,
            group_size: 1,
            easing: b.easing,
            shift_x: b.shift_x,
            shift_y: b.shift_y,
            scale_from: b.scale_from.max(0.01),
            scale_to: b.scale_to.max(0.01),
            path_arc_deg: b.path_arc_deg,
            path_points: b.path_points.clone(),
            homotopy_amp_x: b.homotopy_amp_x,
            homotopy_amp_y: b.homotopy_amp_y,
            homotopy_freq: b.homotopy_freq.max(0.0),
            homotopy_phase_deg: b.homotopy_phase_deg,
            replace_with: b.replace_with.clone(),
            to_x: b.to_x,
            to_y: b.to_y,
            to_scale_x: b.to_scale_x,
            to_scale_y: b.to_scale_y,
            to_rotation_deg: b.to_rotation_deg,
            axis_x: b.axis_x,
            axis_y: b.axis_y,
            axis_width: b.axis_width,
            axis_height: b.axis_height,
            label_text: b.label_text.clone(),
            layout_target: b.layout_target.clone(),
            sub_box_mode: b.sub_box_mode,
            sub_box_offset_x: b.sub_box_offset_x,
            sub_box_offset_y: b.sub_box_offset_y,
            sub_box_width: b.sub_box_width,
            sub_box_height: b.sub_box_height,
            preset_fill_rgba: b.preset_fill_rgba,
            preset_stroke_rgba: b.preset_stroke_rgba,
            preset_text_rgba: b.preset_text_rgba,
            avoid_overlap: b.avoid_overlap,
            arrows_outside: b.arrows_outside,
            layout_padding: b.layout_padding.max(0.0),
            label_padding: b.label_padding.max(0.0),
            connector_side_preference: b.connector_side_preference,
            connector_path_mode: b.connector_path_mode,
            connector_elbow_ratio: b.connector_elbow_ratio,
        })
        .collect();

    let mut inferred = 0.0f32;
    for beat in &dsl.beats {
        inferred = inferred.max(beat.start.max(0.0) + beat.duration.max(0.05));
    }
    let duration = item
        .duration_seconds
        .unwrap_or(inferred.max(6.0))
        .max(inferred.max(0.1));

    let cam = dsl.camera.clone().unwrap_or_default();
    let scene = Scene {
        version: if dsl.version.trim().is_empty() {
            "v1".to_string()
        } else {
            dsl.version.clone()
        },
        canvas: Canvas {
            width,
            height,
            fps,
            background_rgba: dsl.background_rgba.unwrap_or([8, 14, 30, 255]),
        },
        duration_seconds: duration.max(0.1),
        camera: varin_core::CameraState {
            x: cam.x,
            y: cam.y,
            z: cam.z,
            // Treat missing/zero DSL zoom as 1:1 (derive(Default) on f32 used to yield 0, then .max(0.01) made scenes microscopic).
            zoom: (if cam.zoom <= 0.0 { 1.0 } else { cam.zoom }).max(0.01),
            rotation_deg: cam.rotation_deg,
            yaw_deg: cam.yaw_deg,
            pitch_deg: cam.pitch_deg,
            roll_deg: cam.roll_deg,
            fov: cam.fov.max(1.0),
            near: cam.near.max(0.01),
            far: cam.far.max(1.0),
        },
        layers,
        animations: vec![],
        camera_animations: vec![],
        timeline: Some(SceneTimeline {
            specs,
            lifecycle: vec![],
            segments: vec![TimelineSegment::Play {
                start: 0.0,
                run_time: duration.max(0.1),
                spec_indices: (0..dsl.beats.len()).collect(),
            }],
            groups: vec![],
        }),
    };
    Ok(scene)
}

fn compile_explain_primitive(src: &ExplainPrimitive) -> Primitive {
    match src {
        ExplainPrimitive::Rect {
            width,
            height,
            corner_radius,
        } => Primitive::Rect {
            width: *width,
            height: *height,
            corner_radius: *corner_radius,
        },
        ExplainPrimitive::Circle { radius } => Primitive::Circle { radius: *radius },
        ExplainPrimitive::Ellipse { radius_x, radius_y } => Primitive::Ellipse {
            radius_x: *radius_x,
            radius_y: *radius_y,
        },
        ExplainPrimitive::Line { x1, y1, x2, y2 } => Primitive::Line {
            x1: *x1,
            y1: *y1,
            x2: *x2,
            y2: *y2,
        },
        ExplainPrimitive::Arrow {
            x1,
            y1,
            x2,
            y2,
            tip_length,
            tip_width,
        } => Primitive::Arrow {
            x1: *x1,
            y1: *y1,
            x2: *x2,
            y2: *y2,
            tip_length: *tip_length,
            tip_width: *tip_width,
        },
        ExplainPrimitive::Polyline { points } => Primitive::Polyline {
            points: points.clone(),
        },
        ExplainPrimitive::Polygon { points } => Primitive::Polygon {
            points: points.clone(),
        },
        ExplainPrimitive::Cube {
            size,
            depth_ratio,
            projection_x,
            projection_y,
        } => Primitive::Cube {
            size: *size,
            depth_ratio: *depth_ratio,
            projection_x: *projection_x,
            projection_y: *projection_y,
        },
        ExplainPrimitive::Cuboid {
            width,
            height,
            depth,
            projection_x,
            projection_y,
        } => Primitive::Cuboid {
            width: *width,
            height: *height,
            depth: *depth,
            projection_x: *projection_x,
            projection_y: *projection_y,
        },
        ExplainPrimitive::MeshBlock {
            width,
            height,
            depth,
            albedo,
            emissive,
            roughness,
            metallic,
        } => Primitive::MeshBlock {
            width: *width,
            height: *height,
            depth: *depth,
            albedo: *albedo,
            emissive: *emissive,
            roughness: *roughness,
            metallic: *metallic,
        },
        ExplainPrimitive::Text {
            text,
            font_size,
            font_family,
            font_path,
        } => Primitive::Text {
            text: text.clone(),
            font_size: *font_size,
            font_family: font_family.clone(),
            font_path: font_path.clone(),
        },
        ExplainPrimitive::Image {
            path,
            width,
            height,
        } => Primitive::Image {
            path: path.clone(),
            width: *width,
            height: *height,
        },
    }
}

fn effective_visual_instruction(scene: &StoryboardScene) -> String {
    if !scene.visual_instruction.trim().is_empty() {
        scene.visual_instruction.trim().to_string()
    } else if !scene.caption.trim().is_empty() {
        format!("Visual choreography for '{}'.", scene.caption.trim())
    } else if !scene.id.trim().is_empty() {
        format!("Visual choreography for scene '{}'.", scene.id.trim())
    } else {
        "Visual choreography: staged reveal, connectors, and summary emphasis.".to_string()
    }
}

fn narration_looks_instructional(narration: &str) -> bool {
    let n = narration.to_lowercase();
    let markers = [
        "generate",
        "return only json",
        "scene json",
        "output contract",
        "llm",
        "must include",
        "forbidden:",
        "use valid",
    ];
    markers.iter().any(|m| n.contains(m))
}

fn relativize_or_abs(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| path.to_string_lossy().replace('\\', "/"))
}

fn resolve_scene_path(storyboard_root: &Path, scene_path: &str) -> PathBuf {
    let p = PathBuf::from(scene_path);
    if p.is_absolute() {
        p
    } else {
        storyboard_root.join(p)
    }
}

fn run_edge_tts(voice: &str, text: &str, out_mp3: &Path) -> Result<()> {
    let edge_bin = resolve_edge_tts_bin().unwrap_or_else(|| "edge-tts".to_string());
    let output = Command::new(&edge_bin)
        .arg("--voice")
        .arg(voice)
        .arg("--text")
        .arg(text)
        .arg("--write-media")
        .arg(out_mp3.as_os_str())
        .output()
        .with_context(|| format!("failed launching edge-tts binary '{}'", edge_bin))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        bail!("edge-tts failed: {}", truncate(&err, 500));
    }
    Ok(())
}

fn ensure_edge_tts_available() {
    if resolve_edge_tts_bin().is_some() || command_works("edge-tts", &["--help"]) {
        return;
    }
    let _ = if cfg!(windows) {
        Command::new("py")
            .args(["-m", "pip", "install", "--user", "edge-tts"])
            .output()
    } else {
        Command::new("python3")
            .args(["-m", "pip", "install", "--user", "edge-tts"])
            .output()
    };
}

fn resolve_edge_tts_bin() -> Option<String> {
    if command_works("edge-tts", &["--help"]) {
        return Some("edge-tts".to_string());
    }
    if cfg!(windows) {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let p = PathBuf::from(appdata)
                .join("Python")
                .join("Python313")
                .join("Scripts")
                .join("edge-tts.exe");
            if p.exists() {
                return Some(p.to_string_lossy().to_string());
            }
        }
    }
    None
}

fn command_works(cmd: &str, args: &[&str]) -> bool {
    Command::new(cmd)
        .args(args)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn probe_media_duration(ffmpeg: &str, media: &Path) -> Result<f32> {
    let ffmpeg_path = Path::new(ffmpeg);
    let ffprobe = if let Some(parent) = ffmpeg_path.parent() {
        parent.join(if cfg!(windows) { "ffprobe.exe" } else { "ffprobe" })
    } else {
        PathBuf::from(if cfg!(windows) { "ffprobe.exe" } else { "ffprobe" })
    };
    let output = Command::new(&ffprobe)
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
        ])
        .arg(media.as_os_str())
        .output()
        .with_context(|| format!("failed to run ffprobe '{}'", ffprobe.display()))?;
    if !output.status.success() {
        bail!(
            "ffprobe failed for {}: {}",
            media.display(),
            String::from_utf8_lossy(&output.stderr)
        );
    }
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let secs: f32 = text
        .parse()
        .with_context(|| format!("invalid ffprobe duration '{}'", text))?;
    Ok(secs.max(0.0))
}

fn mux_scene_one_pass(
    ffmpeg: &str,
    video: &Path,
    audio: Option<&Path>,
    out_video: &Path,
    duration_sec: f32,
    benchmark_fast: bool,
) -> Result<()> {
    let out = out_video
        .to_str()
        .ok_or_else(|| anyhow!("invalid scene output path"))?;
    let v = video
        .to_str()
        .ok_or_else(|| anyhow!("invalid scene video path"))?;
    let copy_result = if let Some(a) = audio {
        let a = a
            .to_str()
            .ok_or_else(|| anyhow!("invalid scene audio path"))?;
        run_cmd(
            ffmpeg,
            &[
                "-y",
                "-i",
                v,
                "-i",
                a,
                "-filter_complex",
                "[1:a]apad=pad_dur=60[aout]",
                "-map",
                "0:v:0",
                "-map",
                "[aout]",
                "-c:v",
                "copy",
                "-c:a",
                "aac",
                "-t",
                &format!("{:.3}", duration_sec),
                out,
            ],
        )
    } else {
        run_cmd(
            ffmpeg,
            &[
                "-y",
                "-i",
                v,
                "-f",
                "lavfi",
                "-i",
                "anullsrc=channel_layout=stereo:sample_rate=44100",
                "-map",
                "0:v:0",
                "-map",
                "1:a:0",
                "-c:v",
                "copy",
                "-c:a",
                "aac",
                "-t",
                &format!("{:.3}", duration_sec),
                out,
            ],
        )
    };
    if copy_result.is_ok() {
        return Ok(());
    }
    if let Some(a) = audio {
        let a = a
            .to_str()
            .ok_or_else(|| anyhow!("invalid scene audio path"))?;
        run_cmd(
            ffmpeg,
            &[
                "-y",
                "-i",
                v,
                "-i",
                a,
                "-filter_complex",
                "[1:a]apad=pad_dur=60[aout]",
                "-map",
                "0:v:0",
                "-map",
                "[aout]",
                "-c:v",
                "libx264",
                "-preset",
                if benchmark_fast { "ultrafast" } else { "veryfast" },
                "-c:a",
                "aac",
                "-t",
                &format!("{:.3}", duration_sec),
                out,
            ],
        )
    } else {
        run_cmd(
            ffmpeg,
            &[
                "-y",
                "-i",
                v,
                "-f",
                "lavfi",
                "-i",
                "anullsrc=channel_layout=stereo:sample_rate=44100",
                "-map",
                "0:v:0",
                "-map",
                "1:a:0",
                "-c:v",
                "libx264",
                "-preset",
                if benchmark_fast { "ultrafast" } else { "veryfast" },
                "-c:a",
                "aac",
                "-t",
                &format!("{:.3}", duration_sec),
                out,
            ],
        )
    }
}

fn concat_segments(ffmpeg: &str, segments: &[PathBuf], output: &Path, benchmark_fast: bool) -> Result<()> {
    if segments.is_empty() {
        bail!("no storyboard segments were rendered");
    }
    let concat_path = output
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(format!(".concat_{}.txt", now_millis()));
    let mut lines = String::new();
    for seg in segments {
        lines.push_str(&format!("file '{}'\n", seg.to_string_lossy().replace('\\', "/")));
    }
    fs::write(&concat_path, lines).context("failed writing concat file")?;

    let fast = run_cmd(
        ffmpeg,
        &[
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            concat_path
                .to_str()
                .ok_or_else(|| anyhow!("invalid concat list path"))?,
            "-c",
            "copy",
            output
                .to_str()
                .ok_or_else(|| anyhow!("invalid final output path"))?,
        ],
    );
    if fast.is_ok() {
        let _ = fs::remove_file(concat_path);
        return Ok(());
    }
    let slow = concat_segments_with_filter(ffmpeg, segments, output, benchmark_fast);
    let _ = fs::remove_file(concat_path);
    slow
}

fn concat_segments_with_filter(
    ffmpeg: &str,
    segments: &[PathBuf],
    output: &Path,
    benchmark_fast: bool,
) -> Result<()> {
    let mut cmd = Command::new(ffmpeg);
    cmd.arg("-y");
    for seg in segments {
        cmd.arg("-i").arg(seg.as_os_str());
    }
    let mut filter = String::new();
    for i in 0..segments.len() {
        filter.push_str(&format!("[{i}:v:0][{i}:a:0]"));
    }
    filter.push_str(&format!("concat=n={}:v=1:a=1[outv][outa]", segments.len()));
    let output_path = output
        .to_str()
        .ok_or_else(|| anyhow!("invalid final output path"))?;
    let out = cmd
        .arg("-filter_complex")
        .arg(filter)
        .arg("-map")
        .arg("[outv]")
        .arg("-map")
        .arg("[outa]")
        .arg("-c:v")
        .arg("libx264")
        .arg("-preset")
        .arg(if benchmark_fast { "ultrafast" } else { "veryfast" })
        .arg("-c:a")
        .arg("aac")
        .arg(output_path)
        .output()
        .with_context(|| format!("failed to run {}", ffmpeg))?;
    if !out.status.success() {
        bail!(
            "{} failed: {}",
            ffmpeg,
            truncate(&String::from_utf8_lossy(&out.stderr), 1800)
        );
    }
    Ok(())
}

fn write_srt(path: &Path, rows: &[(f32, f32, String)]) -> Result<()> {
    let mut out = String::new();
    for (idx, (start, end, text)) in rows.iter().enumerate() {
        out.push_str(&(idx + 1).to_string());
        out.push('\n');
        out.push_str(&format!("{} --> {}\n", to_srt_time(*start), to_srt_time(*end)));
        out.push_str(text);
        out.push_str("\n\n");
    }
    fs::write(path, out).with_context(|| format!("failed writing srt {}", path.display()))
}

fn write_interaction_sidecars(output_mp4: &Path, rendered: &[RenderedSegment]) -> Result<()> {
    let mut chapters = Vec::new();
    let mut hotspots = Vec::new();
    let mut t = 0.0f32;
    for seg in rendered {
        let end = t + seg.duration.max(0.1);
        chapters.push(serde_json::json!({
            "index": seg.index,
            "title": seg.caption,
            "start_seconds": t,
            "end_seconds": end
        }));
        hotspots.push(serde_json::json!({
            "id": format!("hotspot_{}", seg.index),
            "kind": "chapter_jump",
            "start_seconds": t,
            "end_seconds": end,
            "label": seg.caption,
            "target_chapter_index": seg.index
        }));
        t = end;
    }
    let chapters_path = output_mp4.with_extension("chapters.json");
    fs::write(&chapters_path, serde_json::to_string_pretty(&chapters)?)
        .with_context(|| format!("failed writing chapters sidecar {}", chapters_path.display()))?;

    let hotspots_path = output_mp4.with_extension("hotspots.json");
    fs::write(&hotspots_path, serde_json::to_string_pretty(&hotspots)?)
        .with_context(|| format!("failed writing hotspots sidecar {}", hotspots_path.display()))?;
    println!("Wrote interaction metadata -> {}, {}", chapters_path.display(), hotspots_path.display());
    Ok(())
}

fn to_srt_time(sec: f32) -> String {
    let s = sec.max(0.0);
    let h = (s / 3600.0).floor() as u32;
    let m = ((s % 3600.0) / 60.0).floor() as u32;
    let ss = (s % 60.0).floor() as u32;
    let ms = ((s - s.floor()) * 1000.0).round() as u32;
    format!("{:02}:{:02}:{:02},{:03}", h, m, ss, ms.min(999))
}

fn run_cmd(bin: &str, args: &[&str]) -> Result<()> {
    let output = Command::new(bin)
        .args(args)
        .output()
        .with_context(|| format!("failed to run {}", bin))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        bail!("{} failed: {}", bin, truncate(&err, 900));
    }
    Ok(())
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn truncate(v: &str, max: usize) -> String {
    if v.len() <= max {
        v.to_string()
    } else {
        format!("{}...", &v[..max])
    }
}
