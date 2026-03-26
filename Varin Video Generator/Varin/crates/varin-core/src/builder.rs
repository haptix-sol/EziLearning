use crate::{
    AnimationKind, AnimationSpec, CameraState, Canvas, Easing, Layer, LifecycleAction, LifecycleEvent,
    GroupMode, Primitive, Scene, SceneTimeline, Style, TimelineGroup, TimelineSegment, Transform,
};

#[derive(Debug, Clone)]
pub struct SceneBuilder {
    scene: Scene,
    cursor: f32,
}

impl SceneBuilder {
    pub fn new(width: u32, height: u32, fps: u32) -> Self {
        Self {
            scene: Scene {
                version: "v1".to_string(),
                canvas: Canvas {
                    width,
                    height,
                    fps,
                    background_rgba: [24, 24, 36, 255],
                },
                duration_seconds: 1.0,
                camera: CameraState::default(),
                layers: vec![],
                animations: vec![],
                camera_animations: vec![],
                timeline: Some(SceneTimeline {
                    specs: vec![],
                    lifecycle: vec![],
                    segments: vec![],
                    groups: vec![],
                }),
            },
            cursor: 0.0,
        }
    }

    pub fn with_background(mut self, rgba: [u8; 4]) -> Self {
        self.scene.canvas.background_rgba = rgba;
        self
    }

    pub fn add_layer(mut self, layer: Layer) -> Self {
        self.scene.layers.push(layer);
        self
    }

    pub fn add(mut self, layer: Layer) -> Self {
        let id = layer.id.clone();
        self.scene.layers.push(layer);
        if let Some(tl) = self.scene.timeline.as_mut() {
            tl.lifecycle.push(LifecycleEvent {
                t: self.cursor,
                action: LifecycleAction::Add,
                target: id,
                with: None,
            });
        }
        self
    }

    pub fn remove(mut self, target: &str) -> Self {
        if let Some(tl) = self.scene.timeline.as_mut() {
            tl.lifecycle.push(LifecycleEvent {
                t: self.cursor,
                action: LifecycleAction::Remove,
                target: target.to_string(),
                with: None,
            });
        }
        self
    }

    pub fn replace(mut self, target: &str, with: &str) -> Self {
        if let Some(tl) = self.scene.timeline.as_mut() {
            tl.lifecycle.push(LifecycleEvent {
                t: self.cursor,
                action: LifecycleAction::Replace,
                target: target.to_string(),
                with: Some(with.to_string()),
            });
        }
        self
    }

    pub fn wait(mut self, duration: f32) -> Self {
        let d = duration.max(0.0);
        if let Some(tl) = self.scene.timeline.as_mut() {
            tl.segments.push(TimelineSegment::Wait {
                start: self.cursor,
                duration: d,
            });
        }
        self.cursor += d;
        self
    }

    pub fn play(mut self, mut specs: Vec<AnimationSpec>, run_time: f32) -> Self {
        let rt = run_time.max(0.01);
        let group_size = specs.len().max(1);
        if let Some(tl) = self.scene.timeline.as_mut() {
            let start_index = tl.specs.len();
            for (idx, spec) in specs.iter_mut().enumerate() {
                spec.start = self.cursor;
                spec.run_time = rt;
                spec.group_size = group_size;
                spec.group_index = idx;
                tl.specs.push(spec.clone());
            }
            tl.segments.push(TimelineSegment::Play {
                start: self.cursor,
                run_time: rt,
                spec_indices: (start_index..start_index + group_size).collect(),
            });
        }
        self.cursor += rt;
        self
    }

    pub fn play_staggered(
        mut self,
        mut specs: Vec<AnimationSpec>,
        run_time: f32,
        lag_ratio: f32,
    ) -> Self {
        let rt = run_time.max(0.01);
        let lag = lag_ratio.clamp(0.0, 1.0);
        let n = specs.len().max(1);
        if let Some(tl) = self.scene.timeline.as_mut() {
            let start_index = tl.specs.len();
            for (idx, spec) in specs.iter_mut().enumerate() {
                let offset = if n <= 1 {
                    0.0
                } else {
                    (idx as f32) * lag * (rt / n as f32)
                };
                spec.start = self.cursor + offset;
                spec.run_time = rt;
                spec.group_size = n;
                spec.group_index = idx;
                spec.lag_ratio = lag;
                tl.specs.push(spec.clone());
            }
            let span = rt + if n <= 1 { 0.0 } else { lag * (rt / n as f32) * (n as f32 - 1.0) };
            tl.segments.push(TimelineSegment::Play {
                start: self.cursor,
                run_time: span.max(rt),
                spec_indices: (start_index..start_index + n).collect(),
            });
            self.cursor += span.max(rt);
        } else {
            self.cursor += rt;
        }
        self
    }

    pub fn animation_group(
        mut self,
        spec_indices: Vec<usize>,
        run_time: f32,
        lag_ratio: f32,
    ) -> Self {
        if let Some(tl) = self.scene.timeline.as_mut() {
            tl.groups.push(TimelineGroup {
                mode: GroupMode::AnimationGroup,
                start: self.cursor,
                run_time: run_time.max(0.01),
                lag_ratio: lag_ratio.clamp(0.0, 1.0),
                spec_indices,
            });
        }
        self
    }

    pub fn succession(mut self, spec_indices: Vec<usize>, run_time: f32) -> Self {
        if let Some(tl) = self.scene.timeline.as_mut() {
            tl.groups.push(TimelineGroup {
                mode: GroupMode::Succession,
                start: self.cursor,
                run_time: run_time.max(0.01),
                lag_ratio: 0.0,
                spec_indices,
            });
        }
        self
    }

    pub fn arrange_horizontal(mut self, layer_ids: &[&str], spacing: f32, center_x: f32, y: f32) -> Self {
        if layer_ids.is_empty() {
            return self;
        }
        let mut widths = Vec::with_capacity(layer_ids.len());
        for id in layer_ids {
            let w = self
                .scene
                .layers
                .iter()
                .find(|l| l.id == *id)
                .map(layer_width)
                .unwrap_or(64.0);
            widths.push(w.max(1.0));
        }
        let total: f32 = widths.iter().sum::<f32>() + spacing.max(0.0) * (layer_ids.len().saturating_sub(1) as f32);
        let mut cursor = center_x - total * 0.5;
        for (idx, id) in layer_ids.iter().enumerate() {
            if let Some(layer) = self.scene.layers.iter_mut().find(|l| l.id == *id) {
                let w = widths[idx];
                layer.transform.x = cursor + w * 0.5;
                layer.transform.y = y;
                cursor += w + spacing.max(0.0);
            }
        }
        self
    }

    pub fn arrange_vertical(mut self, layer_ids: &[&str], spacing: f32, x: f32, center_y: f32) -> Self {
        if layer_ids.is_empty() {
            return self;
        }
        let mut heights = Vec::with_capacity(layer_ids.len());
        for id in layer_ids {
            let h = self
                .scene
                .layers
                .iter()
                .find(|l| l.id == *id)
                .map(layer_height)
                .unwrap_or(36.0);
            heights.push(h.max(1.0));
        }
        let total: f32 = heights.iter().sum::<f32>() + spacing.max(0.0) * (layer_ids.len().saturating_sub(1) as f32);
        let mut cursor = center_y - total * 0.5;
        for (idx, id) in layer_ids.iter().enumerate() {
            if let Some(layer) = self.scene.layers.iter_mut().find(|l| l.id == *id) {
                let h = heights[idx];
                layer.transform.x = x;
                layer.transform.y = cursor + h * 0.5;
                cursor += h + spacing.max(0.0);
            }
        }
        self
    }

    pub fn next_to(mut self, target: &str, anchor: &str, dx: f32, dy: f32, buff: f32) -> Self {
        let anchor_layer = self.scene.layers.iter().find(|l| l.id == anchor).cloned();
        if let Some(anchor_layer) = anchor_layer {
            if let Some(target_layer) = self.scene.layers.iter_mut().find(|l| l.id == target) {
                let aw = layer_width(&anchor_layer);
                let ah = layer_height(&anchor_layer);
                let tw = layer_width(target_layer);
                let th = layer_height(target_layer);
                let nx = dx.signum();
                let ny = dy.signum();
                let gap = buff.max(0.0);
                target_layer.transform.x = anchor_layer.transform.x + nx * ((aw + tw) * 0.5 + gap);
                target_layer.transform.y = anchor_layer.transform.y + ny * ((ah + th) * 0.5 + gap);
            }
        }
        self
    }

    pub fn build(mut self) -> Scene {
        self.scene.duration_seconds = self.cursor.max(0.1);
        self.scene
    }
}

pub fn layer_rect(id: &str, width: f32, height: f32, x: f32, y: f32, z_index: i32) -> Layer {
    Layer {
        id: id.to_string(),
        z_index,
        transform: Transform {
            x,
            y,
            scale_x: 1.0,
            scale_y: 1.0,
            ..Default::default()
        },
        style: Style::default(),
        primitive: Primitive::Rect {
            width,
            height,
            corner_radius: 0.0,
        },
    }
}

pub fn layer_text(id: &str, text: &str, font_size: f32, x: f32, y: f32, z_index: i32) -> Layer {
    Layer {
        id: id.to_string(),
        z_index,
        transform: Transform {
            x,
            y,
            scale_x: 1.0,
            scale_y: 1.0,
            ..Default::default()
        },
        style: Style::default(),
        primitive: Primitive::Text {
            text: text.to_string(),
            font_size,
            font_family: None,
            font_path: None,
        },
    }
}

pub fn layer_text_with_font(
    id: &str,
    text: &str,
    font_size: f32,
    x: f32,
    y: f32,
    z_index: i32,
    font_family: Option<&str>,
    font_path: Option<&str>,
) -> Layer {
    Layer {
        id: id.to_string(),
        z_index,
        transform: Transform {
            x,
            y,
            scale_x: 1.0,
            scale_y: 1.0,
            ..Default::default()
        },
        style: Style::default(),
        primitive: Primitive::Text {
            text: text.to_string(),
            font_size,
            font_family: font_family.map(|v| v.to_string()),
            font_path: font_path.map(|v| v.to_string()),
        },
    }
}

pub fn create(target: &str, easing: Easing) -> AnimationSpec {
    AnimationSpec {
        target: target.to_string(),
        kind: AnimationKind::Create,
        start: 0.0,
        run_time: 1.0,
        lag_ratio: 0.0,
        group_index: 0,
        group_size: 1,
        easing,
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
    }
}

pub fn write(target: &str, easing: Easing) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::Write,
        ..create(target, easing)
    }
}

pub fn show_increasing_subsets(target: &str, easing: Easing) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::ShowIncreasingSubsets,
        ..create(target, easing)
    }
}

pub fn draw_border_then_fill(target: &str, easing: Easing) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::DrawBorderThenFill,
        ..create(target, easing)
    }
}

pub fn fade_in(target: &str, shift_x: f32, shift_y: f32, scale_from: f32, easing: Easing) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::FadeIn,
        shift_x,
        shift_y,
        scale_from,
        ..create(target, easing)
    }
}

pub fn fade_out(target: &str, shift_x: f32, shift_y: f32, easing: Easing) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::FadeOut,
        shift_x,
        shift_y,
        scale_to: 0.8,
        ..create(target, easing)
    }
}

pub fn transform_to(
    target: &str,
    to_x: Option<f32>,
    to_y: Option<f32>,
    to_scale_x: Option<f32>,
    to_scale_y: Option<f32>,
    to_rotation_deg: Option<f32>,
    easing: Easing,
) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::Transform,
        to_x,
        to_y,
        to_scale_x,
        to_scale_y,
        to_rotation_deg,
        ..create(target, easing)
    }
}

pub fn replacement_transform(target: &str, replace_with: &str, easing: Easing) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::ReplacementTransform,
        replace_with: Some(replace_with.to_string()),
        ..create(target, easing)
    }
}

pub fn fade_transform(target: &str, replace_with: &str, easing: Easing) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::FadeTransform,
        replace_with: Some(replace_with.to_string()),
        ..create(target, easing)
    }
}

pub fn fade_transform_pieces(target: &str, replace_with: &str, easing: Easing) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::FadeTransformPieces,
        replace_with: Some(replace_with.to_string()),
        ..create(target, easing)
    }
}

pub fn rotate_to(target: &str, to_rotation_deg: f32, easing: Easing) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::Rotate,
        to_rotation_deg: Some(to_rotation_deg),
        ..create(target, easing)
    }
}

pub fn grow_from_center(target: &str, easing: Easing) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::GrowFromCenter,
        ..create(target, easing)
    }
}

pub fn grow_from_point(target: &str, from_x: f32, from_y: f32, easing: Easing) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::GrowFromPoint,
        to_x: Some(from_x),
        to_y: Some(from_y),
        ..create(target, easing)
    }
}

pub fn move_along_path(target: &str, path_points: Vec<[f32; 2]>, easing: Easing) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::MoveAlongPath,
        path_points: Some(path_points),
        ..create(target, easing)
    }
}

pub fn homotopy_wave(
    target: &str,
    amp_x: f32,
    amp_y: f32,
    freq: f32,
    phase_deg: f32,
    easing: Easing,
) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::Homotopy,
        homotopy_amp_x: amp_x,
        homotopy_amp_y: amp_y,
        homotopy_freq: freq.max(0.0),
        homotopy_phase_deg: phase_deg,
        ..create(target, easing)
    }
}

pub fn phase_flow(
    target: &str,
    drift_x: f32,
    drift_y: f32,
    amp_x: f32,
    amp_y: f32,
    freq: f32,
    easing: Easing,
) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::PhaseFlow,
        to_x: Some(drift_x),
        to_y: Some(drift_y),
        homotopy_amp_x: amp_x,
        homotopy_amp_y: amp_y,
        homotopy_freq: freq.max(0.0),
        ..create(target, easing)
    }
}

pub fn vfade_in(target: &str, easing: Easing) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::VFadeIn,
        ..create(target, easing)
    }
}

pub fn vfade_out(target: &str, easing: Easing) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::VFadeOut,
        ..create(target, easing)
    }
}

pub fn preset_enter_soft(target: &str) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::PresetEnterSoft,
        easing: Easing::EaseOut,
        ..create(target, Easing::EaseOut)
    }
}

pub fn preset_enter_rise(target: &str) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::PresetEnterRise,
        easing: Easing::EaseOut,
        ..create(target, Easing::EaseOut)
    }
}

pub fn preset_exit_soft(target: &str) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::PresetExitSoft,
        easing: Easing::EaseIn,
        ..create(target, Easing::EaseIn)
    }
}

pub fn preset_exit_drop(target: &str) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::PresetExitDrop,
        easing: Easing::EaseIn,
        ..create(target, Easing::EaseIn)
    }
}

pub fn preset_emphasis_pulse(target: &str) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::PresetEmphasisPulse,
        easing: Easing::ThereAndBack,
        ..create(target, Easing::ThereAndBack)
    }
}

pub fn preset_transition_morph(target: &str, replace_with: &str) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::PresetTransitionMorph,
        replace_with: Some(replace_with.to_string()),
        easing: Easing::EaseInOut,
        ..create(target, Easing::EaseInOut)
    }
}

pub fn preset_transition_crossfade(target: &str, replace_with: &str) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::PresetTransitionCrossfade,
        replace_with: Some(replace_with.to_string()),
        easing: Easing::EaseInOut,
        ..create(target, Easing::EaseInOut)
    }
}

pub fn preset_text_typewriter(target: &str) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::PresetTextTypewriter,
        easing: Easing::Linear,
        ..create(target, Easing::Linear)
    }
}

pub fn preset_text_pop_in(target: &str) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::PresetTextPopIn,
        easing: Easing::EaseOut,
        ..create(target, Easing::EaseOut)
    }
}

pub fn preset_text_glow_pulse(target: &str) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::PresetTextGlowPulse,
        easing: Easing::ThereAndBack,
        ..create(target, Easing::ThereAndBack)
    }
}

pub fn preset_shape_draw_rect(target: &str, axis_x: f32, axis_y: f32, width: f32, height: f32) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::PresetShapeDrawRect,
        axis_x: Some(axis_x),
        axis_y: Some(axis_y),
        axis_width: Some(width.max(1.0)),
        axis_height: Some(height.max(1.0)),
        easing: Easing::EaseInOut,
        ..create(target, Easing::EaseInOut)
    }
}

pub fn preset_shape_draw_square(target: &str, axis_x: f32, axis_y: f32, side: f32) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::PresetShapeDrawSquare,
        axis_x: Some(axis_x),
        axis_y: Some(axis_y),
        axis_width: Some(side.max(1.0)),
        axis_height: Some(side.max(1.0)),
        easing: Easing::EaseInOut,
        ..create(target, Easing::EaseInOut)
    }
}

pub fn preset_shape_draw_circle(target: &str, axis_x: f32, axis_y: f32, diameter: f32) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::PresetShapeDrawCircle,
        axis_x: Some(axis_x),
        axis_y: Some(axis_y),
        axis_width: Some(diameter.max(1.0)),
        axis_height: Some(diameter.max(1.0)),
        easing: Easing::EaseInOut,
        ..create(target, Easing::EaseInOut)
    }
}

pub fn preset_arrow_outside_point(
    target: &str,
    from_x: f32,
    from_y: f32,
    target_layer: &str,
    arrows_outside: bool,
    avoid_overlap: bool,
) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::PresetArrowOutsidePoint,
        axis_x: Some(from_x),
        axis_y: Some(from_y),
        layout_target: Some(target_layer.to_string()),
        arrows_outside,
        avoid_overlap,
        easing: Easing::EaseInOut,
        ..create(target, Easing::EaseInOut)
    }
}

pub fn preset_box_with_subbox_inside(
    target: &str,
    parent_box_layer: &str,
    sub_box_width: f32,
    sub_box_height: f32,
    offset_x: f32,
    offset_y: f32,
) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::PresetBoxWithSubboxInside,
        layout_target: Some(parent_box_layer.to_string()),
        sub_box_mode: Some(crate::SubBoxMode::Inside),
        sub_box_width: Some(sub_box_width.max(4.0)),
        sub_box_height: Some(sub_box_height.max(4.0)),
        sub_box_offset_x: Some(offset_x),
        sub_box_offset_y: Some(offset_y),
        easing: Easing::EaseInOut,
        ..create(target, Easing::EaseInOut)
    }
}

pub fn preset_box_with_subbox_overlap(
    target: &str,
    parent_box_layer: &str,
    sub_box_width: f32,
    sub_box_height: f32,
    offset_x: f32,
    offset_y: f32,
) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::PresetBoxWithSubboxOverlap,
        layout_target: Some(parent_box_layer.to_string()),
        sub_box_mode: Some(crate::SubBoxMode::Overlap),
        sub_box_width: Some(sub_box_width.max(4.0)),
        sub_box_height: Some(sub_box_height.max(4.0)),
        sub_box_offset_x: Some(offset_x),
        sub_box_offset_y: Some(offset_y),
        easing: Easing::EaseInOut,
        ..create(target, Easing::EaseInOut)
    }
}

pub fn preset_formula_step_reveal(target: &str, label_text: &str) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::PresetFormulaStepReveal,
        label_text: Some(label_text.to_string()),
        easing: Easing::EaseOut,
        ..create(target, Easing::EaseOut)
    }
}

pub fn preset_vector_flow_block_reveal(target: &str, axis_x: f32, axis_y: f32) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::PresetVectorFlowBlockReveal,
        axis_x: Some(axis_x),
        axis_y: Some(axis_y),
        easing: Easing::EaseOut,
        ..create(target, Easing::EaseOut)
    }
}

#[derive(Debug, Clone, Copy)]
pub struct MotifPalette {
    pub primary_fill: [u8; 4],
    pub primary_stroke: [u8; 4],
    pub secondary_fill: [u8; 4],
    pub secondary_stroke: [u8; 4],
    pub text: [u8; 4],
}

impl Default for MotifPalette {
    fn default() -> Self {
        Self {
            primary_fill: [64, 126, 224, 76],
            primary_stroke: [146, 205, 255, 255],
            secondary_fill: [74, 176, 132, 76],
            secondary_stroke: [158, 236, 198, 255],
            text: [228, 240, 255, 255],
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct VisualTheme {
    pub background: [u8; 4],
    pub primary_fill: [u8; 4],
    pub primary_stroke: [u8; 4],
    pub accent_fill: [u8; 4],
    pub accent_stroke: [u8; 4],
    pub text: [u8; 4],
    pub glow_alpha: u8,
    pub depth_offset: f32,
}

impl Default for VisualTheme {
    fn default() -> Self {
        Self {
            background: [8, 14, 30, 255],
            primary_fill: [64, 126, 224, 86],
            primary_stroke: [146, 205, 255, 255],
            accent_fill: [74, 176, 132, 86],
            accent_stroke: [158, 236, 198, 255],
            text: [230, 242, 255, 255],
            glow_alpha: 72,
            depth_offset: 8.0,
        }
    }
}

pub fn visual_theme_neon() -> VisualTheme {
    VisualTheme {
        background: [10, 14, 34, 255],
        primary_fill: [26, 38, 112, 100],
        primary_stroke: [82, 228, 255, 255],
        accent_fill: [52, 152, 92, 98],
        accent_stroke: [176, 255, 126, 255],
        text: [236, 252, 255, 255],
        glow_alpha: 108,
        depth_offset: 10.0,
    }
}

pub fn component_scene_title(prefix: &str, text: &str, x: f32, y: f32, theme: VisualTheme) -> Vec<Layer> {
    let mut out = Vec::new();
    let mut glow = layer_rect(
        &format!("{prefix}_title_glow"),
        880.0,
        90.0,
        x + theme.depth_offset,
        y + theme.depth_offset * 0.4,
        0,
    );
    glow.style.fill_rgba = [theme.primary_stroke[0], theme.primary_stroke[1], theme.primary_stroke[2], theme.glow_alpha];
    glow.style.stroke_rgba = [0, 0, 0, 0];
    glow.style.opacity = 0.0;
    glow.style.draw_progress = 0.0;
    out.push(glow);

    let mut title = layer_text(&format!("{prefix}_title"), text, 52.0, x, y, 1);
    title.style.fill_rgba = theme.text;
    title.style.opacity = 0.0;
    title.style.draw_progress = 0.0;
    out.push(title);
    out
}

pub fn component_card(prefix: &str, text: &str, x: f32, y: f32, w: f32, h: f32, theme: VisualTheme) -> Vec<Layer> {
    let mut out = Vec::new();
    let mut shadow = layer_rect(
        &format!("{prefix}_shadow"),
        w.max(20.0),
        h.max(20.0),
        x + theme.depth_offset,
        y + theme.depth_offset,
        0,
    );
    shadow.style.fill_rgba = [0, 0, 0, 70];
    shadow.style.stroke_rgba = [0, 0, 0, 0];
    shadow.style.opacity = 0.0;
    shadow.style.draw_progress = 0.0;
    out.push(shadow);

    let mut body = layer_rect(&format!("{prefix}_body"), w.max(20.0), h.max(20.0), x, y, 1);
    body.style.fill_rgba = theme.primary_fill;
    body.style.stroke_rgba = theme.primary_stroke;
    body.style.stroke_width = 2.0;
    body.style.opacity = 0.0;
    body.style.draw_progress = 0.0;
    out.push(body);

    let mut label = layer_text(&format!("{prefix}_text"), text, 22.0, x, y, 2);
    label.style.fill_rgba = theme.text;
    label.style.opacity = 0.0;
    label.style.draw_progress = 0.0;
    out.push(label);
    out
}

pub fn component_metric_tile(prefix: &str, label: &str, value: &str, x: f32, y: f32, theme: VisualTheme) -> Vec<Layer> {
    let mut out = component_card(prefix, label, x, y, 300.0, 120.0, theme);
    let mut value_layer = layer_text(&format!("{prefix}_value"), value, 34.0, x, y + 22.0, 3);
    value_layer.style.fill_rgba = theme.accent_stroke;
    value_layer.style.opacity = 0.0;
    value_layer.style.draw_progress = 0.0;
    out.push(value_layer);
    out
}

pub fn component_callout(prefix: &str, text: &str, x: f32, y: f32, theme: VisualTheme) -> Vec<Layer> {
    component_card(prefix, text, x, y, 420.0, 96.0, theme)
}

pub fn component_grid(prefix: &str, labels: &[&str], x: f32, y: f32, theme: VisualTheme) -> Vec<Layer> {
    let mut out = Vec::new();
    for (idx, label) in labels.iter().enumerate() {
        let col = idx % 2;
        let row = idx / 2;
        let cx = x - 170.0 + col as f32 * 340.0;
        let cy = y - 84.0 + row as f32 * 110.0;
        let mut card = layer_rect(&format!("{prefix}_cell_{}", idx + 1), 300.0, 84.0, cx, cy, 1);
        card.style.fill_rgba = theme.accent_fill;
        card.style.stroke_rgba = theme.accent_stroke;
        card.style.stroke_width = 2.0;
        card.style.opacity = 0.0;
        card.style.draw_progress = 0.0;
        out.push(card);
        let mut txt = layer_text(&format!("{prefix}_cell_t_{}", idx + 1), label, 20.0, cx, cy, 2);
        txt.style.fill_rgba = theme.text;
        txt.style.opacity = 0.0;
        txt.style.draw_progress = 0.0;
        out.push(txt);
    }
    out
}

pub fn component_flow(prefix: &str, labels: &[&str], start_x: f32, y: f32, spacing: f32, theme: VisualTheme) -> Vec<Layer> {
    let mut out = Vec::new();
    for (idx, label) in labels.iter().enumerate() {
        let x = start_x + idx as f32 * spacing.max(1.0);
        let mut block = layer_rect(&format!("{prefix}_node_{}", idx + 1), 200.0, 90.0, x, y, 1);
        block.style.fill_rgba = theme.primary_fill;
        block.style.stroke_rgba = theme.primary_stroke;
        block.style.stroke_width = 2.0;
        block.style.opacity = 0.0;
        block.style.draw_progress = 0.0;
        out.push(block);
        let mut txt = layer_text(&format!("{prefix}_node_t_{}", idx + 1), label, 20.0, x, y, 2);
        txt.style.fill_rgba = theme.text;
        txt.style.opacity = 0.0;
        txt.style.draw_progress = 0.0;
        out.push(txt);
    }
    out
}

pub fn motif_safe_connector(
    target: &str,
    from_x: f32,
    from_y: f32,
    layout_target: &str,
    side: crate::ConnectorSidePreference,
    mode: crate::ConnectorPathMode,
) -> AnimationSpec {
    AnimationSpec {
        kind: AnimationKind::PresetConnectorSafeRoute,
        axis_x: Some(from_x),
        axis_y: Some(from_y),
        layout_target: Some(layout_target.to_string()),
        arrows_outside: true,
        avoid_overlap: true,
        layout_padding: 18.0,
        label_padding: 20.0,
        connector_side_preference: Some(side),
        connector_path_mode: Some(mode),
        connector_elbow_ratio: Some(0.55),
        easing: Easing::EaseInOut,
        ..create(target, Easing::EaseInOut)
    }
}

pub fn motif_house_layers(prefix: &str, center_x: f32, center_y: f32, palette: MotifPalette) -> Vec<Layer> {
    let mut body = layer_rect(
        &format!("{prefix}_body"),
        220.0,
        170.0,
        center_x,
        center_y + 20.0,
        0,
    );
    body.style.fill_rgba = palette.secondary_fill;
    body.style.stroke_rgba = palette.secondary_stroke;
    body.style.stroke_width = 2.0;
    body.style.opacity = 0.0;
    body.style.draw_progress = 0.0;
    let mut door = layer_rect(
        &format!("{prefix}_door"),
        42.0,
        70.0,
        center_x,
        center_y + 70.0,
        1,
    );
    door.style.fill_rgba = [110, 72, 52, 230];
    door.style.stroke_rgba = [214, 182, 154, 255];
    door.style.stroke_width = 1.0;
    door.style.opacity = 0.0;
    door.style.draw_progress = 0.0;
    vec![
        Layer {
            id: format!("{prefix}_roof"),
            z_index: 0,
            transform: Transform {
                x: center_x,
                y: center_y - 70.0,
                ..Default::default()
            },
            style: Style {
                fill_rgba: [210, 126, 88, 170],
                stroke_rgba: [255, 212, 180, 255],
                stroke_width: 2.0,
                opacity: 0.0,
                draw_progress: 0.0,
                line_height_mult: 1.15,
                text_max_width: 0.0,
            },
            primitive: Primitive::Polygon {
                points: vec![[-120.0, 40.0], [0.0, -80.0], [120.0, 40.0]],
            },
        },
        body,
        door,
    ]
}

pub fn motif_bank_layers(prefix: &str, center_x: f32, center_y: f32, palette: MotifPalette) -> Vec<Layer> {
    let mut body = layer_rect(
        &format!("{prefix}_body"),
        330.0,
        220.0,
        center_x,
        center_y + 20.0,
        0,
    );
    body.style.fill_rgba = [226, 208, 176, 190];
    body.style.stroke_rgba = [246, 236, 212, 255];
    body.style.stroke_width = 2.0;
    body.style.opacity = 0.0;
    body.style.draw_progress = 0.0;
    let mut label = layer_text(
        &format!("{prefix}_label"),
        "BANK",
        34.0,
        center_x,
        center_y + 20.0,
        1,
    );
    label.style.fill_rgba = palette.text;
    label.style.opacity = 0.0;
    label.style.draw_progress = 0.0;
    vec![
        Layer {
            id: format!("{prefix}_roof"),
            z_index: 0,
            transform: Transform {
                x: center_x,
                y: center_y - 80.0,
                ..Default::default()
            },
            style: Style {
                fill_rgba: [198, 142, 88, 170],
                stroke_rgba: [246, 214, 176, 255],
                stroke_width: 2.0,
                opacity: 0.0,
                draw_progress: 0.0,
                line_height_mult: 1.15,
                text_max_width: 0.0,
            },
            primitive: Primitive::Polygon {
                points: vec![[-160.0, 48.0], [0.0, -70.0], [160.0, 48.0]],
            },
        },
        body,
        label,
    ]
}

pub fn motif_vector_flow_layers(
    prefix: &str,
    start_x: f32,
    y: f32,
    spacing: f32,
    labels: &[&str],
    palette: MotifPalette,
) -> Vec<Layer> {
    let mut out = Vec::new();
    for (idx, label) in labels.iter().enumerate() {
        let x = start_x + idx as f32 * spacing.max(1.0);
        let mut block = layer_rect(
            &format!("{prefix}_block_{}", idx + 1),
            250.0,
            120.0,
            x,
            y,
            0,
        );
        block.style.fill_rgba = palette.primary_fill;
        block.style.stroke_rgba = palette.primary_stroke;
        block.style.stroke_width = 2.0;
        block.style.opacity = 0.0;
        block.style.draw_progress = 0.0;
        out.push(block);
        let mut txt = layer_text(
            &format!("{prefix}_text_{}", idx + 1),
            label,
            24.0,
            x,
            y,
            1,
        );
        txt.style.fill_rgba = palette.text;
        txt.style.opacity = 0.0;
        txt.style.draw_progress = 0.0;
        out.push(txt);
    }
    out
}

pub fn motif_recap_board_layers(
    prefix: &str,
    center_x: f32,
    center_y: f32,
    title: &str,
    items_multiline: &str,
    palette: MotifPalette,
) -> Vec<Layer> {
    let mut title_layer = layer_text(
        &format!("{prefix}_title"),
        title,
        52.0,
        center_x,
        center_y - 240.0,
        2,
    );
    title_layer.style.fill_rgba = palette.text;
    title_layer.style.opacity = 0.0;
    title_layer.style.draw_progress = 0.0;
    let mut board = layer_rect(
        &format!("{prefix}_board"),
        1080.0,
        420.0,
        center_x,
        center_y,
        0,
    );
    board.style.fill_rgba = [26, 44, 86, 114];
    board.style.stroke_rgba = [124, 188, 255, 255];
    board.style.stroke_width = 2.0;
    board.style.opacity = 0.0;
    board.style.draw_progress = 0.0;
    let mut items = layer_text(
        &format!("{prefix}_items"),
        items_multiline,
        32.0,
        center_x,
        center_y - 20.0,
        1,
    );
    items.style.fill_rgba = [228, 238, 255, 255];
    items.style.opacity = 0.0;
    items.style.draw_progress = 0.0;
    vec![
        title_layer,
        board,
        items,
    ]
}

pub fn motif_swimlane_layers(
    prefix: &str,
    center_x: f32,
    start_y: f32,
    lane_count: usize,
    lane_width: f32,
    lane_height: f32,
    palette: MotifPalette,
) -> Vec<Layer> {
    let mut out = Vec::new();
    for i in 0..lane_count.max(1) {
        let y = start_y + i as f32 * lane_height.max(20.0);
        let mut lane = layer_rect(
            &format!("{prefix}_lane_{}", i + 1),
            lane_width.max(50.0),
            (lane_height - 12.0).max(12.0),
            center_x,
            y,
            0,
        );
        lane.style.fill_rgba = [40, 72, 118, 92];
        lane.style.stroke_rgba = palette.primary_stroke;
        lane.style.stroke_width = 2.0;
        lane.style.opacity = 0.0;
        lane.style.draw_progress = 0.0;
        out.push(lane);

        let mut lane_label = layer_text(
            &format!("{prefix}_lane_label_{}", i + 1),
            &format!("Lane {}", i + 1),
            20.0,
            center_x - lane_width * 0.42,
            y,
            1,
        );
        lane_label.style.fill_rgba = palette.text;
        lane_label.style.opacity = 0.0;
        lane_label.style.draw_progress = 0.0;
        out.push(lane_label);
    }
    out
}

pub fn motif_timeline_layers(
    prefix: &str,
    start_x: f32,
    end_x: f32,
    y: f32,
    labels: &[&str],
    palette: MotifPalette,
) -> Vec<Layer> {
    let mut out = Vec::new();
    let width = (end_x - start_x).abs().max(1.0);
    out.push(Layer {
        id: format!("{prefix}_axis"),
        z_index: 0,
        transform: Transform {
            x: start_x,
            y,
            ..Default::default()
        },
        style: Style {
            fill_rgba: [0, 0, 0, 0],
            stroke_rgba: palette.primary_stroke,
            stroke_width: 3.0,
            opacity: 0.0,
            draw_progress: 0.0,
            line_height_mult: 1.15,
            text_max_width: 0.0,
        },
        primitive: Primitive::Polyline {
            points: vec![[0.0, 0.0], [width, 0.0]],
        },
    });

    let n = labels.len().max(2);
    let step = width / (n as f32 - 1.0);
    for i in 0..n {
        let x = start_x + i as f32 * step;
        out.push(Layer {
            id: format!("{prefix}_milestone_{}", i + 1),
            z_index: 1,
            transform: Transform {
                x,
                y,
                ..Default::default()
            },
            style: Style {
                fill_rgba: palette.primary_fill,
                stroke_rgba: palette.primary_stroke,
                stroke_width: 2.0,
                opacity: 0.0,
                draw_progress: 0.0,
                line_height_mult: 1.15,
                text_max_width: 0.0,
            },
            primitive: Primitive::Circle { radius: 22.0 },
        });

        let text = labels.get(i).copied().unwrap_or("M");
        let mut lbl = layer_text(
            &format!("{prefix}_milestone_t_{}", i + 1),
            text,
            18.0,
            x,
            y + 54.0,
            2,
        );
        lbl.style.fill_rgba = palette.text;
        lbl.style.opacity = 0.0;
        lbl.style.draw_progress = 0.0;
        out.push(lbl);
    }
    out
}

pub fn motif_building_cluster_layers(
    prefix: &str,
    start_x: f32,
    ground_y: f32,
    count: usize,
    spacing: f32,
    palette: MotifPalette,
) -> Vec<Layer> {
    let mut out = Vec::new();
    let mut ground = layer_rect(
        &format!("{prefix}_ground"),
        (count.max(1) as f32 * spacing.max(100.0)).max(300.0),
        90.0,
        start_x + (count.max(1) as f32 - 1.0) * spacing.max(100.0) * 0.5,
        ground_y,
        0,
    );
    ground.style.fill_rgba = [30, 52, 88, 130];
    ground.style.stroke_rgba = [120, 186, 255, 255];
    ground.style.stroke_width = 2.0;
    ground.style.opacity = 0.0;
    ground.style.draw_progress = 0.0;
    out.push(ground);

    for i in 0..count.max(1) {
        let x = start_x + i as f32 * spacing.max(100.0);
        let h = 150.0 + (i % 3) as f32 * 70.0;
        let mut tower = layer_rect(
            &format!("{prefix}_tower_{}", i + 1),
            96.0,
            h,
            x,
            ground_y - 45.0 - h * 0.5,
            1,
        );
        tower.style.fill_rgba = palette.secondary_fill;
        tower.style.stroke_rgba = palette.secondary_stroke;
        tower.style.stroke_width = 2.0;
        tower.style.opacity = 0.0;
        tower.style.draw_progress = 0.0;
        out.push(tower);
    }
    out
}

fn layer_width(layer: &Layer) -> f32 {
    match &layer.primitive {
        Primitive::Rect { width, .. } => *width,
        Primitive::Circle { radius } => radius * 2.0,
        Primitive::Ellipse { radius_x, .. } => radius_x * 2.0,
        Primitive::Text { text, font_size, .. } => {
            (text.chars().count() as f32 * *font_size * 0.56).max(*font_size)
        }
        Primitive::Image { width, .. } => *width,
        Primitive::Cube { size, .. } => *size,
        Primitive::Cuboid { width, .. } => *width,
        Primitive::MeshBlock { width, .. } => *width,
        Primitive::Line { x1, x2, .. } | Primitive::Arrow { x1, x2, .. } => (x2 - x1).abs().max(1.0),
        Primitive::Polyline { points } | Primitive::Polygon { points } => {
            if points.is_empty() {
                1.0
            } else {
                let mut min_x = points[0][0];
                let mut max_x = points[0][0];
                for p in points.iter().skip(1) {
                    min_x = min_x.min(p[0]);
                    max_x = max_x.max(p[0]);
                }
                (max_x - min_x).abs().max(1.0)
            }
        }
    }
}

fn layer_height(layer: &Layer) -> f32 {
    match &layer.primitive {
        Primitive::Rect { height, .. } => *height,
        Primitive::Circle { radius } => radius * 2.0,
        Primitive::Ellipse { radius_y, .. } => radius_y * 2.0,
        Primitive::Text { text, font_size, .. } => {
            let lines = text.lines().count().max(1) as f32;
            lines * *font_size * 1.2
        }
        Primitive::Image { height, .. } => *height,
        Primitive::Cube { size, .. } => *size,
        Primitive::Cuboid { height, .. } => *height,
        Primitive::MeshBlock { height, .. } => *height,
        Primitive::Line { y1, y2, .. } | Primitive::Arrow { y1, y2, .. } => (y2 - y1).abs().max(1.0),
        Primitive::Polyline { points } | Primitive::Polygon { points } => {
            if points.is_empty() {
                1.0
            } else {
                let mut min_y = points[0][1];
                let mut max_y = points[0][1];
                for p in points.iter().skip(1) {
                    min_y = min_y.min(p[1]);
                    max_y = max_y.max(p[1]);
                }
                (max_y - min_y).abs().max(1.0)
            }
        }
    }
}
