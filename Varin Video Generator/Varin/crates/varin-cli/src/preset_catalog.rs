//! Embedded education presets: 250 curated layouts (see `data/education_presets.json`).
//! Storyboards use `scene_template: "edu_preset"` with `preset_id` and/or `preset_index`, plus
//! content overlays (`title`, `recap`, `labels`, …) merged on top of the catalog defaults.

use anyhow::{bail, Result};
use serde::Deserialize;
use serde_json::{Map, Value};
use std::collections::HashMap;
use std::sync::OnceLock;

#[derive(Debug, Clone, Deserialize)]
pub struct PresetEntry {
    pub id: String,
    pub base: String,
    #[serde(default)]
    pub params: Value,
}

#[derive(Debug, Deserialize)]
struct PresetFile {
    #[allow(dead_code)]
    version: u32,
    presets: Vec<PresetEntry>,
}

struct Catalog {
    presets: Vec<PresetEntry>,
    by_id: HashMap<String, usize>,
}

fn load_catalog() -> Catalog {
    let raw = include_str!("../data/education_presets.json");
    let file: PresetFile = serde_json::from_str(raw).unwrap_or_else(|e| {
        panic!("education_presets.json: {e}");
    });
    let mut by_id = HashMap::with_capacity(file.presets.len());
    for (i, p) in file.presets.iter().enumerate() {
        by_id.insert(p.id.clone(), i);
    }
    Catalog {
        presets: file.presets,
        by_id,
    }
}

fn catalog() -> &'static Catalog {
    static CAT: OnceLock<Catalog> = OnceLock::new();
    CAT.get_or_init(load_catalog)
}

/// Stable hash from scene id → preset bucket (when `preset_index` omitted).
fn index_from_scene_id(scene_id: &str) -> usize {
    let mut h: u32 = 5381;
    for b in scene_id.as_bytes() {
        h = h.wrapping_mul(33).wrapping_add(*b as u32);
    }
    (h as usize) % catalog().presets.len().max(1)
}

pub fn resolve_preset(preset_id: &str, preset_index: Option<usize>, scene_id: &str) -> Result<PresetEntry> {
    let cat = catalog();
    if cat.presets.is_empty() {
        bail!("education preset catalog is empty");
    }
    if !preset_id.is_empty() {
        if let Some(&i) = cat.by_id.get(preset_id) {
            return Ok(cat.presets[i].clone());
        }
    }
    let idx = preset_index.unwrap_or_else(|| index_from_scene_id(scene_id)) % cat.presets.len();
    Ok(cat.presets[idx].clone())
}

/// Merge catalog defaults with storyboard `template_params`. Skips routing keys.
pub fn merge_template_params(catalog_params: Value, overlay: Option<&Value>) -> Value {
    let mut base_map = match catalog_params {
        Value::Object(m) => m,
        _ => Map::new(),
    };
    if let Some(Value::Object(overlay_map)) = overlay {
        for (k, v) in overlay_map {
            if matches!(k.as_str(), "preset_id" | "preset_index") {
                continue;
            }
            if !v.is_null() {
                base_map.insert(k.clone(), v.clone());
            }
        }
    }
    Value::Object(base_map)
}
