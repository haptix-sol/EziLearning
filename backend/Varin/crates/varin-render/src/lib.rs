use anyhow::{anyhow, bail, Context, Result};
use rayon::prelude::*;
use rayon::ThreadPoolBuilder;
use rusttype::{point, Font, OutlineBuilder, Scale};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::OnceLock;
use std::sync::Mutex;
use std::time::Instant;
use sysinfo::System;
use tiny_skia::{
    Color, FillRule, Paint, PathBuilder, Pixmap, PixmapPaint, Rect, Shader, Stroke,
    Transform as SkTransform,
};
use varin_core::{CameraState, Primitive, ResolvedLayer, Scene};
#[cfg(feature = "wgpu-backend")]
mod wgpu_backend;

static FONT_CACHE: OnceLock<Option<Font<'static>>> = OnceLock::new();
static SPECIFIC_FONT_CACHE: OnceLock<Mutex<std::collections::HashMap<String, Option<&'static Font<'static>>>>> =
    OnceLock::new();

#[derive(Debug, Clone)]
pub struct RenderOptions {
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fps: Option<u32>,
    pub ffmpeg: String,
    pub cpu_ratio: f32,
    pub ram_ratio: f32,
    pub max_threads: Option<usize>,
    pub prefer_hw_encode: bool,
    pub live_resource_monitor: bool,
    pub benchmark_fast: bool,
    pub force_wgpu_backend: bool,
    pub render_mode: RenderMode,
    pub effects_tier: EffectsTier,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RenderMode {
    TwoD,
    ThreeD,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EffectsTier {
    Basic,
    Cinematic,
    Vfx,
}

impl Default for RenderOptions {
    fn default() -> Self {
        Self {
            width: None,
            height: None,
            fps: None,
            ffmpeg: "ffmpeg".to_string(),
            cpu_ratio: 0.7,
            ram_ratio: 0.65,
            max_threads: None,
            prefer_hw_encode: true,
            live_resource_monitor: true,
            benchmark_fast: false,
            force_wgpu_backend: false,
            render_mode: RenderMode::TwoD,
            effects_tier: EffectsTier::Basic,
        }
    }
}

#[derive(Debug, Clone)]
pub struct RenderStats {
    pub frames: usize,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub worker_threads: usize,
    pub chunk_frames: usize,
    pub ram_budget_bytes: usize,
    pub encoder: String,
    pub adaptive_chunks: bool,
    pub stage_prepare_ms: u128,
    pub stage_raster_ms: u128,
    pub stage_encode_wait_ms: u128,
    pub total_ms: u128,
    pub backend: String,
    pub encoder_preset: String,
}

pub fn render_scene_to_mp4(scene: &Scene, out_path: &Path, options: &RenderOptions) -> Result<RenderStats> {
    let total_t0 = Instant::now();
    let prep_t0 = Instant::now();
    scene.validate()?;

    let width = options.width.unwrap_or(scene.canvas.width);
    let height = options.height.unwrap_or(scene.canvas.height);
    let mut fps = options.fps.unwrap_or(scene.canvas.fps);
    if options.benchmark_fast {
        fps = fps.min(24).max(18);
    }
    let frame_count = (scene.duration_seconds * fps as f32).ceil().max(1.0) as usize;

    let plan = ResourcePlan::for_render(width, height, frame_count, options);
    let pool = ThreadPoolBuilder::new()
        .num_threads(plan.worker_threads)
        .build()
        .context("failed to create rayon thread pool")?;
    let encoder = choose_encoder(&options.ffmpeg, options.prefer_hw_encode);
    let encoder_preset = choose_encoder_preset(&encoder, options.benchmark_fast);
    let frame_bytes = (width as usize)
        .saturating_mul(height as usize)
        .saturating_mul(4);

    if let Some(parent) = out_path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("failed to create output directory: {}", parent.display()))?;
    }

    let stage_prepare_ms = prep_t0.elapsed().as_millis();
    let raster_t0 = Instant::now();

    let mut child = Command::new(&options.ffmpeg)
        .arg("-y")
        .arg("-f")
        .arg("rawvideo")
        .arg("-pix_fmt")
        .arg("rgba")
        .arg("-s")
        .arg(format!("{}x{}", width, height))
        .arg("-r")
        .arg(fps.to_string())
        .arg("-i")
        .arg("-")
        .arg("-an")
        .arg("-c:v")
        .arg(&encoder)
        .arg("-preset")
        .arg(&encoder_preset)
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-movflags")
        .arg("+faststart")
        .arg(out_path.as_os_str())
        .stdin(Stdio::piped())
        .stderr(Stdio::piped())
        .stdout(Stdio::null())
        .spawn()
        .with_context(|| format!("failed to spawn ffmpeg '{}'", options.ffmpeg))?;

    {
        let stdin = child
            .stdin
            .as_mut()
            .ok_or_else(|| anyhow!("failed to open ffmpeg stdin"))?;
        let mut sys = System::new_all();
        let mut start = 0usize;
        let mut dynamic_chunk = plan.chunk_frames;
        while start < frame_count {
            let remaining = frame_count - start;
            dynamic_chunk = plan.adjust_chunk_frames(
                &mut sys,
                frame_bytes,
                remaining,
                dynamic_chunk,
                options.live_resource_monitor,
            );
            let end = (start + dynamic_chunk).min(frame_count);
            let chunk_frames = pool.install(|| {
                (start..end)
                    .into_par_iter()
                    .map(|idx| {
                        let t = idx as f32 / fps as f32;
                        render_frame_auto_backend(scene, t, width, height, options)
                    })
                    .collect::<Result<Vec<_>>>()
            })?;
            for frame in &chunk_frames {
                stdin
                    .write_all(frame)
                    .context("failed writing RGBA frame to ffmpeg stdin")?;
            }
            if options.live_resource_monitor {
                sys.refresh_memory();
                let free_mb = (sys.available_memory() as usize) / (1024 * 1024);
                eprintln!(
                    "progress: frames={}..{} / {} chunk={} workers={} free_ram_mb={} encoder={}",
                    start,
                    end,
                    frame_count,
                    dynamic_chunk,
                    plan.worker_threads,
                    free_mb,
                    encoder
                );
            }
            start = end;
        }
    }
    let stage_raster_ms = raster_t0.elapsed().as_millis();

    let encode_wait_t0 = Instant::now();
    let output = child.wait_with_output().context("ffmpeg process wait failed")?;
    let stage_encode_wait_ms = encode_wait_t0.elapsed().as_millis();
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        bail!("ffmpeg encode failed: {}", truncate(&err, 1200));
    }

    Ok(RenderStats {
        frames: frame_count,
        width,
        height,
        fps,
        worker_threads: plan.worker_threads,
        chunk_frames: plan.chunk_frames,
        ram_budget_bytes: plan.ram_budget_bytes,
        encoder,
        adaptive_chunks: options.live_resource_monitor,
        stage_prepare_ms,
        stage_raster_ms,
        stage_encode_wait_ms,
        total_ms: total_t0.elapsed().as_millis(),
        backend: selected_backend_label(options, scene),
        encoder_preset,
    })
}

fn selected_backend_label(_options: &RenderOptions, _scene: &Scene) -> String {
    #[cfg(feature = "wgpu-backend")]
    {
        if _options.force_wgpu_backend && scene_is_wgpu_compatible(_scene) {
            return "wgpu-core".to_string();
        }
    }
    "skia-cpu".to_string()
}

#[derive(Debug, Clone)]
struct ResourcePlan {
    worker_threads: usize,
    chunk_frames: usize,
    ram_budget_bytes: usize,
}

impl ResourcePlan {
    fn for_render(width: u32, height: u32, frame_count: usize, options: &RenderOptions) -> Self {
        let mut sys = System::new_all();
        sys.refresh_memory();

        let free_mem_bytes = sys.available_memory() as usize;
        // "70% of free resources max"; default lower (65%) for safer headroom.
        let ram_ratio = options.ram_ratio.clamp(0.10, 0.70);
        let ram_budget_bytes = ((free_mem_bytes as f64) * (ram_ratio as f64)) as usize;

        let frame_bytes = (width as usize)
            .saturating_mul(height as usize)
            .saturating_mul(4);
        let mut max_frames_by_mem = if frame_bytes == 0 {
            1
        } else {
            (ram_budget_bytes / frame_bytes).max(1)
        };
        max_frames_by_mem = max_frames_by_mem.min(frame_count.max(1));

        let logical_cores = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4);
        let cpu_ratio = options.cpu_ratio.clamp(0.10, 0.70);
        let mut worker_threads = ((logical_cores as f32 * cpu_ratio).floor() as usize).max(1);
        if let Some(max_t) = options.max_threads {
            worker_threads = worker_threads.min(max_t.max(1));
        }

        // Keep chunks large enough for parallel efficiency but bounded by memory budget.
        let preferred_chunk = (worker_threads * 8).max(8);
        let chunk_frames = preferred_chunk.min(max_frames_by_mem).max(1);

        Self {
            worker_threads,
            chunk_frames,
            ram_budget_bytes,
        }
    }

    fn adjust_chunk_frames(
        &self,
        sys: &mut System,
        frame_bytes: usize,
        remaining_frames: usize,
        prev_chunk: usize,
        live_resource_monitor: bool,
    ) -> usize {
        if !live_resource_monitor {
            return prev_chunk.min(remaining_frames).max(1);
        }

        sys.refresh_memory();
        sys.refresh_cpu_usage();

        let free_mem_bytes = sys.available_memory() as usize;
        let max_by_mem = if frame_bytes == 0 {
            1
        } else {
            (self.ram_budget_bytes.min((free_mem_bytes as f64 * 0.70) as usize) / frame_bytes).max(1)
        };
        let cpu = sys.global_cpu_usage();
        let mut next = prev_chunk.max(1);

        if cpu >= 90.0 {
            next = (next / 2).max(1);
        } else if cpu >= 80.0 {
            next = (next * 3 / 4).max(1);
        } else if cpu <= 50.0 {
            next = (next * 5 / 4).max(next + 1);
        }

        let upper_parallel = (self.worker_threads * 16).max(4);
        next = next.min(max_by_mem).min(upper_parallel).min(remaining_frames).max(1);
        next
    }
}

fn render_frame_auto_backend(
    scene: &Scene,
    t: f32,
    width: u32,
    height: u32,
    _options: &RenderOptions,
) -> Result<Vec<u8>> {
    #[cfg(feature = "wgpu-backend")]
    {
        if _options.force_wgpu_backend && scene_is_wgpu_compatible(scene) {
            if let Ok(frame) = wgpu_backend::render_frame_wgpu(scene, t, width, height) {
                return Ok(frame);
            }
        }
    }
    if _options.render_mode == RenderMode::ThreeD {
        render_frame_with_options(scene, t, width, height, _options)
    } else {
        render_frame_with_options(scene, t, width, height, _options)
    }
}

fn render_frame_with_options(
    scene: &Scene,
    t: f32,
    width: u32,
    height: u32,
    options: &RenderOptions,
) -> Result<Vec<u8>> {
    let mut pixmap = Pixmap::new(width, height).ok_or_else(|| anyhow!("invalid pixmap size"))?;
    let bg = scene.canvas.background_rgba;
    pixmap.fill(Color::from_rgba8(bg[0], bg[1], bg[2], bg[3]));

    let layers = scene.resolve_at(t);
    let camera = scene.camera_at(t);
    for layer in &layers {
        draw_layer(&mut pixmap, layer, camera, options)?;
    }
    apply_post_effects(&mut pixmap, options.effects_tier);
    Ok(pixmap.data().to_vec())
}

#[cfg(feature = "wgpu-backend")]
fn scene_is_wgpu_compatible(scene: &Scene) -> bool {
    scene.layers.iter().all(|layer| {
        matches!(
            layer.primitive,
            Primitive::Rect { .. }
                | Primitive::Circle { .. }
                | Primitive::Ellipse { .. }
                | Primitive::Line { .. }
                | Primitive::Arrow { .. }
                | Primitive::Polyline { .. }
                | Primitive::Polygon { .. }
                | Primitive::Cube { .. }
                | Primitive::Cuboid { .. }
                | Primitive::MeshBlock { .. }
        )
    })
}

fn draw_layer(
    pixmap: &mut Pixmap,
    layer: &ResolvedLayer,
    camera: CameraState,
    options: &RenderOptions,
) -> Result<()> {
    let progress = layer.style.draw_progress.clamp(0.0, 1.0);
    if progress <= 0.0 {
        return Ok(());
    }
    let fill = color_with_opacity(layer.style.fill_rgba, layer.style.opacity * progress);
    let stroke = color_with_opacity(layer.style.stroke_rgba, layer.style.opacity * progress);

    let mut fill_paint = Paint::default();
    fill_paint.shader = Shader::SolidColor(fill);
    fill_paint.anti_alias = true;

    let mut stroke_paint = Paint::default();
    stroke_paint.shader = Shader::SolidColor(stroke);
    stroke_paint.anti_alias = true;

    let mut stroke_style = Stroke::default();
    stroke_style.width = layer.style.stroke_width.max(0.0);

    let tx = to_sk_transform(layer, camera, options);
    let (stroke_phase, fill_phase) = stroke_fill_phases(progress);

    match &layer.primitive {
        Primitive::Rect {
            width,
            height,
            corner_radius,
        } => {
            let w = width.max(1.0);
            let h = height.max(1.0);
            if let Some(path) = rounded_rect_path(w, h, *corner_radius) {
                draw_shape_with_progress(
                    pixmap,
                    &path,
                    &fill_paint,
                    &stroke_paint,
                    &stroke_style,
                    tx,
                    stroke_phase,
                    fill_phase,
                );
            }
        }
        Primitive::Circle { radius } => {
            let mut pb = PathBuilder::new();
            pb.push_circle(0.0, 0.0, radius.max(1.0));
            if let Some(path) = pb.finish() {
                draw_shape_with_progress(
                    pixmap,
                    &path,
                    &fill_paint,
                    &stroke_paint,
                    &stroke_style,
                    tx,
                    stroke_phase,
                    fill_phase,
                );
            }
        }
        Primitive::Ellipse { radius_x, radius_y } => {
            let mut pb = PathBuilder::new();
            // Build ellipse with line segments for tiny-skia compatibility.
            let steps = 48usize;
            let rx = radius_x.max(1.0);
            let ry = radius_y.max(1.0);
            for i in 0..=steps {
                let t = i as f32 / steps as f32 * std::f32::consts::TAU;
                let x = rx * t.cos();
                let y = ry * t.sin();
                if i == 0 {
                    pb.move_to(x, y);
                } else {
                    pb.line_to(x, y);
                }
            }
            pb.close();
            if let Some(path) = pb.finish() {
                draw_shape_with_progress(
                    pixmap,
                    &path,
                    &fill_paint,
                    &stroke_paint,
                    &stroke_style,
                    tx,
                    stroke_phase,
                    fill_phase,
                );
            }
        }
        Primitive::Line { x1, y1, x2, y2 } => {
            let (ex, ey) = lerp_point(*x1, *y1, *x2, *y2, progress);
            let mut pb = PathBuilder::new();
            pb.move_to(*x1, *y1);
            pb.line_to(ex, ey);
            let path = pb
                .finish()
                .ok_or_else(|| anyhow!("failed to build line path for {}", layer.id))?;
            pixmap.stroke_path(&path, &stroke_paint, &stroke_style, tx, None);
        }
        Primitive::Arrow {
            x1,
            y1,
            x2,
            y2,
            tip_length,
            tip_width,
        } => {
            let (ex, ey) = lerp_point(*x1, *y1, *x2, *y2, progress);
            let mut pb = PathBuilder::new();
            pb.move_to(*x1, *y1);
            pb.line_to(ex, ey);
            let path = pb
                .finish()
                .ok_or_else(|| anyhow!("failed to build arrow shaft path for {}", layer.id))?;
            pixmap.stroke_path(&path, &stroke_paint, &stroke_style, tx, None);
            if progress > 0.85 {
                let tip_scale = ((progress - 0.85) / 0.15).clamp(0.0, 1.0);
                if let Some(tip_path) = build_arrow_tip_path(
                    *x1,
                    *y1,
                    ex,
                    ey,
                    *tip_length * tip_scale.max(0.2),
                    *tip_width * tip_scale.max(0.2),
                ) {
                    pixmap.fill_path(&tip_path, &stroke_paint, FillRule::Winding, tx, None);
                }
            }
        }
        Primitive::Polyline { points } => {
            if points.len() < 2 {
                return Ok(());
            }
            let partial = partial_polyline(points, progress);
            if partial.len() < 2 {
                return Ok(());
            }
            let mut pb = PathBuilder::new();
            pb.move_to(partial[0][0], partial[0][1]);
            for p in &partial[1..] {
                pb.line_to(p[0], p[1]);
            }
            if let Some(path) = pb.finish() {
                pixmap.stroke_path(&path, &stroke_paint, &stroke_style, tx, None);
            }
        }
        Primitive::Polygon { points } => {
            if points.len() < 3 {
                return Ok(());
            }
            let mut pb = PathBuilder::new();
            pb.move_to(points[0][0], points[0][1]);
            for p in &points[1..] {
                pb.line_to(p[0], p[1]);
            }
            pb.close();
            if let Some(path) = pb.finish() {
                draw_shape_with_progress(
                    pixmap,
                    &path,
                    &fill_paint,
                    &stroke_paint,
                    &stroke_style,
                    tx,
                    stroke_phase,
                    fill_phase,
                );
            }
        }
        Primitive::Cube {
            size,
            depth_ratio,
            projection_x,
            projection_y,
        } => {
            let depth = size.max(1.0) * depth_ratio.max(0.05);
            draw_cuboid_like(
                pixmap,
                size.max(1.0),
                size.max(1.0),
                depth,
                *projection_x,
                *projection_y,
                &fill_paint,
                &stroke_paint,
                &stroke_style,
                tx,
                stroke_phase,
                fill_phase,
            );
        }
        Primitive::Cuboid {
            width,
            height,
            depth,
            projection_x,
            projection_y,
        } => {
            draw_cuboid_like(
                pixmap,
                width.max(1.0),
                height.max(1.0),
                depth.max(1.0),
                *projection_x,
                *projection_y,
                &fill_paint,
                &stroke_paint,
                &stroke_style,
                tx,
                stroke_phase,
                fill_phase,
            );
        }
        Primitive::MeshBlock {
            width,
            height,
            depth,
            albedo,
            emissive,
            roughness,
            metallic,
        } => {
            let lit = shade_material(*albedo, *emissive, *roughness, *metallic);
            let mut mat_fill = fill_paint;
            mat_fill.shader = Shader::SolidColor(color_with_opacity(lit, layer.style.opacity * progress));
            draw_cuboid_like(
                pixmap,
                width.max(1.0),
                height.max(1.0),
                depth.max(1.0),
                16.0,
                -12.0,
                &mat_fill,
                &stroke_paint,
                &stroke_style,
                tx,
                stroke_phase,
                fill_phase,
            );
        }
        Primitive::Text {
            text,
            font_size,
            font_family,
            font_path,
        } => {
            let drawn = draw_text_glyphs(
                pixmap,
                text,
                *font_size,
                font_family.as_deref(),
                font_path.as_deref(),
                progress,
                layer.style.line_height_mult.max(0.8),
                layer.style.text_max_width.max(0.0),
                &fill_paint,
                &stroke_paint,
                &stroke_style,
                tx,
            );
            if !drawn {
                // Fallback if no usable font is available.
                let w =
                    (text.chars().count() as f32 * font_size * 0.6).max(*font_size) * progress.max(0.06);
                let h = (*font_size).max(8.0) * 1.2;
                let mut pb = PathBuilder::new();
                if let Some(rect) = Rect::from_xywh(-w / 2.0, -h / 2.0, w, h) {
                    pb.push_rect(rect);
                }
                if let Some(path) = pb.finish() {
                    pixmap.fill_path(&path, &fill_paint, FillRule::Winding, tx, None);
                    if layer.style.stroke_width > 0.0 && progress > 0.01 {
                        pixmap.stroke_path(&path, &stroke_paint, &stroke_style, tx, None);
                    }
                }
            }
        }
        Primitive::Image { path, width, height } => {
            let target_w = width.max(1.0);
            let target_h = height.max(1.0);
            if let Ok(img) = Pixmap::load_png(path) {
                let mut paint = PixmapPaint::default();
                paint.opacity = progress;
                let sx = target_w / img.width() as f32;
                let sy = target_h / img.height() as f32;
                let mut image_tx = SkTransform::identity();
                image_tx = image_tx.post_scale(sx, sy);
                image_tx = image_tx.post_translate(-target_w / 2.0, -target_h / 2.0);
                let final_tx = image_tx.post_concat(tx);
                let _ = pixmap.draw_pixmap(0, 0, img.as_ref(), &paint, final_tx, None);
            } else {
                // Fallback placeholder if image is missing or unsupported.
                let mut pb = PathBuilder::new();
                if let Some(rect) = Rect::from_xywh(-target_w / 2.0, -target_h / 2.0, target_w, target_h) {
                    pb.push_rect(rect);
                }
                if let Some(path_rect) = pb.finish() {
                    pixmap.stroke_path(&path_rect, &stroke_paint, &stroke_style, tx, None);
                }
                let mut pbx = PathBuilder::new();
                pbx.move_to(-target_w / 2.0, -target_h / 2.0);
                pbx.line_to(target_w / 2.0, target_h / 2.0);
                pbx.move_to(target_w / 2.0, -target_h / 2.0);
                pbx.line_to(-target_w / 2.0, target_h / 2.0);
                if let Some(path_x) = pbx.finish() {
                    pixmap.stroke_path(&path_x, &stroke_paint, &stroke_style, tx, None);
                }
            }
        }
    }
    Ok(())
}

fn to_sk_transform(layer: &ResolvedLayer, camera: CameraState, options: &RenderOptions) -> SkTransform {
    let (proj_x, proj_y, depth_scale) = project_layer_3d(layer, camera, options.render_mode);
    let mut tx = SkTransform::identity();
    tx = tx.post_scale(
        layer.transform.scale_x * depth_scale,
        layer.transform.scale_y * depth_scale,
    );
    tx = tx.post_rotate((layer.transform.rotation_deg + layer.transform.roll_deg).to_radians());
    tx = tx.post_translate(proj_x, proj_y);
    tx = tx.post_rotate((-camera.rotation_deg - camera.roll_deg).to_radians());
    tx = tx.post_scale(camera.zoom.max(0.01), camera.zoom.max(0.01));
    tx
}

fn project_layer_3d(layer: &ResolvedLayer, camera: CameraState, mode: RenderMode) -> (f32, f32, f32) {
    if mode != RenderMode::ThreeD {
        return (layer.transform.x - camera.x, layer.transform.y - camera.y, 1.0);
    }

    let mut dx = layer.transform.x - camera.x;
    let mut dy = layer.transform.y - camera.y;
    let mut dz = layer.transform.z - camera.z;

    let yaw = (-camera.yaw_deg + layer.transform.yaw_deg).to_radians();
    let pitch = (-camera.pitch_deg + layer.transform.pitch_deg).to_radians();

    let x1 = dx * yaw.cos() - dz * yaw.sin();
    let z1 = dx * yaw.sin() + dz * yaw.cos();
    let y1 = dy * pitch.cos() - z1 * pitch.sin();
    let z2 = dy * pitch.sin() + z1 * pitch.cos();

    dx = x1;
    dy = y1;
    dz = z2;

    let fov = camera.fov.max(1.0);
    let near = camera.near.max(0.01);
    let clamped_z = dz.max(near);
    let mut scale = (fov / (fov + clamped_z)).clamp(0.15, 6.0);
    if clamped_z > camera.far.max(near + 1.0) {
        scale *= 0.5;
    }
    (dx * scale, dy * scale, scale)
}

fn shade_material(
    albedo: [u8; 4],
    emissive: [u8; 4],
    roughness: f32,
    metallic: f32,
) -> [u8; 4] {
    let rough = roughness.clamp(0.0, 1.0);
    let metal = metallic.clamp(0.0, 1.0);
    let light = 0.78 + metal * 0.22 - rough * 0.18;
    let r = ((albedo[0] as f32 * light) + emissive[0] as f32 * 0.35).clamp(0.0, 255.0) as u8;
    let g = ((albedo[1] as f32 * light) + emissive[1] as f32 * 0.35).clamp(0.0, 255.0) as u8;
    let b = ((albedo[2] as f32 * light) + emissive[2] as f32 * 0.35).clamp(0.0, 255.0) as u8;
    [r, g, b, albedo[3]]
}

fn apply_post_effects(pixmap: &mut Pixmap, tier: EffectsTier) {
    let (w, h) = (pixmap.width() as usize, pixmap.height() as usize);
    if w == 0 || h == 0 {
        return;
    }
    let cx = w as f32 * 0.5;
    let cy = h as f32 * 0.5;
    let max_d = (cx * cx + cy * cy).sqrt().max(1.0);
    let data = pixmap.data_mut();
    for y in 0..h {
        for x in 0..w {
            let idx = (y * w + x) * 4;
            let dx = x as f32 - cx;
            let dy = y as f32 - cy;
            let d = (dx * dx + dy * dy).sqrt() / max_d;
            let vignette = 1.0 - d * 0.18;
            let (mut r, mut g, mut b) = (data[idx] as f32, data[idx + 1] as f32, data[idx + 2] as f32);
            r *= vignette;
            g *= vignette;
            b *= vignette;
            if tier == EffectsTier::Cinematic || tier == EffectsTier::Vfx {
                b = (b * 1.06).clamp(0.0, 255.0);
                r = (r * 0.98).clamp(0.0, 255.0);
            }
            if tier == EffectsTier::Vfx {
                let glow = ((1.0 - d).powf(2.0) * 12.0).clamp(0.0, 24.0);
                r = (r + glow * 0.35).clamp(0.0, 255.0);
                g = (g + glow * 0.45).clamp(0.0, 255.0);
                b = (b + glow * 0.75).clamp(0.0, 255.0);
            }
            data[idx] = r as u8;
            data[idx + 1] = g as u8;
            data[idx + 2] = b as u8;
        }
    }
}

fn draw_text_glyphs(
    pixmap: &mut Pixmap,
    text: &str,
    font_size: f32,
    font_family: Option<&str>,
    font_path: Option<&str>,
    progress: f32,
    line_height_mult: f32,
    text_max_width: f32,
    fill_paint: &Paint,
    stroke_paint: &Paint,
    stroke_style: &Stroke,
    tx: SkTransform,
) -> bool {
    let Some(font) = resolve_font(font_family, font_path) else {
        return false;
    };
    // Front-load text reveal slightly to avoid long static holds on narration-heavy scenes.
    let reveal = progress.clamp(0.0, 1.0).powf(0.82);
    let visible = text.to_string();
    if visible.trim().is_empty() {
        return false;
    }

    let raw_lines: Vec<&str> = visible.lines().collect();
    let mut lines: Vec<String> = Vec::new();
    for line in raw_lines {
        let wrapped = wrap_text_line(
            font,
            line,
            Scale::uniform(font_size.max(1.0)),
            text_max_width,
            font_size.max(1.0),
        );
        if wrapped.is_empty() {
            lines.push(line.to_string());
        } else {
            lines.extend(wrapped);
        }
    }
    if lines.is_empty() {
        return false;
    }
    let scale = Scale::uniform(font_size.max(1.0));
    let vm = font.v_metrics(scale);
    let line_height = (vm.ascent - vm.descent + vm.line_gap).max(font_size * line_height_mult.max(0.8));
    let total_h = line_height * lines.len() as f32;

    let line_units: Vec<usize> = lines
        .iter()
        .map(|line| line.chars().count().max(1))
        .collect();
    let total_units = line_units.iter().sum::<usize>().max(1) as f32;
    let mut unit_cursor = 0.0f32;

    let mut pb = PathBuilder::new();
    for (line_idx, line) in lines.iter().enumerate() {
        let glyphs: Vec<_> = font.layout(line, scale, point(0.0, 0.0)).collect();
        let line_w = line_advance_width(&glyphs);
        let units = line_units[line_idx] as f32;
        let visible_units = (reveal * total_units - unit_cursor).clamp(0.0, units);
        let line_reveal = (visible_units / units).clamp(0.0, 1.0);
        let reveal_w = line_w * line_reveal;
        unit_cursor += units;
        let x0 = -line_w * 0.5;
        let y0 = -total_h * 0.5 + line_idx as f32 * line_height + vm.ascent;
        if reveal_w <= 0.0 {
            continue;
        }
        for glyph in font.layout(line, scale, point(x0, y0)) {
            let pos = glyph.position();
            let right = pos.x + glyph.unpositioned().h_metrics().advance_width;
            if right > x0 + reveal_w + 0.5 {
                break;
            }
            let mut builder = SkiaOutlineBuilder {
                pb: &mut pb,
                offset_x: pos.x,
                offset_y: pos.y,
            };
            let _ = glyph.unpositioned().build_outline(&mut builder);
        }
    }

    if let Some(path) = pb.finish() {
        pixmap.fill_path(&path, fill_paint, FillRule::Winding, tx, None);
        if stroke_style.width > 0.0 {
            pixmap.stroke_path(&path, stroke_paint, stroke_style, tx, None);
        }
        return true;
    }
    false
}

fn wrap_text_line(
    font: &Font<'static>,
    line: &str,
    scale: Scale,
    max_width: f32,
    font_size: f32,
) -> Vec<String> {
    if max_width <= 1.0 {
        return vec![line.to_string()];
    }
    let words: Vec<&str> = line.split_whitespace().collect();
    if words.is_empty() {
        return vec![line.to_string()];
    }
    let mut out = Vec::new();
    let mut current = String::new();
    for word in words {
        let candidate = if current.is_empty() {
            word.to_string()
        } else {
            format!("{} {}", current, word)
        };
        let glyphs: Vec<_> = font.layout(&candidate, scale, point(0.0, 0.0)).collect();
        let w = line_advance_width(&glyphs);
        if w <= max_width || current.is_empty() {
            current = candidate;
        } else {
            out.push(current);
            current = hard_wrap_word(font, word, scale, max_width, font_size);
        }
    }
    if !current.is_empty() {
        out.push(current);
    }
    out
}

fn hard_wrap_word(font: &Font<'static>, word: &str, scale: Scale, max_width: f32, font_size: f32) -> String {
    let glyphs: Vec<_> = font.layout(word, scale, point(0.0, 0.0)).collect();
    let w = line_advance_width(&glyphs);
    if w <= max_width {
        return word.to_string();
    }
    let approx_chars = ((max_width / (font_size * 0.58)).floor() as usize).clamp(3, word.len().max(3));
    let mut out = String::new();
    let chars: Vec<char> = word.chars().collect();
    for (i, c) in chars.iter().enumerate() {
        out.push(*c);
        if (i + 1) % approx_chars == 0 && i + 1 < chars.len() {
            out.push('-');
            out.push(' ');
        }
    }
    out
}

fn stroke_fill_phases(progress: f32) -> (f32, f32) {
    let p = progress.clamp(0.0, 1.0);
    let stroke = (p / 0.7).clamp(0.0, 1.0);
    let fill = ((p - 0.25) / 0.75).clamp(0.0, 1.0);
    (stroke, fill)
}

fn draw_shape_with_progress(
    pixmap: &mut Pixmap,
    path: &tiny_skia::Path,
    fill_paint: &Paint,
    stroke_paint: &Paint,
    stroke_style: &Stroke,
    tx: SkTransform,
    stroke_phase: f32,
    fill_phase: f32,
) {
    if fill_phase > 0.01 {
        let mut fp = fill_paint.clone();
        if let Shader::SolidColor(c) = fp.shader {
            let alpha = (c.alpha() * fill_phase).clamp(0.0, 1.0);
            fp.shader = Shader::SolidColor(Color::from_rgba(c.red(), c.green(), c.blue(), alpha).unwrap_or(c));
        }
        pixmap.fill_path(path, &fp, FillRule::Winding, tx, None);
    }
    if stroke_style.width > 0.0 && stroke_phase > 0.01 {
        let mut sp = stroke_paint.clone();
        if let Shader::SolidColor(c) = sp.shader {
            let alpha = (c.alpha() * stroke_phase).clamp(0.0, 1.0);
            sp.shader = Shader::SolidColor(Color::from_rgba(c.red(), c.green(), c.blue(), alpha).unwrap_or(c));
        }
        pixmap.stroke_path(path, &sp, stroke_style, tx, None);
    }
}

fn draw_cuboid_like(
    pixmap: &mut Pixmap,
    width: f32,
    height: f32,
    depth: f32,
    projection_x: f32,
    projection_y: f32,
    fill_paint: &Paint,
    stroke_paint: &Paint,
    stroke_style: &Stroke,
    tx: SkTransform,
    stroke_phase: f32,
    fill_phase: f32,
) {
    let w = width.max(1.0);
    let h = height.max(1.0);
    let d = depth.max(1.0);
    let ox = projection_x.signum() * projection_x.abs().max(1.0).min(d);
    let oy = projection_y.signum() * projection_y.abs().max(1.0).min(d);

    let x0 = -w / 2.0;
    let y0 = -h / 2.0;
    let x1 = w / 2.0;
    let y1 = h / 2.0;

    let front = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    let top = [[x0, y0], [x1, y0], [x1 + ox, y0 + oy], [x0 + ox, y0 + oy]];
    let side = [[x1, y0], [x1, y1], [x1 + ox, y1 + oy], [x1 + ox, y0 + oy]];

    if let Some(path) = polygon_path(&top) {
        let mut fp = fill_paint.clone();
        tint_paint(&mut fp, 1.12);
        draw_shape_with_progress(
            pixmap,
            &path,
            &fp,
            stroke_paint,
            stroke_style,
            tx,
            stroke_phase,
            fill_phase,
        );
    }
    if let Some(path) = polygon_path(&side) {
        let mut fp = fill_paint.clone();
        tint_paint(&mut fp, 0.86);
        draw_shape_with_progress(
            pixmap,
            &path,
            &fp,
            stroke_paint,
            stroke_style,
            tx,
            stroke_phase,
            fill_phase,
        );
    }
    if let Some(path) = polygon_path(&front) {
        draw_shape_with_progress(
            pixmap,
            &path,
            fill_paint,
            stroke_paint,
            stroke_style,
            tx,
            stroke_phase,
            fill_phase,
        );
    }
}

fn polygon_path(points: &[[f32; 2]]) -> Option<tiny_skia::Path> {
    if points.len() < 3 {
        return None;
    }
    let mut pb = PathBuilder::new();
    pb.move_to(points[0][0], points[0][1]);
    for p in &points[1..] {
        pb.line_to(p[0], p[1]);
    }
    pb.close();
    pb.finish()
}

fn tint_paint(paint: &mut Paint, factor: f32) {
    if let Shader::SolidColor(c) = paint.shader {
        let r = (c.red() * factor).clamp(0.0, 1.0);
        let g = (c.green() * factor).clamp(0.0, 1.0);
        let b = (c.blue() * factor).clamp(0.0, 1.0);
        paint.shader = Shader::SolidColor(Color::from_rgba(r, g, b, c.alpha()).unwrap_or(c));
    }
}

fn rounded_rect_path(w: f32, h: f32, corner_radius: f32) -> Option<tiny_skia::Path> {
    let r = corner_radius.clamp(0.0, (w.min(h) * 0.5) - 0.5);
    if r <= 0.5 {
        let mut pb = PathBuilder::new();
        if let Some(rect) = Rect::from_xywh(-w / 2.0, -h / 2.0, w, h) {
            pb.push_rect(rect);
        }
        return pb.finish();
    }
    let x0 = -w / 2.0;
    let y0 = -h / 2.0;
    let x1 = w / 2.0;
    let y1 = h / 2.0;
    let mut pb = PathBuilder::new();
    pb.move_to(x0 + r, y0);
    pb.line_to(x1 - r, y0);
    pb.quad_to(x1, y0, x1, y0 + r);
    pb.line_to(x1, y1 - r);
    pb.quad_to(x1, y1, x1 - r, y1);
    pb.line_to(x0 + r, y1);
    pb.quad_to(x0, y1, x0, y1 - r);
    pb.line_to(x0, y0 + r);
    pb.quad_to(x0, y0, x0 + r, y0);
    pb.close();
    pb.finish()
}

fn get_font() -> Option<&'static Font<'static>> {
    FONT_CACHE.get_or_init(load_font).as_ref()
}

fn resolve_font(font_family: Option<&str>, font_path: Option<&str>) -> Option<&'static Font<'static>> {
    if let Some(path) = font_path {
        if !path.trim().is_empty() {
            return load_specific_font(path).or_else(get_font);
        }
    }
    if let Some(family) = font_family {
        if !family.trim().is_empty() {
            if let Some(font) = load_by_family(family) {
                return Some(font);
            }
        }
    }
    get_font()
}

fn load_specific_font(path: &str) -> Option<&'static Font<'static>> {
    let cache = SPECIFIC_FONT_CACHE.get_or_init(|| Mutex::new(std::collections::HashMap::new()));
    let mut guard = cache.lock().ok()?;
    if let Some(found) = guard.get(path) {
        return *found;
    }
    let resolved = fs::read(path)
        .ok()
        .and_then(Font::try_from_vec)
        .map(|font| Box::leak(Box::new(font)) as &'static Font<'static>);
    guard.insert(path.to_string(), resolved);
    resolved
}

fn load_by_family(family: &str) -> Option<&'static Font<'static>> {
    for path in font_family_candidates(family) {
        if let Some(font) = load_specific_font(path.to_string_lossy().as_ref()) {
            return Some(font);
        }
    }
    None
}

fn load_font() -> Option<Font<'static>> {
    for path in font_candidates() {
        if let Ok(bytes) = fs::read(&path) {
            if let Some(font) = Font::try_from_vec(bytes) {
                return Some(font);
            }
        }
    }
    None
}

fn font_candidates() -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Ok(custom) = std::env::var("VARIN_FONT_PATH") {
        out.push(PathBuf::from(custom));
    }
    out.push(PathBuf::from("C:/Windows/Fonts/arial.ttf"));
    out.push(PathBuf::from("C:/Windows/Fonts/segoeui.ttf"));
    out.push(PathBuf::from("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"));
    out.push(PathBuf::from("/System/Library/Fonts/Supplemental/Arial.ttf"));
    out
}

fn font_family_candidates(family: &str) -> Vec<PathBuf> {
    let key = family.trim().to_lowercase();
    let mut out = Vec::new();
    match key.as_str() {
        "arial" => {
            out.push(PathBuf::from("C:/Windows/Fonts/arial.ttf"));
            out.push(PathBuf::from("/System/Library/Fonts/Supplemental/Arial.ttf"));
        }
        "segoe_ui" | "segoe ui" => {
            out.push(PathBuf::from("C:/Windows/Fonts/segoeui.ttf"));
        }
        "consolas" => {
            out.push(PathBuf::from("C:/Windows/Fonts/consola.ttf"));
        }
        "dejavu_sans" | "dejavu sans" => {
            out.push(PathBuf::from("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"));
        }
        _ => {}
    }
    out
}

struct SkiaOutlineBuilder<'a> {
    pb: &'a mut PathBuilder,
    offset_x: f32,
    offset_y: f32,
}

impl OutlineBuilder for SkiaOutlineBuilder<'_> {
    fn move_to(&mut self, x: f32, y: f32) {
        self.pb.move_to(x + self.offset_x, y + self.offset_y);
    }

    fn line_to(&mut self, x: f32, y: f32) {
        self.pb.line_to(x + self.offset_x, y + self.offset_y);
    }

    fn quad_to(&mut self, x1: f32, y1: f32, x: f32, y: f32) {
        self.pb.quad_to(
            x1 + self.offset_x,
            y1 + self.offset_y,
            x + self.offset_x,
            y + self.offset_y,
        );
    }

    fn curve_to(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, x: f32, y: f32) {
        self.pb.cubic_to(
            x1 + self.offset_x,
            y1 + self.offset_y,
            x2 + self.offset_x,
            y2 + self.offset_y,
            x + self.offset_x,
            y + self.offset_y,
        );
    }

    fn close(&mut self) {
        self.pb.close();
    }
}

fn line_advance_width(glyphs: &[rusttype::PositionedGlyph<'_>]) -> f32 {
    if glyphs.is_empty() {
        return 0.0;
    }
    let first_x = glyphs.first().map(|g| g.position().x).unwrap_or(0.0);
    let mut max_x = first_x;
    for g in glyphs {
        let right = g.position().x + g.unpositioned().h_metrics().advance_width;
        if right > max_x {
            max_x = right;
        }
    }
    (max_x - first_x).max(0.0)
}

fn color_with_opacity(base: [u8; 4], opacity: f32) -> Color {
    let alpha = ((base[3] as f32) * opacity.clamp(0.0, 1.0))
        .round()
        .clamp(0.0, 255.0) as u8;
    Color::from_rgba8(base[0], base[1], base[2], alpha)
}

fn lerp_point(x1: f32, y1: f32, x2: f32, y2: f32, u: f32) -> (f32, f32) {
    let t = u.clamp(0.0, 1.0);
    (x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)
}

fn partial_polyline(points: &[[f32; 2]], progress: f32) -> Vec<[f32; 2]> {
    if points.len() < 2 {
        return vec![];
    }
    let p = progress.clamp(0.0, 1.0);
    if p <= 0.0 {
        return vec![points[0]];
    }
    if p >= 1.0 {
        return points.to_vec();
    }
    let mut lengths = Vec::with_capacity(points.len().saturating_sub(1));
    let mut total = 0.0f32;
    for i in 0..points.len() - 1 {
        let dx = points[i + 1][0] - points[i][0];
        let dy = points[i + 1][1] - points[i][1];
        let len = (dx * dx + dy * dy).sqrt();
        lengths.push(len);
        total += len;
    }
    if total <= 1e-6 {
        return vec![points[0]];
    }
    let target_len = total * p;
    let mut acc = 0.0f32;
    let mut out = vec![points[0]];
    for i in 0..points.len() - 1 {
        let seg_len = lengths[i];
        if acc + seg_len < target_len {
            out.push(points[i + 1]);
            acc += seg_len;
            continue;
        }
        let remain = (target_len - acc).max(0.0);
        let u = if seg_len <= 1e-6 { 0.0 } else { remain / seg_len };
        let (x, y) = lerp_point(
            points[i][0],
            points[i][1],
            points[i + 1][0],
            points[i + 1][1],
            u,
        );
        out.push([x, y]);
        break;
    }
    out
}

fn build_arrow_tip_path(
    x1: f32,
    y1: f32,
    x2: f32,
    y2: f32,
    tip_length: f32,
    tip_width: f32,
) -> Option<tiny_skia::Path> {
    let dx = x2 - x1;
    let dy = y2 - y1;
    let len = (dx * dx + dy * dy).sqrt();
    if len <= 1e-6 {
        return None;
    }
    let ux = dx / len;
    let uy = dy / len;
    let px = -uy;
    let py = ux;
    let bx = x2 - ux * tip_length.max(1.0);
    let by = y2 - uy * tip_length.max(1.0);
    let hw = tip_width.max(1.0) * 0.5;
    let lx = bx + px * hw;
    let ly = by + py * hw;
    let rx = bx - px * hw;
    let ry = by - py * hw;
    let mut pb = PathBuilder::new();
    pb.move_to(x2, y2);
    pb.line_to(lx, ly);
    pb.line_to(rx, ry);
    pb.close();
    pb.finish()
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        let mut out: String = s.chars().take(max).collect();
        out.push_str("...");
        out
    }
}

fn choose_encoder(ffmpeg: &str, prefer_hw_encode: bool) -> String {
    if prefer_hw_encode && has_nvidia_gpu() && ffmpeg_supports_encoder(ffmpeg, "h264_nvenc") {
        "h264_nvenc".to_string()
    } else {
        "libx264".to_string()
    }
}

fn choose_encoder_preset(encoder: &str, benchmark_fast: bool) -> String {
    if encoder == "h264_nvenc" {
        if benchmark_fast {
            "p1".to_string()
        } else {
            "p5".to_string()
        }
    } else if benchmark_fast {
        "ultrafast".to_string()
    } else {
        "fast".to_string()
    }
}

fn has_nvidia_gpu() -> bool {
    let out = Command::new("nvidia-smi").arg("-L").output();
    match out {
        Ok(o) if o.status.success() => {
            let text = String::from_utf8_lossy(&o.stdout).to_lowercase();
            text.contains("gpu")
        }
        _ => false,
    }
}

fn ffmpeg_supports_encoder(ffmpeg: &str, encoder: &str) -> bool {
    let out = Command::new(ffmpeg)
        .arg("-hide_banner")
        .arg("-encoders")
        .output();
    match out {
        Ok(o) if o.status.success() => {
            let mut text = String::new();
            text.push_str(&String::from_utf8_lossy(&o.stdout));
            text.push_str(&String::from_utf8_lossy(&o.stderr));
            text.to_lowercase().contains(&encoder.to_lowercase())
        }
        _ => false,
    }
}
