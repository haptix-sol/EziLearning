import cors from "cors";
import express from "express";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
app.use(cors());
app.use(express.json({ limit: "8mb" }));

const PORT = Number(process.env.PORT || 8787);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = (process.env.VARIN_VIDEO_GENERATOR_ROOT || "").trim() || path.resolve(__dirname, "..", "..");
const VARIN_ROOT = (process.env.VARIN_ROOT || "").trim() || path.join(REPO_ROOT, "Varin");
const JOB_DIR = path.join(VARIN_ROOT, "output", "jobs");
const DEFAULT_FFMPEG = (process.env.FFMPEG_PATH || "").trim() || path.join(REPO_ROOT, "ffmpeg", "bin", "ffmpeg.exe");
const CARGO = (process.env.CARGO_PATH || "").trim() || path.join(os.homedir(), ".cargo", "bin", "cargo.exe");

/** @type {Map<string, any>} */
const jobs = new Map();
let seq = 1;

function getDefaultOutputPath() {
  return path.join(VARIN_ROOT, "output", `varin-${Date.now()}.mp4`);
}

function resolveFfmpegPath() {
  const candidates = [
    DEFAULT_FFMPEG,
    (process.env.FFMPEG_PATH || "").trim(),
    path.join(REPO_ROOT, "ffmpeg", "ffmpeg.exe"),
    path.join(REPO_ROOT, "ffmpeg", "ffmpeg-8.1-full_build", "bin", "ffmpeg.exe"),
    path.join(REPO_ROOT, "ffmpeg", "ffmpeg-8.1", "bin", "ffmpeg.exe"),
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  // WinGet Gyan install path:
  // %LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg*\ffmpeg-*\bin\ffmpeg.exe
  const wingetRoot = path.join(
    process.env.LOCALAPPDATA || "",
    "Microsoft",
    "WinGet",
    "Packages"
  );
  if (fs.existsSync(wingetRoot)) {
    try {
      const pkgDirs = fs
        .readdirSync(wingetRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name.startsWith("Gyan.FFmpeg"))
        .map((d) => path.join(wingetRoot, d.name));
      for (const pkg of pkgDirs) {
        const versionDirs = fs
          .readdirSync(pkg, { withFileTypes: true })
          .filter((d) => d.isDirectory() && d.name.startsWith("ffmpeg-"))
          .map((d) => path.join(pkg, d.name, "bin", "ffmpeg.exe"));
        for (const exe of versionDirs) {
          if (fs.existsSync(exe)) return exe;
        }
      }
    } catch {
      // Ignore and fallback below.
    }
  }

  return "ffmpeg";
}

function pushLog(job, msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  job.logs.push(line);
  if (job.logs.length > 800) job.logs.shift();
}

function updateResources(job) {
  const total = os.totalmem();
  const free = os.freemem();
  job.resources = {
    totalRamGb: +(total / (1024 ** 3)).toFixed(2),
    freeRamGb: +(free / (1024 ** 3)).toFixed(2),
    usedRamGb: +((total - free) / (1024 ** 3)).toFixed(2),
    cpuLogical: os.cpus().length,
    at: new Date().toISOString(),
  };
}

function runCommandCapture(bin, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (buf) => {
      stdout += String(buf);
    });
    child.stderr.on("data", (buf) => {
      stderr += String(buf);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function safeParseJson(input) {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function sanitizeLlmJson(input) {
  let text = String(input || "");
  // Remove BOM/zero-width chars often introduced by editors/LLMs.
  text = text.replace(/\uFEFF/g, "").replace(/[\u200B-\u200D\u2060]/g, "");
  // Replace missing values patterns like `"fill": ,` or `"background_rgba": ,`
  text = text.replace(/:\s*,/g, ": null,");
  // Replace missing value before object/array close.
  text = text.replace(/:\s*([\]}])/g, ": null$1");
  return text;
}

function defaultRgba(v, fallback) {
  if (!Array.isArray(v) || v.length !== 4) return fallback;
  const out = v.map((n) => Number(n));
  if (out.some((n) => Number.isNaN(n))) return fallback;
  return out.map((n) => Math.max(0, Math.min(255, Math.round(n))));
}

function convertLegacyLayer(layer, idx) {
  const id = String(layer?.id || `layer_${idx + 1}`);
  const kind = String(layer?.kind || "");
  const props = layer?.props || {};
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  if (kind === "shape_rect") {
    return {
      id,
      type: "rect",
      width: Number(props.width ?? 200),
      height: Number(props.height ?? 100),
      corner_radius: Number(props.corner_radius ?? 0),
      transform: { x, y },
      style: {
        fill_rgba: defaultRgba(props.fill_rgba, [40, 70, 130, 220]),
        stroke_rgba: defaultRgba(props.stroke_rgba, [220, 230, 255, 255]),
        stroke_width: Number(props.stroke_width ?? 2),
        opacity: Number(props.opacity ?? 1),
      },
    };
  }
  if (kind === "text") {
    return {
      id,
      type: "text",
      text: String(props.text ?? ""),
      font_size: Number(props.font_size ?? 30),
      font_family: props.font_family ? String(props.font_family) : undefined,
      transform: { x, y },
      style: {
        fill_rgba: defaultRgba(props.fill_rgba, [235, 240, 255, 255]),
        stroke_rgba: defaultRgba(props.stroke_rgba, [0, 0, 0, 0]),
        stroke_width: Number(props.stroke_width ?? 0),
        opacity: Number(props.opacity ?? 1),
        line_height_mult: Number(props.line_height ?? 1.2),
        text_max_width: Number(props.max_width ?? 0),
      },
    };
  }
  return null;
}

function convertLegacySceneSchema(sceneObj) {
  if (!sceneObj || typeof sceneObj !== "object") return null;
  const hasLegacyLayers = Array.isArray(sceneObj.layers) && sceneObj.layers.some((l) => l && typeof l === "object" && "kind" in l);
  const hasLegacyTimeline = sceneObj.timeline && Array.isArray(sceneObj.timeline.tracks);
  if (!hasLegacyLayers && !hasLegacyTimeline) return null;

  const convertedLayers = (sceneObj.layers || [])
    .map((layer, idx) => convertLegacyLayer(layer, idx))
    .filter(Boolean);

  const specs = [];
  const tracks = sceneObj?.timeline?.tracks || [];
  for (const track of tracks) {
    const clips = Array.isArray(track?.clips) ? track.clips : [];
    for (const clip of clips) {
      specs.push({
        target: String(clip.target_layer_id || ""),
        kind: String(clip.kind || "preset_enter_soft"),
        start: Number(clip.start_time ?? 0),
        run_time: Number(clip.duration ?? 1),
        easing: "ease_in_out",
      });
    }
  }

  return {
    version: "v1",
    duration_seconds: Number(sceneObj.duration_seconds ?? 30),
    canvas: {
      width: Number(sceneObj?.canvas?.width ?? 1280),
      height: Number(sceneObj?.canvas?.height ?? 720),
      fps: Number(sceneObj?.canvas?.fps ?? 30),
      background_rgba: defaultRgba(sceneObj?.canvas?.background_rgba, [18, 22, 34, 255]),
    },
    layers: convertedLayers,
    timeline: {
      specs,
      lifecycle: [],
      segments: [],
      groups: [],
    },
  };
}

function convertNearVarinScene(sceneObj) {
  if (!sceneObj || typeof sceneObj !== "object" || !Array.isArray(sceneObj.layers)) return null;
  const hasNearVarin = sceneObj.layers.some(
    (l) => l && typeof l === "object" && l.type && l.style && typeof l.style === "object"
  );
  if (!hasNearVarin) return null;

  const layers = [];
  for (const layer of sceneObj.layers) {
    const id = String(layer?.id || `layer_${layers.length + 1}`);
    const type = String(layer?.type || "");
    const tr = layer?.transform || {};
    const st = layer?.style || {};
    const base = {
      id,
      transform: { x: Number(tr.x ?? 0), y: Number(tr.y ?? 0) },
      style: {
        fill_rgba: defaultRgba(st.fill_rgba ?? st.fill, [220, 230, 255, 255]),
        stroke_rgba: defaultRgba(st.stroke_rgba, [0, 0, 0, 0]),
        stroke_width: Number(st.stroke_width ?? 0),
        opacity: Number(st.opacity ?? 1),
        line_height_mult: Number(st.line_height ?? 1.2),
        text_max_width: Number(tr.width ?? st.max_width ?? 0),
      },
    };

    if (type === "text") {
      layers.push({
        ...base,
        type: "text",
        text: String(st.text ?? layer.text ?? ""),
        font_size: Number(st.font_size ?? layer.font_size ?? 30),
        font_family: st.font_family ? String(st.font_family) : undefined,
      });
      continue;
    }

    if (type === "rect") {
      layers.push({
        ...base,
        type: "rect",
        width: Number(tr.width ?? layer.width ?? 200),
        height: Number(tr.height ?? layer.height ?? 100),
        corner_radius: Number(st.corner_radius ?? layer.corner_radius ?? 0),
      });
      continue;
    }
  }

  const timelineSpecs = [];
  const nearSpecs = Array.isArray(sceneObj?.timeline?.specs) ? sceneObj.timeline.specs : [];
  for (const s of nearSpecs) {
    timelineSpecs.push({
      target: String(s.target ?? ""),
      kind: String(s.kind ?? s.preset ?? "preset_enter_soft"),
      start: Number(s.start ?? s.start_time ?? 0),
      run_time: Number(s.run_time ?? s.duration ?? 1),
      easing: "ease_in_out",
    });
  }

  return {
    version: "v1",
    duration_seconds: Number(sceneObj.duration_seconds ?? 20),
    canvas: {
      width: Number(sceneObj?.canvas?.width ?? 1280),
      height: Number(sceneObj?.canvas?.height ?? 720),
      fps: Number(sceneObj?.canvas?.fps ?? 30),
      background_rgba: defaultRgba(sceneObj?.canvas?.background_rgba, [18, 22, 34, 255]),
    },
    layers,
    timeline: {
      specs: timelineSpecs,
      lifecycle: [],
      segments: [],
      groups: [],
    },
  };
}

function materializeStoryboardBundle(inputJson, rootName) {
  const sanitized = sanitizeLlmJson(inputJson);
  const parsed = safeParseJson(sanitized);
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "invalid JSON" };
  }

  const rootDir = path.join(JOB_DIR, rootName);
  fs.mkdirSync(rootDir, { recursive: true });
  const createdFiles = [];
  const cleanupFiles = [];

  // If scene JSON (or legacy scene JSON), normalize to scene file.
  if (!Array.isArray(parsed.scenes)) {
    const converted = convertLegacySceneSchema(parsed) || convertNearVarinScene(parsed) || parsed;
    const sceneFile = path.join(rootDir, "scene_input.json");
    fs.writeFileSync(sceneFile, JSON.stringify(converted, null, 2), "utf8");
    createdFiles.push(sceneFile);
    cleanupFiles.push(sceneFile);
    return { ok: true, mode: "scene", entryPath: sceneFile, files: createdFiles, cleanupFiles };
  }

  // Storyboard mode: materialize referenced scene files if embedded.
  const storyboard = { ...parsed, scenes: parsed.scenes.map((s) => ({ ...s })) };
  const embeddedWarnings = [];
  for (const sc of storyboard.scenes) {
    const scenePath = String(sc.scene_path || "").trim();
    if (!scenePath) continue;
    const embedded = parsed[scenePath];
    if (embedded && typeof embedded === "object") {
      const normalizedEmbedded =
        convertLegacySceneSchema(embedded) || convertNearVarinScene(embedded) || embedded;
      const abs = path.join(rootDir, scenePath.replaceAll("/", path.sep));
      const parent = path.dirname(abs);
      fs.mkdirSync(parent, { recursive: true });
      fs.writeFileSync(abs, JSON.stringify(normalizedEmbedded, null, 2), "utf8");
      sc.scene_path = path.relative(rootDir, abs).replaceAll("\\", "/");
      createdFiles.push(abs);
      cleanupFiles.push(abs);
    } else {
      // If scene_path exists on disk already, keep as-is; else warning for validator/user.
      const candidate = path.isAbsolute(scenePath) ? scenePath : path.join(rootDir, scenePath);
      if (!fs.existsSync(candidate)) {
        embeddedWarnings.push(`scene_path '${scenePath}' is missing embedded scene JSON and file does not exist`);
      }
    }
  }
  const storyboardPath = path.join(rootDir, "storyboard_input.json");
  fs.writeFileSync(storyboardPath, JSON.stringify(storyboard, null, 2), "utf8");
  createdFiles.push(storyboardPath);
  cleanupFiles.push(storyboardPath);
  return {
    ok: true,
    mode: "storyboard",
    entryPath: storyboardPath,
    files: createdFiles,
    cleanupFiles,
    warnings: embeddedWarnings,
  };
}

function estimateSceneCount(durationMinutes, conceptDensity) {
  const mins = Number(durationMinutes || 1);
  const densityFactor = conceptDensity === "deep" ? 1.3 : conceptDensity === "light" ? 0.8 : 1.0;
  const raw = Math.round(mins * 3 * densityFactor);
  return Math.min(20, Math.max(4, raw));
}

app.get("/api/config", (_, res) => {
  const resolvedFfmpeg = resolveFfmpegPath();
  res.json({
    repoRoot: REPO_ROOT,
    varinRoot: VARIN_ROOT,
    defaultFfmpeg: resolvedFfmpeg,
    ffmpegExists: resolvedFfmpeg === "ffmpeg" ? null : fs.existsSync(resolvedFfmpeg),
    defaultOutputPath: getDefaultOutputPath(),
    cargoPath: CARGO,
  });
});

app.post("/api/llm-prompt/storyboard", async (req, res) => {
  const payload = req.body || {};
  const sceneCount = estimateSceneCount(payload?.durationMinutes, payload?.conceptDensity);
  fs.mkdirSync(JOB_DIR, { recursive: true });
  const tmpName = `prompt-${Date.now()}-${Math.floor(Math.random() * 10000)}.json`;
  const inPath = path.join(JOB_DIR, tmpName);
  const rustPayload = {
    title: payload.title ?? "",
    topic_details: payload.topicDetails ?? "",
    sections: Array.isArray(payload.sections) ? payload.sections : [],
    duration_minutes: Number(payload.durationMinutes || 3),
    audience_level: payload.audienceLevel ?? "beginner",
    style_tone: payload.styleTone ?? "clean",
    aspect: payload.aspect ?? "16:9",
    resolution: payload.resolution ?? "1280x720",
    must_include: payload.mustInclude ?? "",
    avoid: payload.avoid ?? "",
    auto_scene_count: payload.autoSceneCount !== false,
    scene_count: Number(payload.sceneCount || 8),
    concept_density: payload.conceptDensity ?? "medium",
    animation_intensity: payload.animationIntensity ?? "balanced",
  };
  fs.writeFileSync(inPath, JSON.stringify(rustPayload), "utf8");
  const args = ["run", "--release", "-p", "varin-cli", "--", "prompt-storyboard", "--input", inPath];
  try {
    const result = await runCommandCapture(CARGO, args, VARIN_ROOT);
    if (result.code !== 0) {
      return res.status(500).json({
        error: "rust prompt generation failed",
        detail: String(result.stderr || result.stdout || `exit code ${result.code}`),
      });
    }
    return res.json({
      prompt: String(result.stdout || "").trim(),
      suggestedSceneCount: sceneCount,
      feedSteps: [
        "Copy the generated prompt and send it to your LLM.",
        "Paste storyboard/scene JSON output into the editor.",
        "Run Validate Input first.",
        "Run Generate Video after validation passes."
      ],
    });
  } catch (err) {
    return res.status(500).json({ error: `rust prompt generation failed: ${String(err)}` });
  } finally {
    try {
      fs.unlinkSync(inPath);
    } catch {
      // no-op
    }
  }
});

app.post("/api/validate", async (req, res) => {
  const { inputJson } = req.body || {};
  if (!inputJson || typeof inputJson !== "string") {
    return res.status(400).json({ ok: false, error: "inputJson is required" });
  }
  fs.mkdirSync(JOB_DIR, { recursive: true });
  const tmpName = `validate-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const bundle = materializeStoryboardBundle(inputJson, tmpName);
  if (!bundle.ok) {
    return res.status(400).json({ ok: false, error: bundle.error || "normalization failed" });
  }
  const args = ["run", "--release", "-p", "varin-cli", "--", "build", "--input", bundle.entryPath];
  try {
    const result = await runCommandCapture(CARGO, args, VARIN_ROOT);
    const lines = `${result.stdout}\n${result.stderr}`
      .split(/\r?\n/)
      .map((v) => v.trim())
      .filter(Boolean);
    const issues = lines.map((line) => {
      const m = line.match(/\bline\s+(\d+)\b/i);
      const c = line.match(/\bcolumn\s+(\d+)\b/i);
      return {
        severity: /error|failed|invalid/i.test(line) ? "error" : "info",
        line: m ? Number(m[1]) : null,
        column: c ? Number(c[1]) : null,
        message: line,
      };
    });
    const warnings = bundle.warnings || [];
    if (result.code === 0) {
      return res.json({ ok: true, messages: [...warnings, ...lines], issues });
    }
    return res.status(400).json({
      ok: false,
      error: "validation failed",
      exitCode: result.code,
      messages: [...warnings, ...lines],
      issues,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  } finally {
    for (const p of bundle.cleanupFiles || []) {
      try {
        fs.unlinkSync(p);
      } catch {
        // no-op
      }
    }
    try {
      fs.rmSync(path.join(JOB_DIR, tmpName), { recursive: true, force: true });
    } catch {
      // no-op
    }
  }
});

app.post("/api/render", (req, res) => {
  const {
    inputJson,
    outputPath,
    ffmpegPath,
    cpuRatio = 0.7,
    ramRatio = 0.65,
    maxThreads,
    noHwEncode = false,
    noLiveMonitor = false,
  } = req.body || {};

  if (!inputJson || typeof inputJson !== "string") {
    return res.status(400).json({ error: "inputJson is required" });
  }
  const id = `job-${seq++}`;
  const job = {
    id,
    status: "starting",
    logs: [],
    resources: null,
    startedAt: new Date().toISOString(),
    outputPath: outputPath || getDefaultOutputPath(),
    error: null,
    exitCode: null,
  };
  jobs.set(id, job);
  updateResources(job);
  fs.mkdirSync(JOB_DIR, { recursive: true });

  const bundle = materializeStoryboardBundle(inputJson, `render-${id}`);
  if (!bundle.ok) {
    return res.status(400).json({ error: bundle.error || "normalization failed" });
  }
  const scenePath = bundle.entryPath;
  const tempRoot = path.join(JOB_DIR, `render-${id}`);

  const userFfmpeg = ffmpegPath && String(ffmpegPath).trim() ? String(ffmpegPath).trim() : "";
  const ff = userFfmpeg && fs.existsSync(userFfmpeg) ? userFfmpeg : resolveFfmpegPath();
  if (userFfmpeg && !fs.existsSync(userFfmpeg)) {
    pushLog(job, `ffmpeg path not found, auto-fallback used: ${ff}`);
  }
  const args = [
    "run",
    "--release",
    "-p",
    "varin-cli",
    "--",
    bundle.mode === "storyboard" ? "render-storyboard" : "render",
    "--input",
    scenePath,
    "--output",
    job.outputPath,
    "--ffmpeg",
    ff,
    "--cpu-ratio",
    String(cpuRatio),
    "--ram-ratio",
    String(ramRatio),
  ];
  if (maxThreads) args.push("--max-threads", String(maxThreads));
  if (noHwEncode) args.push("--no-hw-encode");
  if (noLiveMonitor) args.push("--no-live-monitor");

  job.status = "running";
  pushLog(job, `spawn: ${CARGO} ${args.join(" ")}`);

  const child = spawn(CARGO, args, {
    cwd: VARIN_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const timer = setInterval(() => updateResources(job), 1000);

  child.stdout.on("data", (buf) => {
    pushLog(job, String(buf).trim());
  });
  child.stderr.on("data", (buf) => {
    pushLog(job, String(buf).trim());
  });
  child.on("error", (err) => {
    clearInterval(timer);
    job.status = "failed";
    job.error = String(err);
    pushLog(job, `error: ${job.error}`);
  });
  child.on("close", (code) => {
    clearInterval(timer);
    job.exitCode = code;
    if (code === 0) {
      job.status = "completed";
      pushLog(job, `completed: ${job.outputPath}`);
    } else {
      job.status = "failed";
      job.error = `process exited with code ${code}`;
      pushLog(job, job.error);
    }
    updateResources(job);
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // no-op
    }
  });

  return res.json({ jobId: id });
});

app.get("/api/job/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "job not found" });
  return res.json(job);
});

const server = app.listen(PORT, () => {
  console.log(`VarinStudio server listening on http://localhost:${PORT}`);
});

// Keep process alive and prune old jobs every minute.
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    const ageMs = now - new Date(job.startedAt).getTime();
    if (ageMs > 12 * 60 * 60 * 1000) jobs.delete(id);
  }
}, 60_000);

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
