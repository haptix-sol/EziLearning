use crate::planner::{PlannedScene, SceneTemplate};
use anyhow::{Context, Result};
use serde_json::{json, Value};
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy)]
pub struct SceneRenderConfig {
    pub width: u32,
    pub height: u32,
    pub fps: u32,
}

pub fn materialize_planned_scene(
    out_dir: &Path,
    scene: &PlannedScene,
    cfg: SceneRenderConfig,
) -> Result<PathBuf> {
    fs::create_dir_all(out_dir)
        .with_context(|| format!("failed creating generated scene dir {}", out_dir.display()))?;
    let value = match scene.template {
        SceneTemplate::IntroUnderline => build_intro_underline(scene, cfg),
        SceneTemplate::HeadingDiagram => build_heading_diagram(scene, cfg),
        SceneTemplate::ConceptCards => build_concept_cards(scene, cfg),
        SceneTemplate::FormulaFlow => build_formula_flow(scene, cfg),
        SceneTemplate::SplitCompare => build_split_compare(scene, cfg),
        SceneTemplate::TimelineLadder => build_timeline_ladder(scene, cfg),
        SceneTemplate::ArrayCompareSwap => build_array_compare_swap(scene, cfg),
        SceneTemplate::TeacherExplainer => build_teacher_explainer(scene, cfg),
        SceneTemplate::RecapOutro => build_recap_outro(scene, cfg),
    };
    let path = out_dir.join(format!("{}.json", scene.id));
    fs::write(&path, serde_json::to_string_pretty(&value)?)
        .with_context(|| format!("failed writing generated scene {}", path.display()))?;
    Ok(path)
}

fn base_scene(scene: &PlannedScene, cfg: SceneRenderConfig, layers: Vec<Value>, specs: Vec<Value>) -> Value {
    json!({
        "version": "v1",
        "duration_seconds": scene.duration_seconds,
        "meta": {
            "visual_instruction": scene.visual_instruction
        },
        "canvas": {
            "width": cfg.width,
            "height": cfg.height,
            "fps": cfg.fps,
            "background_rgba": [8, 14, 30, 255]
        },
        "layers": layers,
        "timeline": {
            "specs": specs,
            "lifecycle": [],
            "segments": [
                {
                    "segment_type": "play",
                    "start": 0.0,
                    "run_time": scene.duration_seconds,
                    "spec_indices": (0..specs.len()).collect::<Vec<_>>()
                }
            ],
            "groups": []
        }
    })
}

fn visual_line(scene: &PlannedScene) -> String {
    let src = if !scene.visual_instruction.trim().is_empty() {
        scene.visual_instruction.trim()
    } else if !scene.caption.trim().is_empty() {
        scene.caption.trim()
    } else {
        scene.title.trim()
    };
    if src.len() <= 180 {
        src.to_string()
    } else {
        format!("{}...", &src[..177])
    }
}

fn build_intro_underline(scene: &PlannedScene, cfg: SceneRenderConfig) -> Value {
    let cx = (cfg.width / 2) as i32;
    let title = scene.title.clone();
    let t_out = (scene.duration_seconds - 1.2).max(1.5);
    base_scene(
        scene,
        cfg,
        vec![
            json!({"id":"intro_panel","z_index":2,"type":"rect","width":(cfg.width as f32*0.82),"height":300,"corner_radius":26,"transform":{"x":cx,"y":240},"style":{"fill_rgba":[22,42,88,165],"stroke_rgba":[115,180,255,255],"stroke_width":3,"opacity":0.0}}),
            json!({"id":"intro_glow_l","z_index":1,"type":"circle","radius":95,"transform":{"x":(cx-350),"y":250},"style":{"fill_rgba":[80,145,255,110],"stroke_rgba":[0,0,0,0],"opacity":0.0}}),
            json!({"id":"intro_glow_r","z_index":1,"type":"circle","radius":95,"transform":{"x":(cx+350),"y":250},"style":{"fill_rgba":[90,205,220,90],"stroke_rgba":[0,0,0,0],"opacity":0.0}}),
            json!({"id":"title","z_index":10,"type":"text","text":title,"font_size":58,"transform":{"x":cx,"y":220},"style":{"fill_rgba":[228,238,255,255],"opacity":0.0,"text_max_width":(cfg.width as f32*0.86)}}),
            json!({"id":"line","z_index":9,"type":"line","x1":-340,"y1":0,"x2":340,"y2":0,"transform":{"x":cx,"y":278},"style":{"stroke_rgba":[106,176,255,255],"stroke_width":5,"draw_progress":0.0,"opacity":0.0}})
        ],
        vec![
            json!({"target":"intro_panel","kind":"preset_enter_soft","start":0.0,"run_time":0.9,"easing":"ease_out"}),
            json!({"target":"intro_glow_l","kind":"fade_in","start":0.1,"run_time":0.8,"easing":"ease_out"}),
            json!({"target":"intro_glow_r","kind":"fade_in","start":0.25,"run_time":0.8,"easing":"ease_out"}),
            json!({"target":"title","kind":"write","start":0.0,"run_time":1.8,"easing":"ease_out"}),
            json!({"target":"line","kind":"create","start":1.4,"run_time":0.9,"easing":"ease_in_out"}),
            json!({"target":"title","kind":"preset_emphasis_pulse","start":2.4,"run_time":1.0,"easing":"there_and_back"}),
            json!({"target":"title","kind":"fade_out","start":t_out,"run_time":1.0,"easing":"ease_in_out"}),
            json!({"target":"intro_glow_l","kind":"fade_out","start":t_out-0.2,"run_time":0.7,"easing":"ease_in"}),
            json!({"target":"intro_glow_r","kind":"fade_out","start":t_out-0.1,"run_time":0.7,"easing":"ease_in"}),
            json!({"target":"intro_panel","kind":"preset_exit_soft","start":t_out,"run_time":0.8,"easing":"ease_in_out"}),
            json!({"target":"line","kind":"uncreate","start":t_out+0.1,"run_time":0.9,"easing":"ease_in_out"})
        ],
    )
}

fn build_heading_diagram(scene: &PlannedScene, cfg: SceneRenderConfig) -> Value {
    let cx = (cfg.width / 2) as i32;
    let t_out = (scene.duration_seconds - 1.4).max(2.0);
    base_scene(
        scene,
        cfg,
        vec![
            json!({"id":"scene_plate","z_index":2,"type":"rect","width":(cfg.width as f32*0.92),"height":560,"corner_radius":26,"transform":{"x":cx,"y":360},"style":{"fill_rgba":[18,36,76,110],"stroke_rgba":[88,142,235,180],"stroke_width":2,"opacity":0.0}}),
            json!({"id":"heading","z_index":12,"type":"text","text":scene.title,"font_size":52,"transform":{"x":cx,"y":90},"style":{"fill_rgba":[232,241,255,255],"opacity":0.0,"text_max_width":(cfg.width as f32*0.9)}}),
            json!({"id":"box","z_index":8,"type":"rect","width":380,"height":130,"transform":{"x":cx,"y":280},"style":{"fill_rgba":[55,110,210,70],"stroke_rgba":[110,174,255,255],"stroke_width":4,"draw_progress":0.0}}),
            json!({"id":"label","z_index":9,"type":"text","text":"Main Idea","font_size":36,"transform":{"x":cx,"y":280},"style":{"fill_rgba":[230,240,255,255],"opacity":0.0}}),
            json!({"id":"left","z_index":8,"type":"rect","width":250,"height":100,"transform":{"x":350,"y":480},"style":{"fill_rgba":[75,180,130,70],"stroke_rgba":[130,235,182,255],"stroke_width":3,"draw_progress":0.0}}),
            json!({"id":"right","z_index":8,"type":"rect","width":250,"height":100,"transform":{"x":930,"y":480},"style":{"fill_rgba":[230,152,90,70],"stroke_rgba":[255,205,150,255],"stroke_width":3,"draw_progress":0.0}}),
            json!({"id":"arr_l","z_index":6,"type":"arrow","x1":-70,"y1":62,"x2":-210,"y2":165,"transform":{"x":cx,"y":280},"style":{"stroke_rgba":[222,233,255,255],"stroke_width":3,"draw_progress":0.0}}),
            json!({"id":"arr_r","z_index":6,"type":"arrow","x1":70,"y1":62,"x2":210,"y2":165,"transform":{"x":cx,"y":280},"style":{"stroke_rgba":[222,233,255,255],"stroke_width":3,"draw_progress":0.0}}),
            json!({"id":"bridge","z_index":6,"type":"line","x1":-120,"y1":0,"x2":120,"y2":0,"transform":{"x":cx,"y":480},"style":{"stroke_rgba":[185,210,255,200],"stroke_width":2,"draw_progress":0.0}}),
            json!({"id":"left_t","z_index":9,"type":"text","text":"Example A","font_size":30,"transform":{"x":350,"y":480},"style":{"fill_rgba":[222,245,232,255],"opacity":0.0}}),
            json!({"id":"right_t","z_index":9,"type":"text","text":"Example B","font_size":30,"transform":{"x":930,"y":480},"style":{"fill_rgba":[255,234,214,255],"opacity":0.0}}),
            json!({"id":"note","z_index":9,"type":"text","text":visual_line(scene),"font_size":28,"transform":{"x":cx,"y":620},"style":{"fill_rgba":[220,232,255,255],"opacity":0.0,"text_max_width":(cfg.width as f32*0.88)}})
        ],
        vec![
            json!({"target":"scene_plate","kind":"preset_enter_soft","start":0.0,"run_time":0.9,"easing":"ease_out"}),
            json!({"target":"heading","kind":"show_increasing_subsets","start":0.0,"run_time":1.5,"easing":"ease_out"}),
            json!({"target":"box","kind":"draw_border_then_fill","start":1.3,"run_time":1.0,"easing":"ease_in_out"}),
            json!({"target":"label","kind":"fade_in","start":2.1,"run_time":0.8,"easing":"ease_out"}),
            json!({"target":"arr_l","kind":"create","start":2.5,"run_time":0.7,"easing":"ease_in_out"}),
            json!({"target":"arr_r","kind":"create","start":2.8,"run_time":0.7,"easing":"ease_in_out"}),
            json!({"target":"bridge","kind":"create","start":3.0,"run_time":0.7,"easing":"ease_in_out"}),
            json!({"target":"left","kind":"draw_border_then_fill","start":3.0,"run_time":0.9,"easing":"ease_in_out"}),
            json!({"target":"right","kind":"draw_border_then_fill","start":3.2,"run_time":0.9,"easing":"ease_in_out"}),
            json!({"target":"left_t","kind":"preset_text_pop_in","start":3.8,"run_time":0.8,"easing":"ease_out"}),
            json!({"target":"right_t","kind":"preset_text_pop_in","start":3.9,"run_time":0.8,"easing":"ease_out"}),
            json!({"target":"note","kind":"preset_text_typewriter","start":4.3,"run_time":1.4,"easing":"ease_out"}),
            json!({"target":"label","kind":"preset_emphasis_pulse","start":5.2,"run_time":1.0,"easing":"there_and_back"}),
            json!({"target":"heading","kind":"fade_out","start":t_out,"run_time":0.9,"easing":"ease_in_out"}),
            json!({"target":"label","kind":"fade_out","start":t_out,"run_time":0.9,"easing":"ease_in_out"}),
            json!({"target":"note","kind":"preset_exit_soft","start":t_out-0.1,"run_time":0.7,"easing":"ease_in"}),
            json!({"target":"left_t","kind":"fade_out","start":t_out+0.1,"run_time":0.8,"easing":"ease_in_out"}),
            json!({"target":"right_t","kind":"fade_out","start":t_out+0.1,"run_time":0.8,"easing":"ease_in_out"}),
            json!({"target":"arr_l","kind":"uncreate","start":t_out+0.1,"run_time":0.7,"easing":"ease_in_out"}),
            json!({"target":"arr_r","kind":"uncreate","start":t_out+0.2,"run_time":0.7,"easing":"ease_in_out"}),
            json!({"target":"bridge","kind":"uncreate","start":t_out+0.25,"run_time":0.6,"easing":"ease_in"}),
            json!({"target":"left","kind":"uncreate","start":t_out+0.2,"run_time":0.7,"easing":"ease_in_out"}),
            json!({"target":"right","kind":"uncreate","start":t_out+0.3,"run_time":0.7,"easing":"ease_in_out"}),
            json!({"target":"box","kind":"uncreate","start":t_out+0.3,"run_time":0.8,"easing":"ease_in_out"}),
            json!({"target":"scene_plate","kind":"preset_exit_soft","start":t_out+0.35,"run_time":0.8,"easing":"ease_in"})
        ],
    )
}

fn build_concept_cards(scene: &PlannedScene, cfg: SceneRenderConfig) -> Value {
    let cx = (cfg.width / 2) as i32;
    let t_out = (scene.duration_seconds - 1.4).max(2.0);
    base_scene(
        scene,
        cfg,
        vec![
            json!({"id":"cards_plate","z_index":2,"type":"rect","width":(cfg.width as f32*0.94),"height":520,"corner_radius":24,"transform":{"x":cx,"y":350},"style":{"fill_rgba":[20,35,72,90],"stroke_rgba":[98,160,240,155],"stroke_width":2,"opacity":0.0}}),
            json!({"id":"heading","z_index":12,"type":"text","text":scene.title,"font_size":50,"transform":{"x":cx,"y":92},"style":{"fill_rgba":[232,241,255,255],"opacity":0.0}}),
            json!({"id":"c1","z_index":8,"type":"rect","width":300,"height":95,"transform":{"x":250,"y":280},"style":{"fill_rgba":[58,112,212,70],"stroke_rgba":[110,175,255,255],"stroke_width":3,"draw_progress":0.0}}),
            json!({"id":"c2","z_index":8,"type":"rect","width":300,"height":95,"transform":{"x":640,"y":280},"style":{"fill_rgba":[76,182,130,70],"stroke_rgba":[132,236,183,255],"stroke_width":3,"draw_progress":0.0}}),
            json!({"id":"c3","z_index":8,"type":"rect","width":300,"height":95,"transform":{"x":1030,"y":280},"style":{"fill_rgba":[230,152,92,70],"stroke_rgba":[255,206,150,255],"stroke_width":3,"draw_progress":0.0}}),
            json!({"id":"arrow_12","z_index":7,"type":"arrow","x1":-140,"y1":0,"x2":-20,"y2":0,"transform":{"x":640,"y":280},"style":{"stroke_rgba":[220,232,255,230],"stroke_width":3,"draw_progress":0.0}}),
            json!({"id":"arrow_23","z_index":7,"type":"arrow","x1":20,"y1":0,"x2":140,"y2":0,"transform":{"x":640,"y":280},"style":{"stroke_rgba":[220,232,255,230],"stroke_width":3,"draw_progress":0.0}}),
            json!({"id":"t1","z_index":9,"type":"text","text":"Principle 1","font_size":30,"transform":{"x":250,"y":280},"style":{"fill_rgba":[230,240,255,255],"opacity":0.0}}),
            json!({"id":"t2","z_index":9,"type":"text","text":"Principle 2","font_size":30,"transform":{"x":640,"y":280},"style":{"fill_rgba":[222,245,232,255],"opacity":0.0}}),
            json!({"id":"t3","z_index":9,"type":"text","text":"Principle 3","font_size":30,"transform":{"x":1030,"y":280},"style":{"fill_rgba":[255,236,214,255],"opacity":0.0}}),
            json!({"id":"desc","z_index":10,"type":"text","text":visual_line(scene),"font_size":34,"transform":{"x":640,"y":450},"style":{"fill_rgba":[230,239,255,255],"opacity":0.0,"text_max_width":1100}})
        ],
        vec![
            json!({"target":"cards_plate","kind":"preset_enter_soft","start":0.0,"run_time":0.9,"easing":"ease_out"}),
            json!({"target":"heading","kind":"show_increasing_subsets","start":0.0,"run_time":1.4,"easing":"ease_out"}),
            json!({"target":"c1","kind":"draw_border_then_fill","start":1.2,"run_time":0.8,"easing":"ease_in_out"}),
            json!({"target":"c2","kind":"draw_border_then_fill","start":1.5,"run_time":0.8,"easing":"ease_in_out"}),
            json!({"target":"c3","kind":"draw_border_then_fill","start":1.8,"run_time":0.8,"easing":"ease_in_out"}),
            json!({"target":"arrow_12","kind":"create","start":2.0,"run_time":0.7,"easing":"ease_in_out"}),
            json!({"target":"arrow_23","kind":"create","start":2.25,"run_time":0.7,"easing":"ease_in_out"}),
            json!({"target":"t1","kind":"preset_text_pop_in","start":1.9,"run_time":0.7,"easing":"ease_out"}),
            json!({"target":"t2","kind":"preset_text_pop_in","start":2.2,"run_time":0.7,"easing":"ease_out"}),
            json!({"target":"t3","kind":"preset_text_pop_in","start":2.5,"run_time":0.7,"easing":"ease_out"}),
            json!({"target":"desc","kind":"preset_text_typewriter","start":3.0,"run_time":1.6,"easing":"ease_in_out"}),
            json!({"target":"t2","kind":"preset_text_glow_pulse","start":4.7,"run_time":1.1,"easing":"there_and_back"}),
            json!({"target":"heading","kind":"fade_out","start":t_out,"run_time":0.9,"easing":"ease_in_out"}),
            json!({"target":"desc","kind":"fade_out","start":t_out,"run_time":0.9,"easing":"ease_in_out"}),
            json!({"target":"t1","kind":"fade_out","start":t_out+0.1,"run_time":0.8,"easing":"ease_in_out"}),
            json!({"target":"t2","kind":"fade_out","start":t_out+0.1,"run_time":0.8,"easing":"ease_in_out"}),
            json!({"target":"t3","kind":"fade_out","start":t_out+0.2,"run_time":0.8,"easing":"ease_in_out"}),
            json!({"target":"arrow_12","kind":"uncreate","start":t_out+0.15,"run_time":0.7,"easing":"ease_in"}),
            json!({"target":"arrow_23","kind":"uncreate","start":t_out+0.2,"run_time":0.7,"easing":"ease_in"}),
            json!({"target":"c1","kind":"uncreate","start":t_out+0.2,"run_time":0.7,"easing":"ease_in_out"}),
            json!({"target":"c2","kind":"uncreate","start":t_out+0.3,"run_time":0.7,"easing":"ease_in_out"}),
            json!({"target":"c3","kind":"uncreate","start":t_out+0.4,"run_time":0.7,"easing":"ease_in_out"}),
            json!({"target":"cards_plate","kind":"preset_exit_soft","start":t_out+0.35,"run_time":0.7,"easing":"ease_in"})
        ],
    )
}

fn build_formula_flow(scene: &PlannedScene, cfg: SceneRenderConfig) -> Value {
    let cx = (cfg.width / 2) as i32;
    let t_out = (scene.duration_seconds - 1.3).max(2.0);
    base_scene(
        scene,
        cfg,
        vec![
            json!({"id":"flow_plate","z_index":2,"type":"rect","width":(cfg.width as f32*0.9),"height":440,"corner_radius":24,"transform":{"x":cx,"y":300},"style":{"fill_rgba":[22,36,72,100],"stroke_rgba":[100,164,242,165],"stroke_width":2,"opacity":0.0}}),
            json!({"id":"heading","z_index":12,"type":"text","text":scene.title,"font_size":52,"transform":{"x":cx,"y":90},"style":{"fill_rgba":[232,241,255,255],"opacity":0.0}}),
            json!({"id":"f1","z_index":9,"type":"text","text":"Input -> Process -> Output","font_size":44,"transform":{"x":cx,"y":260},"style":{"fill_rgba":[255,226,140,255],"opacity":0.0}}),
            json!({"id":"f2","z_index":9,"type":"text","text":"Step 1 + Step 2 + Step 3","font_size":44,"transform":{"x":cx,"y":260},"style":{"fill_rgba":[255,198,132,255],"opacity":0.0}}),
            json!({"id":"f3","z_index":9,"type":"text","text":"Final behavior at runtime","font_size":46,"transform":{"x":cx,"y":260},"style":{"fill_rgba":[140,245,175,255],"opacity":0.0}}),
            json!({"id":"bar","z_index":8,"type":"rect","width":760,"height":100,"transform":{"x":cx,"y":260},"style":{"fill_rgba":[56,108,214,50],"stroke_rgba":[110,175,255,255],"stroke_width":3,"draw_progress":0.0}}),
            json!({"id":"flow_left","z_index":8,"type":"circle","radius":24,"transform":{"x":(cx-320),"y":260},"style":{"fill_rgba":[84,170,255,190],"stroke_rgba":[220,236,255,255],"stroke_width":2,"opacity":0.0}}),
            json!({"id":"flow_mid","z_index":8,"type":"circle","radius":24,"transform":{"x":cx,"y":260},"style":{"fill_rgba":[255,196,115,190],"stroke_rgba":[255,229,185,255],"stroke_width":2,"opacity":0.0}}),
            json!({"id":"flow_right","z_index":8,"type":"circle","radius":24,"transform":{"x":(cx+320),"y":260},"style":{"fill_rgba":[118,223,156,190],"stroke_rgba":[210,244,225,255],"stroke_width":2,"opacity":0.0}})
        ],
        vec![
            json!({"target":"flow_plate","kind":"preset_enter_soft","start":0.0,"run_time":0.9,"easing":"ease_out"}),
            json!({"target":"heading","kind":"write","start":0.0,"run_time":1.6,"easing":"ease_out"}),
            json!({"target":"bar","kind":"draw_border_then_fill","start":1.0,"run_time":1.0,"easing":"ease_in_out"}),
            json!({"target":"flow_left","kind":"preset_enter_rise","start":1.5,"run_time":0.7,"easing":"ease_out"}),
            json!({"target":"flow_mid","kind":"preset_enter_rise","start":1.7,"run_time":0.7,"easing":"ease_out"}),
            json!({"target":"flow_right","kind":"preset_enter_rise","start":1.9,"run_time":0.7,"easing":"ease_out"}),
            json!({"target":"f1","kind":"show_increasing_subsets","start":1.8,"run_time":1.4,"easing":"ease_out"}),
            json!({"target":"f1","kind":"replacement_transform","replace_with":"f2","start":4.0,"run_time":1.0,"easing":"ease_in_out"}),
            json!({"target":"f2","kind":"replacement_transform","replace_with":"f3","start":6.0,"run_time":1.0,"easing":"ease_in_out"}),
            json!({"target":"f3","kind":"preset_text_glow_pulse","start":7.2,"run_time":1.0,"easing":"there_and_back"}),
            json!({"target":"heading","kind":"fade_out","start":t_out,"run_time":0.9,"easing":"ease_in_out"}),
            json!({"target":"f3","kind":"fade_out","start":t_out+0.1,"run_time":0.9,"easing":"ease_in_out"}),
            json!({"target":"flow_left","kind":"preset_exit_drop","start":t_out,"run_time":0.7,"easing":"ease_in"}),
            json!({"target":"flow_mid","kind":"preset_exit_drop","start":t_out+0.1,"run_time":0.7,"easing":"ease_in"}),
            json!({"target":"flow_right","kind":"preset_exit_drop","start":t_out+0.2,"run_time":0.7,"easing":"ease_in"}),
            json!({"target":"bar","kind":"uncreate","start":t_out+0.2,"run_time":0.9,"easing":"ease_in_out"})
        ],
    )
}

fn build_split_compare(scene: &PlannedScene, cfg: SceneRenderConfig) -> Value {
    let cx = (cfg.width / 2) as i32;
    let t_out = (scene.duration_seconds - 1.3).max(2.0);
    base_scene(
        scene,
        cfg,
        vec![
            json!({"id":"split_panel","z_index":2,"type":"rect","width":(cfg.width as f32*0.94),"height":560,"corner_radius":26,"transform":{"x":cx,"y":350},"style":{"fill_rgba":[18,34,70,105],"stroke_rgba":[98,166,248,180],"stroke_width":2,"opacity":0.0}}),
            json!({"id":"heading","z_index":12,"type":"text","text":scene.title,"font_size":48,"transform":{"x":cx,"y":88},"style":{"fill_rgba":[235,243,255,255],"opacity":0.0,"text_max_width":1100}}),
            json!({"id":"split_line","z_index":7,"type":"line","x1":0,"y1":-190,"x2":0,"y2":220,"transform":{"x":cx,"y":350},"style":{"stroke_rgba":[158,198,255,210],"stroke_width":3,"draw_progress":0.0}}),
            json!({"id":"left_card","z_index":8,"type":"rect","width":430,"height":330,"corner_radius":18,"transform":{"x":400,"y":360},"style":{"fill_rgba":[54,110,210,68],"stroke_rgba":[114,180,255,255],"stroke_width":3,"draw_progress":0.0}}),
            json!({"id":"right_card","z_index":8,"type":"rect","width":430,"height":330,"corner_radius":18,"transform":{"x":880,"y":360},"style":{"fill_rgba":[78,182,136,68],"stroke_rgba":[138,236,192,255],"stroke_width":3,"draw_progress":0.0}}),
            json!({"id":"left_title","z_index":9,"type":"text","text":"Approach A","font_size":34,"transform":{"x":400,"y":235},"style":{"fill_rgba":[228,238,255,255],"opacity":0.0}}),
            json!({"id":"right_title","z_index":9,"type":"text","text":"Approach B","font_size":34,"transform":{"x":880,"y":235},"style":{"fill_rgba":[225,247,236,255],"opacity":0.0}}),
            json!({"id":"left_body","z_index":10,"type":"text","text":"Strengths\\n- easy start\\n- clear structure","font_size":28,"transform":{"x":400,"y":365},"style":{"fill_rgba":[228,236,255,255],"opacity":0.0,"line_height_mult":1.2}}),
            json!({"id":"right_body","z_index":10,"type":"text","text":"Strengths\\n- more flexible\\n- scales better","font_size":28,"transform":{"x":880,"y":365},"style":{"fill_rgba":[224,246,236,255],"opacity":0.0,"line_height_mult":1.2}}),
            json!({"id":"decision","z_index":11,"type":"text","text":visual_line(scene),"font_size":30,"transform":{"x":cx,"y":600},"style":{"fill_rgba":[230,239,255,255],"opacity":0.0,"text_max_width":1120}})
        ],
        vec![
            json!({"target":"split_panel","kind":"preset_enter_soft","start":0.0,"run_time":0.8,"easing":"ease_out"}),
            json!({"target":"heading","kind":"preset_text_typewriter","start":0.0,"run_time":1.3,"easing":"ease_out"}),
            json!({"target":"split_line","kind":"create","start":1.0,"run_time":0.8,"easing":"ease_in_out"}),
            json!({"target":"left_card","kind":"draw_border_then_fill","start":1.4,"run_time":0.9,"easing":"ease_in_out"}),
            json!({"target":"right_card","kind":"draw_border_then_fill","start":1.7,"run_time":0.9,"easing":"ease_in_out"}),
            json!({"target":"left_title","kind":"preset_text_pop_in","start":2.1,"run_time":0.7,"easing":"ease_out"}),
            json!({"target":"right_title","kind":"preset_text_pop_in","start":2.3,"run_time":0.7,"easing":"ease_out"}),
            json!({"target":"left_body","kind":"preset_text_typewriter","start":2.6,"run_time":1.4,"easing":"ease_out"}),
            json!({"target":"right_body","kind":"preset_text_typewriter","start":3.0,"run_time":1.4,"easing":"ease_out"}),
            json!({"target":"decision","kind":"preset_text_typewriter","start":4.2,"run_time":1.5,"easing":"ease_out"}),
            json!({"target":"decision","kind":"preset_text_glow_pulse","start":5.8,"run_time":1.0,"easing":"there_and_back"}),
            json!({"target":"heading","kind":"fade_out","start":t_out,"run_time":0.8,"easing":"ease_in"}),
            json!({"target":"left_body","kind":"fade_out","start":t_out+0.05,"run_time":0.75,"easing":"ease_in"}),
            json!({"target":"right_body","kind":"fade_out","start":t_out+0.1,"run_time":0.75,"easing":"ease_in"}),
            json!({"target":"decision","kind":"fade_out","start":t_out+0.1,"run_time":0.75,"easing":"ease_in"}),
            json!({"target":"left_title","kind":"fade_out","start":t_out+0.15,"run_time":0.6,"easing":"ease_in"}),
            json!({"target":"right_title","kind":"fade_out","start":t_out+0.2,"run_time":0.6,"easing":"ease_in"}),
            json!({"target":"left_card","kind":"uncreate","start":t_out+0.2,"run_time":0.7,"easing":"ease_in_out"}),
            json!({"target":"right_card","kind":"uncreate","start":t_out+0.3,"run_time":0.7,"easing":"ease_in_out"}),
            json!({"target":"split_line","kind":"uncreate","start":t_out+0.25,"run_time":0.6,"easing":"ease_in"}),
            json!({"target":"split_panel","kind":"preset_exit_soft","start":t_out+0.3,"run_time":0.7,"easing":"ease_in"})
        ],
    )
}

fn build_timeline_ladder(scene: &PlannedScene, cfg: SceneRenderConfig) -> Value {
    let cx = (cfg.width / 2) as i32;
    let t_out = (scene.duration_seconds - 1.3).max(2.0);
    base_scene(
        scene,
        cfg,
        vec![
            json!({"id":"ladder_panel","z_index":2,"type":"rect","width":(cfg.width as f32*0.92),"height":560,"corner_radius":24,"transform":{"x":cx,"y":350},"style":{"fill_rgba":[20,35,74,98],"stroke_rgba":[104,170,248,180],"stroke_width":2,"opacity":0.0}}),
            json!({"id":"heading","z_index":12,"type":"text","text":scene.title,"font_size":48,"transform":{"x":cx,"y":88},"style":{"fill_rgba":[234,242,255,255],"opacity":0.0,"text_max_width":1090}}),
            json!({"id":"rail","z_index":7,"type":"line","x1":0,"y1":-190,"x2":0,"y2":220,"transform":{"x":260,"y":350},"style":{"stroke_rgba":[150,195,255,220],"stroke_width":4,"draw_progress":0.0}}),
            json!({"id":"s1","z_index":9,"type":"circle","radius":26,"transform":{"x":260,"y":205},"style":{"fill_rgba":[84,160,255,200],"stroke_rgba":[214,232,255,255],"stroke_width":2,"opacity":0.0}}),
            json!({"id":"s2","z_index":9,"type":"circle","radius":26,"transform":{"x":260,"y":305},"style":{"fill_rgba":[118,196,146,200],"stroke_rgba":[218,247,232,255],"stroke_width":2,"opacity":0.0}}),
            json!({"id":"s3","z_index":9,"type":"circle","radius":26,"transform":{"x":260,"y":405},"style":{"fill_rgba":[248,182,106,200],"stroke_rgba":[255,236,205,255],"stroke_width":2,"opacity":0.0}}),
            json!({"id":"s4","z_index":9,"type":"circle","radius":26,"transform":{"x":260,"y":505},"style":{"fill_rgba":[196,154,255,200],"stroke_rgba":[238,221,255,255],"stroke_width":2,"opacity":0.0}}),
            json!({"id":"b1","z_index":8,"type":"rect","width":760,"height":82,"corner_radius":14,"transform":{"x":760,"y":205},"style":{"fill_rgba":[52,108,210,66],"stroke_rgba":[112,178,255,255],"stroke_width":2,"draw_progress":0.0}}),
            json!({"id":"b2","z_index":8,"type":"rect","width":760,"height":82,"corner_radius":14,"transform":{"x":760,"y":305},"style":{"fill_rgba":[72,176,132,66],"stroke_rgba":[132,236,190,255],"stroke_width":2,"draw_progress":0.0}}),
            json!({"id":"b3","z_index":8,"type":"rect","width":760,"height":82,"corner_radius":14,"transform":{"x":760,"y":405},"style":{"fill_rgba":[238,166,96,66],"stroke_rgba":[255,216,158,255],"stroke_width":2,"draw_progress":0.0}}),
            json!({"id":"b4","z_index":8,"type":"rect","width":760,"height":82,"corner_radius":14,"transform":{"x":760,"y":505},"style":{"fill_rgba":[182,136,252,66],"stroke_rgba":[228,210,255,255],"stroke_width":2,"draw_progress":0.0}}),
            json!({"id":"txt","z_index":10,"type":"text","text":visual_line(scene),"font_size":26,"transform":{"x":760,"y":355},"style":{"fill_rgba":[226,238,255,255],"opacity":0.0,"text_max_width":720,"line_height_mult":1.18}})
        ],
        vec![
            json!({"target":"ladder_panel","kind":"preset_enter_soft","start":0.0,"run_time":0.8,"easing":"ease_out"}),
            json!({"target":"heading","kind":"show_increasing_subsets","start":0.0,"run_time":1.3,"easing":"ease_out"}),
            json!({"target":"rail","kind":"create","start":0.9,"run_time":0.9,"easing":"ease_in_out"}),
            json!({"target":"s1","kind":"preset_enter_rise","start":1.5,"run_time":0.45,"easing":"ease_out"}),
            json!({"target":"b1","kind":"draw_border_then_fill","start":1.6,"run_time":0.7,"easing":"ease_in_out"}),
            json!({"target":"s2","kind":"preset_enter_rise","start":2.1,"run_time":0.45,"easing":"ease_out"}),
            json!({"target":"b2","kind":"draw_border_then_fill","start":2.2,"run_time":0.7,"easing":"ease_in_out"}),
            json!({"target":"s3","kind":"preset_enter_rise","start":2.7,"run_time":0.45,"easing":"ease_out"}),
            json!({"target":"b3","kind":"draw_border_then_fill","start":2.8,"run_time":0.7,"easing":"ease_in_out"}),
            json!({"target":"s4","kind":"preset_enter_rise","start":3.3,"run_time":0.45,"easing":"ease_out"}),
            json!({"target":"b4","kind":"draw_border_then_fill","start":3.4,"run_time":0.7,"easing":"ease_in_out"}),
            json!({"target":"txt","kind":"preset_text_typewriter","start":4.0,"run_time":2.0,"easing":"ease_out"}),
            json!({"target":"txt","kind":"preset_text_glow_pulse","start":6.2,"run_time":0.9,"easing":"there_and_back"}),
            json!({"target":"txt","kind":"fade_out","start":t_out,"run_time":0.8,"easing":"ease_in"}),
            json!({"target":"heading","kind":"fade_out","start":t_out+0.05,"run_time":0.8,"easing":"ease_in"}),
            json!({"target":"b1","kind":"uncreate","start":t_out+0.1,"run_time":0.55,"easing":"ease_in"}),
            json!({"target":"b2","kind":"uncreate","start":t_out+0.2,"run_time":0.55,"easing":"ease_in"}),
            json!({"target":"b3","kind":"uncreate","start":t_out+0.3,"run_time":0.55,"easing":"ease_in"}),
            json!({"target":"b4","kind":"uncreate","start":t_out+0.4,"run_time":0.55,"easing":"ease_in"}),
            json!({"target":"s1","kind":"preset_exit_drop","start":t_out+0.2,"run_time":0.45,"easing":"ease_in"}),
            json!({"target":"s2","kind":"preset_exit_drop","start":t_out+0.3,"run_time":0.45,"easing":"ease_in"}),
            json!({"target":"s3","kind":"preset_exit_drop","start":t_out+0.4,"run_time":0.45,"easing":"ease_in"}),
            json!({"target":"s4","kind":"preset_exit_drop","start":t_out+0.5,"run_time":0.45,"easing":"ease_in"}),
            json!({"target":"rail","kind":"uncreate","start":t_out+0.35,"run_time":0.55,"easing":"ease_in"}),
            json!({"target":"ladder_panel","kind":"preset_exit_soft","start":t_out+0.45,"run_time":0.65,"easing":"ease_in"})
        ],
    )
}

fn build_array_compare_swap(scene: &PlannedScene, cfg: SceneRenderConfig) -> Value {
    let cx = (cfg.width / 2) as i32;
    let t_out = (scene.duration_seconds - 1.2).max(2.1);
    base_scene(
        scene,
        cfg,
        vec![
            json!({"id":"stage","z_index":2,"type":"rect","width":(cfg.width as f32*0.95),"height":560,"corner_radius":24,"transform":{"x":cx,"y":350},"style":{"fill_rgba":[18,34,70,102],"stroke_rgba":[100,168,248,175],"stroke_width":2,"opacity":0.0}}),
            json!({"id":"heading","z_index":12,"type":"text","text":scene.title,"font_size":48,"transform":{"x":cx,"y":88},"style":{"fill_rgba":[236,243,255,255],"opacity":0.0,"text_max_width":1100}}),
            json!({"id":"n1","z_index":9,"type":"rect","width":120,"height":120,"corner_radius":14,"transform":{"x":340,"y":300},"style":{"fill_rgba":[56,112,214,95],"stroke_rgba":[122,186,255,255],"stroke_width":3,"draw_progress":0.0}}),
            json!({"id":"n2","z_index":9,"type":"rect","width":120,"height":120,"corner_radius":14,"transform":{"x":500,"y":300},"style":{"fill_rgba":[56,112,214,95],"stroke_rgba":[122,186,255,255],"stroke_width":3,"draw_progress":0.0}}),
            json!({"id":"n3","z_index":9,"type":"rect","width":120,"height":120,"corner_radius":14,"transform":{"x":660,"y":300},"style":{"fill_rgba":[56,112,214,95],"stroke_rgba":[122,186,255,255],"stroke_width":3,"draw_progress":0.0}}),
            json!({"id":"n4","z_index":9,"type":"rect","width":120,"height":120,"corner_radius":14,"transform":{"x":820,"y":300},"style":{"fill_rgba":[56,112,214,95],"stroke_rgba":[122,186,255,255],"stroke_width":3,"draw_progress":0.0}}),
            json!({"id":"n5","z_index":9,"type":"rect","width":120,"height":120,"corner_radius":14,"transform":{"x":980,"y":300},"style":{"fill_rgba":[56,112,214,95],"stroke_rgba":[122,186,255,255],"stroke_width":3,"draw_progress":0.0}}),
            json!({"id":"t1","z_index":10,"type":"text","text":"A","font_size":42,"transform":{"x":340,"y":300},"style":{"fill_rgba":[228,240,255,255],"opacity":0.0}}),
            json!({"id":"t2","z_index":10,"type":"text","text":"B","font_size":42,"transform":{"x":500,"y":300},"style":{"fill_rgba":[228,240,255,255],"opacity":0.0}}),
            json!({"id":"t3","z_index":10,"type":"text","text":"C","font_size":42,"transform":{"x":660,"y":300},"style":{"fill_rgba":[228,240,255,255],"opacity":0.0}}),
            json!({"id":"t4","z_index":10,"type":"text","text":"D","font_size":42,"transform":{"x":820,"y":300},"style":{"fill_rgba":[228,240,255,255],"opacity":0.0}}),
            json!({"id":"t5","z_index":10,"type":"text","text":"E","font_size":42,"transform":{"x":980,"y":300},"style":{"fill_rgba":[228,240,255,255],"opacity":0.0}}),
            json!({"id":"cmp_arrow","z_index":8,"type":"arrow","x1":-70,"y1":0,"x2":70,"y2":0,"transform":{"x":420,"y":210},"style":{"stroke_rgba":[255,210,138,255],"stroke_width":3,"draw_progress":0.0,"opacity":0.0}}),
            json!({"id":"swap_arrow","z_index":8,"type":"arrow","x1":-40,"y1":0,"x2":40,"y2":0,"transform":{"x":740,"y":210},"style":{"stroke_rgba":[138,236,186,255],"stroke_width":3,"draw_progress":0.0,"opacity":0.0}}),
            json!({"id":"caption","z_index":11,"type":"text","text":visual_line(scene),"font_size":30,"transform":{"x":cx,"y":610},"style":{"fill_rgba":[230,240,255,255],"opacity":0.0,"text_max_width":1130}})
        ],
        vec![
            json!({"target":"stage","kind":"preset_enter_soft","start":0.0,"run_time":0.75,"easing":"ease_out"}),
            json!({"target":"heading","kind":"preset_text_typewriter","start":0.0,"run_time":1.2,"easing":"ease_out"}),
            json!({"target":"n1","kind":"draw_border_then_fill","start":0.9,"run_time":0.55,"easing":"ease_in_out"}),
            json!({"target":"n2","kind":"draw_border_then_fill","start":1.05,"run_time":0.55,"easing":"ease_in_out"}),
            json!({"target":"n3","kind":"draw_border_then_fill","start":1.2,"run_time":0.55,"easing":"ease_in_out"}),
            json!({"target":"n4","kind":"draw_border_then_fill","start":1.35,"run_time":0.55,"easing":"ease_in_out"}),
            json!({"target":"n5","kind":"draw_border_then_fill","start":1.5,"run_time":0.55,"easing":"ease_in_out"}),
            json!({"target":"t1","kind":"preset_text_pop_in","start":1.55,"run_time":0.45,"easing":"ease_out"}),
            json!({"target":"t2","kind":"preset_text_pop_in","start":1.68,"run_time":0.45,"easing":"ease_out"}),
            json!({"target":"t3","kind":"preset_text_pop_in","start":1.81,"run_time":0.45,"easing":"ease_out"}),
            json!({"target":"t4","kind":"preset_text_pop_in","start":1.94,"run_time":0.45,"easing":"ease_out"}),
            json!({"target":"t5","kind":"preset_text_pop_in","start":2.07,"run_time":0.45,"easing":"ease_out"}),
            json!({"target":"cmp_arrow","kind":"create","start":2.4,"run_time":0.6,"easing":"ease_in_out"}),
            json!({"target":"n1","kind":"preset_emphasis_pulse","start":2.7,"run_time":0.65,"easing":"there_and_back"}),
            json!({"target":"n2","kind":"preset_emphasis_pulse","start":2.8,"run_time":0.65,"easing":"there_and_back"}),
            json!({"target":"swap_arrow","kind":"create","start":3.8,"run_time":0.6,"easing":"ease_in_out"}),
            json!({"target":"n3","kind":"transform","start":4.2,"run_time":0.8,"to_x":820.0,"easing":"ease_in_out"}),
            json!({"target":"n4","kind":"transform","start":4.2,"run_time":0.8,"to_x":660.0,"easing":"ease_in_out"}),
            json!({"target":"t3","kind":"transform","start":4.2,"run_time":0.8,"to_x":820.0,"easing":"ease_in_out"}),
            json!({"target":"t4","kind":"transform","start":4.2,"run_time":0.8,"to_x":660.0,"easing":"ease_in_out"}),
            json!({"target":"caption","kind":"preset_text_typewriter","start":5.1,"run_time":1.5,"easing":"ease_out"}),
            json!({"target":"caption","kind":"preset_text_glow_pulse","start":6.8,"run_time":0.9,"easing":"there_and_back"}),
            json!({"target":"cmp_arrow","kind":"uncreate","start":t_out-0.1,"run_time":0.6,"easing":"ease_in"}),
            json!({"target":"swap_arrow","kind":"uncreate","start":t_out,"run_time":0.6,"easing":"ease_in"}),
            json!({"target":"caption","kind":"fade_out","start":t_out,"run_time":0.7,"easing":"ease_in"}),
            json!({"target":"t1","kind":"fade_out","start":t_out+0.1,"run_time":0.55,"easing":"ease_in"}),
            json!({"target":"t2","kind":"fade_out","start":t_out+0.15,"run_time":0.55,"easing":"ease_in"}),
            json!({"target":"t3","kind":"fade_out","start":t_out+0.2,"run_time":0.55,"easing":"ease_in"}),
            json!({"target":"t4","kind":"fade_out","start":t_out+0.25,"run_time":0.55,"easing":"ease_in"}),
            json!({"target":"t5","kind":"fade_out","start":t_out+0.3,"run_time":0.55,"easing":"ease_in"}),
            json!({"target":"n1","kind":"uncreate","start":t_out+0.2,"run_time":0.6,"easing":"ease_in"}),
            json!({"target":"n2","kind":"uncreate","start":t_out+0.25,"run_time":0.6,"easing":"ease_in"}),
            json!({"target":"n3","kind":"uncreate","start":t_out+0.3,"run_time":0.6,"easing":"ease_in"}),
            json!({"target":"n4","kind":"uncreate","start":t_out+0.35,"run_time":0.6,"easing":"ease_in"}),
            json!({"target":"n5","kind":"uncreate","start":t_out+0.4,"run_time":0.6,"easing":"ease_in"}),
            json!({"target":"heading","kind":"fade_out","start":t_out+0.25,"run_time":0.7,"easing":"ease_in"}),
            json!({"target":"stage","kind":"preset_exit_soft","start":t_out+0.35,"run_time":0.7,"easing":"ease_in"})
        ],
    )
}

fn build_recap_outro(scene: &PlannedScene, cfg: SceneRenderConfig) -> Value {
    let cx = (cfg.width / 2) as i32;
    let t_out = (scene.duration_seconds - 1.2).max(1.6);
    base_scene(
        scene,
        cfg,
        vec![
            json!({"id":"recap_panel","z_index":2,"type":"rect","width":(cfg.width as f32*0.9),"height":420,"corner_radius":24,"transform":{"x":cx,"y":320},"style":{"fill_rgba":[22,40,82,105],"stroke_rgba":[112,178,255,185],"stroke_width":2,"opacity":0.0}}),
            json!({"id":"title","z_index":12,"type":"text","text":"Recap","font_size":64,"transform":{"x":cx,"y":170},"style":{"fill_rgba":[236,243,255,255],"opacity":0.0}}),
            json!({"id":"line","z_index":11,"type":"line","x1":-260,"y1":0,"x2":260,"y2":0,"transform":{"x":cx,"y":225},"style":{"stroke_rgba":[120,185,255,255],"stroke_width":5,"draw_progress":0.0}}),
            json!({"id":"body","z_index":10,"type":"text","text":visual_line(scene),"font_size":34,"transform":{"x":cx,"y":340},"style":{"fill_rgba":[232,240,255,255],"opacity":0.0,"text_max_width":1080,"line_height_mult":1.24}}),
            json!({"id":"check1","z_index":10,"type":"circle","radius":12,"transform":{"x":(cx-430),"y":450},"style":{"fill_rgba":[120,220,165,255],"stroke_rgba":[200,248,228,255],"stroke_width":2,"opacity":0.0}}),
            json!({"id":"check2","z_index":10,"type":"circle","radius":12,"transform":{"x":(cx-150),"y":450},"style":{"fill_rgba":[120,220,165,255],"stroke_rgba":[200,248,228,255],"stroke_width":2,"opacity":0.0}}),
            json!({"id":"check3","z_index":10,"type":"circle","radius":12,"transform":{"x":(cx+140),"y":450},"style":{"fill_rgba":[120,220,165,255],"stroke_rgba":[200,248,228,255],"stroke_width":2,"opacity":0.0}}),
            json!({"id":"check4","z_index":10,"type":"circle","radius":12,"transform":{"x":(cx+420),"y":450},"style":{"fill_rgba":[120,220,165,255],"stroke_rgba":[200,248,228,255],"stroke_width":2,"opacity":0.0}})
        ],
        vec![
            json!({"target":"recap_panel","kind":"preset_enter_soft","start":0.0,"run_time":0.8,"easing":"ease_out"}),
            json!({"target":"title","kind":"write","start":0.0,"run_time":1.3,"easing":"ease_out"}),
            json!({"target":"line","kind":"create","start":0.9,"run_time":0.8,"easing":"ease_in_out"}),
            json!({"target":"body","kind":"preset_text_typewriter","start":1.7,"run_time":2.2,"easing":"ease_out"}),
            json!({"target":"check1","kind":"preset_enter_rise","start":2.4,"run_time":0.5,"easing":"ease_out"}),
            json!({"target":"check2","kind":"preset_enter_rise","start":2.55,"run_time":0.5,"easing":"ease_out"}),
            json!({"target":"check3","kind":"preset_enter_rise","start":2.7,"run_time":0.5,"easing":"ease_out"}),
            json!({"target":"check4","kind":"preset_enter_rise","start":2.85,"run_time":0.5,"easing":"ease_out"}),
            json!({"target":"body","kind":"preset_text_glow_pulse","start":4.2,"run_time":1.2,"easing":"there_and_back"}),
            json!({"target":"title","kind":"fade_out","start":t_out,"run_time":0.9,"easing":"ease_in_out"}),
            json!({"target":"line","kind":"uncreate","start":t_out+0.1,"run_time":0.8,"easing":"ease_in_out"}),
            json!({"target":"body","kind":"fade_out","start":t_out+0.1,"run_time":0.9,"easing":"ease_in_out"}),
            json!({"target":"check1","kind":"preset_exit_soft","start":t_out+0.05,"run_time":0.55,"easing":"ease_in"}),
            json!({"target":"check2","kind":"preset_exit_soft","start":t_out+0.1,"run_time":0.55,"easing":"ease_in"}),
            json!({"target":"check3","kind":"preset_exit_soft","start":t_out+0.15,"run_time":0.55,"easing":"ease_in"}),
            json!({"target":"check4","kind":"preset_exit_soft","start":t_out+0.2,"run_time":0.55,"easing":"ease_in"}),
            json!({"target":"recap_panel","kind":"preset_exit_soft","start":t_out+0.2,"run_time":0.7,"easing":"ease_in"})
        ],
    )
}

fn build_teacher_explainer(scene: &PlannedScene, cfg: SceneRenderConfig) -> Value {
    let cx = (cfg.width / 2) as i32;
    let t_out = (scene.duration_seconds - 1.5).max(2.4);
    let (teacher_style, student_style) = pick_character_styles(scene);
    let mut layers = vec![
        json!({"id":"teach_panel","z_index":2,"type":"rect","width":(cfg.width as f32*0.95),"height":560,"corner_radius":24,"transform":{"x":cx,"y":350},"style":{"fill_rgba":[19,34,70,110],"stroke_rgba":[102,166,246,168],"stroke_width":2,"opacity":0.0}}),
        json!({"id":"teach_heading","z_index":12,"type":"text","text":scene.title,"font_size":48,"transform":{"x":cx,"y":90},"style":{"fill_rgba":[236,243,255,255],"opacity":0.0,"text_max_width":(cfg.width as f32*0.9)}}),
        json!({"id":"board","z_index":6,"type":"rect","width":700,"height":340,"corner_radius":18,"transform":{"x":860,"y":320},"style":{"fill_rgba":[26,52,100,160],"stroke_rgba":[122,190,255,255],"stroke_width":3,"opacity":0.0}}),
        json!({"id":"board_title","z_index":8,"type":"text","text":"Key concept","font_size":34,"transform":{"x":860,"y":220},"style":{"fill_rgba":[230,241,255,255],"opacity":0.0}}),
        json!({"id":"board_body","z_index":8,"type":"text","text":visual_line(scene),"font_size":28,"transform":{"x":860,"y":320},"style":{"fill_rgba":[220,235,255,255],"opacity":0.0,"text_max_width":620,"line_height_mult":1.2}}),
        json!({"id":"pointer","z_index":9,"type":"arrow","x1":0,"y1":0,"x2":210,"y2":-70,"transform":{"x":435,"y":330},"style":{"stroke_rgba":[232,241,255,255],"stroke_width":3,"draw_progress":0.0,"opacity":0.0}})
    ];
    layers.extend(character_layers("teacher", 380, 360, 8, &teacher_style));
    layers.extend(character_layers("student", 520, 485, 7, &student_style));

    let mut specs = vec![
        json!({"target":"teach_panel","kind":"preset_enter_soft","start":0.0,"run_time":0.8,"easing":"ease_out"}),
        json!({"target":"teach_heading","kind":"preset_text_typewriter","start":0.0,"run_time":1.3,"easing":"ease_out"}),
        json!({"target":"board","kind":"preset_enter_soft","start":0.7,"run_time":0.8,"easing":"ease_out"}),
        json!({"target":"board_title","kind":"preset_text_pop_in","start":1.2,"run_time":0.8,"easing":"ease_out"}),
        json!({"target":"board_body","kind":"preset_text_typewriter","start":1.6,"run_time":2.1,"easing":"ease_out"}),
        json!({"target":"pointer","kind":"create","start":1.1,"run_time":0.9,"easing":"ease_in_out"}),
    ];
    specs.extend(character_intro_specs("teacher", 0.2));
    specs.extend(character_intro_specs("student", 0.8));
    specs.extend(character_talk_bob_specs("teacher", 2.2));
    specs.extend(character_nod_specs("student", 3.2));
    specs.extend(character_point_specs("teacher", 2.5));
    specs.extend(vec![
        json!({"target":"board_body","kind":"preset_text_glow_pulse","start":4.7,"run_time":1.2,"easing":"there_and_back"}),
        json!({"target":"teach_heading","kind":"fade_out","start":t_out,"run_time":0.8,"easing":"ease_in"}),
        json!({"target":"board_body","kind":"fade_out","start":t_out+0.1,"run_time":0.8,"easing":"ease_in"}),
        json!({"target":"board_title","kind":"fade_out","start":t_out+0.15,"run_time":0.7,"easing":"ease_in"}),
        json!({"target":"pointer","kind":"uncreate","start":t_out+0.2,"run_time":0.7,"easing":"ease_in"}),
        json!({"target":"board","kind":"preset_exit_soft","start":t_out+0.2,"run_time":0.8,"easing":"ease_in"}),
        json!({"target":"teach_panel","kind":"preset_exit_soft","start":t_out+0.3,"run_time":0.8,"easing":"ease_in"}),
    ]);
    specs.extend(character_exit_specs("teacher", t_out + 0.15));
    specs.extend(character_exit_specs("student", t_out + 0.25));

    base_scene(scene, cfg, layers, specs)
}

#[derive(Clone, Copy)]
struct CharacterStyle {
    body_fill: [u8; 4],
    body_stroke: [u8; 4],
    head_fill: [u8; 4],
    head_stroke: [u8; 4],
    facial_fill: [u8; 4],
    arm_stroke: [u8; 4],
    tag_fill: [u8; 4],
    shadow_fill: [u8; 4],
    label: &'static str,
}

fn pick_character_styles(scene: &PlannedScene) -> (CharacterStyle, CharacterStyle) {
    // Stable pseudo-random per scene id for reproducible renders.
    let roll = stable_scene_roll(&scene.id);
    if roll % 2 == 0 {
        (teacher_classic(), student_classic())
    } else {
        (teacher_mentor_female(), student_kid())
    }
}

fn stable_scene_roll(id: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    id.hash(&mut hasher);
    hasher.finish()
}

fn teacher_classic() -> CharacterStyle {
    CharacterStyle {
        body_fill: [36, 66, 120, 220],
        body_stroke: [140, 190, 255, 255],
        head_fill: [244, 217, 178, 255],
        head_stroke: [220, 198, 164, 255],
        facial_fill: [42, 58, 86, 255],
        arm_stroke: [206, 224, 255, 255],
        tag_fill: [90, 168, 245, 255],
        shadow_fill: [10, 20, 40, 120],
        label: "Guide",
    }
}

fn teacher_mentor_female() -> CharacterStyle {
    CharacterStyle {
        body_fill: [86, 58, 138, 228],
        body_stroke: [194, 156, 255, 255],
        head_fill: [245, 206, 181, 255],
        head_stroke: [222, 183, 162, 255],
        facial_fill: [58, 42, 88, 255],
        arm_stroke: [228, 208, 255, 255],
        tag_fill: [204, 156, 255, 255],
        shadow_fill: [22, 10, 42, 120],
        label: "Mentor",
    }
}

fn student_classic() -> CharacterStyle {
    CharacterStyle {
        body_fill: [38, 108, 84, 220],
        body_stroke: [144, 234, 194, 255],
        head_fill: [245, 219, 186, 255],
        head_stroke: [224, 200, 170, 255],
        facial_fill: [38, 72, 66, 255],
        arm_stroke: [188, 236, 214, 255],
        tag_fill: [132, 225, 175, 255],
        shadow_fill: [10, 26, 20, 118],
        label: "You",
    }
}

fn student_kid() -> CharacterStyle {
    CharacterStyle {
        body_fill: [214, 122, 54, 226],
        body_stroke: [255, 194, 142, 255],
        head_fill: [250, 224, 190, 255],
        head_stroke: [226, 201, 169, 255],
        facial_fill: [80, 55, 36, 255],
        arm_stroke: [255, 214, 174, 255],
        tag_fill: [255, 194, 120, 255],
        shadow_fill: [36, 20, 8, 112],
        label: "Learner",
    }
}

fn character_layers(
    prefix: &str,
    cx: i32,
    cy: i32,
    z: i32,
    style: &CharacterStyle,
) -> Vec<Value> {
    vec![
        json!({"id":format!("{prefix}_shadow"),"z_index":z-1,"type":"ellipse","radius_x":56,"radius_y":16,"transform":{"x":cx,"y":(cy+108)},"style":{"fill_rgba":style.shadow_fill,"stroke_rgba":[0,0,0,0],"opacity":0.0}}),
        json!({"id":format!("{prefix}_body"),"z_index":z,"type":"rect","width":94,"height":126,"corner_radius":20,"transform":{"x":cx,"y":(cy+36)},"style":{"fill_rgba":style.body_fill,"stroke_rgba":style.body_stroke,"stroke_width":2,"opacity":0.0}}),
        json!({"id":format!("{prefix}_head"),"z_index":z+1,"type":"circle","radius":42,"transform":{"x":cx,"y":(cy-48)},"style":{"fill_rgba":style.head_fill,"stroke_rgba":style.head_stroke,"stroke_width":2,"opacity":0.0}}),
        json!({"id":format!("{prefix}_eye_l"),"z_index":z+2,"type":"circle","radius":4,"transform":{"x":(cx-12),"y":(cy-54)},"style":{"fill_rgba":style.facial_fill,"stroke_rgba":[0,0,0,0],"opacity":0.0}}),
        json!({"id":format!("{prefix}_eye_r"),"z_index":z+2,"type":"circle","radius":4,"transform":{"x":(cx+12),"y":(cy-54)},"style":{"fill_rgba":style.facial_fill,"stroke_rgba":[0,0,0,0],"opacity":0.0}}),
        json!({"id":format!("{prefix}_smile"),"z_index":z+2,"type":"polyline","points":[[-13.0,0.0],[-6.0,4.0],[0.0,6.0],[6.0,4.0],[13.0,0.0]],"transform":{"x":cx,"y":(cy-36)},"style":{"stroke_rgba":style.facial_fill,"stroke_width":2,"draw_progress":0.0,"opacity":0.0}}),
        json!({"id":format!("{prefix}_arm"),"z_index":z+1,"type":"line","x1":0,"y1":0,"x2":64,"y2":-30,"transform":{"x":(cx+8),"y":(cy+12)},"style":{"stroke_rgba":style.arm_stroke,"stroke_width":4,"draw_progress":0.0,"opacity":0.0}}),
        json!({"id":format!("{prefix}_tag"),"z_index":z+2,"type":"text","text":style.label,"font_size":20,"transform":{"x":cx,"y":(cy+102)},"style":{"fill_rgba":style.tag_fill,"opacity":0.0}})
    ]
}

fn character_intro_specs(prefix: &str, start: f32) -> Vec<Value> {
    vec![
        json!({"target":format!("{prefix}_shadow"),"kind":"fade_in","start":start,"run_time":0.5,"easing":"ease_out"}),
        json!({"target":format!("{prefix}_body"),"kind":"preset_enter_rise","start":start+0.05,"run_time":0.65,"easing":"ease_out"}),
        json!({"target":format!("{prefix}_head"),"kind":"preset_enter_soft","start":start+0.2,"run_time":0.6,"easing":"ease_out"}),
        json!({"target":format!("{prefix}_eye_l"),"kind":"preset_enter_soft","start":start+0.35,"run_time":0.4,"easing":"ease_out"}),
        json!({"target":format!("{prefix}_eye_r"),"kind":"preset_enter_soft","start":start+0.35,"run_time":0.4,"easing":"ease_out"}),
        json!({"target":format!("{prefix}_smile"),"kind":"create","start":start+0.4,"run_time":0.45,"easing":"ease_in_out"}),
        json!({"target":format!("{prefix}_arm"),"kind":"create","start":start+0.5,"run_time":0.55,"easing":"ease_in_out"}),
        json!({"target":format!("{prefix}_tag"),"kind":"preset_text_pop_in","start":start+0.55,"run_time":0.55,"easing":"ease_out"}),
    ]
}

fn character_talk_bob_specs(prefix: &str, start: f32) -> Vec<Value> {
    vec![
        json!({"target":format!("{prefix}_head"),"kind":"preset_emphasis_pulse","start":start,"run_time":0.8,"easing":"there_and_back"}),
        json!({"target":format!("{prefix}_head"),"kind":"preset_emphasis_pulse","start":start+1.0,"run_time":0.8,"easing":"there_and_back"}),
        json!({"target":format!("{prefix}_tag"),"kind":"preset_text_glow_pulse","start":start+0.2,"run_time":1.0,"easing":"there_and_back"}),
    ]
}

fn character_nod_specs(prefix: &str, start: f32) -> Vec<Value> {
    vec![
        json!({"target":format!("{prefix}_head"),"kind":"rotate","start":start,"run_time":0.35,"to_rotation_deg":8.0,"easing":"ease_in_out"}),
        json!({"target":format!("{prefix}_head"),"kind":"rotate","start":start+0.35,"run_time":0.35,"to_rotation_deg":-6.0,"easing":"ease_in_out"}),
        json!({"target":format!("{prefix}_head"),"kind":"rotate","start":start+0.70,"run_time":0.30,"to_rotation_deg":0.0,"easing":"ease_out"}),
    ]
}

fn character_point_specs(prefix: &str, start: f32) -> Vec<Value> {
    vec![
        json!({"target":format!("{prefix}_arm"),"kind":"rotate","start":start,"run_time":0.45,"to_rotation_deg":-12.0,"easing":"ease_in_out"}),
        json!({"target":format!("{prefix}_arm"),"kind":"rotate","start":start+0.45,"run_time":0.45,"to_rotation_deg":6.0,"easing":"ease_in_out"}),
        json!({"target":format!("{prefix}_arm"),"kind":"rotate","start":start+0.90,"run_time":0.35,"to_rotation_deg":0.0,"easing":"ease_out"}),
    ]
}

fn character_exit_specs(prefix: &str, start: f32) -> Vec<Value> {
    vec![
        json!({"target":format!("{prefix}_tag"),"kind":"preset_exit_soft","start":start,"run_time":0.45,"easing":"ease_in"}),
        json!({"target":format!("{prefix}_arm"),"kind":"uncreate","start":start+0.05,"run_time":0.5,"easing":"ease_in"}),
        json!({"target":format!("{prefix}_smile"),"kind":"uncreate","start":start+0.1,"run_time":0.4,"easing":"ease_in"}),
        json!({"target":format!("{prefix}_eye_l"),"kind":"preset_exit_soft","start":start+0.1,"run_time":0.4,"easing":"ease_in"}),
        json!({"target":format!("{prefix}_eye_r"),"kind":"preset_exit_soft","start":start+0.1,"run_time":0.4,"easing":"ease_in"}),
        json!({"target":format!("{prefix}_head"),"kind":"preset_exit_drop","start":start+0.15,"run_time":0.55,"easing":"ease_in"}),
        json!({"target":format!("{prefix}_body"),"kind":"preset_exit_drop","start":start+0.25,"run_time":0.55,"easing":"ease_in"}),
        json!({"target":format!("{prefix}_shadow"),"kind":"fade_out","start":start+0.3,"run_time":0.5,"easing":"ease_in"}),
    ]
}
