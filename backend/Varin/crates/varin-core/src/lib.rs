use serde::{Deserialize, Serialize};
use thiserror::Error;

pub mod builder;
mod timeline_runtime;

use timeline_runtime::{
    apply_color, apply_timeline_spec, build_group_timings, sample_color_keyframes,
    sample_float_keyframes, timeline_progress,
};

#[derive(Debug, Error)]
pub enum SceneError {
    #[error("scene duration_seconds must be > 0")]
    InvalidDuration,
    #[error("canvas width/height must be > 0")]
    InvalidCanvas,
    #[error("layer id '{0}' not found")]
    MissingLayer(String),
    #[error("layer '{0}' has invalid geometry")]
    InvalidGeometry(String),
    #[error("invalid timeline configuration: {0}")]
    InvalidTimeline(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scene {
    pub version: String,
    pub canvas: Canvas,
    pub duration_seconds: f32,
    #[serde(default)]
    pub camera: CameraState,
    #[serde(default)]
    pub layers: Vec<Layer>,
    #[serde(default)]
    pub animations: Vec<Track>,
    #[serde(default)]
    pub camera_animations: Vec<CameraTrack>,
    #[serde(default)]
    pub timeline: Option<SceneTimeline>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Canvas {
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    #[serde(default = "default_bg")]
    pub background_rgba: [u8; 4],
}

fn default_bg() -> [u8; 4] {
    [24, 24, 36, 255]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Layer {
    pub id: String,
    #[serde(default)]
    pub z_index: i32,
    #[serde(default)]
    pub transform: Transform,
    #[serde(default)]
    pub style: Style,
    #[serde(flatten)]
    pub primitive: Primitive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Primitive {
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

fn default_font_size() -> f32 {
    28.0
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

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Transform {
    #[serde(default)]
    pub x: f32,
    #[serde(default)]
    pub y: f32,
    #[serde(default = "default_scale")]
    pub scale_x: f32,
    #[serde(default = "default_scale")]
    pub scale_y: f32,
    #[serde(default)]
    pub rotation_deg: f32,
    #[serde(default)]
    pub z: f32,
    #[serde(default)]
    pub yaw_deg: f32,
    #[serde(default)]
    pub pitch_deg: f32,
    #[serde(default)]
    pub roll_deg: f32,
}

impl Default for Transform {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            scale_x: 1.0,
            scale_y: 1.0,
            rotation_deg: 0.0,
            z: 0.0,
            yaw_deg: 0.0,
            pitch_deg: 0.0,
            roll_deg: 0.0,
        }
    }
}

fn default_scale() -> f32 {
    1.0
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct CameraState {
    #[serde(default)]
    pub x: f32,
    #[serde(default)]
    pub y: f32,
    #[serde(default = "default_camera_zoom")]
    pub zoom: f32,
    #[serde(default)]
    pub rotation_deg: f32,
    #[serde(default)]
    pub z: f32,
    #[serde(default)]
    pub yaw_deg: f32,
    #[serde(default)]
    pub pitch_deg: f32,
    #[serde(default)]
    pub roll_deg: f32,
    #[serde(default = "default_camera_fov")]
    pub fov: f32,
    #[serde(default = "default_camera_near")]
    pub near: f32,
    #[serde(default = "default_camera_far")]
    pub far: f32,
}

impl Default for CameraState {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            zoom: default_camera_zoom(),
            rotation_deg: 0.0,
            z: 0.0,
            yaw_deg: 0.0,
            pitch_deg: 0.0,
            roll_deg: 0.0,
            fov: default_camera_fov(),
            near: default_camera_near(),
            far: default_camera_far(),
        }
    }
}

fn default_camera_zoom() -> f32 {
    1.0
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

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Style {
    #[serde(default = "default_fill")]
    pub fill_rgba: [u8; 4],
    #[serde(default = "default_stroke")]
    pub stroke_rgba: [u8; 4],
    #[serde(default = "default_stroke_width")]
    pub stroke_width: f32,
    #[serde(default = "default_opacity")]
    pub opacity: f32,
    #[serde(default = "default_draw_progress")]
    pub draw_progress: f32,
    #[serde(default = "default_line_height_mult")]
    pub line_height_mult: f32,
    #[serde(default)]
    pub text_max_width: f32,
}

impl Default for Style {
    fn default() -> Self {
        Self {
            fill_rgba: default_fill(),
            stroke_rgba: default_stroke(),
            stroke_width: default_stroke_width(),
            opacity: default_opacity(),
            draw_progress: default_draw_progress(),
            line_height_mult: default_line_height_mult(),
            text_max_width: 0.0,
        }
    }
}

fn default_fill() -> [u8; 4] {
    [65, 127, 224, 255]
}

fn default_stroke() -> [u8; 4] {
    [220, 220, 240, 255]
}

fn default_stroke_width() -> f32 {
    2.0
}

fn default_opacity() -> f32 {
    1.0
}

fn default_draw_progress() -> f32 {
    1.0
}

fn default_line_height_mult() -> f32 {
    1.15
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "track_type", rename_all = "snake_case")]
pub enum Track {
    Float {
        target: String,
        property: FloatProperty,
        keyframes: Vec<FloatKeyframe>,
    },
    Color {
        target: String,
        property: ColorProperty,
        keyframes: Vec<ColorKeyframe>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "track_type", rename_all = "snake_case")]
pub enum CameraTrack {
    Float {
        property: CameraProperty,
        keyframes: Vec<FloatKeyframe>,
    },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CameraProperty {
    X,
    Y,
    Z,
    Zoom,
    RotationDeg,
    YawDeg,
    PitchDeg,
    RollDeg,
    Fov,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneTimeline {
    #[serde(default)]
    pub specs: Vec<AnimationSpec>,
    #[serde(default)]
    pub lifecycle: Vec<LifecycleEvent>,
    #[serde(default)]
    pub segments: Vec<TimelineSegment>,
    #[serde(default)]
    pub groups: Vec<TimelineGroup>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LifecycleEvent {
    pub t: f32,
    pub action: LifecycleAction,
    pub target: String,
    pub with: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LifecycleAction {
    Add,
    Remove,
    Replace,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "segment_type", rename_all = "snake_case")]
pub enum TimelineSegment {
    Play {
        start: f32,
        run_time: f32,
        spec_indices: Vec<usize>,
    },
    Wait {
        start: f32,
        duration: f32,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineGroup {
    pub mode: GroupMode,
    pub start: f32,
    pub run_time: f32,
    #[serde(default)]
    pub lag_ratio: f32,
    pub spec_indices: Vec<usize>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GroupMode {
    AnimationGroup,
    Succession,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimationSpec {
    pub target: String,
    pub kind: AnimationKind,
    #[serde(default)]
    pub start: f32,
    #[serde(default = "default_anim_run_time")]
    pub run_time: f32,
    #[serde(default)]
    pub lag_ratio: f32,
    #[serde(default)]
    pub group_index: usize,
    #[serde(default = "default_group_size")]
    pub group_size: usize,
    #[serde(default)]
    pub easing: Easing,
    #[serde(default)]
    pub shift_x: f32,
    #[serde(default)]
    pub shift_y: f32,
    #[serde(default = "default_scale")]
    pub scale_from: f32,
    #[serde(default = "default_scale")]
    pub scale_to: f32,
    #[serde(default)]
    pub path_arc_deg: f32,
    pub path_points: Option<Vec<[f32; 2]>>,
    #[serde(default)]
    pub homotopy_amp_x: f32,
    #[serde(default)]
    pub homotopy_amp_y: f32,
    #[serde(default = "default_homotopy_freq")]
    pub homotopy_freq: f32,
    #[serde(default)]
    pub homotopy_phase_deg: f32,
    pub replace_with: Option<String>,
    pub to_x: Option<f32>,
    pub to_y: Option<f32>,
    pub to_scale_x: Option<f32>,
    pub to_scale_y: Option<f32>,
    pub to_rotation_deg: Option<f32>,
    #[serde(default)]
    pub axis_x: Option<f32>,
    #[serde(default)]
    pub axis_y: Option<f32>,
    #[serde(default)]
    pub axis_width: Option<f32>,
    #[serde(default)]
    pub axis_height: Option<f32>,
    #[serde(default)]
    pub label_text: Option<String>,
    #[serde(default)]
    pub layout_target: Option<String>,
    #[serde(default)]
    pub sub_box_mode: Option<SubBoxMode>,
    #[serde(default)]
    pub sub_box_offset_x: Option<f32>,
    #[serde(default)]
    pub sub_box_offset_y: Option<f32>,
    #[serde(default)]
    pub sub_box_width: Option<f32>,
    #[serde(default)]
    pub sub_box_height: Option<f32>,
    #[serde(default)]
    pub preset_fill_rgba: Option<[u8; 4]>,
    #[serde(default)]
    pub preset_stroke_rgba: Option<[u8; 4]>,
    #[serde(default)]
    pub preset_text_rgba: Option<[u8; 4]>,
    #[serde(default)]
    pub avoid_overlap: bool,
    #[serde(default)]
    pub arrows_outside: bool,
    #[serde(default = "default_layout_padding")]
    pub layout_padding: f32,
    #[serde(default = "default_label_padding")]
    pub label_padding: f32,
    #[serde(default)]
    pub connector_side_preference: Option<ConnectorSidePreference>,
    #[serde(default)]
    pub connector_path_mode: Option<ConnectorPathMode>,
    #[serde(default)]
    pub connector_elbow_ratio: Option<f32>,
}

fn default_anim_run_time() -> f32 {
    1.0
}

fn default_group_size() -> usize {
    1
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

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnimationKind {
    Create,
    ShowIncreasingSubsets,
    Write,
    DrawBorderThenFill,
    Uncreate,
    Transform,
    ReplacementTransform,
    FadeIn,
    FadeOut,
    VFadeIn,
    VFadeOut,
    FadeTransform,
    FadeTransformPieces,
    Rotate,
    GrowFromCenter,
    GrowFromPoint,
    MoveAlongPath,
    Homotopy,
    PhaseFlow,
    PresetEnterSoft,
    PresetEnterRise,
    PresetExitSoft,
    PresetExitDrop,
    PresetEmphasisPulse,
    PresetTransitionMorph,
    PresetTransitionCrossfade,
    PresetTextTypewriter,
    PresetTextPopIn,
    PresetTextGlowPulse,
    PresetShapeDrawRect,
    PresetShapeDrawSquare,
    PresetShapeDrawCircle,
    PresetShapeDrawLine,
    PresetShapeDrawPolygon,
    PresetArrowOutsidePoint,
    PresetConnectorSafeRoute,
    PresetBoxWithSubboxInside,
    PresetBoxWithSubboxOverlap,
    PresetFormulaStepReveal,
    PresetVectorFlowBlockReveal,
    PresetCameraPan,
    PresetCameraZoom,
    PresetParallaxDrift,
    PresetChromaPulse,
    PresetTransitionSwipe,
    PresetTransitionWipe,
    PresetTransitionPush,
    PresetTransitionBlurFade,
    PresetTransitionColorWash,
    PresetMotionOrbitDrift,
    PresetCameraSettle,
    PresetElasticEmphasis,
    PresetShotFront,
    PresetShotBack,
    PresetShotLeft,
    PresetShotRight,
    PresetShotLowHero,
    PresetSpeedRamp,
    PresetImpactSlowMo,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SubBoxMode {
    Inside,
    Overlap,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectorSidePreference {
    Auto,
    Left,
    Right,
    Top,
    Bottom,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectorPathMode {
    Direct,
    ElbowHorizontalFirst,
    ElbowVerticalFirst,
    ElbowAuto,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FloatProperty {
    X,
    Y,
    Z,
    ScaleX,
    ScaleY,
    RotationDeg,
    YawDeg,
    PitchDeg,
    RollDeg,
    Opacity,
    StrokeWidth,
    Width,
    Height,
    Radius,
    RadiusX,
    RadiusY,
    FontSize,
    X1,
    Y1,
    X2,
    Y2,
    TipLength,
    TipWidth,
    DrawProgress,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ColorProperty {
    FillRgba,
    StrokeRgba,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct FloatKeyframe {
    pub t: f32,
    pub value: f32,
    #[serde(default)]
    pub easing_to_next: Easing,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct ColorKeyframe {
    pub t: f32,
    pub value: [u8; 4],
    #[serde(default)]
    pub easing_to_next: Easing,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Easing {
    #[default]
    Linear,
    EaseIn,
    EaseOut,
    EaseInOut,
    RushInto,
    RushFrom,
    ThereAndBack,
    Overshoot,
}

#[derive(Debug, Clone)]
pub struct ResolvedLayer {
    pub id: String,
    pub z_index: i32,
    pub transform: Transform,
    pub style: Style,
    pub primitive: Primitive,
    pub transition_rank: i8,
    pub world_z: f32,
}

impl Scene {
    pub fn validate(&self) -> Result<(), SceneError> {
        if self.duration_seconds <= 0.0 {
            return Err(SceneError::InvalidDuration);
        }
        if self.canvas.width == 0 || self.canvas.height == 0 || self.canvas.fps == 0 {
            return Err(SceneError::InvalidCanvas);
        }
        for track in &self.animations {
            let target = match track {
                Track::Float { target, .. } => target,
                Track::Color { target, .. } => target,
            };
            if self.layers.iter().all(|l| &l.id != target) {
                return Err(SceneError::MissingLayer(target.clone()));
            }
        }
        if let Some(tl) = &self.timeline {
            for spec in &tl.specs {
                if spec.run_time <= 0.0 {
                    return Err(SceneError::InvalidDuration);
                }
                if spec.group_size == 0 {
                    return Err(SceneError::InvalidDuration);
                }
                if spec.start < 0.0 {
                    return Err(SceneError::InvalidTimeline(format!(
                        "spec target '{}' has negative start time",
                        spec.target
                    )));
                }
                if !(0.0..=1.0).contains(&spec.lag_ratio) {
                    return Err(SceneError::InvalidTimeline(format!(
                        "spec target '{}' has lag_ratio outside [0,1]",
                        spec.target
                    )));
                }
                if self.layers.iter().all(|l| l.id != spec.target) {
                    return Err(SceneError::MissingLayer(spec.target.clone()));
                }
                if matches!(
                    spec.kind,
                    AnimationKind::PresetTextTypewriter
                        | AnimationKind::PresetTextPopIn
                        | AnimationKind::PresetTextGlowPulse
                        | AnimationKind::PresetFormulaStepReveal
                ) && !self
                    .layers
                    .iter()
                    .any(|l| l.id == spec.target && matches!(l.primitive, Primitive::Text { .. }))
                {
                    return Err(SceneError::InvalidTimeline(format!(
                        "text preset '{}' can only target text layers",
                        spec.target
                    )));
                }
                if let Some(replace_with) = &spec.replace_with {
                    if self.layers.iter().all(|l| &l.id != replace_with) {
                        return Err(SceneError::MissingLayer(replace_with.clone()));
                    }
                }
                if let Some(layout_target) = &spec.layout_target {
                    if self.layers.iter().all(|l| &l.id != layout_target) {
                        return Err(SceneError::MissingLayer(layout_target.clone()));
                    }
                }
                validate_preset_guardrails(spec)?;
            }
            for ev in &tl.lifecycle {
                if self.layers.iter().all(|l| l.id != ev.target) {
                    return Err(SceneError::MissingLayer(ev.target.clone()));
                }
                if let Some(with) = &ev.with {
                    if self.layers.iter().all(|l| &l.id != with) {
                        return Err(SceneError::MissingLayer(with.clone()));
                    }
                }
            }
            for segment in &tl.segments {
                match segment {
                    TimelineSegment::Play {
                        run_time,
                        spec_indices,
                        ..
                    } => {
                        if *run_time <= 0.0 {
                            return Err(SceneError::InvalidDuration);
                        }
                        for idx in spec_indices {
                            if *idx >= tl.specs.len() {
                                return Err(SceneError::InvalidDuration);
                            }
                        }
                    }
                    TimelineSegment::Wait { duration, .. } => {
                        if *duration < 0.0 {
                            return Err(SceneError::InvalidDuration);
                        }
                    }
                }
            }
            for group in &tl.groups {
                if group.run_time <= 0.0 {
                    return Err(SceneError::InvalidDuration);
                }
                for idx in &group.spec_indices {
                    if *idx >= tl.specs.len() {
                        return Err(SceneError::InvalidDuration);
                    }
                }
            }
        }
        for layer in &self.layers {
            match &layer.primitive {
                Primitive::Rect { width, height, .. } if *width <= 0.0 || *height <= 0.0 => {
                    return Err(SceneError::InvalidGeometry(layer.id.clone()));
                }
                Primitive::Circle { radius } if *radius <= 0.0 => {
                    return Err(SceneError::InvalidGeometry(layer.id.clone()));
                }
                Primitive::Ellipse { radius_x, radius_y } if *radius_x <= 0.0 || *radius_y <= 0.0 => {
                    return Err(SceneError::InvalidGeometry(layer.id.clone()));
                }
                Primitive::Polyline { points } if points.len() < 2 => {
                    return Err(SceneError::InvalidGeometry(layer.id.clone()));
                }
                Primitive::Polygon { points } if points.len() < 3 => {
                    return Err(SceneError::InvalidGeometry(layer.id.clone()));
                }
                Primitive::Cube {
                    size,
                    depth_ratio,
                    ..
                } if *size <= 0.0 || *depth_ratio <= 0.0 => {
                    return Err(SceneError::InvalidGeometry(layer.id.clone()));
                }
                Primitive::Cuboid {
                    width,
                    height,
                    depth,
                    ..
                } if *width <= 0.0 || *height <= 0.0 || *depth <= 0.0 => {
                    return Err(SceneError::InvalidGeometry(layer.id.clone()));
                }
                Primitive::MeshBlock {
                    width,
                    height,
                    depth,
                    roughness,
                    metallic,
                    ..
                } if *width <= 0.0
                    || *height <= 0.0
                    || *depth <= 0.0
                    || !(0.0..=1.0).contains(roughness)
                    || !(0.0..=1.0).contains(metallic) =>
                {
                    return Err(SceneError::InvalidGeometry(layer.id.clone()));
                }
                Primitive::Arrow {
                    x1,
                    y1,
                    x2,
                    y2,
                    tip_length,
                    tip_width,
                } if (*x1 - *x2).abs() < 1e-6
                    && (*y1 - *y2).abs() < 1e-6
                    || *tip_length <= 0.0
                    || *tip_width <= 0.0 =>
                {
                    return Err(SceneError::InvalidGeometry(layer.id.clone()));
                }
                Primitive::Text {
                    font_size,
                    font_family,
                    font_path,
                    ..
                } if *font_size <= 0.0
                    || font_family
                        .as_ref()
                        .map(|s| s.trim().is_empty())
                        .unwrap_or(false)
                    || font_path
                        .as_ref()
                        .map(|s| s.trim().is_empty())
                        .unwrap_or(false) =>
                {
                    return Err(SceneError::InvalidGeometry(layer.id.clone()));
                }
                Primitive::Image { path, width, height } if path.trim().is_empty() || *width <= 0.0 || *height <= 0.0 => {
                    return Err(SceneError::InvalidGeometry(layer.id.clone()));
                }
                _ => {}
            }
        }
        Ok(())
    }

    pub fn frame_count(&self) -> usize {
        (self.duration_seconds * self.canvas.fps as f32).ceil().max(1.0) as usize
    }

    pub fn resolve_at(&self, t: f32) -> Vec<ResolvedLayer> {
        let visible = self.layer_visibility_at(t);
        let mut out: Vec<ResolvedLayer> = self
            .layers
            .iter()
            .filter(|layer| *visible.get(&layer.id).unwrap_or(&true))
            .map(|layer| ResolvedLayer {
                id: layer.id.clone(),
                z_index: layer.z_index,
                transform: layer.transform,
                style: layer.style,
                primitive: layer.primitive.clone(),
                transition_rank: 0,
                world_z: layer.transform.z,
            })
            .collect();

        for track in &self.animations {
            match track {
                Track::Float {
                    target,
                    property,
                    keyframes,
                } => {
                    if let Some(layer) = out.iter_mut().find(|l| &l.id == target) {
                        let v = sample_float_keyframes(keyframes, t);
                        apply_float(layer, *property, v);
                    }
                }
                Track::Color {
                    target,
                    property,
                    keyframes,
                } => {
                    if let Some(layer) = out.iter_mut().find(|l| &l.id == target) {
                        let v = sample_color_keyframes(keyframes, t);
                        apply_color(layer, *property, v);
                    }
                }
            }
        }

        if let Some(timeline) = &self.timeline {
            let group_timings = build_group_timings(timeline);
            let mut effective_specs = Vec::with_capacity(timeline.specs.len());
            for (idx, spec) in timeline.specs.iter().enumerate() {
                let effective = if let Some(override_timing) = group_timings.get(&idx) {
                    let mut s = spec.clone();
                    s.start = override_timing.start;
                    s.run_time = override_timing.run_time;
                    s.group_index = 0;
                    s.group_size = 1;
                    s.lag_ratio = 0.0;
                    s
                } else {
                    spec.clone()
                };

                if matches!(
                    effective.kind,
                    AnimationKind::ReplacementTransform
                        | AnimationKind::FadeTransform
                        | AnimationKind::FadeTransformPieces
                        | AnimationKind::PresetTransitionMorph
                        | AnimationKind::PresetTransitionCrossfade
                ) {
                    if let Some(replace_with) = &effective.replace_with {
                        if apply_replacement_transform_pair(&mut out, &effective, replace_with, t) {
                            continue;
                        }
                    }
                }

                if let Some(layer) = out.iter_mut().find(|l| l.id == effective.target) {
                    apply_timeline_spec(layer, &effective, t);
                }
                effective_specs.push(effective);
            }
            apply_layout_safety(&mut out, &effective_specs, t);
        }

        let mut indexed: Vec<(usize, ResolvedLayer)> = out.into_iter().enumerate().collect();
        indexed.sort_by(|(idx_a, a), (idx_b, b)| {
            use std::cmp::Ordering;
            match a.z_index.cmp(&b.z_index) {
                Ordering::Equal => match a
                    .world_z
                    .partial_cmp(&b.world_z)
                    .unwrap_or(Ordering::Equal)
                {
                    Ordering::Equal => match a.transition_rank.cmp(&b.transition_rank) {
                        Ordering::Equal => idx_a.cmp(idx_b),
                        other => other,
                    },
                    other => other,
                },
                other => other,
            }
        });
        indexed.into_iter().map(|(_, layer)| layer).collect()
    }

    pub fn camera_at(&self, t: f32) -> CameraState {
        let mut cam = self.camera;
        for track in &self.camera_animations {
            match track {
                CameraTrack::Float { property, keyframes } => {
                    let v = sample_float_keyframes(keyframes, t);
                    match property {
                        CameraProperty::X => cam.x = v,
                        CameraProperty::Y => cam.y = v,
                        CameraProperty::Z => cam.z = v,
                        CameraProperty::Zoom => cam.zoom = v.max(0.01),
                        CameraProperty::RotationDeg => cam.rotation_deg = v,
                        CameraProperty::YawDeg => cam.yaw_deg = v,
                        CameraProperty::PitchDeg => cam.pitch_deg = v,
                        CameraProperty::RollDeg => cam.roll_deg = v,
                        CameraProperty::Fov => cam.fov = v.max(1.0),
                    }
                }
            }
        }
        cam
    }

    fn layer_visibility_at(&self, t: f32) -> std::collections::HashMap<String, bool> {
        let mut visible: std::collections::HashMap<String, bool> = self
            .layers
            .iter()
            .map(|l| (l.id.clone(), true))
            .collect();
        if let Some(timeline) = &self.timeline {
            for ev in &timeline.lifecycle {
                if matches!(ev.action, LifecycleAction::Add)
                    || matches!(ev.action, LifecycleAction::Replace)
                {
                    if let Some(with) = &ev.with {
                        visible.insert(with.clone(), false);
                    }
                }
            }

            let mut events: Vec<&LifecycleEvent> = timeline
                .lifecycle
                .iter()
                .filter(|ev| ev.t <= t)
                .collect();
            events.sort_by(|a, b| a.t.partial_cmp(&b.t).unwrap_or(std::cmp::Ordering::Equal));

            for ev in events {
                match ev.action {
                    LifecycleAction::Add => {
                        visible.insert(ev.target.clone(), true);
                    }
                    LifecycleAction::Remove => {
                        visible.insert(ev.target.clone(), false);
                    }
                    LifecycleAction::Replace => {
                        visible.insert(ev.target.clone(), false);
                        if let Some(with) = &ev.with {
                            visible.insert(with.clone(), true);
                        }
                    }
                }
            }
        }
        visible
    }
}

fn apply_replacement_transform_pair(
    layers: &mut [ResolvedLayer],
    spec: &AnimationSpec,
    replace_with: &str,
    t: f32,
) -> bool {
    let src_idx = layers.iter().position(|l| l.id == spec.target);
    let dst_idx = layers.iter().position(|l| l.id == replace_with);
    let (Some(si), Some(di)) = (src_idx, dst_idx) else {
        return false;
    };
    if si == di {
        return false;
    }

    let u = timeline_progress(spec, t);
    let p = u;

    if si < di {
        let (left, right) = layers.split_at_mut(di);
        let src = &mut left[si];
        let dst = &mut right[0];
        apply_transition_pair(src, dst, spec.kind, p);
    } else {
        let (left, right) = layers.split_at_mut(si);
        let dst = &mut left[di];
        let src = &mut right[0];
        apply_transition_pair(src, dst, spec.kind, p);
    }
    true
}

fn apply_transition_pair(src: &mut ResolvedLayer, dst: &mut ResolvedLayer, kind: AnimationKind, u: f32) {
    match kind {
        AnimationKind::PresetTransitionCrossfade => crossfade_layers(src, dst, u),
        _ => morph_layers(src, dst, u),
    }
}

fn morph_layers(src: &mut ResolvedLayer, dst: &mut ResolvedLayer, u: f32) {
    let ux = u.clamp(0.0, 1.0);
    let sx0 = src.transform.x;
    let sy0 = src.transform.y;
    let ssx0 = src.transform.scale_x;
    let ssy0 = src.transform.scale_y;
    let sr0 = src.transform.rotation_deg;

    let dx1 = dst.transform.x;
    let dy1 = dst.transform.y;
    let dsx1 = dst.transform.scale_x;
    let dsy1 = dst.transform.scale_y;
    let dr1 = dst.transform.rotation_deg;

    let mx = lerp_local(sx0, dx1, ux);
    let my = lerp_local(sy0, dy1, ux);
    let msx = lerp_local(ssx0, dsx1, ux);
    let msy = lerp_local(ssy0, dsy1, ux);
    let mr = lerp_local(sr0, dr1, ux);

    src.transform.x = mx;
    src.transform.y = my;
    src.transform.scale_x = msx;
    src.transform.scale_y = msy;
    src.transform.rotation_deg = mr;
    src.style.opacity = 1.0 - ux;
    src.style.draw_progress = (1.0 - ux).clamp(0.0, 1.0);
    src.transition_rank = -1;

    dst.transform.x = mx;
    dst.transform.y = my;
    dst.transform.scale_x = msx;
    dst.transform.scale_y = msy;
    dst.transform.rotation_deg = mr;
    dst.style.opacity = ux;
    dst.style.draw_progress = ux.clamp(0.0, 1.0);
    dst.transition_rank = 1;
}

fn crossfade_layers(src: &mut ResolvedLayer, dst: &mut ResolvedLayer, u: f32) {
    let ux = u.clamp(0.0, 1.0);
    src.style.opacity = 1.0 - ux;
    src.style.draw_progress = (1.0 - ux).clamp(0.0, 1.0);
    src.transition_rank = -1;

    dst.style.opacity = ux;
    dst.style.draw_progress = ux.clamp(0.0, 1.0);
    dst.transition_rank = 1;
}

fn lerp_local(a: f32, b: f32, u: f32) -> f32 {
    a + (b - a) * u
}

fn apply_layout_safety(layers: &mut [ResolvedLayer], specs: &[AnimationSpec], t: f32) {
    for spec in specs {
        let progress = timeline_progress(spec, t);
        if progress <= 0.0 {
            continue;
        }
        if !(spec.avoid_overlap
            || spec.arrows_outside
            || matches!(
                spec.kind,
                AnimationKind::PresetBoxWithSubboxInside | AnimationKind::PresetBoxWithSubboxOverlap
            ))
        {
            continue;
        }

        if matches!(
            spec.kind,
            AnimationKind::PresetBoxWithSubboxInside | AnimationKind::PresetBoxWithSubboxOverlap
        ) {
            place_sub_box(layers, spec);
        }

        if spec.arrows_outside
            || matches!(
                spec.kind,
                AnimationKind::PresetArrowOutsidePoint | AnimationKind::PresetConnectorSafeRoute
            )
        {
            route_connector_outside(layers, spec);
        }

        if spec.avoid_overlap {
            shift_text_if_overlapping_shape(layers, spec);
            shift_text_away_from_arrow(layers, spec);
        }
    }
}

fn place_sub_box(layers: &mut [ResolvedLayer], spec: &AnimationSpec) {
    let Some(parent_id) = spec.layout_target.as_ref() else {
        return;
    };
    let parent_idx = layers.iter().position(|l| &l.id == parent_id);
    let child_idx = layers.iter().position(|l| l.id == spec.target);
    let (Some(pi), Some(ci)) = (parent_idx, child_idx) else {
        return;
    };
    if pi == ci {
        return;
    }
    let parent_rect = layer_rect(&layers[pi]);
    let child_size = (
        spec.sub_box_width.unwrap_or(120.0).max(8.0),
        spec.sub_box_height.unwrap_or(80.0).max(8.0),
    );
    let px = parent_rect.0;
    let py = parent_rect.1;
    let pw = parent_rect.2;
    let ph = parent_rect.3;

    let (tx, ty) = if matches!(spec.sub_box_mode, Some(SubBoxMode::Overlap))
        || matches!(spec.kind, AnimationKind::PresetBoxWithSubboxOverlap)
    {
        (
            px + pw * 0.5 - child_size.0 * 0.35 + spec.sub_box_offset_x.unwrap_or(0.0),
            py - ph * 0.5 + child_size.1 * 0.35 + spec.sub_box_offset_y.unwrap_or(0.0),
        )
    } else {
        let inner_x = spec.sub_box_offset_x.unwrap_or(0.0);
        let inner_y = spec.sub_box_offset_y.unwrap_or(0.0);
        let half_x = (pw - child_size.0).max(0.0) * 0.5;
        let half_y = (ph - child_size.1).max(0.0) * 0.5;
        (
            (px + inner_x).clamp(px - half_x, px + half_x),
            (py + inner_y).clamp(py - half_y, py + half_y),
        )
    };

    layers[ci].transform.x = tx;
    layers[ci].transform.y = ty;
    if let Primitive::Rect { width, height, .. } = &mut layers[ci].primitive {
        *width = child_size.0;
        *height = child_size.1;
    }
}

fn route_connector_outside(layers: &mut [ResolvedLayer], spec: &AnimationSpec) {
    let conn_idx = layers.iter().position(|l| {
        l.id == spec.target
            && matches!(
                l.primitive,
                Primitive::Arrow { .. } | Primitive::Polyline { .. } | Primitive::Line { .. }
            )
    });
    let Some(ci) = conn_idx else {
        return;
    };

    let src_abs = if let (Some(x), Some(y)) = (spec.axis_x, spec.axis_y) {
        (x, y)
    } else {
        let (x1, y1, tx, ty) = match &layers[ci].primitive {
            Primitive::Arrow { x1, y1, .. } => (*x1, *y1, layers[ci].transform.x, layers[ci].transform.y),
            Primitive::Line { x1, y1, .. } => (*x1, *y1, layers[ci].transform.x, layers[ci].transform.y),
            Primitive::Polyline { points } => {
                if let Some(p0) = points.first() {
                    (p0[0], p0[1], layers[ci].transform.x, layers[ci].transform.y)
                } else {
                    return;
                }
            }
            _ => return,
        };
        (tx + x1, ty + y1)
    };

    let target_rect = if let Some(target_id) = spec.layout_target.as_ref() {
        layers
            .iter()
            .position(|l| &l.id == target_id)
            .map(|ti| layer_rect(&layers[ti]))
    } else if let (Some(ax), Some(ay), Some(aw), Some(ah)) =
        (spec.axis_x, spec.axis_y, spec.axis_width, spec.axis_height)
    {
        Some((ax, ay, aw.max(1.0), ah.max(1.0)))
    } else {
        None
    };
    let Some(target_rect) = target_rect else {
        return;
    };

    let text_rects: Vec<(f32, f32, f32, f32)> = layers
        .iter()
        .filter(|l| matches!(l.primitive, Primitive::Text { .. }))
        .map(text_bounds)
        .collect();
    let mut dst_abs = choose_rect_entry_point(
        src_abs,
        target_rect,
        spec.layout_padding.max(0.0),
        &text_rects,
        spec.label_padding.max(0.0),
        spec.connector_side_preference,
    );

    if (dst_abs.0 - src_abs.0).abs() < 1e-3 && (dst_abs.1 - src_abs.1).abs() < 1e-3 {
        dst_abs.0 += 1.0;
    }
    let mode = spec
        .connector_path_mode
        .unwrap_or(ConnectorPathMode::Direct);

    match &mut layers[ci].primitive {
        Primitive::Arrow { x1, y1, x2, y2, .. } => {
            let tx = layers[ci].transform.x;
            let ty = layers[ci].transform.y;
            *x1 = src_abs.0 - tx;
            *y1 = src_abs.1 - ty;
            *x2 = dst_abs.0 - tx;
            *y2 = dst_abs.1 - ty;
        }
        Primitive::Line { x1, y1, x2, y2 } => {
            let tx = layers[ci].transform.x;
            let ty = layers[ci].transform.y;
            *x1 = src_abs.0 - tx;
            *y1 = src_abs.1 - ty;
            *x2 = dst_abs.0 - tx;
            *y2 = dst_abs.1 - ty;
        }
        Primitive::Polyline { points } => {
            let tx = layers[ci].transform.x;
            let ty = layers[ci].transform.y;
            let route = choose_polyline_route(
                src_abs,
                dst_abs,
                mode,
                &text_rects,
                spec.label_padding.max(0.0),
                spec.connector_elbow_ratio.unwrap_or(0.5).clamp(0.05, 0.95),
            );
            *points = route
                .into_iter()
                .map(|(x, y)| [x - tx, y - ty])
                .collect::<Vec<_>>();
        }
        _ => {}
    }

}

fn shift_text_if_overlapping_shape(layers: &mut [ResolvedLayer], spec: &AnimationSpec) {
    let Some(target_id) = spec.layout_target.as_ref() else {
        return;
    };
    let text_idx = layers
        .iter()
        .position(|l| l.id == spec.target && matches!(l.primitive, Primitive::Text { .. }));
    let shape_idx = layers.iter().position(|l| &l.id == target_id);
    let (Some(ti), Some(si)) = (text_idx, shape_idx) else {
        return;
    };
    let text_rect = text_bounds(&layers[ti]);
    let shape_rect = layer_rect(&layers[si]);
    if rects_overlap(text_rect, inflate_rect(shape_rect, spec.layout_padding.max(0.0))) {
        let (_, sy, _, sh) = shape_rect;
        let (_, _, _, th) = text_rect;
        layers[ti].transform.y = sy - sh * 0.5 - th * 0.5 - spec.label_padding.max(0.0);
    }
}

fn shift_text_away_from_arrow(layers: &mut [ResolvedLayer], spec: &AnimationSpec) {
    let arrow_idx = layers
        .iter()
        .position(|l| l.id == spec.target && matches!(l.primitive, Primitive::Arrow { .. }));
    let Some(ai) = arrow_idx else {
        return;
    };
    let (x1, y1, x2, y2, tx, ty) = match &layers[ai].primitive {
        Primitive::Arrow { x1, y1, x2, y2, .. } => (*x1, *y1, *x2, *y2, layers[ai].transform.x, layers[ai].transform.y),
        _ => return,
    };
    let a0 = (tx + x1, ty + y1);
    let a1 = (tx + x2, ty + y2);
    let threshold = (spec.layout_padding + spec.label_padding).max(8.0);

    for layer in layers.iter_mut() {
        if !matches!(layer.primitive, Primitive::Text { .. }) {
            continue;
        }
        let (cx, cy, _, _) = text_bounds(layer);
        let (closest, d) = closest_point_and_distance_on_segment((cx, cy), a0, a1);
        if d < threshold {
            let mut nx = cx - closest.0;
            let mut ny = cy - closest.1;
            let len = (nx * nx + ny * ny).sqrt();
            if len <= 1e-4 {
                nx = 0.0;
                ny = -1.0;
            } else {
                nx /= len;
                ny /= len;
            }
            let push = (threshold - d) + 2.0;
            layer.transform.x += nx * push;
            layer.transform.y += ny * push;
        }
    }
}

fn layer_rect(layer: &ResolvedLayer) -> (f32, f32, f32, f32) {
    let (mut w, mut h) = (120.0f32, 80.0f32);
    match &layer.primitive {
        Primitive::Rect { width, height, .. } => {
            w = *width;
            h = *height;
        }
        Primitive::Circle { radius } => {
            w = radius * 2.0;
            h = radius * 2.0;
        }
        Primitive::Ellipse { radius_x, radius_y } => {
            w = radius_x * 2.0;
            h = radius_y * 2.0;
        }
        Primitive::Text { text, font_size, .. } => {
            w = (text.chars().count() as f32 * font_size * 0.55).max(16.0);
            h = (*font_size * layer.style.line_height_mult.max(1.0)).max(12.0);
        }
        Primitive::Arrow { x1, y1, x2, y2, .. } | Primitive::Line { x1, y1, x2, y2 } => {
            w = (x2 - x1).abs().max(8.0);
            h = (y2 - y1).abs().max(8.0);
        }
        Primitive::Polygon { points } | Primitive::Polyline { points } => {
            if let Some((min_x, min_y, max_x, max_y)) = poly_bounds(points) {
                w = (max_x - min_x).max(8.0);
                h = (max_y - min_y).max(8.0);
            }
        }
        Primitive::Cube { size, .. } => {
            w = *size;
            h = *size;
        }
        Primitive::Cuboid { width, height, .. } => {
            w = *width;
            h = *height;
        }
        Primitive::MeshBlock { width, height, .. } => {
            w = *width;
            h = *height;
        }
        Primitive::Image { width, height, .. } => {
            w = *width;
            h = *height;
        }
    }
    (
        layer.transform.x,
        layer.transform.y,
        w.max(1.0) * layer.transform.scale_x.abs().max(0.01),
        h.max(1.0) * layer.transform.scale_y.abs().max(0.01),
    )
}

fn text_bounds(layer: &ResolvedLayer) -> (f32, f32, f32, f32) {
    layer_rect(layer)
}

fn poly_bounds(points: &[[f32; 2]]) -> Option<(f32, f32, f32, f32)> {
    let mut it = points.iter();
    let first = it.next()?;
    let (mut min_x, mut min_y, mut max_x, mut max_y) = (first[0], first[1], first[0], first[1]);
    for p in it {
        min_x = min_x.min(p[0]);
        min_y = min_y.min(p[1]);
        max_x = max_x.max(p[0]);
        max_y = max_y.max(p[1]);
    }
    Some((min_x, min_y, max_x, max_y))
}

fn choose_rect_entry_point(
    src: (f32, f32),
    rect: (f32, f32, f32, f32),
    padding: f32,
    text_rects: &[(f32, f32, f32, f32)],
    label_padding: f32,
    side_pref: Option<ConnectorSidePreference>,
) -> (f32, f32) {
    let (cx, cy, w, h) = rect;
    let half_w = w * 0.5 + padding;
    let half_h = h * 0.5 + padding;

    let left = (cx - half_w, src.1.clamp(cy - half_h, cy + half_h));
    let right = (cx + half_w, src.1.clamp(cy - half_h, cy + half_h));
    let top = (src.0.clamp(cx - half_w, cx + half_w), cy - half_h);
    let bottom = (src.0.clamp(cx - half_w, cx + half_w), cy + half_h);
    let mut candidates = vec![left, right, top, bottom];
    if let Some(pref) = side_pref {
        match pref {
            ConnectorSidePreference::Left => candidates = vec![left],
            ConnectorSidePreference::Right => candidates = vec![right],
            ConnectorSidePreference::Top => candidates = vec![top],
            ConnectorSidePreference::Bottom => candidates = vec![bottom],
            ConnectorSidePreference::Auto => {}
        }
    }

    let mut best = candidates[0];
    let mut best_score = f32::MAX;
    for cand in candidates {
        let mut score = ((cand.0 - src.0).powi(2) + (cand.1 - src.1).powi(2)).sqrt();
        // Prefer routes that keep one axis stable (cleaner orthogonal look).
        if (cand.0 - src.0).abs() < 1e-3 || (cand.1 - src.1).abs() < 1e-3 {
            score *= 0.92;
        }
        let mut collisions = 0.0f32;
        for tr in text_rects {
            if segment_near_rect(src, cand, inflate_rect(*tr, label_padding.max(0.0))) {
                collisions += 1.0;
            }
        }
        score += collisions * 1200.0;
        if score < best_score {
            best_score = score;
            best = cand;
        }
    }
    best
}

fn choose_polyline_route(
    src: (f32, f32),
    dst: (f32, f32),
    mode: ConnectorPathMode,
    text_rects: &[(f32, f32, f32, f32)],
    label_padding: f32,
    elbow_ratio: f32,
) -> Vec<(f32, f32)> {
    let direct = vec![src, dst];
    let h_mid = (
        src.0 + (dst.0 - src.0) * elbow_ratio,
        src.1,
    );
    let h_mid2 = (
        src.0 + (dst.0 - src.0) * elbow_ratio,
        dst.1,
    );
    let horizontal_first = vec![src, h_mid, h_mid2, dst];

    let v_mid = (
        src.0,
        src.1 + (dst.1 - src.1) * elbow_ratio,
    );
    let v_mid2 = (
        dst.0,
        src.1 + (dst.1 - src.1) * elbow_ratio,
    );
    let vertical_first = vec![src, v_mid, v_mid2, dst];

    match mode {
        ConnectorPathMode::Direct => direct,
        ConnectorPathMode::ElbowHorizontalFirst => horizontal_first,
        ConnectorPathMode::ElbowVerticalFirst => vertical_first,
        ConnectorPathMode::ElbowAuto => {
            let h = polyline_collision_score(&horizontal_first, text_rects, label_padding);
            let v = polyline_collision_score(&vertical_first, text_rects, label_padding);
            if h <= v {
                horizontal_first
            } else {
                vertical_first
            }
        }
    }
}

fn polyline_collision_score(
    pts: &[(f32, f32)],
    text_rects: &[(f32, f32, f32, f32)],
    label_padding: f32,
) -> f32 {
    if pts.len() < 2 {
        return 0.0;
    }
    let mut score = 0.0f32;
    for seg in pts.windows(2) {
        let a = seg[0];
        let b = seg[1];
        for tr in text_rects {
            if segment_near_rect(a, b, inflate_rect(*tr, label_padding.max(0.0))) {
                score += 1.0;
            }
        }
    }
    score
}

fn inflate_rect(rect: (f32, f32, f32, f32), pad: f32) -> (f32, f32, f32, f32) {
    (rect.0, rect.1, (rect.2 + pad * 2.0).max(1.0), (rect.3 + pad * 2.0).max(1.0))
}

fn rects_overlap(a: (f32, f32, f32, f32), b: (f32, f32, f32, f32)) -> bool {
    let ax0 = a.0 - a.2 * 0.5;
    let ax1 = a.0 + a.2 * 0.5;
    let ay0 = a.1 - a.3 * 0.5;
    let ay1 = a.1 + a.3 * 0.5;
    let bx0 = b.0 - b.2 * 0.5;
    let bx1 = b.0 + b.2 * 0.5;
    let by0 = b.1 - b.3 * 0.5;
    let by1 = b.1 + b.3 * 0.5;
    ax0 <= bx1 && ax1 >= bx0 && ay0 <= by1 && ay1 >= by0
}

fn point_segment_distance(p: (f32, f32), a: (f32, f32), b: (f32, f32)) -> f32 {
    let vx = b.0 - a.0;
    let vy = b.1 - a.1;
    let len2 = vx * vx + vy * vy;
    if len2 <= 1e-6 {
        let dx = p.0 - a.0;
        let dy = p.1 - a.1;
        return (dx * dx + dy * dy).sqrt();
    }
    let t = (((p.0 - a.0) * vx + (p.1 - a.1) * vy) / len2).clamp(0.0, 1.0);
    let cx = a.0 + t * vx;
    let cy = a.1 + t * vy;
    let dx = p.0 - cx;
    let dy = p.1 - cy;
    (dx * dx + dy * dy).sqrt()
}

fn closest_point_and_distance_on_segment(
    p: (f32, f32),
    a: (f32, f32),
    b: (f32, f32),
) -> ((f32, f32), f32) {
    let vx = b.0 - a.0;
    let vy = b.1 - a.1;
    let len2 = vx * vx + vy * vy;
    if len2 <= 1e-6 {
        let dx = p.0 - a.0;
        let dy = p.1 - a.1;
        let d = (dx * dx + dy * dy).sqrt();
        return (a, d);
    }
    let t = (((p.0 - a.0) * vx + (p.1 - a.1) * vy) / len2).clamp(0.0, 1.0);
    let cx = a.0 + t * vx;
    let cy = a.1 + t * vy;
    let dx = p.0 - cx;
    let dy = p.1 - cy;
    ((cx, cy), (dx * dx + dy * dy).sqrt())
}

fn segment_near_rect(a: (f32, f32), b: (f32, f32), rect: (f32, f32, f32, f32)) -> bool {
    let (cx, cy, w, h) = rect;
    let half_diag = ((w * 0.5).powi(2) + (h * 0.5).powi(2)).sqrt();
    point_segment_distance((cx, cy), a, b) <= half_diag
}

fn validate_preset_guardrails(spec: &AnimationSpec) -> Result<(), SceneError> {
    let has_explicit_targets = spec.to_x.is_some()
        || spec.to_y.is_some()
        || spec.to_scale_x.is_some()
        || spec.to_scale_y.is_some()
        || spec.to_rotation_deg.is_some()
        || spec.path_points.is_some();
    let has_entry_exit_customization = spec.shift_x.abs() > 1e-6
        || spec.shift_y.abs() > 1e-6
        || (spec.scale_from - 1.0).abs() > 1e-6
        || (spec.scale_to - 1.0).abs() > 1e-6;

    match spec.kind {
        AnimationKind::PresetTransitionMorph | AnimationKind::PresetTransitionCrossfade => {
            if spec.replace_with.is_none() {
                return Err(SceneError::InvalidTimeline(format!(
                    "transition preset on '{}' requires 'replace_with'",
                    spec.target
                )));
            }
            if has_explicit_targets {
                return Err(SceneError::InvalidTimeline(format!(
                    "transition preset on '{}' cannot be mixed with explicit transform/path target fields",
                    spec.target
                )));
            }
        }
        AnimationKind::PresetEnterSoft
        | AnimationKind::PresetEnterRise
        | AnimationKind::PresetExitSoft
        | AnimationKind::PresetExitDrop
        | AnimationKind::PresetEmphasisPulse
        | AnimationKind::PresetTextTypewriter
        | AnimationKind::PresetTextPopIn
        | AnimationKind::PresetTextGlowPulse
        | AnimationKind::PresetShapeDrawRect
        | AnimationKind::PresetShapeDrawSquare
        | AnimationKind::PresetShapeDrawCircle
        | AnimationKind::PresetShapeDrawLine
        | AnimationKind::PresetShapeDrawPolygon
        | AnimationKind::PresetArrowOutsidePoint
        | AnimationKind::PresetConnectorSafeRoute
        | AnimationKind::PresetBoxWithSubboxInside
        | AnimationKind::PresetBoxWithSubboxOverlap
        | AnimationKind::PresetFormulaStepReveal
        | AnimationKind::PresetVectorFlowBlockReveal
        | AnimationKind::PresetCameraPan
        | AnimationKind::PresetCameraZoom
        | AnimationKind::PresetParallaxDrift
        | AnimationKind::PresetChromaPulse
        | AnimationKind::PresetTransitionSwipe
        | AnimationKind::PresetTransitionWipe
        | AnimationKind::PresetTransitionPush
        | AnimationKind::PresetTransitionBlurFade
        | AnimationKind::PresetTransitionColorWash
        | AnimationKind::PresetMotionOrbitDrift
        | AnimationKind::PresetCameraSettle
        | AnimationKind::PresetElasticEmphasis
        | AnimationKind::PresetShotFront
        | AnimationKind::PresetShotBack
        | AnimationKind::PresetShotLeft
        | AnimationKind::PresetShotRight
        | AnimationKind::PresetShotLowHero
        | AnimationKind::PresetSpeedRamp
        | AnimationKind::PresetImpactSlowMo => {
            if spec.replace_with.is_some() {
                return Err(SceneError::InvalidTimeline(format!(
                    "preset on '{}' must not set 'replace_with'",
                    spec.target
                )));
            }
            if has_entry_exit_customization {
                return Err(SceneError::InvalidTimeline(format!(
                    "preset on '{}' should not include manual fade override fields",
                    spec.target
                )));
            }
        }
        _ => {}
    }

    if spec.layout_padding < 0.0 || spec.label_padding < 0.0 {
        return Err(SceneError::InvalidTimeline(format!(
            "preset on '{}' uses negative layout padding values",
            spec.target
        )));
    }
    if let Some(r) = spec.connector_elbow_ratio {
        if !(0.0..1.0).contains(&r) {
            return Err(SceneError::InvalidTimeline(format!(
                "preset on '{}' uses invalid connector_elbow_ratio {}, expected (0,1)",
                spec.target, r
            )));
        }
    }

    Ok(())
}

fn apply_float(layer: &mut ResolvedLayer, property: FloatProperty, value: f32) {
    match property {
        FloatProperty::X => layer.transform.x = value,
        FloatProperty::Y => layer.transform.y = value,
        FloatProperty::Z => {
            layer.transform.z = value;
            layer.world_z = value;
        }
        FloatProperty::ScaleX => layer.transform.scale_x = value,
        FloatProperty::ScaleY => layer.transform.scale_y = value,
        FloatProperty::RotationDeg => layer.transform.rotation_deg = value,
        FloatProperty::YawDeg => layer.transform.yaw_deg = value,
        FloatProperty::PitchDeg => layer.transform.pitch_deg = value,
        FloatProperty::RollDeg => layer.transform.roll_deg = value,
        FloatProperty::Opacity => layer.style.opacity = value.clamp(0.0, 1.0),
        FloatProperty::StrokeWidth => layer.style.stroke_width = value.max(0.0),
        FloatProperty::Width => {
            if let Primitive::Rect { width, .. } = &mut layer.primitive {
                *width = value.max(0.01);
            }
        }
        FloatProperty::Height => {
            if let Primitive::Rect { height, .. } = &mut layer.primitive {
                *height = value.max(0.01);
            }
        }
        FloatProperty::Radius => {
            if let Primitive::Circle { radius } = &mut layer.primitive {
                *radius = value.max(0.01);
            }
        }
        FloatProperty::RadiusX => {
            if let Primitive::Ellipse { radius_x, .. } = &mut layer.primitive {
                *radius_x = value.max(0.01);
            }
        }
        FloatProperty::RadiusY => {
            if let Primitive::Ellipse { radius_y, .. } = &mut layer.primitive {
                *radius_y = value.max(0.01);
            }
        }
        FloatProperty::FontSize => {
            if let Primitive::Text { font_size, .. } = &mut layer.primitive {
                *font_size = value.max(1.0);
            }
        }
        FloatProperty::X1 => {
            if let Primitive::Line { x1, .. } = &mut layer.primitive {
                *x1 = value;
            }
        }
        FloatProperty::Y1 => {
            if let Primitive::Line { y1, .. } = &mut layer.primitive {
                *y1 = value;
            }
        }
        FloatProperty::X2 => {
            if let Primitive::Line { x2, .. } = &mut layer.primitive {
                *x2 = value;
            }
        }
        FloatProperty::Y2 => {
            if let Primitive::Line { y2, .. } = &mut layer.primitive {
                *y2 = value;
            }
        }
        FloatProperty::TipLength => {
            if let Primitive::Arrow { tip_length, .. } = &mut layer.primitive {
                *tip_length = value.max(1.0);
            }
        }
        FloatProperty::TipWidth => {
            if let Primitive::Arrow { tip_width, .. } = &mut layer.primitive {
                *tip_width = value.max(1.0);
            }
        }
        FloatProperty::DrawProgress => {
            layer.style.draw_progress = value.clamp(0.0, 1.0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn camera_track_updates_zoom() {
        let scene = Scene {
            version: "v1".into(),
            canvas: Canvas {
                width: 1280,
                height: 720,
                fps: 30,
                background_rgba: [0, 0, 0, 255],
            },
            duration_seconds: 2.0,
            camera: CameraState::default(),
            layers: vec![],
            animations: vec![],
            camera_animations: vec![CameraTrack::Float {
                property: CameraProperty::Zoom,
                keyframes: vec![
                    FloatKeyframe {
                        t: 0.0,
                        value: 1.0,
                        easing_to_next: Easing::Linear,
                    },
                    FloatKeyframe {
                        t: 2.0,
                        value: 2.0,
                        easing_to_next: Easing::Linear,
                    },
                ],
            }],
            timeline: None,
        };
        let cam = scene.camera_at(1.0);
        assert!(cam.zoom > 1.4 && cam.zoom < 1.6);
    }

    #[test]
    fn timeline_create_affects_draw_progress() {
        let scene = Scene {
            version: "v1".into(),
            canvas: Canvas {
                width: 640,
                height: 360,
                fps: 30,
                background_rgba: [0, 0, 0, 255],
            },
            duration_seconds: 2.0,
            camera: CameraState::default(),
            layers: vec![Layer {
                id: "a".into(),
                z_index: 0,
                transform: Transform::default(),
                style: Style::default(),
                primitive: Primitive::Rect {
                    width: 10.0,
                    height: 10.0,
                    corner_radius: 0.0,
                },
            }],
            animations: vec![],
            camera_animations: vec![],
            timeline: Some(SceneTimeline {
                specs: vec![AnimationSpec {
                    target: "a".into(),
                    kind: AnimationKind::Create,
                    start: 0.0,
                    run_time: 2.0,
                    lag_ratio: 0.0,
                    group_index: 0,
                    group_size: 1,
                    easing: Easing::Linear,
                    shift_x: 0.0,
                    shift_y: 0.0,
                    scale_from: 1.0,
                    scale_to: 1.0,
                    path_arc_deg: 0.0,
                    path_points: None,
                    homotopy_amp_x: 0.0,
                    homotopy_amp_y: 0.0,
                    homotopy_freq: 1.0,
                    homotopy_phase_deg: 0.0,
                    replace_with: None,
                    to_x: None,
                    to_y: None,
                    to_scale_x: None,
                    to_scale_y: None,
                    to_rotation_deg: None,
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
                    layout_padding: 10.0,
                    label_padding: 16.0,
                    connector_side_preference: None,
                    connector_path_mode: None,
                    connector_elbow_ratio: None,
                }],
                lifecycle: vec![],
                segments: vec![],
                groups: vec![],
            }),
        };
        let frame = scene.resolve_at(1.0);
        assert!((frame[0].style.draw_progress - 1.0).abs() < 1e-4 || frame[0].style.draw_progress > 0.49);
    }

    #[test]
    fn lifecycle_replace_hides_source_and_shows_target() {
        let scene = Scene {
            version: "v1".into(),
            canvas: Canvas {
                width: 640,
                height: 360,
                fps: 30,
                background_rgba: [0, 0, 0, 255],
            },
            duration_seconds: 2.0,
            camera: CameraState::default(),
            layers: vec![
                Layer {
                    id: "from".into(),
                    z_index: 0,
                    transform: Transform::default(),
                    style: Style::default(),
                    primitive: Primitive::Rect {
                        width: 10.0,
                        height: 10.0,
                        corner_radius: 0.0,
                    },
                },
                Layer {
                    id: "to".into(),
                    z_index: 1,
                    transform: Transform::default(),
                    style: Style::default(),
                    primitive: Primitive::Rect {
                        width: 10.0,
                        height: 10.0,
                        corner_radius: 0.0,
                    },
                },
            ],
            animations: vec![],
            camera_animations: vec![],
            timeline: Some(SceneTimeline {
                specs: vec![],
                lifecycle: vec![LifecycleEvent {
                    t: 1.0,
                    action: LifecycleAction::Replace,
                    target: "from".into(),
                    with: Some("to".into()),
                }],
                segments: vec![],
                groups: vec![],
            }),
        };
        let before = scene.resolve_at(0.5);
        let after = scene.resolve_at(1.5);
        assert!(before.iter().any(|l| l.id == "from"));
        assert!(!before.iter().any(|l| l.id == "to"));
        assert!(!after.iter().any(|l| l.id == "from"));
        assert!(after.iter().any(|l| l.id == "to"));
    }

    #[test]
    fn move_along_path_updates_position() {
        let scene = Scene {
            version: "v1".into(),
            canvas: Canvas {
                width: 640,
                height: 360,
                fps: 30,
                background_rgba: [0, 0, 0, 255],
            },
            duration_seconds: 2.0,
            camera: CameraState::default(),
            layers: vec![Layer {
                id: "dot".into(),
                z_index: 0,
                transform: Transform::default(),
                style: Style::default(),
                primitive: Primitive::Circle { radius: 8.0 },
            }],
            animations: vec![],
            camera_animations: vec![],
            timeline: Some(SceneTimeline {
                specs: vec![AnimationSpec {
                    target: "dot".into(),
                    kind: AnimationKind::MoveAlongPath,
                    start: 0.0,
                    run_time: 2.0,
                    lag_ratio: 0.0,
                    group_index: 0,
                    group_size: 1,
                    easing: Easing::Linear,
                    shift_x: 0.0,
                    shift_y: 0.0,
                    scale_from: 1.0,
                    scale_to: 1.0,
                    path_arc_deg: 0.0,
                    path_points: Some(vec![[0.0, 0.0], [100.0, 0.0], [100.0, 100.0]]),
                    homotopy_amp_x: 0.0,
                    homotopy_amp_y: 0.0,
                    homotopy_freq: 1.0,
                    homotopy_phase_deg: 0.0,
                    replace_with: None,
                    to_x: None,
                    to_y: None,
                    to_scale_x: None,
                    to_scale_y: None,
                    to_rotation_deg: None,
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
                    layout_padding: 10.0,
                    label_padding: 16.0,
                    connector_side_preference: None,
                    connector_path_mode: None,
                    connector_elbow_ratio: None,
                }],
                lifecycle: vec![],
                segments: vec![],
                groups: vec![],
            }),
        };
        let frame = scene.resolve_at(1.0);
        assert!(frame[0].transform.x >= 95.0);
        assert!(frame[0].transform.y <= 5.0);
    }

    #[test]
    fn succession_group_staggers_specs() {
        let scene = Scene {
            version: "v1".into(),
            canvas: Canvas {
                width: 640,
                height: 360,
                fps: 30,
                background_rgba: [0, 0, 0, 255],
            },
            duration_seconds: 3.0,
            camera: CameraState::default(),
            layers: vec![
                Layer {
                    id: "a".into(),
                    z_index: 0,
                    transform: Transform::default(),
                    style: Style {
                        draw_progress: 0.0,
                        ..Style::default()
                    },
                    primitive: Primitive::Rect {
                        width: 10.0,
                        height: 10.0,
                        corner_radius: 0.0,
                    },
                },
                Layer {
                    id: "b".into(),
                    z_index: 0,
                    transform: Transform::default(),
                    style: Style {
                        draw_progress: 0.0,
                        ..Style::default()
                    },
                    primitive: Primitive::Rect {
                        width: 10.0,
                        height: 10.0,
                        corner_radius: 0.0,
                    },
                },
            ],
            animations: vec![],
            camera_animations: vec![],
            timeline: Some(SceneTimeline {
                specs: vec![
                    AnimationSpec {
                        target: "a".into(),
                        kind: AnimationKind::Create,
                        start: 0.0,
                        run_time: 1.0,
                        lag_ratio: 0.0,
                        group_index: 0,
                        group_size: 1,
                        easing: Easing::Linear,
                        shift_x: 0.0,
                        shift_y: 0.0,
                        scale_from: 1.0,
                        scale_to: 1.0,
                        path_arc_deg: 0.0,
                        path_points: None,
                        homotopy_amp_x: 0.0,
                        homotopy_amp_y: 0.0,
                        homotopy_freq: 1.0,
                        homotopy_phase_deg: 0.0,
                        replace_with: None,
                        to_x: None,
                        to_y: None,
                        to_scale_x: None,
                        to_scale_y: None,
                        to_rotation_deg: None,
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
                        layout_padding: 10.0,
                        label_padding: 16.0,
                        connector_side_preference: None,
                        connector_path_mode: None,
                        connector_elbow_ratio: None,
                    },
                    AnimationSpec {
                        target: "b".into(),
                        kind: AnimationKind::Create,
                        start: 0.0,
                        run_time: 1.0,
                        lag_ratio: 0.0,
                        group_index: 0,
                        group_size: 1,
                        easing: Easing::Linear,
                        shift_x: 0.0,
                        shift_y: 0.0,
                        scale_from: 1.0,
                        scale_to: 1.0,
                        path_arc_deg: 0.0,
                        path_points: None,
                        homotopy_amp_x: 0.0,
                        homotopy_amp_y: 0.0,
                        homotopy_freq: 1.0,
                        homotopy_phase_deg: 0.0,
                        replace_with: None,
                        to_x: None,
                        to_y: None,
                        to_scale_x: None,
                        to_scale_y: None,
                        to_rotation_deg: None,
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
                        layout_padding: 10.0,
                        label_padding: 16.0,
                        connector_side_preference: None,
                        connector_path_mode: None,
                        connector_elbow_ratio: None,
                    },
                ],
                lifecycle: vec![],
                segments: vec![],
                groups: vec![TimelineGroup {
                    mode: GroupMode::Succession,
                    start: 0.0,
                    run_time: 2.0,
                    lag_ratio: 0.0,
                    spec_indices: vec![0, 1],
                }],
            }),
        };
        let early = scene.resolve_at(0.5);
        let later = scene.resolve_at(1.5);
        let early_a = early.iter().find(|l| l.id == "a").unwrap().style.draw_progress;
        let early_b = early.iter().find(|l| l.id == "b").unwrap().style.draw_progress;
        let later_b = later.iter().find(|l| l.id == "b").unwrap().style.draw_progress;
        assert!(early_a > 0.4);
        assert!(early_b < 0.1);
        assert!(later_b > 0.4);
    }

    #[test]
    fn fade_transform_crossfades_to_target() {
        let scene = Scene {
            version: "v1".into(),
            canvas: Canvas {
                width: 640,
                height: 360,
                fps: 30,
                background_rgba: [0, 0, 0, 255],
            },
            duration_seconds: 2.0,
            camera: CameraState::default(),
            layers: vec![
                Layer {
                    id: "from".into(),
                    z_index: 0,
                    transform: Transform {
                        x: 100.0,
                        y: 0.0,
                        ..Transform::default()
                    },
                    style: Style::default(),
                    primitive: Primitive::Rect {
                        width: 10.0,
                        height: 10.0,
                        corner_radius: 0.0,
                    },
                },
                Layer {
                    id: "to".into(),
                    z_index: 0,
                    transform: Transform {
                        x: 300.0,
                        y: 0.0,
                        ..Transform::default()
                    },
                    style: Style {
                        opacity: 0.0,
                        ..Style::default()
                    },
                    primitive: Primitive::Rect {
                        width: 10.0,
                        height: 10.0,
                        corner_radius: 0.0,
                    },
                },
            ],
            animations: vec![],
            camera_animations: vec![],
            timeline: Some(SceneTimeline {
                specs: vec![AnimationSpec {
                    target: "from".into(),
                    kind: AnimationKind::FadeTransform,
                    start: 0.0,
                    run_time: 2.0,
                    lag_ratio: 0.0,
                    group_index: 0,
                    group_size: 1,
                    easing: Easing::Linear,
                    shift_x: 0.0,
                    shift_y: 0.0,
                    scale_from: 1.0,
                    scale_to: 1.0,
                    path_arc_deg: 0.0,
                    path_points: None,
                    homotopy_amp_x: 0.0,
                    homotopy_amp_y: 0.0,
                    homotopy_freq: 1.0,
                    homotopy_phase_deg: 0.0,
                    replace_with: Some("to".into()),
                    to_x: None,
                    to_y: None,
                    to_scale_x: None,
                    to_scale_y: None,
                    to_rotation_deg: None,
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
                    layout_padding: 10.0,
                    label_padding: 16.0,
                    connector_side_preference: None,
                    connector_path_mode: None,
                    connector_elbow_ratio: None,
                }],
                lifecycle: vec![],
                segments: vec![],
                groups: vec![],
            }),
        };
        let frame = scene.resolve_at(1.0);
        let src = frame.iter().find(|l| l.id == "from").unwrap();
        let dst = frame.iter().find(|l| l.id == "to").unwrap();
        assert!(src.style.opacity > 0.45 && src.style.opacity < 0.55);
        assert!(dst.style.opacity > 0.45 && dst.style.opacity < 0.55);
        assert!(src.transition_rank < dst.transition_rank);
    }

    #[test]
    fn show_increasing_subsets_advances_progress() {
        let scene = Scene {
            version: "v1".into(),
            canvas: Canvas {
                width: 640,
                height: 360,
                fps: 30,
                background_rgba: [0, 0, 0, 255],
            },
            duration_seconds: 2.0,
            camera: CameraState::default(),
            layers: vec![Layer {
                id: "path".into(),
                z_index: 0,
                transform: Transform::default(),
                style: Style {
                    draw_progress: 0.0,
                    ..Style::default()
                },
                primitive: Primitive::Polyline {
                    points: vec![[0.0, 0.0], [100.0, 0.0], [100.0, 60.0]],
                },
            }],
            animations: vec![],
            camera_animations: vec![],
            timeline: Some(SceneTimeline {
                specs: vec![AnimationSpec {
                    target: "path".into(),
                    kind: AnimationKind::ShowIncreasingSubsets,
                    start: 0.0,
                    run_time: 2.0,
                    lag_ratio: 0.0,
                    group_index: 0,
                    group_size: 1,
                    easing: Easing::Linear,
                    shift_x: 0.0,
                    shift_y: 0.0,
                    scale_from: 1.0,
                    scale_to: 1.0,
                    path_arc_deg: 0.0,
                    path_points: None,
                    homotopy_amp_x: 0.0,
                    homotopy_amp_y: 0.0,
                    homotopy_freq: 1.0,
                    homotopy_phase_deg: 0.0,
                    replace_with: None,
                    to_x: None,
                    to_y: None,
                    to_scale_x: None,
                    to_scale_y: None,
                    to_rotation_deg: None,
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
                    layout_padding: 10.0,
                    label_padding: 16.0,
                    connector_side_preference: None,
                    connector_path_mode: None,
                    connector_elbow_ratio: None,
                }],
                lifecycle: vec![],
                segments: vec![],
                groups: vec![],
            }),
        };
        let frame = scene.resolve_at(1.0);
        assert!(frame[0].style.draw_progress > 0.45 && frame[0].style.draw_progress < 0.55);
    }

    #[test]
    fn preset_enter_rise_changes_opacity_and_y() {
        let scene = Scene {
            version: "v1".into(),
            canvas: Canvas {
                width: 640,
                height: 360,
                fps: 30,
                background_rgba: [0, 0, 0, 255],
            },
            duration_seconds: 2.0,
            camera: CameraState::default(),
            layers: vec![Layer {
                id: "title".into(),
                z_index: 0,
                transform: Transform {
                    x: 200.0,
                    y: 200.0,
                    ..Transform::default()
                },
                style: Style {
                    opacity: 0.0,
                    ..Style::default()
                },
                primitive: Primitive::Text {
                    text: "A".into(),
                    font_size: 24.0,
                    font_family: None,
                    font_path: None,
                },
            }],
            animations: vec![],
            camera_animations: vec![],
            timeline: Some(SceneTimeline {
                specs: vec![AnimationSpec {
                    target: "title".into(),
                    kind: AnimationKind::PresetEnterRise,
                    start: 0.0,
                    run_time: 2.0,
                    lag_ratio: 0.0,
                    group_index: 0,
                    group_size: 1,
                    easing: Easing::Linear,
                    shift_x: 0.0,
                    shift_y: 0.0,
                    scale_from: 1.0,
                    scale_to: 1.0,
                    path_arc_deg: 0.0,
                    path_points: None,
                    homotopy_amp_x: 0.0,
                    homotopy_amp_y: 0.0,
                    homotopy_freq: 1.0,
                    homotopy_phase_deg: 0.0,
                    replace_with: None,
                    to_x: None,
                    to_y: None,
                    to_scale_x: None,
                    to_scale_y: None,
                    to_rotation_deg: None,
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
                    layout_padding: 10.0,
                    label_padding: 16.0,
                    connector_side_preference: None,
                    connector_path_mode: None,
                    connector_elbow_ratio: None,
                }],
                lifecycle: vec![],
                segments: vec![],
                groups: vec![],
            }),
        };
        let frame = scene.resolve_at(1.0);
        assert!(frame[0].style.opacity > 0.4);
        assert!(frame[0].transform.y < 200.0);
    }

    #[test]
    fn preset_transition_requires_replace_with() {
        let scene = Scene {
            version: "v1".into(),
            canvas: Canvas {
                width: 640,
                height: 360,
                fps: 30,
                background_rgba: [0, 0, 0, 255],
            },
            duration_seconds: 2.0,
            camera: CameraState::default(),
            layers: vec![Layer {
                id: "a".into(),
                z_index: 0,
                transform: Transform::default(),
                style: Style::default(),
                primitive: Primitive::Rect {
                    width: 10.0,
                    height: 10.0,
                    corner_radius: 0.0,
                },
            }],
            animations: vec![],
            camera_animations: vec![],
            timeline: Some(SceneTimeline {
                specs: vec![AnimationSpec {
                    target: "a".into(),
                    kind: AnimationKind::PresetTransitionCrossfade,
                    start: 0.0,
                    run_time: 1.0,
                    lag_ratio: 0.0,
                    group_index: 0,
                    group_size: 1,
                    easing: Easing::Linear,
                    shift_x: 0.0,
                    shift_y: 0.0,
                    scale_from: 1.0,
                    scale_to: 1.0,
                    path_arc_deg: 0.0,
                    path_points: None,
                    homotopy_amp_x: 0.0,
                    homotopy_amp_y: 0.0,
                    homotopy_freq: 1.0,
                    homotopy_phase_deg: 0.0,
                    replace_with: None,
                    to_x: None,
                    to_y: None,
                    to_scale_x: None,
                    to_scale_y: None,
                    to_rotation_deg: None,
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
                    layout_padding: 10.0,
                    label_padding: 16.0,
                    connector_side_preference: None,
                    connector_path_mode: None,
                    connector_elbow_ratio: None,
                }],
                lifecycle: vec![],
                segments: vec![],
                groups: vec![],
            }),
        };
        let err = scene.validate().unwrap_err();
        assert!(format!("{err}").contains("requires 'replace_with'"));
    }

    #[test]
    fn text_preset_rejects_non_text_layer() {
        let scene = Scene {
            version: "v1".into(),
            canvas: Canvas {
                width: 640,
                height: 360,
                fps: 30,
                background_rgba: [0, 0, 0, 255],
            },
            duration_seconds: 2.0,
            camera: CameraState::default(),
            layers: vec![Layer {
                id: "shape".into(),
                z_index: 0,
                transform: Transform::default(),
                style: Style::default(),
                primitive: Primitive::Rect {
                    width: 10.0,
                    height: 10.0,
                    corner_radius: 0.0,
                },
            }],
            animations: vec![],
            camera_animations: vec![],
            timeline: Some(SceneTimeline {
                specs: vec![AnimationSpec {
                    target: "shape".into(),
                    kind: AnimationKind::PresetTextTypewriter,
                    start: 0.0,
                    run_time: 1.0,
                    lag_ratio: 0.0,
                    group_index: 0,
                    group_size: 1,
                    easing: Easing::Linear,
                    shift_x: 0.0,
                    shift_y: 0.0,
                    scale_from: 1.0,
                    scale_to: 1.0,
                    path_arc_deg: 0.0,
                    path_points: None,
                    homotopy_amp_x: 0.0,
                    homotopy_amp_y: 0.0,
                    homotopy_freq: 1.0,
                    homotopy_phase_deg: 0.0,
                    replace_with: None,
                    to_x: None,
                    to_y: None,
                    to_scale_x: None,
                    to_scale_y: None,
                    to_rotation_deg: None,
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
                    layout_padding: 10.0,
                    label_padding: 16.0,
                    connector_side_preference: None,
                    connector_path_mode: None,
                    connector_elbow_ratio: None,
                }],
                lifecycle: vec![],
                segments: vec![],
                groups: vec![],
            }),
        };
        let err = scene.validate().unwrap_err();
        assert!(format!("{err}").contains("text preset"));
    }

    #[test]
    fn layout_target_must_exist_when_set() {
        let scene = Scene {
            version: "v1".into(),
            canvas: Canvas {
                width: 640,
                height: 360,
                fps: 30,
                background_rgba: [0, 0, 0, 255],
            },
            duration_seconds: 2.0,
            camera: CameraState::default(),
            layers: vec![Layer {
                id: "a".into(),
                z_index: 0,
                transform: Transform::default(),
                style: Style::default(),
                primitive: Primitive::Rect {
                    width: 80.0,
                    height: 60.0,
                    corner_radius: 0.0,
                },
            }],
            animations: vec![],
            camera_animations: vec![],
            timeline: Some(SceneTimeline {
                specs: vec![AnimationSpec {
                    target: "a".into(),
                    kind: AnimationKind::PresetShapeDrawRect,
                    start: 0.0,
                    run_time: 1.0,
                    lag_ratio: 0.0,
                    group_index: 0,
                    group_size: 1,
                    easing: Easing::Linear,
                    shift_x: 0.0,
                    shift_y: 0.0,
                    scale_from: 1.0,
                    scale_to: 1.0,
                    path_arc_deg: 0.0,
                    path_points: None,
                    homotopy_amp_x: 0.0,
                    homotopy_amp_y: 0.0,
                    homotopy_freq: 1.0,
                    homotopy_phase_deg: 0.0,
                    replace_with: None,
                    to_x: None,
                    to_y: None,
                    to_scale_x: None,
                    to_scale_y: None,
                    to_rotation_deg: None,
                    axis_x: None,
                    axis_y: None,
                    axis_width: None,
                    axis_height: None,
                    label_text: None,
                    layout_target: Some("missing".into()),
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
                    layout_padding: 10.0,
                    label_padding: 16.0,
                    connector_side_preference: None,
                    connector_path_mode: None,
                    connector_elbow_ratio: None,
                }],
                lifecycle: vec![],
                segments: vec![],
                groups: vec![],
            }),
        };
        let err = scene.validate().unwrap_err();
        assert!(matches!(err, SceneError::MissingLayer(_)));
    }

    #[test]
    fn preset_arrow_outside_moves_endpoint_to_shape_boundary() {
        let scene = Scene {
            version: "v1".into(),
            canvas: Canvas {
                width: 1280,
                height: 720,
                fps: 30,
                background_rgba: [0, 0, 0, 255],
            },
            duration_seconds: 2.0,
            camera: CameraState::default(),
            layers: vec![
                Layer {
                    id: "box".into(),
                    z_index: 0,
                    transform: Transform {
                        x: 800.0,
                        y: 360.0,
                        scale_x: 1.0,
                        scale_y: 1.0,
                        rotation_deg: 0.0,
                    },
                    style: Style::default(),
                    primitive: Primitive::Rect {
                        width: 300.0,
                        height: 200.0,
                        corner_radius: 8.0,
                    },
                },
                Layer {
                    id: "arrow".into(),
                    z_index: 1,
                    transform: Transform {
                        x: 300.0,
                        y: 360.0,
                        scale_x: 1.0,
                        scale_y: 1.0,
                        rotation_deg: 0.0,
                    },
                    style: Style::default(),
                    primitive: Primitive::Arrow {
                        x1: 0.0,
                        y1: 0.0,
                        x2: 120.0,
                        y2: 0.0,
                        tip_length: 18.0,
                        tip_width: 12.0,
                    },
                },
            ],
            animations: vec![],
            camera_animations: vec![],
            timeline: Some(SceneTimeline {
                specs: vec![AnimationSpec {
                    target: "arrow".into(),
                    kind: AnimationKind::PresetArrowOutsidePoint,
                    start: 0.0,
                    run_time: 1.0,
                    lag_ratio: 0.0,
                    group_index: 0,
                    group_size: 1,
                    easing: Easing::Linear,
                    shift_x: 0.0,
                    shift_y: 0.0,
                    scale_from: 1.0,
                    scale_to: 1.0,
                    path_arc_deg: 0.0,
                    path_points: None,
                    homotopy_amp_x: 0.0,
                    homotopy_amp_y: 0.0,
                    homotopy_freq: 1.0,
                    homotopy_phase_deg: 0.0,
                    replace_with: None,
                    to_x: None,
                    to_y: None,
                    to_scale_x: None,
                    to_scale_y: None,
                    to_rotation_deg: None,
                    axis_x: Some(260.0),
                    axis_y: Some(360.0),
                    axis_width: None,
                    axis_height: None,
                    label_text: None,
                    layout_target: Some("box".into()),
                    sub_box_mode: None,
                    sub_box_offset_x: None,
                    sub_box_offset_y: None,
                    sub_box_width: None,
                    sub_box_height: None,
                    preset_fill_rgba: None,
                    preset_stroke_rgba: None,
                    preset_text_rgba: None,
                    avoid_overlap: true,
                    arrows_outside: true,
                    layout_padding: 16.0,
                    label_padding: 16.0,
                    connector_side_preference: None,
                    connector_path_mode: None,
                    connector_elbow_ratio: None,
                }],
                lifecycle: vec![],
                segments: vec![],
                groups: vec![],
            }),
        };

        let out = scene.resolve_at(1.0);
        let arrow = out.iter().find(|l| l.id == "arrow").unwrap();
        if let Primitive::Arrow { x2, y2, .. } = arrow.primitive {
            let end_x = arrow.transform.x + x2;
            let end_y = arrow.transform.y + y2;
            // Outside-boundary routing should place endpoint near left boundary of the box.
            assert!(end_x < 800.0);
            assert!((end_y - 360.0).abs() < 120.0);
        } else {
            panic!("arrow primitive expected");
        }
    }
}
