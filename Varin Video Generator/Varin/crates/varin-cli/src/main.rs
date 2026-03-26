use anyhow::{Context, Result};
use clap::{Parser, Subcommand, ValueEnum};
use serde::Deserialize;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
mod director;
mod planner;
mod storyboard;
mod cache;
mod preset_catalog;
use varin_core::builder::{
    create, fade_in, grow_from_center, layer_rect, layer_text, replacement_transform, rotate_to,
    transform_to, SceneBuilder,
};
use varin_core::{Easing, Scene};
use varin_render::{render_scene_to_mp4, EffectsTier, RenderMode, RenderOptions};

#[derive(Debug, Parser)]
#[command(name = "varin", version, about = "Varin Rust video engine CLI")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Debug, Subcommand)]
enum Commands {
    /// Render a scene JSON into MP4 using FFmpeg.
    Render {
        /// Scene JSON path.
        #[arg(long)]
        input: PathBuf,
        /// Output mp4 path.
        #[arg(long)]
        output: PathBuf,
        /// Optional ffmpeg binary path.
        #[arg(long, default_value = "ffmpeg")]
        ffmpeg: String,
        /// Optional width override.
        #[arg(long)]
        width: Option<u32>,
        /// Optional height override.
        #[arg(long)]
        height: Option<u32>,
        /// Optional FPS override.
        #[arg(long)]
        fps: Option<u32>,
        /// Fraction of CPU cores to use (max clamped to 0.70).
        #[arg(long, default_value_t = 0.7)]
        cpu_ratio: f32,
        /// Fraction of currently free RAM used for buffered frames (max clamped to 0.70).
        #[arg(long, default_value_t = 0.65)]
        ram_ratio: f32,
        /// Hard cap for render worker threads.
        #[arg(long)]
        max_threads: Option<usize>,
        /// Disable hardware encoder auto-selection (NVIDIA NVENC).
        #[arg(long, default_value_t = false)]
        no_hw_encode: bool,
        /// Disable dynamic resource monitor (chunk size stays static).
        #[arg(long, default_value_t = false)]
        no_live_monitor: bool,
        /// Speed-oriented benchmark profile (balanced quality).
        #[arg(long, default_value_t = false)]
        benchmark_fast: bool,
        /// Quality profile preset for speed/quality tuning.
        #[arg(long, value_enum)]
        quality_profile: Option<QualityProfile>,
        /// Force wgpu backend for supported primitive subsets.
        #[arg(long, default_value_t = false)]
        force_wgpu_backend: bool,
        /// Render mode.
        #[arg(long, value_enum, default_value_t = RenderModeArg::TwoD)]
        render_mode: RenderModeArg,
        /// Post effects tier.
        #[arg(long, value_enum, default_value_t = EffectsTierArg::Basic)]
        effects_tier: EffectsTierArg,
    },
    /// Scaffold a Rust-authored scene and save as JSON.
    ScaffoldRustScene {
        /// Output JSON path.
        #[arg(long)]
        output: PathBuf,
    },
    /// Render a storyboard JSON (scene-by-scene with narration).
    RenderStoryboard {
        /// Storyboard JSON path.
        #[arg(long)]
        input: PathBuf,
        /// Output mp4 path.
        #[arg(long)]
        output: PathBuf,
        /// Optional ffmpeg binary path.
        #[arg(long, default_value = "ffmpeg")]
        ffmpeg: String,
        /// Optional width override.
        #[arg(long)]
        width: Option<u32>,
        /// Optional height override.
        #[arg(long)]
        height: Option<u32>,
        /// Optional FPS override.
        #[arg(long)]
        fps: Option<u32>,
        /// Fraction of CPU cores to use (max clamped to 0.70).
        #[arg(long, default_value_t = 0.7)]
        cpu_ratio: f32,
        /// Fraction of currently free RAM used for buffered frames (max clamped to 0.70).
        #[arg(long, default_value_t = 0.65)]
        ram_ratio: f32,
        /// Hard cap for render worker threads.
        #[arg(long)]
        max_threads: Option<usize>,
        /// Disable hardware encoder auto-selection (NVIDIA NVENC).
        #[arg(long, default_value_t = false)]
        no_hw_encode: bool,
        /// Disable dynamic resource monitor (chunk size stays static).
        #[arg(long, default_value_t = false)]
        no_live_monitor: bool,
        /// Enable legacy brief->planner->director flow.
        #[arg(long, default_value_t = false)]
        legacy_brief: bool,
        /// Number of scenes processed in parallel (0 = auto).
        #[arg(long, default_value_t = 0)]
        scene_workers: usize,
        /// Speed-oriented benchmark profile (balanced quality).
        #[arg(long, default_value_t = false)]
        benchmark_fast: bool,
        /// Quality profile preset for speed/quality tuning.
        #[arg(long, value_enum)]
        quality_profile: Option<QualityProfile>,
        /// Optional path for per-stage timing JSON output.
        #[arg(long)]
        timings_json: Option<PathBuf>,
        /// Force wgpu backend for supported primitive subsets.
        #[arg(long, default_value_t = false)]
        force_wgpu_backend: bool,
        /// Render mode.
        #[arg(long, value_enum, default_value_t = RenderModeArg::TwoD)]
        render_mode: RenderModeArg,
        /// Post effects tier.
        #[arg(long, value_enum, default_value_t = EffectsTierArg::Basic)]
        effects_tier: EffectsTierArg,
    },
    /// Ergonomic run aliases.
    Run {
        #[command(subcommand)]
        command: RunCommands,
    },
    /// Validate inputs and perform preflight checks.
    Build {
        /// Optional storyboard JSON path for validation.
        #[arg(long)]
        input: Option<PathBuf>,
        /// Enable legacy brief->planner->director flow.
        #[arg(long, default_value_t = false)]
        legacy_brief: bool,
    },
    /// Reconcile storyboard timings and produce subtitle timeline.
    Sync {
        /// Storyboard JSON path.
        #[arg(long)]
        input: PathBuf,
        /// Output SRT path.
        #[arg(long)]
        output: PathBuf,
        /// Enable legacy brief->planner->director flow.
        #[arg(long, default_value_t = false)]
        legacy_brief: bool,
    },
    /// Build storyboard prompt text from structured input JSON.
    PromptStoryboard {
        /// Prompt input JSON path.
        #[arg(long)]
        input: PathBuf,
    },
    /// Materialize explicit storyboard scenes into JSON files.
    MaterializeScenes {
        /// Storyboard JSON path (explicit scenes list).
        #[arg(long)]
        input: PathBuf,
        /// Output directory for generated scene JSON files.
        #[arg(long)]
        out_dir: PathBuf,
        /// Width for generated scenes.
        #[arg(long, default_value_t = 1280)]
        width: u32,
        /// Height for generated scenes.
        #[arg(long, default_value_t = 720)]
        height: u32,
        /// FPS for generated scenes.
        #[arg(long, default_value_t = 30)]
        fps: u32,
    },
    /// Remotion-style composition workflow commands.
    Compose {
        #[command(subcommand)]
        command: ComposeCommands,
    },
}

#[derive(Debug, Subcommand)]
enum RunCommands {
    /// Alias for scene rendering.
    Scene {
        #[arg(long)]
        input: PathBuf,
        #[arg(long)]
        output: PathBuf,
        #[arg(long, default_value = "ffmpeg")]
        ffmpeg: String,
        #[arg(long)]
        width: Option<u32>,
        #[arg(long)]
        height: Option<u32>,
        #[arg(long)]
        fps: Option<u32>,
        #[arg(long, default_value_t = 0.7)]
        cpu_ratio: f32,
        #[arg(long, default_value_t = 0.65)]
        ram_ratio: f32,
        #[arg(long)]
        max_threads: Option<usize>,
        #[arg(long, default_value_t = false)]
        no_hw_encode: bool,
        #[arg(long, default_value_t = false)]
        no_live_monitor: bool,
        #[arg(long, default_value_t = false)]
        benchmark_fast: bool,
        #[arg(long, value_enum)]
        quality_profile: Option<QualityProfile>,
        #[arg(long, default_value_t = false)]
        force_wgpu_backend: bool,
        #[arg(long, value_enum, default_value_t = RenderModeArg::TwoD)]
        render_mode: RenderModeArg,
        #[arg(long, value_enum, default_value_t = EffectsTierArg::Basic)]
        effects_tier: EffectsTierArg,
    },
    /// Alias for storyboard rendering.
    Storyboard {
        #[arg(long)]
        input: PathBuf,
        #[arg(long)]
        output: PathBuf,
        #[arg(long, default_value = "ffmpeg")]
        ffmpeg: String,
        #[arg(long)]
        width: Option<u32>,
        #[arg(long)]
        height: Option<u32>,
        #[arg(long)]
        fps: Option<u32>,
        #[arg(long, default_value_t = 0.7)]
        cpu_ratio: f32,
        #[arg(long, default_value_t = 0.65)]
        ram_ratio: f32,
        #[arg(long)]
        max_threads: Option<usize>,
        #[arg(long, default_value_t = false)]
        no_hw_encode: bool,
        #[arg(long, default_value_t = false)]
        no_live_monitor: bool,
        #[arg(long, default_value_t = false)]
        legacy_brief: bool,
        /// Number of scenes processed in parallel (0 = auto).
        #[arg(long, default_value_t = 0)]
        scene_workers: usize,
        #[arg(long, default_value_t = false)]
        benchmark_fast: bool,
        #[arg(long, value_enum)]
        quality_profile: Option<QualityProfile>,
        #[arg(long)]
        timings_json: Option<PathBuf>,
        #[arg(long, default_value_t = false)]
        force_wgpu_backend: bool,
        #[arg(long, value_enum, default_value_t = RenderModeArg::TwoD)]
        render_mode: RenderModeArg,
        #[arg(long, value_enum, default_value_t = EffectsTierArg::Basic)]
        effects_tier: EffectsTierArg,
    },
    /// Start lightweight local preview server.
    Dev {
        /// Port for preview.
        #[arg(long, default_value_t = 4173)]
        port: u16,
        /// Directory to serve.
        #[arg(long, default_value = "output")]
        dir: PathBuf,
    },
}

#[derive(Debug, Subcommand)]
enum ComposeCommands {
    /// Scaffold a composition-first storyboard file.
    Scaffold {
        #[arg(long)]
        output: PathBuf,
    },
    /// Preview an output directory in local dev server.
    Preview {
        #[arg(long, default_value_t = 4173)]
        port: u16,
        #[arg(long, default_value = "output")]
        dir: PathBuf,
    },
    /// Render a composition storyboard.
    Render {
        #[arg(long)]
        input: PathBuf,
        #[arg(long)]
        output: PathBuf,
        #[arg(long, default_value = "ffmpeg")]
        ffmpeg: String,
        #[arg(long)]
        width: Option<u32>,
        #[arg(long)]
        height: Option<u32>,
        #[arg(long)]
        fps: Option<u32>,
        #[arg(long, default_value_t = 0.7)]
        cpu_ratio: f32,
        #[arg(long, default_value_t = 0.65)]
        ram_ratio: f32,
        #[arg(long)]
        max_threads: Option<usize>,
        #[arg(long, default_value_t = false)]
        no_hw_encode: bool,
        #[arg(long, default_value_t = false)]
        no_live_monitor: bool,
        #[arg(long, default_value_t = 0)]
        scene_workers: usize,
        #[arg(long, default_value_t = false)]
        benchmark_fast: bool,
        #[arg(long, value_enum)]
        quality_profile: Option<QualityProfile>,
        #[arg(long)]
        timings_json: Option<PathBuf>,
        #[arg(long, default_value_t = false)]
        force_wgpu_backend: bool,
        #[arg(long, value_enum, default_value_t = RenderModeArg::TwoD)]
        render_mode: RenderModeArg,
        #[arg(long, value_enum, default_value_t = EffectsTierArg::Basic)]
        effects_tier: EffectsTierArg,
        /// Optional JSON shot list injected for compose cinematic cuts.
        #[arg(long)]
        shot_list: Option<PathBuf>,
    },
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum QualityProfile {
    Draft,
    Standard,
    Final,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum RenderModeArg {
    TwoD,
    ThreeD,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum EffectsTierArg {
    Basic,
    Cinematic,
    Vfx,
}

fn to_render_mode(mode: RenderModeArg) -> RenderMode {
    match mode {
        RenderModeArg::TwoD => RenderMode::TwoD,
        RenderModeArg::ThreeD => RenderMode::ThreeD,
    }
}

fn to_effects_tier(tier: EffectsTierArg) -> EffectsTier {
    match tier {
        EffectsTierArg::Basic => EffectsTier::Basic,
        EffectsTierArg::Cinematic => EffectsTier::Cinematic,
        EffectsTierArg::Vfx => EffectsTier::Vfx,
    }
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Commands::Render {
            input,
            output,
            ffmpeg,
            width,
            height,
            fps,
            cpu_ratio,
            ram_ratio,
            max_threads,
            no_hw_encode,
            no_live_monitor,
            benchmark_fast,
            quality_profile,
            force_wgpu_backend,
            render_mode,
            effects_tier,
        } => render_cmd(
            input,
            output,
            ffmpeg,
            width,
            height,
            fps,
            cpu_ratio,
            ram_ratio,
            max_threads,
            no_hw_encode,
            no_live_monitor,
            benchmark_fast,
            quality_profile,
            force_wgpu_backend,
            render_mode,
            effects_tier,
        ),
        Commands::ScaffoldRustScene { output } => scaffold_rust_scene_cmd(output),
        Commands::RenderStoryboard {
            input,
            output,
            ffmpeg,
            width,
            height,
            fps,
            cpu_ratio,
            ram_ratio,
            max_threads,
            no_hw_encode,
            no_live_monitor,
            legacy_brief,
            scene_workers,
            benchmark_fast,
            quality_profile,
            timings_json,
            force_wgpu_backend,
            render_mode,
            effects_tier,
        } => render_storyboard_cmd(
            input,
            output,
            ffmpeg,
            width,
            height,
            fps,
            cpu_ratio,
            ram_ratio,
            max_threads,
            no_hw_encode,
            no_live_monitor,
            legacy_brief,
            scene_workers,
            benchmark_fast,
            quality_profile,
            timings_json,
            force_wgpu_backend,
            render_mode,
            effects_tier,
            None,
        ),
        Commands::Run { command } => match command {
            RunCommands::Scene {
                input,
                output,
                ffmpeg,
                width,
                height,
                fps,
                cpu_ratio,
                ram_ratio,
                max_threads,
                no_hw_encode,
                no_live_monitor,
                benchmark_fast,
                quality_profile,
                force_wgpu_backend,
                render_mode,
                effects_tier,
            } => render_cmd(
                input,
                output,
                ffmpeg,
                width,
                height,
                fps,
                cpu_ratio,
                ram_ratio,
                max_threads,
                no_hw_encode,
                no_live_monitor,
                benchmark_fast,
                quality_profile,
                force_wgpu_backend,
                render_mode,
                effects_tier,
            ),
            RunCommands::Storyboard {
                input,
                output,
                ffmpeg,
                width,
                height,
                fps,
                cpu_ratio,
                ram_ratio,
                max_threads,
                no_hw_encode,
                no_live_monitor,
                legacy_brief,
                scene_workers,
                benchmark_fast,
                quality_profile,
                timings_json,
                force_wgpu_backend,
                render_mode,
                effects_tier,
            } => render_storyboard_cmd(
                input,
                output,
                ffmpeg,
                width,
                height,
                fps,
                cpu_ratio,
                ram_ratio,
                max_threads,
                no_hw_encode,
                no_live_monitor,
                legacy_brief,
                scene_workers,
                benchmark_fast,
                quality_profile,
                timings_json,
                force_wgpu_backend,
                render_mode,
                effects_tier,
                None,
            ),
            RunCommands::Dev { port, dir } => run_dev_server(port, dir),
        },
        Commands::Build {
            input,
            legacy_brief,
        } => build_cmd(input, legacy_brief),
        Commands::Sync {
            input,
            output,
            legacy_brief,
        } => sync_cmd(input, output, legacy_brief),
        Commands::PromptStoryboard { input } => prompt_storyboard_cmd(input),
        Commands::MaterializeScenes {
            input,
            out_dir,
            width,
            height,
            fps,
        } => materialize_scenes_cmd(input, out_dir, width, height, fps),
        Commands::Compose { command } => match command {
            ComposeCommands::Scaffold { output } => compose_scaffold_cmd(output),
            ComposeCommands::Preview { port, dir } => run_dev_server(port, dir),
            ComposeCommands::Render {
                input,
                output,
                ffmpeg,
                width,
                height,
                fps,
                cpu_ratio,
                ram_ratio,
                max_threads,
                no_hw_encode,
                no_live_monitor,
                scene_workers,
                benchmark_fast,
                quality_profile,
                timings_json,
                force_wgpu_backend,
                render_mode,
                effects_tier,
                shot_list,
            } => render_storyboard_cmd(
                input,
                output,
                ffmpeg,
                width,
                height,
                fps,
                cpu_ratio,
                ram_ratio,
                max_threads,
                no_hw_encode,
                no_live_monitor,
                false,
                scene_workers,
                benchmark_fast,
                quality_profile,
                timings_json,
                force_wgpu_backend,
                render_mode,
                effects_tier,
                shot_list,
            ),
        },
    }
}

#[derive(Debug, Deserialize)]
struct PromptStoryboardInput {
    #[serde(default)]
    title: String,
    #[serde(default)]
    topic_details: String,
    #[serde(default)]
    sections: Vec<String>,
    #[serde(default = "default_prompt_minutes")]
    duration_minutes: f32,
    #[serde(default = "default_prompt_audience")]
    audience_level: String,
    #[serde(default = "default_prompt_tone")]
    style_tone: String,
    #[serde(default = "default_prompt_aspect")]
    aspect: String,
    #[serde(default = "default_prompt_resolution")]
    resolution: String,
    #[serde(default)]
    must_include: String,
    #[serde(default)]
    avoid: String,
    #[serde(default = "default_true")]
    auto_scene_count: bool,
    #[serde(default = "default_prompt_scene_count")]
    scene_count: usize,
    #[serde(default = "default_prompt_density")]
    concept_density: String,
    #[serde(default = "default_prompt_intensity")]
    animation_intensity: String,
}

fn default_prompt_minutes() -> f32 {
    3.0
}
fn default_prompt_audience() -> String {
    "beginner".to_string()
}
fn default_prompt_tone() -> String {
    "clean".to_string()
}
fn default_prompt_aspect() -> String {
    "16:9".to_string()
}
fn default_prompt_resolution() -> String {
    "1280x720".to_string()
}
fn default_prompt_scene_count() -> usize {
    8
}
fn default_prompt_density() -> String {
    "medium".to_string()
}
fn default_prompt_intensity() -> String {
    "balanced".to_string()
}
fn default_true() -> bool {
    true
}

fn estimate_scene_count(duration_minutes: f32, concept_density: &str) -> usize {
    let mins = duration_minutes.max(1.0);
    let density = match concept_density {
        "deep" => 1.3,
        "light" => 0.8,
        _ => 1.0,
    };
    let raw = (mins * 3.0 * density).round() as usize;
    raw.clamp(4, 20)
}

fn prompt_storyboard_cmd(input: PathBuf) -> Result<()> {
    let raw = fs::read_to_string(&input)
        .with_context(|| format!("failed reading prompt input: {}", input.display()))?;
    let req: PromptStoryboardInput = serde_json::from_str(&raw)
        .with_context(|| format!("invalid prompt input JSON in {}", input.display()))?;

    let title = if req.title.trim().is_empty() {
        "Untitled Topic"
    } else {
        req.title.trim()
    };
    let topic_details = if req.topic_details.trim().is_empty() {
        "No extra topic details provided."
    } else {
        req.topic_details.trim()
    };
    let sections: Vec<String> = req
        .sections
        .iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let target_scene_count = if req.auto_scene_count {
        estimate_scene_count(req.duration_minutes, &req.concept_density)
    } else {
        req.scene_count.clamp(3, 20)
    };

    let section_block = if sections.is_empty() {
        "No explicit sections provided. Derive sections from topic details.".to_string()
    } else {
        sections
            .iter()
            .enumerate()
            .map(|(i, s)| format!("{}. {}", i + 1, s))
            .collect::<Vec<_>>()
            .join("\n")
    };

    let base_template = fs::read_to_string("docs/LLM_SCENE_PROMPT_TEMPLATE.md")
        .unwrap_or_else(|_| "Use Varin storyboard-friendly JSON output only.".to_string());

    let must_include = if req.must_include.trim().is_empty() {
        "none"
    } else {
        req.must_include.trim()
    };
    let avoid = if req.avoid.trim().is_empty() {
        "none"
    } else {
        req.avoid.trim()
    };

    let prompt = format!(
        r#"{base_template}

---
RUNTIME INPUTS FOR THIS REQUEST
- VIDEO_TITLE: {title}
- TOPIC_DETAILS: {topic_details}
- TARGET_DURATION_MINUTES: {duration_minutes}
- TARGET_SCENE_COUNT: {target_scene_count}
- AUDIENCE_LEVEL: {audience_level}
- STYLE_TONE: {style_tone}
- ASPECT: {aspect}
- RESOLUTION: {resolution}
- CONCEPT_DENSITY: {concept_density}
- ANIMATION_INTENSITY: {animation_intensity}
- MUST_INCLUDE: {must_include}
- AVOID: {avoid}

SECTIONS TO COVER
{section_block}

RESPONSE FORMAT REQUIREMENT
Return ONLY JSON with this storyboard shape:
{{
  "version": "v1",
  "scenes": [
    {{
      "id": "scene_01_intro",
      "visual_instruction": "on-screen choreography instructions (NOT spoken)",
      "narration": "spoken learner-facing voiceover text",
      "caption": "subtitle text aligned to spoken narration",
      "duration_seconds": 20,
      "scene_explanatory": {{
        "width": 1280,
        "height": 720,
        "fps": 30,
        "background_rgba": [8,14,30,255],
        "layers": [{{ "id": "title", "primitive": {{ "type": "text", "text": "Title", "font_size": 52 }}, "transform": {{ "x": 640, "y": 96 }}, "style": {{ "fill_rgba": [232,242,255,255], "opacity": 0.0 }} }}],
        "beats": [{{ "target": "title", "kind": "write", "start": 0.0, "duration": 1.2, "easing": "ease_out" }}]
      }}
    }}
  ]
}}

HARD REQUIREMENTS
- Generate exactly {target_scene_count} scenes in storyboard output.
- Keep total duration near {target_duration_seconds} seconds (tolerance +/- 5s).
- Keep `visual_instruction` separate from `narration`; never put prompt/instruction text in narration.
- Use JSON-first `scene_explanatory` for all drawing and animation instructions.
- Include headings/arrows/geometry/text directly in scene_explanatory layers and beats.
- Every RGBA must be concrete array values (no blanks/placeholders).
"#,
        duration_minutes = req.duration_minutes.max(1.0),
        target_duration_seconds = (req.duration_minutes.max(1.0) * 60.0).round() as i32,
        audience_level = req.audience_level.trim(),
        style_tone = req.style_tone.trim(),
        aspect = req.aspect.trim(),
        resolution = req.resolution.trim(),
        concept_density = req.concept_density.trim(),
        animation_intensity = req.animation_intensity.trim(),
        target_scene_count = target_scene_count,
    );

    println!("{prompt}");
    Ok(())
}

fn render_cmd(
    input: PathBuf,
    output: PathBuf,
    ffmpeg: String,
    width: Option<u32>,
    height: Option<u32>,
    fps: Option<u32>,
    cpu_ratio: f32,
    ram_ratio: f32,
    max_threads: Option<usize>,
    no_hw_encode: bool,
    no_live_monitor: bool,
    benchmark_fast: bool,
    quality_profile: Option<QualityProfile>,
    force_wgpu_backend: bool,
    render_mode: RenderModeArg,
    effects_tier: EffectsTierArg,
) -> Result<()> {
    let raw = fs::read_to_string(&input)
        .with_context(|| format!("failed reading input scene: {}", input.display()))?;
    let scene: Scene = serde_json::from_str(&raw)
        .with_context(|| format!("invalid scene JSON in {}", input.display()))?;
    scene
        .validate()
        .with_context(|| format!("scene validation failed for {}", input.display()))?;

    let (profile_cpu, profile_ram, profile_threads, profile_hw_disable, profile_benchmark_fast) =
        apply_quality_profile(quality_profile, cpu_ratio, ram_ratio, max_threads, no_hw_encode, benchmark_fast);
    let tuned_cpu_ratio = if profile_benchmark_fast {
        profile_cpu.max(0.70)
    } else {
        profile_cpu
    };
    let tuned_ram_ratio = if profile_benchmark_fast {
        profile_ram.max(0.70)
    } else {
        profile_ram
    };
    let options = RenderOptions {
        width,
        height,
        fps,
        ffmpeg,
        cpu_ratio: tuned_cpu_ratio,
        ram_ratio: tuned_ram_ratio,
        max_threads: profile_threads,
        prefer_hw_encode: !profile_hw_disable,
        live_resource_monitor: if profile_benchmark_fast { false } else { !no_live_monitor },
        benchmark_fast: profile_benchmark_fast,
        force_wgpu_backend,
        render_mode: to_render_mode(render_mode),
        effects_tier: to_effects_tier(effects_tier),
    };

    let stats = render_scene_to_mp4(&scene, &output, &options)
        .with_context(|| format!("render failed for {}", output.display()))?;
    println!(
        "Rendered {} frames at {}x{} {}fps -> {}",
        stats.frames,
        stats.width,
        stats.height,
        stats.fps,
        output.display()
    );
    println!(
        "workers={} chunk_frames={} ram_budget_mb={} encoder={} preset={} backend={} adaptive_chunks={} stage_ms[prepare={},raster={},encode_wait={},total={}]",
        stats.worker_threads,
        stats.chunk_frames,
        stats.ram_budget_bytes / (1024 * 1024),
        stats.encoder,
        stats.encoder_preset,
        stats.backend,
        stats.adaptive_chunks
        ,
        stats.stage_prepare_ms,
        stats.stage_raster_ms,
        stats.stage_encode_wait_ms,
        stats.total_ms
    );
    Ok(())
}

fn render_storyboard_cmd(
    input: PathBuf,
    output: PathBuf,
    ffmpeg: String,
    width: Option<u32>,
    height: Option<u32>,
    fps: Option<u32>,
    cpu_ratio: f32,
    ram_ratio: f32,
    max_threads: Option<usize>,
    no_hw_encode: bool,
    no_live_monitor: bool,
    legacy_brief: bool,
    scene_workers: usize,
    benchmark_fast: bool,
    quality_profile: Option<QualityProfile>,
    timings_json: Option<PathBuf>,
    force_wgpu_backend: bool,
    render_mode: RenderModeArg,
    effects_tier: EffectsTierArg,
    shot_list: Option<PathBuf>,
) -> Result<()> {
    let (profile_cpu, profile_ram, profile_threads, profile_hw_disable, profile_benchmark_fast) =
        apply_quality_profile(quality_profile, cpu_ratio, ram_ratio, max_threads, no_hw_encode, benchmark_fast);
    let tuned_cpu_ratio = if profile_benchmark_fast {
        profile_cpu.max(0.70)
    } else {
        profile_cpu
    };
    let tuned_ram_ratio = if profile_benchmark_fast {
        profile_ram.max(0.70)
    } else {
        profile_ram
    };
    let options = RenderOptions {
        width,
        height,
        fps,
        ffmpeg,
        cpu_ratio: tuned_cpu_ratio,
        ram_ratio: tuned_ram_ratio,
        max_threads: profile_threads,
        prefer_hw_encode: !profile_hw_disable,
        live_resource_monitor: if profile_benchmark_fast { false } else { !no_live_monitor },
        benchmark_fast: profile_benchmark_fast,
        force_wgpu_backend,
        render_mode: to_render_mode(render_mode),
        effects_tier: to_effects_tier(effects_tier),
    };
    if let Some(shot_path) = shot_list {
        std::env::set_var("VARIN_COMPOSE_SHOT_LIST", shot_path.to_string_lossy().to_string());
    } else {
        std::env::remove_var("VARIN_COMPOSE_SHOT_LIST");
    }
    let tuned_scene_workers = apply_storyboard_profile_scene_workers(quality_profile, scene_workers);
    storyboard::render_storyboard_cmd(
        &input,
        &output,
        &options,
        legacy_brief,
        tuned_scene_workers,
        timings_json.as_deref(),
    )
}

fn apply_quality_profile(
    profile: Option<QualityProfile>,
    cpu_ratio: f32,
    ram_ratio: f32,
    max_threads: Option<usize>,
    no_hw_encode: bool,
    benchmark_fast: bool,
) -> (f32, f32, Option<usize>, bool, bool) {
    match profile.unwrap_or(QualityProfile::Standard) {
        QualityProfile::Draft => (
            cpu_ratio.max(0.75),
            ram_ratio.max(0.70),
            max_threads.or(Some(4)),
            true,
            true,
        ),
        QualityProfile::Standard => (cpu_ratio, ram_ratio, max_threads, no_hw_encode, benchmark_fast),
        QualityProfile::Final => (
            cpu_ratio.min(0.60),
            ram_ratio.min(0.60),
            max_threads.or(Some(6)),
            no_hw_encode,
            false,
        ),
    }
}

fn apply_storyboard_profile_scene_workers(profile: Option<QualityProfile>, scene_workers: usize) -> usize {
    if scene_workers > 0 {
        return scene_workers;
    }
    match profile.unwrap_or(QualityProfile::Standard) {
        QualityProfile::Draft => 2,
        QualityProfile::Standard => 0,
        QualityProfile::Final => 1,
    }
}

fn scaffold_rust_scene_cmd(output: PathBuf) -> Result<()> {
    let scene = SceneBuilder::new(1280, 720, 30)
        .with_background([12, 16, 30, 255])
        .add(layer_text("title", "Rust Scene API Demo", 42.0, 640.0, 90.0, 10))
        .add(layer_rect("box", 300.0, 160.0, 640.0, 360.0, 5))
        .add(layer_rect("box2", 260.0, 130.0, 920.0, 360.0, 6))
        .remove("box2")
        .play(
            vec![
                create("title", Easing::EaseOut),
                fade_in("box", 0.0, 60.0, 0.8, Easing::EaseOut),
            ],
            2.0,
        )
        .wait(0.8)
        .play_staggered(
            vec![
                grow_from_center("box", Easing::EaseOut),
                rotate_to("title", 4.0, Easing::ThereAndBack),
            ],
            1.6,
            0.35,
        )
        .play(
            vec![transform_to(
                "box",
                Some(640.0),
                Some(470.0),
                Some(1.2),
                Some(1.2),
                Some(8.0),
                Easing::ThereAndBack,
            )],
            2.2,
        )
        .play(
            vec![replacement_transform("box", "box2", Easing::EaseInOut)],
            1.2,
        )
        .replace("box", "box2")
        .build();

    if let Some(parent) = output.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("failed to create output directory: {}", parent.display()))?;
    }
    let raw = serde_json::to_string_pretty(&scene).context("failed serializing scene JSON")?;
    std::fs::write(&output, raw)
        .with_context(|| format!("failed writing scene JSON to {}", output.display()))?;
    println!("Wrote Rust-authored scene JSON -> {}", output.display());
    Ok(())
}

fn compose_scaffold_cmd(output: PathBuf) -> Result<()> {
    let scaffold = serde_json::json!({
      "version": "v1",
      "title": "Compose Scaffold Storyboard",
      "scenes": [
        {
          "id": "compose_scene_01",
          "visual_instruction": "Composition-driven intro scene",
          "narration": "This scene is authored with scene composition blocks.",
          "caption": "Composition intro",
          "duration_seconds": 12,
          "scene_composition": {
            "variant": "neon",
            "tracks": [
              { "id": "pan_right", "lane": "camera", "start": 1.2, "duration": 2.0 },
              { "id": "chroma_pulse", "lane": "fx", "start": 3.2, "duration": 1.2 }
            ],
            "components": [
              { "kind": "scene_title", "id": "title", "text": "Varin Compose", "x": 640, "y": 98, "start": 0.0, "duration": 0.9 },
              { "kind": "flow", "id": "pipeline", "labels": ["Compose", "Expand", "Render", "Mux"], "x": 640, "y": 360, "width": 760, "start": 0.6, "duration": 1.0 },
              { "kind": "metric_tile", "id": "metric", "text": "Faster Authoring", "x": 640, "y": 560, "width": 320, "height": 84, "start": 1.4, "duration": 0.8 }
            ],
            "camera_moves": [
              { "kind": "pan_right", "start": 1.2, "duration": 2.0, "intensity": 1.0 },
              { "kind": "chroma_pulse", "start": 3.2, "duration": 1.2, "intensity": 1.0 }
            ]
          }
        }
      ]
    });
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&output, serde_json::to_string_pretty(&scaffold)?)
        .with_context(|| format!("failed writing compose scaffold {}", output.display()))?;
    println!("Wrote compose scaffold -> {}", output.display());
    Ok(())
}

fn sync_cmd(input: PathBuf, output: PathBuf, legacy_brief: bool) -> Result<()> {
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create output directory: {}", parent.display()))?;
    }
    storyboard::sync_storyboard_cmd(&input, &output, legacy_brief)
}

fn build_cmd(input: Option<PathBuf>, legacy_brief: bool) -> Result<()> {
    if let Some(in_path) = input {
        let raw = fs::read_to_string(&in_path)
            .with_context(|| format!("failed reading input: {}", in_path.display()))?;
        if let Ok(scene) = serde_json::from_str::<Scene>(&raw) {
            scene.validate().with_context(|| {
                format!(
                    "scene preflight failed for {}",
                    in_path.display()
                )
            })?;
            println!("Scene preflight passed for {}", in_path.display());
        } else {
            let ts = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis();
            let tmp = std::env::temp_dir().join(format!("varin_build_check_{}.srt", ts));
            storyboard::sync_storyboard_cmd(&in_path, &tmp, legacy_brief)?;
            storyboard::preflight_storyboard_cmd(&in_path, legacy_brief)?;
            let _ = fs::remove_file(&tmp);
            println!("Storyboard preflight passed for {}", in_path.display());
        }
    } else {
        println!("Build preflight passed (no input provided).");
    }
    Ok(())
}

fn materialize_scenes_cmd(
    input: PathBuf,
    out_dir: PathBuf,
    width: u32,
    height: u32,
    fps: u32,
) -> Result<()> {
    storyboard::materialize_storyboard_scenes_cmd(&input, &out_dir, width, height, fps)
}

fn run_dev_server(port: u16, dir: PathBuf) -> Result<()> {
    // Prompt-first flow: if VarinStudio backend is present, start it from `varin run dev`.
    if let Some(server_path) = locate_varinstudio_server()? {
        println!(
            "Starting VarinStudio backend API on http://127.0.0.1:{} using {}",
            port,
            server_path.display()
        );
        let status = Command::new("node")
            .env("PORT", port.to_string())
            .arg(server_path.as_os_str())
            .status()
            .context("failed to launch node for VarinStudio backend")?;
        if !status.success() {
            anyhow::bail!("VarinStudio backend exited with {}", status);
        }
        return Ok(());
    }

    // Backward-compatible fallback: static preview server.
    fs::create_dir_all(&dir)
        .with_context(|| format!("failed to create dev serve dir {}", dir.display()))?;
    println!(
        "VarinStudio backend not found; starting static preview on http://127.0.0.1:{} serving {}",
        port,
        dir.display()
    );
    let port_s = port.to_string();
    let dir_s = dir
        .to_str()
        .ok_or_else(|| anyhow::anyhow!("invalid dev server dir path"))?;
    let py = if cfg!(windows) { "py" } else { "python3" };
    let status = Command::new(py)
        .args(["-m", "http.server", &port_s, "--directory", dir_s])
        .status()
        .with_context(|| format!("failed to launch {} http.server", py))?;
    if !status.success() {
        anyhow::bail!("dev server exited with {}", status);
    }
    Ok(())
}

fn locate_varinstudio_server() -> Result<Option<PathBuf>> {
    let cwd = std::env::current_dir().context("failed to resolve current directory")?;
    let mut candidates = Vec::new();
    if let Ok(root) = std::env::var("VARINSTUDIO_ROOT") {
        candidates.push(PathBuf::from(root).join("server/server.mjs"));
    }
    if let Ok(root) = std::env::var("VARIN_VIDEO_GENERATOR_ROOT") {
        candidates.push(PathBuf::from(root).join("VarinStudio/server/server.mjs"));
    }
    candidates.extend([
        cwd.join("../VarinStudio/server/server.mjs"),
        cwd.join("../Varin Video Generator/VarinStudio/server/server.mjs"),
        cwd.join("VarinStudio/server/server.mjs"),
        cwd.join("../../VarinStudio/server/server.mjs"),
    ]);
    for c in candidates {
        if c.exists() {
            return Ok(Some(c));
        }
    }
    Ok(None)
}
