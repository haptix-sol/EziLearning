use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use varin_core::Scene;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TtsCacheMeta {
    pub duration_seconds: f32,
    pub voice: String,
}

pub fn stable_hash(parts: &[&str]) -> String {
    let mut hasher = Sha256::new();
    for part in parts {
        hasher.update(part.as_bytes());
        hasher.update(b"\n");
    }
    let out = hasher.finalize();
    let mut s = String::with_capacity(out.len() * 2);
    for b in out {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

pub fn cache_root() -> PathBuf {
    if let Ok(raw) = std::env::var("VARIN_CACHE_DIR") {
        let p = PathBuf::from(raw);
        if p.is_absolute() {
            return p;
        }
        if let Ok(cwd) = std::env::current_dir() {
            return cwd.join(p);
        }
        return p;
    }
    match std::env::current_dir() {
        Ok(cwd) => cwd.join(".varin_cache"),
        Err(_) => PathBuf::from(".varin_cache"),
    }
}

pub fn ensure_cache_dirs() -> Result<()> {
    fs::create_dir_all(tts_dir()).context("failed creating tts cache directory")?;
    fs::create_dir_all(scene_dir()).context("failed creating scene cache directory")?;
    fs::create_dir_all(render_segment_dir()).context("failed creating render segment cache directory")?;
    Ok(())
}

fn tts_dir() -> PathBuf {
    cache_root().join("tts")
}

fn scene_dir() -> PathBuf {
    cache_root().join("scenes")
}

fn render_segment_dir() -> PathBuf {
    cache_root().join("render_segments")
}

fn tts_audio_path(key: &str) -> PathBuf {
    tts_dir().join(format!("{key}.mp3"))
}

fn tts_meta_path(key: &str) -> PathBuf {
    tts_dir().join(format!("{key}.json"))
}

pub fn load_tts_cache(key: &str) -> Result<Option<(PathBuf, TtsCacheMeta)>> {
    let audio = tts_audio_path(key);
    let meta = tts_meta_path(key);
    if !(audio.exists() && meta.exists()) {
        return Ok(None);
    }
    let raw = fs::read_to_string(&meta)
        .with_context(|| format!("failed reading tts cache metadata {}", meta.display()))?;
    let parsed: TtsCacheMeta = serde_json::from_str(&raw)
        .with_context(|| format!("invalid tts cache metadata {}", meta.display()))?;
    Ok(Some((audio, parsed)))
}

pub fn store_tts_cache(key: &str, source_mp3: &Path, duration_seconds: f32, voice: &str) -> Result<PathBuf> {
    ensure_cache_dirs()?;
    let dst = tts_audio_path(key);
    fs::copy(source_mp3, &dst).with_context(|| {
        format!(
            "failed storing tts cache audio {} -> {}",
            source_mp3.display(),
            dst.display()
        )
    })?;
    let meta = TtsCacheMeta {
        duration_seconds,
        voice: voice.to_string(),
    };
    let meta_path = tts_meta_path(key);
    fs::write(&meta_path, serde_json::to_string_pretty(&meta)?).with_context(|| {
        format!("failed writing tts cache metadata {}", meta_path.display())
    })?;
    Ok(dst)
}

fn scene_path(key: &str) -> PathBuf {
    scene_dir().join(format!("{key}.json"))
}

pub fn load_scene_cache(key: &str) -> Result<Option<Scene>> {
    let p = scene_path(key);
    if !p.exists() {
        return Ok(None);
    }
    let raw =
        fs::read_to_string(&p).with_context(|| format!("failed reading cached scene {}", p.display()))?;
    let scene: Scene =
        serde_json::from_str(&raw).with_context(|| format!("invalid cached scene {}", p.display()))?;
    Ok(Some(scene))
}

pub fn store_scene_cache(key: &str, scene: &Scene) -> Result<PathBuf> {
    ensure_cache_dirs()?;
    let p = scene_path(key);
    fs::write(&p, serde_json::to_string_pretty(scene)?)
        .with_context(|| format!("failed writing cached scene {}", p.display()))?;
    Ok(p)
}

fn render_segment_path(key: &str) -> PathBuf {
    render_segment_dir().join(format!("{key}.mp4"))
}

pub fn load_render_segment_cache(key: &str) -> Option<PathBuf> {
    let p = render_segment_path(key);
    if p.exists() {
        Some(p)
    } else {
        None
    }
}

pub fn store_render_segment_cache(key: &str, source_mp4: &Path) -> Result<PathBuf> {
    ensure_cache_dirs()?;
    let dst = render_segment_path(key);
    fs::copy(source_mp4, &dst).with_context(|| {
        format!(
            "failed storing render segment cache {} -> {}",
            source_mp4.display(),
            dst.display()
        )
    })?;
    Ok(dst)
}
