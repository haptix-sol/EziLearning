use crate::{
    AnimationKind, AnimationSpec, ColorKeyframe, ColorProperty, Easing, GroupMode, Primitive,
    ResolvedLayer, SceneTimeline,
};
use std::collections::HashMap;

pub(crate) fn apply_timeline_spec(layer: &mut ResolvedLayer, spec: &AnimationSpec, t: f32) {
    let alpha = timeline_progress(spec, t);
    if alpha <= 0.0
        && !matches!(
            spec.kind,
            AnimationKind::FadeOut
                | AnimationKind::VFadeOut
                | AnimationKind::FadeTransform
                | AnimationKind::FadeTransformPieces
        )
    {
        return;
    }
    let sub = lagged_alpha(alpha, spec.group_index, spec.group_size, spec.lag_ratio);
    let u = ease(spec.easing, sub);
    let is_text = matches!(layer.primitive, Primitive::Text { .. });

    match spec.kind {
        AnimationKind::Create => {
            layer.style.draw_progress = layer.style.draw_progress.max(u);
            layer.style.opacity = layer.style.opacity.max(0.001);
        }
        AnimationKind::ShowIncreasingSubsets => {
            layer.style.draw_progress = u;
            layer.style.opacity = 1.0;
        }
        AnimationKind::Write => {
            let stroke_phase = (u / 0.68).clamp(0.0, 1.0);
            let fill_phase = ((u - 0.38) / 0.62).clamp(0.0, 1.0);
            layer.style.draw_progress = layer.style.draw_progress.max(stroke_phase);
            layer.style.opacity = layer.style.opacity.max(lerp_f32(0.2, 1.0, fill_phase));
        }
        AnimationKind::DrawBorderThenFill => {
            let border = (u / 0.55).clamp(0.0, 1.0);
            let fill = ((u - 0.45) / 0.55).clamp(0.0, 1.0);
            layer.style.draw_progress = border;
            layer.style.opacity = lerp_f32(0.05, 1.0, fill);
        }
        AnimationKind::Uncreate => {
            layer.style.draw_progress = (1.0 - u).clamp(0.0, 1.0);
            layer.style.opacity = (1.0 - u).clamp(0.0, 1.0);
        }
        AnimationKind::FadeIn => {
            layer.style.opacity = u;
            if is_text {
                layer.style.draw_progress = layer.style.draw_progress.max(u);
            }
            layer.transform.x -= spec.shift_x * (1.0 - u);
            layer.transform.y -= spec.shift_y * (1.0 - u);
            let s = lerp_f32(spec.scale_from.max(0.01), 1.0, u);
            layer.transform.scale_x *= s;
            layer.transform.scale_y *= s;
        }
        AnimationKind::FadeOut => {
            let v = 1.0 - u;
            layer.style.opacity = v;
            layer.transform.x += spec.shift_x * u;
            layer.transform.y += spec.shift_y * u;
            let s = lerp_f32(1.0, spec.scale_to.max(0.01), u);
            layer.transform.scale_x *= s;
            layer.transform.scale_y *= s;
        }
        AnimationKind::VFadeIn => {
            layer.style.opacity = u;
            if is_text {
                layer.style.draw_progress = layer.style.draw_progress.max(u);
            }
        }
        AnimationKind::VFadeOut => {
            layer.style.opacity = 1.0 - u;
        }
        AnimationKind::FadeTransform | AnimationKind::FadeTransformPieces => {
            layer.style.opacity = 1.0 - u;
            if let Some(tx) = spec.to_x {
                layer.transform.x = lerp_f32(layer.transform.x, tx, u);
            }
            if let Some(ty) = spec.to_y {
                layer.transform.y = lerp_f32(layer.transform.y, ty, u);
            }
            if let Some(sx) = spec.to_scale_x {
                layer.transform.scale_x = lerp_f32(layer.transform.scale_x, sx, u);
            }
            if let Some(sy) = spec.to_scale_y {
                layer.transform.scale_y = lerp_f32(layer.transform.scale_y, sy, u);
            }
        }
        AnimationKind::Transform | AnimationKind::ReplacementTransform => {
            if let Some(tx) = spec.to_x {
                if let Some(ty) = spec.to_y {
                    if spec.path_arc_deg.abs() > 1e-3 {
                        let (ax, ay) =
                            arc_lerp(layer.transform.x, layer.transform.y, tx, ty, spec.path_arc_deg, u);
                        layer.transform.x = ax;
                        layer.transform.y = ay;
                    } else {
                        layer.transform.x = lerp_f32(layer.transform.x, tx, u);
                    }
                } else {
                    layer.transform.x = lerp_f32(layer.transform.x, tx, u);
                }
            }
            if let Some(ty) = spec.to_y {
                if spec.path_arc_deg.abs() <= 1e-3 {
                    layer.transform.y = lerp_f32(layer.transform.y, ty, u);
                }
            }
            if let Some(sx) = spec.to_scale_x {
                layer.transform.scale_x = lerp_f32(layer.transform.scale_x, sx, u);
            }
            if let Some(sy) = spec.to_scale_y {
                layer.transform.scale_y = lerp_f32(layer.transform.scale_y, sy, u);
            }
            if let Some(r) = spec.to_rotation_deg {
                layer.transform.rotation_deg = lerp_f32(layer.transform.rotation_deg, r, u);
            }
            if matches!(spec.kind, AnimationKind::ReplacementTransform) && spec.replace_with.is_none() {
                layer.style.opacity = 1.0 - u;
            }
        }
        AnimationKind::Rotate => {
            if let Some(r) = spec.to_rotation_deg {
                layer.transform.rotation_deg = lerp_f32(layer.transform.rotation_deg, r, u);
            }
        }
        AnimationKind::GrowFromCenter => {
            let s = lerp_f32(0.001, 1.0, u);
            layer.transform.scale_x *= s;
            layer.transform.scale_y *= s;
            layer.style.opacity = u;
            layer.style.draw_progress = layer.style.draw_progress.max(u);
        }
        AnimationKind::GrowFromPoint => {
            let from_x = spec.to_x.unwrap_or(layer.transform.x);
            let from_y = spec.to_y.unwrap_or(layer.transform.y);
            layer.transform.x = lerp_f32(from_x, layer.transform.x, u);
            layer.transform.y = lerp_f32(from_y, layer.transform.y, u);
            let s = lerp_f32(0.001, 1.0, u);
            layer.transform.scale_x *= s;
            layer.transform.scale_y *= s;
            layer.style.opacity = u;
            layer.style.draw_progress = layer.style.draw_progress.max(u);
        }
        AnimationKind::MoveAlongPath => {
            if let Some(points) = &spec.path_points {
                if let Some((px, py)) = sample_path_point(points, u) {
                    layer.transform.x = px;
                    layer.transform.y = py;
                }
            }
        }
        AnimationKind::Homotopy => {
            let phase = spec.homotopy_phase_deg.to_radians();
            let angle = std::f32::consts::TAU * spec.homotopy_freq * u + phase;
            layer.transform.x += spec.homotopy_amp_x * angle.sin();
            layer.transform.y += spec.homotopy_amp_y * angle.cos();
        }
        AnimationKind::PhaseFlow => {
            let phase = spec.homotopy_phase_deg.to_radians();
            let angle = std::f32::consts::TAU * spec.homotopy_freq * u + phase;
            let flow_x = spec.to_x.unwrap_or(0.0);
            let flow_y = spec.to_y.unwrap_or(0.0);
            layer.transform.x += flow_x * u + spec.homotopy_amp_x * angle.cos();
            layer.transform.y += flow_y * u + spec.homotopy_amp_y * angle.sin();
        }
        AnimationKind::PresetEnterSoft => {
            layer.style.opacity = u;
            layer.style.draw_progress = layer.style.draw_progress.max(u);
            let s = lerp_f32(0.95, 1.0, u);
            layer.transform.scale_x *= s;
            layer.transform.scale_y *= s;
        }
        AnimationKind::PresetEnterRise => {
            layer.style.opacity = u;
            layer.style.draw_progress = layer.style.draw_progress.max(u);
            layer.transform.y -= 36.0 * (1.0 - u);
            let s = lerp_f32(0.92, 1.0, u);
            layer.transform.scale_x *= s;
            layer.transform.scale_y *= s;
        }
        AnimationKind::PresetExitSoft => {
            let v = 1.0 - u;
            layer.style.opacity = v;
            layer.style.draw_progress = v;
            let s = lerp_f32(1.0, 0.95, u);
            layer.transform.scale_x *= s;
            layer.transform.scale_y *= s;
        }
        AnimationKind::PresetExitDrop => {
            let v = 1.0 - u;
            layer.style.opacity = v;
            layer.style.draw_progress = v;
            layer.transform.y += 30.0 * u;
        }
        AnimationKind::PresetEmphasisPulse => {
            let pulse = 1.0 + 0.1 * (std::f32::consts::PI * u).sin();
            layer.transform.scale_x *= pulse;
            layer.transform.scale_y *= pulse;
            layer.style.opacity = lerp_f32(0.92, 1.0, u);
        }
        AnimationKind::PresetTransitionMorph => {
            layer.style.opacity = 1.0 - u;
            layer.style.draw_progress = (1.0 - u).clamp(0.0, 1.0);
        }
        AnimationKind::PresetTransitionCrossfade => {
            layer.style.opacity = 1.0 - u;
            layer.style.draw_progress = (1.0 - u).clamp(0.0, 1.0);
        }
        AnimationKind::PresetTextTypewriter => {
            // Finish perceived typing earlier so narration and text stay in lockstep.
            let reveal = (u / 0.72).clamp(0.0, 1.0);
            layer.style.opacity = lerp_f32(0.9, 1.0, reveal);
            layer.style.draw_progress = reveal;
        }
        AnimationKind::PresetTextPopIn => {
            layer.style.opacity = u;
            layer.style.draw_progress = layer.style.draw_progress.max(u);
            let pop = 0.94 + 0.10 * (std::f32::consts::PI * u).sin();
            layer.transform.scale_x *= pop;
            layer.transform.scale_y *= pop;
        }
        AnimationKind::PresetTextGlowPulse => {
            let amp = 0.08 * (std::f32::consts::PI * u).sin();
            layer.style.opacity = (0.92 + amp).clamp(0.0, 1.0);
            layer.style.draw_progress = layer.style.draw_progress.max(1.0);
        }
        AnimationKind::PresetShapeDrawRect => {
            layer.style.draw_progress = u;
            layer.style.opacity = lerp_f32(0.08, 1.0, u);
            if let Primitive::Rect { width, height, .. } = &mut layer.primitive {
                if let Some(w) = spec.axis_width {
                    *width = w.max(1.0);
                }
                if let Some(h) = spec.axis_height {
                    *height = h.max(1.0);
                }
            }
            apply_preset_style(layer, spec, u);
        }
        AnimationKind::PresetShapeDrawSquare => {
            layer.style.draw_progress = u;
            layer.style.opacity = lerp_f32(0.08, 1.0, u);
            if let Primitive::Rect { width, height, .. } = &mut layer.primitive {
                let side = spec
                    .axis_width
                    .or(spec.axis_height)
                    .unwrap_or((*width).min(*height))
                    .max(1.0);
                *width = side;
                *height = side;
            }
            apply_preset_style(layer, spec, u);
        }
        AnimationKind::PresetShapeDrawCircle => {
            layer.style.draw_progress = u;
            layer.style.opacity = lerp_f32(0.08, 1.0, u);
            if let Primitive::Circle { radius } = &mut layer.primitive {
                let r = if let (Some(w), Some(h)) = (spec.axis_width, spec.axis_height) {
                    (w.min(h) * 0.5).max(1.0)
                } else {
                    *radius
                };
                *radius = r.max(1.0);
            }
            apply_preset_style(layer, spec, u);
        }
        AnimationKind::PresetShapeDrawLine => {
            layer.style.draw_progress = u;
            layer.style.opacity = lerp_f32(0.1, 1.0, u);
            if let Primitive::Line { x2, y2, .. } = &mut layer.primitive {
                if let Some(w) = spec.axis_width {
                    *x2 = w;
                }
                if let Some(h) = spec.axis_height {
                    *y2 = h;
                }
            }
            apply_preset_style(layer, spec, u);
        }
        AnimationKind::PresetShapeDrawPolygon => {
            layer.style.draw_progress = u;
            layer.style.opacity = lerp_f32(0.1, 1.0, u);
            apply_preset_style(layer, spec, u);
        }
        AnimationKind::PresetArrowOutsidePoint | AnimationKind::PresetConnectorSafeRoute => {
            layer.style.draw_progress = u;
            layer.style.opacity = lerp_f32(0.15, 1.0, u);
            if let Primitive::Arrow { x1, y1, .. } = &mut layer.primitive {
                if let (Some(ax), Some(ay)) = (spec.axis_x, spec.axis_y) {
                    *x1 = ax - layer.transform.x;
                    *y1 = ay - layer.transform.y;
                }
            }
            apply_preset_style(layer, spec, u);
        }
        AnimationKind::PresetBoxWithSubboxInside | AnimationKind::PresetBoxWithSubboxOverlap => {
            layer.style.draw_progress = u;
            layer.style.opacity = lerp_f32(0.10, 1.0, u);
            apply_preset_style(layer, spec, u);
        }
        AnimationKind::PresetFormulaStepReveal => {
            if is_text {
                let reveal = (u / 0.8).clamp(0.0, 1.0);
                layer.style.draw_progress = reveal;
                layer.style.opacity = lerp_f32(0.9, 1.0, reveal);
            } else {
                layer.style.draw_progress = u;
                layer.style.opacity = lerp_f32(0.12, 1.0, u);
            }
            apply_preset_style(layer, spec, u);
        }
        AnimationKind::PresetVectorFlowBlockReveal => {
            layer.style.draw_progress = (u / 0.70).clamp(0.0, 1.0);
            layer.style.opacity = lerp_f32(0.08, 1.0, u);
            let pulse = 1.0 + 0.04 * (std::f32::consts::PI * u).sin();
            layer.transform.scale_x *= pulse;
            layer.transform.scale_y *= pulse;
            apply_preset_style(layer, spec, u);
        }
        AnimationKind::PresetCameraPan => {
            layer.style.opacity = layer.style.opacity.max(0.98);
            let drift_x = spec.to_x.unwrap_or(0.0);
            let drift_y = spec.to_y.unwrap_or(0.0);
            layer.transform.x += drift_x * u;
            layer.transform.y += drift_y * u;
        }
        AnimationKind::PresetCameraZoom => {
            let sx = spec.to_scale_x.unwrap_or(1.06).max(0.01);
            let sy = spec.to_scale_y.unwrap_or(1.06).max(0.01);
            layer.transform.scale_x *= lerp_f32(1.0, sx, u);
            layer.transform.scale_y *= lerp_f32(1.0, sy, u);
            layer.style.opacity = layer.style.opacity.max(0.98);
        }
        AnimationKind::PresetParallaxDrift => {
            let shift_x = spec.to_x.unwrap_or(12.0);
            let shift_y = spec.to_y.unwrap_or(-8.0);
            let wave = (std::f32::consts::PI * u).sin();
            layer.transform.x += shift_x * wave;
            layer.transform.y += shift_y * wave;
            layer.style.opacity = layer.style.opacity.max(0.98);
        }
        AnimationKind::PresetChromaPulse => {
            let amp = (std::f32::consts::PI * u).sin().abs();
            layer.style.opacity = (0.88 + amp * 0.12).clamp(0.0, 1.0);
            apply_preset_style(layer, spec, amp);
        }
        AnimationKind::PresetTransitionSwipe => {
            layer.style.opacity = lerp_f32(0.25, 1.0, u);
            layer.style.draw_progress = u;
            layer.transform.x += lerp_f32(-48.0, 0.0, u);
        }
        AnimationKind::PresetTransitionWipe => {
            layer.style.opacity = lerp_f32(0.20, 1.0, u);
            layer.style.draw_progress = (u / 0.82).clamp(0.0, 1.0);
        }
        AnimationKind::PresetTransitionPush => {
            layer.style.opacity = lerp_f32(0.20, 1.0, u);
            layer.style.draw_progress = u;
            layer.transform.x += lerp_f32(34.0, 0.0, u);
        }
        AnimationKind::PresetTransitionBlurFade => {
            layer.style.opacity = lerp_f32(0.12, 1.0, u);
            layer.style.draw_progress = u;
            let settle = 1.0 + 0.04 * (1.0 - u);
            layer.transform.scale_x *= settle;
            layer.transform.scale_y *= settle;
        }
        AnimationKind::PresetTransitionColorWash => {
            layer.style.opacity = lerp_f32(0.35, 1.0, u);
            let amp = (std::f32::consts::PI * u).sin().abs();
            apply_preset_style(layer, spec, amp);
        }
        AnimationKind::PresetMotionOrbitDrift => {
            let a = std::f32::consts::TAU * u;
            layer.transform.x += 14.0 * a.cos();
            layer.transform.y += 9.0 * a.sin();
            layer.style.opacity = layer.style.opacity.max(0.98);
        }
        AnimationKind::PresetCameraSettle => {
            let settle = (1.0 - u).powf(2.0);
            layer.transform.x += 8.0 * settle;
            layer.transform.y += 5.0 * settle;
            layer.style.opacity = layer.style.opacity.max(0.98);
        }
        AnimationKind::PresetElasticEmphasis => {
            let wobble = 1.0 + 0.08 * (std::f32::consts::PI * 2.0 * u).sin() * (1.0 - u);
            layer.transform.scale_x *= wobble;
            layer.transform.scale_y *= wobble;
            layer.style.opacity = lerp_f32(0.92, 1.0, u);
        }
        AnimationKind::PresetShotFront => {
            layer.transform.yaw_deg = lerp_f32(layer.transform.yaw_deg, 0.0, u);
            layer.transform.pitch_deg = lerp_f32(layer.transform.pitch_deg, 0.0, u);
            layer.transform.z = lerp_f32(layer.transform.z, spec.to_y.unwrap_or(8.0), u);
            layer.style.opacity = layer.style.opacity.max(0.98);
        }
        AnimationKind::PresetShotBack => {
            layer.transform.yaw_deg = lerp_f32(layer.transform.yaw_deg, 180.0, u);
            layer.transform.pitch_deg = lerp_f32(layer.transform.pitch_deg, 0.0, u);
            layer.transform.z = lerp_f32(layer.transform.z, spec.to_y.unwrap_or(28.0), u);
            layer.style.opacity = layer.style.opacity.max(0.98);
        }
        AnimationKind::PresetShotLeft => {
            layer.transform.yaw_deg = lerp_f32(layer.transform.yaw_deg, -90.0, u);
            layer.transform.pitch_deg = lerp_f32(layer.transform.pitch_deg, -3.0, u);
            layer.style.opacity = layer.style.opacity.max(0.98);
        }
        AnimationKind::PresetShotRight => {
            layer.transform.yaw_deg = lerp_f32(layer.transform.yaw_deg, 90.0, u);
            layer.transform.pitch_deg = lerp_f32(layer.transform.pitch_deg, -3.0, u);
            layer.style.opacity = layer.style.opacity.max(0.98);
        }
        AnimationKind::PresetShotLowHero => {
            layer.transform.pitch_deg = lerp_f32(layer.transform.pitch_deg, -18.0, u);
            layer.transform.scale_x *= lerp_f32(1.0, 1.12, u);
            layer.transform.scale_y *= lerp_f32(1.0, 1.12, u);
            layer.transform.y += lerp_f32(16.0, 0.0, u);
            layer.style.opacity = layer.style.opacity.max(0.99);
        }
        AnimationKind::PresetSpeedRamp => {
            let ramp = if u < 0.45 {
                lerp_f32(0.85, 1.25, u / 0.45)
            } else {
                lerp_f32(1.25, 0.92, (u - 0.45) / 0.55)
            };
            layer.transform.x += spec.to_x.unwrap_or(24.0) * u * ramp;
            layer.transform.y += spec.to_y.unwrap_or(-10.0) * u * ramp;
            layer.transform.z += 42.0 * (u * ramp).clamp(0.0, 1.5);
            layer.style.opacity = lerp_f32(0.94, 1.0, u);
        }
        AnimationKind::PresetImpactSlowMo => {
            let hold = if u < 0.78 { u * 0.5 } else { 0.39 + (u - 0.78) * 2.77 };
            let impact = (std::f32::consts::PI * hold).sin().abs();
            let squash = 1.0 + impact * 0.16;
            let stretch = 1.0 - impact * 0.11;
            layer.transform.scale_x *= squash;
            layer.transform.scale_y *= stretch.max(0.7);
            layer.transform.z += 18.0 * (1.0 - hold);
            layer.style.opacity = lerp_f32(0.90, 1.0, hold);
        }
    }
}

fn apply_preset_style(layer: &mut ResolvedLayer, spec: &AnimationSpec, u: f32) {
    if let Some(fill) = spec.preset_fill_rgba {
        layer.style.fill_rgba = lerp_rgba(layer.style.fill_rgba, fill, u.clamp(0.0, 1.0));
    }
    if let Some(stroke) = spec.preset_stroke_rgba {
        layer.style.stroke_rgba = lerp_rgba(layer.style.stroke_rgba, stroke, u.clamp(0.0, 1.0));
    }
    if let Some(text_fill) = spec.preset_text_rgba {
        if matches!(layer.primitive, Primitive::Text { .. }) {
            layer.style.fill_rgba = lerp_rgba(layer.style.fill_rgba, text_fill, u.clamp(0.0, 1.0));
        }
    }
    if let (Some(label), Primitive::Text { text, .. }) = (spec.label_text.as_ref(), &mut layer.primitive) {
        if u >= 0.2 {
            *text = label.clone();
        }
    }
    if let (Some(x), Some(y)) = (spec.axis_x, spec.axis_y) {
        if matches!(
            spec.kind,
            AnimationKind::PresetShapeDrawRect
                | AnimationKind::PresetShapeDrawSquare
                | AnimationKind::PresetShapeDrawCircle
                | AnimationKind::PresetVectorFlowBlockReveal
                | AnimationKind::PresetFormulaStepReveal
                | AnimationKind::PresetCameraPan
                | AnimationKind::PresetCameraZoom
                | AnimationKind::PresetParallaxDrift
                | AnimationKind::PresetChromaPulse
                | AnimationKind::PresetSpeedRamp
                | AnimationKind::PresetImpactSlowMo
                | AnimationKind::PresetShotFront
                | AnimationKind::PresetShotBack
                | AnimationKind::PresetShotLeft
                | AnimationKind::PresetShotRight
                | AnimationKind::PresetShotLowHero
        ) {
            layer.transform.x = lerp_f32(layer.transform.x, x, u);
            layer.transform.y = lerp_f32(layer.transform.y, y, u);
        }
    }
}

pub(crate) fn timeline_progress(spec: &AnimationSpec, t: f32) -> f32 {
    let local = (t - spec.start) / spec.run_time.max(1e-6);
    local.clamp(0.0, 1.0)
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct GroupTiming {
    pub start: f32,
    pub run_time: f32,
}

pub(crate) fn build_group_timings(timeline: &SceneTimeline) -> HashMap<usize, GroupTiming> {
    let mut map = HashMap::new();
    for group in &timeline.groups {
        let n = group.spec_indices.len();
        if n == 0 {
            continue;
        }
        match group.mode {
            GroupMode::Succession => {
                let dur = (group.run_time / n as f32).max(1e-6);
                for (order, idx) in group.spec_indices.iter().enumerate() {
                    map.insert(
                        *idx,
                        GroupTiming {
                            start: group.start + order as f32 * dur,
                            run_time: dur,
                        },
                    );
                }
            }
            GroupMode::AnimationGroup => {
                let lag = group.lag_ratio.clamp(0.0, 1.0);
                let child =
                    (group.run_time / ((n as f32 - 1.0).max(0.0) * lag + 1.0)).max(1e-6);
                for (order, idx) in group.spec_indices.iter().enumerate() {
                    map.insert(
                        *idx,
                        GroupTiming {
                            start: group.start + order as f32 * lag * child,
                            run_time: child,
                        },
                    );
                }
            }
        }
    }
    map
}

fn lagged_alpha(alpha: f32, index: usize, group_size: usize, lag_ratio: f32) -> f32 {
    let n = group_size.max(1);
    let lag = lag_ratio.clamp(0.0, 1.0);
    let full = (n as f32 - 1.0) * lag + 1.0;
    let value = alpha * full;
    let lower = index.min(n - 1) as f32 * lag;
    (value - lower).clamp(0.0, 1.0)
}

pub(crate) fn apply_color(layer: &mut ResolvedLayer, property: ColorProperty, value: [u8; 4]) {
    match property {
        ColorProperty::FillRgba => layer.style.fill_rgba = value,
        ColorProperty::StrokeRgba => layer.style.stroke_rgba = value,
    }
}

pub(crate) fn sample_float_keyframes(keys: &[crate::FloatKeyframe], t: f32) -> f32 {
    if keys.is_empty() {
        return 0.0;
    }
    if t <= keys[0].t {
        return keys[0].value;
    }
    for pair in keys.windows(2) {
        let a = pair[0];
        let b = pair[1];
        if t <= b.t {
            let span = (b.t - a.t).max(1e-6);
            let u = ((t - a.t) / span).clamp(0.0, 1.0);
            let u = ease(a.easing_to_next, u);
            return lerp_f32(a.value, b.value, u);
        }
    }
    keys[keys.len() - 1].value
}

pub(crate) fn sample_color_keyframes(keys: &[ColorKeyframe], t: f32) -> [u8; 4] {
    if keys.is_empty() {
        return [255, 255, 255, 255];
    }
    if t <= keys[0].t {
        return keys[0].value;
    }
    for pair in keys.windows(2) {
        let a = pair[0];
        let b = pair[1];
        if t <= b.t {
            let span = (b.t - a.t).max(1e-6);
            let u = ((t - a.t) / span).clamp(0.0, 1.0);
            let u = ease(a.easing_to_next, u);
            return [
                lerp_u8(a.value[0], b.value[0], u),
                lerp_u8(a.value[1], b.value[1], u),
                lerp_u8(a.value[2], b.value[2], u),
                lerp_u8(a.value[3], b.value[3], u),
            ];
        }
    }
    keys[keys.len() - 1].value
}

fn ease(easing: Easing, u: f32) -> f32 {
    match easing {
        Easing::Linear => u,
        Easing::EaseIn => u * u,
        Easing::EaseOut => 1.0 - (1.0 - u) * (1.0 - u),
        Easing::EaseInOut => {
            if u < 0.5 {
                2.0 * u * u
            } else {
                1.0 - (-2.0 * u + 2.0).powf(2.0) / 2.0
            }
        }
        Easing::RushInto => 2.0 * ease(Easing::EaseInOut, 0.5 * u),
        Easing::RushFrom => 2.0 * ease(Easing::EaseInOut, 0.5 * (u + 1.0)) - 1.0,
        Easing::ThereAndBack => {
            let t = if u < 0.5 { 2.0 * u } else { 2.0 * (1.0 - u) };
            ease(Easing::EaseInOut, t)
        }
        Easing::Overshoot => {
            let t = u - 1.0;
            t * t * ((2.2 + 1.0) * t + 2.2) + 1.0
        }
    }
}

fn lerp_f32(a: f32, b: f32, u: f32) -> f32 {
    a + (b - a) * u
}

fn arc_lerp(x0: f32, y0: f32, x1: f32, y1: f32, arc_deg: f32, u: f32) -> (f32, f32) {
    let theta = arc_deg.to_radians();
    if theta.abs() < 1e-4 {
        return (lerp_f32(x0, x1, u), lerp_f32(y0, y1, u));
    }
    let dx = x1 - x0;
    let dy = y1 - y0;
    let chord = (dx * dx + dy * dy).sqrt();
    if chord <= 1e-6 {
        return (x0, y0);
    }
    let radius = chord / (2.0 * (theta.abs() * 0.5).sin().max(1e-6));
    let mx = (x0 + x1) * 0.5;
    let my = (y0 + y1) * 0.5;
    let nx = -dy / chord;
    let ny = dx / chord;
    let h = (radius * radius - (chord * 0.5) * (chord * 0.5)).max(0.0).sqrt();
    let sign = if theta > 0.0 { 1.0 } else { -1.0 };
    let cx = mx + nx * h * sign;
    let cy = my + ny * h * sign;
    let a0 = (y0 - cy).atan2(x0 - cx);
    let a1 = a0 + theta;
    let a = lerp_f32(a0, a1, u.clamp(0.0, 1.0));
    (cx + radius * a.cos(), cy + radius * a.sin())
}

fn sample_path_point(points: &[[f32; 2]], u: f32) -> Option<(f32, f32)> {
    if points.is_empty() {
        return None;
    }
    if points.len() == 1 {
        return Some((points[0][0], points[0][1]));
    }
    let mut lengths = Vec::with_capacity(points.len() - 1);
    let mut total = 0.0f32;
    for i in 0..points.len() - 1 {
        let dx = points[i + 1][0] - points[i][0];
        let dy = points[i + 1][1] - points[i][1];
        let seg = (dx * dx + dy * dy).sqrt().max(1e-6);
        lengths.push(seg);
        total += seg;
    }
    let mut target = u.clamp(0.0, 1.0) * total;
    for i in 0..lengths.len() {
        if target <= lengths[i] {
            let p0 = points[i];
            let p1 = points[i + 1];
            let t = (target / lengths[i]).clamp(0.0, 1.0);
            return Some((lerp_f32(p0[0], p1[0], t), lerp_f32(p0[1], p1[1], t)));
        }
        target -= lengths[i];
    }
    let last = points[points.len() - 1];
    Some((last[0], last[1]))
}

fn lerp_u8(a: u8, b: u8, u: f32) -> u8 {
    (a as f32 + (b as f32 - a as f32) * u).round().clamp(0.0, 255.0) as u8
}

fn lerp_rgba(a: [u8; 4], b: [u8; 4], u: f32) -> [u8; 4] {
    [
        lerp_u8(a[0], b[0], u),
        lerp_u8(a[1], b[1], u),
        lerp_u8(a[2], b[2], u),
        lerp_u8(a[3], b[3], u),
    ]
}
