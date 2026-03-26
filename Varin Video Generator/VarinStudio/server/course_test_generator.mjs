import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const courseJobs = new Map();
let courseSeq = 1;

const RESOLUTION_PRESETS = {
  "280p": { width: 498, height: 280 },
  "360p": { width: 640, height: 360 },
  "480p": { width: 854, height: 480 },
  "720p": { width: 1280, height: 720 },
};

const BASE_SEGMENTS = [
  { key: "intro", title: "Why OOP", narration: "Java O O P helps us model real world systems with reusable, maintainable code." },
  { key: "class_object", title: "Class vs Object", narration: "A class is a blueprint, and an object is a runtime instance created from that blueprint." },
  { key: "encapsulation", title: "Encapsulation", narration: "Encapsulation protects state by hiding fields and exposing controlled access through methods." },
  { key: "abstraction", title: "Abstraction", narration: "Abstraction exposes what an object does while hiding low level implementation details." },
  { key: "inheritance", title: "Inheritance", narration: "Inheritance lets a child class reuse behavior from a parent class and specialize it." },
  { key: "polymorphism", title: "Polymorphism", narration: "Polymorphism lets one interface represent many forms, with behavior decided at runtime." },
  { key: "interface_abstract", title: "Interface and Abstract", narration: "Interfaces define capability contracts, while abstract classes share partial implementation." },
  { key: "modifiers", title: "Access Modifiers", narration: "Public, protected, default, and private define visibility and boundaries in Java design." },
  { key: "example", title: "Mini Example", narration: "In a payment system, polymorphism lets each payment type implement a common pay method." },
  { key: "recap", title: "Recap", narration: "Think in objects with clear responsibilities and O O P principles become practical architecture." },
  { key: "composition", title: "Composition", narration: "Prefer composition over inheritance when behavior should be assembled from smaller parts." },
  { key: "solid", title: "Design Principles", narration: "Single responsibility and open closed design keep Java code extensible and stable." },
];

function nowIso() {
  return new Date().toISOString();
}

function pushLog(job, message) {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  job.logs.push(line);
  if (job.logs.length > 2000) job.logs.shift();
}

function markStageStart(job, stage) {
  job.metrics.stages[stage] = job.metrics.stages[stage] || {};
  job.metrics.stages[stage].startedAt = nowIso();
  job.metrics.stages[stage].startedMs = Date.now();
}

function markStageEnd(job, stage) {
  const entry = job.metrics.stages[stage];
  if (!entry || !entry.startedMs) return;
  entry.finishedAt = nowIso();
  entry.ms = Date.now() - entry.startedMs;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeJson(p, value) {
  fs.writeFileSync(p, JSON.stringify(value, null, 2), "utf8");
}

function sanitizeFileName(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function classifyError(stderr, code) {
  const text = `${stderr || ""}`.toLowerCase();
  if (text.includes("cannot find the path") || text.includes("enoent")) return "path_not_found";
  if (text.includes("failed to spawn ffmpeg")) return "ffmpeg_spawn";
  if (text.includes("invalid scene json") || text.includes("invalid geometry")) return "scene_invalid";
  if (text.includes("timed out") || text.includes("timeout")) return "timeout";
  if (text.includes("concat") || text.includes("mux")) return "merge_error";
  if (Number(code) !== 0) return "process_failed";
  return "unknown";
}

function toSrtTimestamp(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s - Math.floor(s)) * 1000);
  const pad = (n, len = 2) => `${n}`.padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)},${pad(ms, 3)}`;
}

function splitCaption(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > 46) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2).join("\\N");
}

function splitWords(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^\w'-]/g, "").trim())
    .filter(Boolean);
}

function createSegments(mode, totalSec = 300) {
  if (mode === "manim_1min") {
    return [
      {
        key: "title",
        title: "OOP Concepts",
        narration: "Object oriented programming uses classes and objects to model real systems.",
        caption: "OOP Concepts\\NClasses and objects model real systems.",
        durationSec: 8,
        index: 0,
        template: "title",
      },
      {
        key: "class_objects",
        title: "1. Class and Objects",
        narration: "A class is a blueprint. Dog and Cat are objects with their own behavior.",
        caption: "1. Class and Objects\\NClass = blueprint, Objects = instances.",
        durationSec: 14,
        index: 1,
        template: "class_objects",
      },
      {
        key: "inheritance",
        title: "2. Inheritance",
        narration: "Dog and Cat inherit common behavior from Animal and add specific actions.",
        caption: "2. Inheritance\\NChild classes reuse parent behavior.",
        durationSec: 14,
        index: 2,
        template: "inheritance",
      },
      {
        key: "encap_poly",
        title: "Encapsulation and Polymorphism",
        narration: "Encapsulation hides internal data. Polymorphism keeps one interface for many forms.",
        caption: "Encapsulation: Hide data\\NPolymorphism: Same interface.",
        durationSec: 12,
        index: 3,
        template: "encap_poly",
      },
      {
        key: "summary",
        title: "Summary",
        narration: "OOP includes classes, objects, inheritance, encapsulation, and polymorphism.",
        caption: "OOP Summary\\NClasses, Objects, Inheritance, Encapsulation, Polymorphism.",
        durationSec: 12,
        index: 4,
        template: "summary",
      },
    ];
  }
  const count = mode === "high_quality" ? 12 : 8;
  const selected = BASE_SEGMENTS.slice(0, count);
  const base = totalSec / count;
  return selected.map((s, idx) => {
    const wobble = idx % 2 === 0 ? 1.05 : 0.95;
    const durationSec = Number((base * wobble).toFixed(2));
    return {
      ...s,
      index: idx,
      durationSec,
      caption: splitCaption(`${s.title}. ${s.narration}`),
    };
  });
}

function makeManimInspiredScene(segment, width, height, fps) {
  const cx = Math.floor(width / 2);
  const topY = Math.max(48, Math.floor(height * 0.14));
  const midY = Math.floor(height * 0.42);
  const lowerY = Math.floor(height * 0.68);
  const dur = segment.durationSec;
  const captionY = height - Math.max(26, Math.floor(height * 0.08));
  const titleSize = Math.max(20, Math.floor(height * 0.05));
  const bodySize = Math.max(16, Math.floor(height * 0.035));

  const layers = [
    {
      id: "title",
      type: "text",
      text: segment.title,
      font_size: titleSize,
      transform: { x: cx, y: topY },
      style: { fill_rgba: [235, 240, 255, 255], stroke_rgba: [235, 240, 255, 255], stroke_width: 1.0 },
    },
    {
      id: "class_box",
      type: "rect",
      width: Math.floor(width * 0.32),
      height: Math.floor(height * 0.16),
      transform: { x: cx, y: midY },
      style: { fill_rgba: [50, 120, 255, 80], stroke_rgba: [80, 155, 255, 255], stroke_width: 3.0, opacity: 1.0 },
    },
    {
      id: "class_text",
      type: "text",
      text: segment.template === "inheritance" ? "Animal\\nSpeak()" : "Class\\nAnimal Blueprint",
      font_size: bodySize,
      transform: { x: cx, y: midY },
      style: { fill_rgba: [240, 245, 255, 255], stroke_rgba: [240, 245, 255, 255], stroke_width: 1.0 },
    },
    {
      id: "obj_left",
      type: "rect",
      width: Math.floor(width * 0.22),
      height: Math.floor(height * 0.12),
      transform: { x: Math.floor(width * 0.33), y: lowerY },
      style: { fill_rgba: [90, 220, 120, 90], stroke_rgba: [110, 230, 140, 255], stroke_width: 2.5, opacity: 1.0 },
    },
    {
      id: "obj_left_text",
      type: "text",
      text: segment.template === "inheritance" ? "Dog\\nBark()" : "Dog\\nobj1.speak()",
      font_size: bodySize - 1,
      transform: { x: Math.floor(width * 0.33), y: lowerY },
      style: { fill_rgba: [255, 255, 255, 255], stroke_rgba: [255, 255, 255, 255], stroke_width: 1.0 },
    },
    {
      id: "obj_right",
      type: "rect",
      width: Math.floor(width * 0.22),
      height: Math.floor(height * 0.12),
      transform: { x: Math.floor(width * 0.67), y: lowerY },
      style: { fill_rgba: [90, 220, 120, 90], stroke_rgba: [110, 230, 140, 255], stroke_width: 2.5, opacity: 1.0 },
    },
    {
      id: "obj_right_text",
      type: "text",
      text: segment.template === "inheritance" ? "Cat\\nMeow()" : "Cat\\nobj2.speak()",
      font_size: bodySize - 1,
      transform: { x: Math.floor(width * 0.67), y: lowerY },
      style: { fill_rgba: [255, 255, 255, 255], stroke_rgba: [255, 255, 255, 255], stroke_width: 1.0 },
    },
    {
      id: "arrow_left",
      type: "line",
      x1: 0,
      y1: 0,
      x2: -Math.floor(width * 0.14),
      y2: Math.floor(height * 0.18),
      transform: { x: cx, y: midY + Math.floor(height * 0.07) },
      style: { fill_rgba: [0, 0, 0, 0], stroke_rgba: [235, 235, 245, 255], stroke_width: 3.0, opacity: 1.0 },
    },
    {
      id: "arrow_right",
      type: "line",
      x1: 0,
      y1: 0,
      x2: Math.floor(width * 0.14),
      y2: Math.floor(height * 0.18),
      transform: { x: cx, y: midY + Math.floor(height * 0.07) },
      style: { fill_rgba: [0, 0, 0, 0], stroke_rgba: [235, 235, 245, 255], stroke_width: 3.0, opacity: 1.0 },
    },
    {
      id: "caption_bar",
      type: "rect",
      width: Math.floor(width * 0.96),
      height: Math.max(34, Math.floor(height * 0.13)),
      transform: { x: cx, y: captionY },
      style: { fill_rgba: [6, 8, 14, 190], stroke_rgba: [255, 255, 255, 80], stroke_width: 1.0, opacity: 1.0 },
    },
    {
      id: "caption",
      type: "text",
      text: segment.caption.replace(/\\N/g, " "),
      font_size: Math.max(14, Math.floor(height * 0.032)),
      transform: { x: cx, y: captionY },
      style: { fill_rgba: [255, 255, 255, 255], stroke_rgba: [255, 255, 255, 255], stroke_width: 1.0 },
    },
  ];

  if (segment.template === "title" || segment.template === "summary") {
    for (const id of ["obj_left", "obj_left_text", "obj_right", "obj_right_text", "arrow_left", "arrow_right"]) {
      const layer = layers.find((l) => l.id === id);
      if (layer?.style) layer.style.opacity = 0.0;
    }
  }

  const animations = [
    {
      track_type: "float",
      target: "title",
      property: "font_size",
      keyframes: [
        { t: 0.0, value: Math.max(18, titleSize - 6), easing_to_next: "ease_in_out" },
        { t: dur * 0.45, value: titleSize + 4, easing_to_next: "ease_in_out" },
        { t: dur, value: titleSize },
      ],
    },
    {
      track_type: "float",
      target: "class_box",
      property: "rotation_deg",
      keyframes: [
        { t: 0.0, value: 0, easing_to_next: "ease_in_out" },
        { t: dur, value: segment.template === "inheritance" ? 6 : -4 },
      ],
    },
    {
      track_type: "color",
      target: "class_box",
      property: "stroke_rgba",
      keyframes: [
        { t: 0.0, value: [120, 170, 255, 255], easing_to_next: "ease_in_out" },
        { t: dur * 0.55, value: [255, 210, 120, 255], easing_to_next: "ease_in_out" },
        { t: dur, value: [120, 170, 255, 255] },
      ],
    },
    {
      track_type: "float",
      target: "obj_left",
      property: "y",
      keyframes: [
        { t: 0.0, value: lowerY + 12, easing_to_next: "ease_out" },
        { t: dur * 0.35, value: lowerY, easing_to_next: "ease_in_out" },
        { t: dur, value: lowerY + 8 },
      ],
    },
    {
      track_type: "float",
      target: "obj_right",
      property: "y",
      keyframes: [
        { t: 0.0, value: lowerY + 12, easing_to_next: "ease_out" },
        { t: dur * 0.4, value: lowerY, easing_to_next: "ease_in_out" },
        { t: dur, value: lowerY + 8 },
      ],
    },
  ];

  return {
    version: "v1",
    duration_seconds: dur,
    canvas: { width, height, fps, background_rgba: [10, 14, 28, 255] },
    layers,
    animations,
  };
}

function makeScene(segment, width, height, fps) {
  const cx = width / 2;
  const cy = height / 2;
  const captionY = height - 38;
  const titleY = Math.max(40, Math.floor(height * 0.12));
  const bodyY = Math.floor(height * 0.5);
  const dur = segment.durationSec;

  return {
    version: "v1",
    duration_seconds: dur,
    canvas: {
      width,
      height,
      fps,
      background_rgba: [12, 16, 34, 255],
    },
    layers: [
      {
        id: "hero",
        type: "rect",
        width: Math.floor(width * 0.72),
        height: Math.floor(height * 0.28),
        transform: { x: cx, y: bodyY, rotation_deg: 0.0, scale_x: 1.0, scale_y: 1.0 },
        style: { fill_rgba: [50, 110, 255, 135], stroke_rgba: [190, 220, 255, 255], stroke_width: 3.0 },
      },
      {
        id: "orb",
        type: "circle",
        radius: Math.max(24, Math.floor(Math.min(width, height) * 0.06)),
        transform: { x: Math.floor(width * 0.2), y: Math.floor(height * 0.35) },
        style: { fill_rgba: [255, 170, 80, 190], stroke_rgba: [255, 220, 180, 255], stroke_width: 3.0 },
      },
      {
        id: "title_block",
        type: "text",
        text: segment.title,
        font_size: Math.max(22, Math.floor(height * 0.045)),
        transform: { x: cx, y: titleY },
        style: { fill_rgba: [225, 235, 255, 255], stroke_rgba: [225, 235, 255, 255], stroke_width: 1.0 },
      },
      {
        id: "caption_bar",
        type: "rect",
        width: Math.floor(width * 0.94),
        height: Math.max(36, Math.floor(height * 0.13)),
        transform: { x: cx, y: captionY },
        style: { fill_rgba: [8, 10, 18, 180], stroke_rgba: [255, 255, 255, 70], stroke_width: 1.0 },
      },
      {
        id: "caption_block",
        type: "text",
        text: segment.caption.replace(/\\N/g, " "),
        font_size: Math.max(14, Math.floor(height * 0.031)),
        transform: { x: cx, y: captionY },
        style: { fill_rgba: [255, 255, 255, 255], stroke_rgba: [255, 255, 255, 255], stroke_width: 1.0 },
      },
      {
        id: "pulse",
        type: "ellipse",
        radius_x: Math.floor(width * 0.18),
        radius_y: Math.floor(height * 0.08),
        transform: { x: Math.floor(width * 0.78), y: Math.floor(height * 0.7) },
        style: { fill_rgba: [118, 85, 255, 70], stroke_rgba: [180, 155, 255, 230], stroke_width: 2.0 },
      },
    ],
    animations: [
      {
        track_type: "float",
        target: "hero",
        property: "rotation_deg",
        keyframes: [
          { t: 0.0, value: 0.0, easing_to_next: "ease_in_out" },
          { t: dur, value: modeRotation(segment.index) },
        ],
      },
      {
        track_type: "float",
        target: "orb",
        property: "x",
        keyframes: [
          { t: 0.0, value: Math.floor(width * 0.2), easing_to_next: "ease_in_out" },
          { t: dur / 2, value: Math.floor(width * 0.8), easing_to_next: "ease_in_out" },
          { t: dur, value: Math.floor(width * 0.2) },
        ],
      },
      {
        track_type: "float",
        target: "orb",
        property: "radius",
        keyframes: [
          { t: 0.0, value: Math.max(18, Math.floor(Math.min(width, height) * 0.04)), easing_to_next: "ease_in_out" },
          { t: dur / 2, value: Math.max(26, Math.floor(Math.min(width, height) * 0.07)), easing_to_next: "ease_in_out" },
          { t: dur, value: Math.max(18, Math.floor(Math.min(width, height) * 0.04)) },
        ],
      },
      {
        track_type: "color",
        target: "pulse",
        property: "fill_rgba",
        keyframes: [
          { t: 0.0, value: [118, 85, 255, 60], easing_to_next: "ease_in_out" },
          { t: dur / 2, value: [90, 220, 255, 120], easing_to_next: "ease_in_out" },
          { t: dur, value: [118, 85, 255, 60] },
        ],
      },
      {
        track_type: "float",
        target: "title_block",
        property: "font_size",
        keyframes: [
          { t: 0.0, value: Math.max(18, Math.floor(height * 0.038)), easing_to_next: "ease_in_out" },
          { t: dur / 2, value: Math.max(24, Math.floor(height * 0.05)), easing_to_next: "ease_in_out" },
          { t: dur, value: Math.max(20, Math.floor(height * 0.042)) },
        ],
      },
    ],
  };
}

function modeRotation(index) {
  const steps = [240, 300, 330, 210];
  return steps[index % steps.length];
}

function runCommand(command, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: opts.env || process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeoutMs = opts.timeoutMs || 0;
    let timeout = null;
    if (timeoutMs > 0) {
      timeout = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          // ignore
        }
      }, timeoutMs);
    }
    child.stdout.on("data", (d) => {
      stdout += String(d);
    });
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      resolve({ code: code ?? 1, stdout, stderr });
    });
    child.on("error", (err) => {
      if (timeout) clearTimeout(timeout);
      resolve({ code: 1, stdout, stderr: `${stderr}\n${String(err)}` });
    });
  });
}

async function runWithRetry(job, label, fn, maxAttempts = 3) {
  let last = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const started = Date.now();
    pushLog(job, `${label}: attempt ${attempt}/${maxAttempts}`);
    const result = await fn(attempt);
    const ms = Date.now() - started;
    if (result.ok) {
      pushLog(job, `${label}: success in ${ms}ms`);
      return { ok: true, ms, result };
    }
    const category = classifyError(result.stderr, result.code);
    pushLog(job, `${label}: failed (${category}) in ${ms}ms`);
    if (result.stderr) pushLog(job, truncate(result.stderr, 320));
    last = { ...result, category, ms, attempt };
  }
  return { ok: false, ...last };
}

function truncate(v, n = 400) {
  if (!v) return "";
  return v.length > n ? `${v.slice(0, n)}...` : v;
}

function buildSubtitleSrt(segments) {
  let t = 0;
  const rows = [];
  segments.forEach((s, idx) => {
    const start = t;
    const end = t + s.durationSec;
    t = end;
    rows.push(String(idx + 1));
    rows.push(`${toSrtTimestamp(start)} --> ${toSrtTimestamp(end)}`);
    rows.push(s.caption.replace(/\\N/g, "\n"));
    rows.push("");
  });
  return rows.join("\n");
}

function buildWordTimeline(segments) {
  const timeline = [];
  let cursor = 0;
  for (const segment of segments) {
    const segStart = cursor;
    const segDur = Number(segment.durationSec) || 0;
    const words = splitWords(segment.narration || segment.caption || "");
    if (words.length === 0 || segDur <= 0) {
      cursor += segDur;
      continue;
    }
    const weights = words.map((w) => Math.max(1, w.length));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let local = 0;
    for (let i = 0; i < words.length; i += 1) {
      const part = (weights[i] / totalWeight) * segDur;
      const start = segStart + local;
      const end = segStart + local + part;
      timeline.push({
        segmentIndex: segment.index,
        wordIndex: i,
        word: words[i],
        startSec: start,
        endSec: end,
      });
      local += part;
    }
    cursor += segDur;
  }
  return timeline;
}

function buildWordLevelSrt(wordTimeline) {
  const rows = [];
  for (let i = 0; i < wordTimeline.length; i += 1) {
    const w = wordTimeline[i];
    rows.push(String(i + 1));
    rows.push(`${toSrtTimestamp(w.startSec)} --> ${toSrtTimestamp(w.endSec)}`);
    rows.push(w.word);
    rows.push("");
  }
  return rows.join("\n");
}

async function probeDurationSec(ffprobeOrFfmpeg, mediaPath) {
  const probe = String(ffprobeOrFfmpeg || "").toLowerCase().includes("ffprobe")
    ? ffprobeOrFfmpeg
    : String(ffprobeOrFfmpeg).replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");
  const res = await runCommand(probe, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    mediaPath,
  ]);
  if (res.code !== 0) return null;
  const n = Number(String(res.stdout || "").trim());
  return Number.isFinite(n) ? n : null;
}

async function alignAudioDuration(job, ffmpeg, sourceAudio, targetSec, outAudio) {
  const args = [
    "-y",
    "-i",
    sourceAudio,
    "-af",
    "apad=pad_dur=60",
    "-t",
    String(Math.max(0.1, targetSec)),
    "-c:a",
    "aac",
    outAudio,
  ];
  const res = await runCommand(ffmpeg, args);
  const ok = res.code === 0 && fs.existsSync(outAudio);
  if (!ok && res.stderr) pushLog(job, truncate(res.stderr, 400));
  return ok;
}

async function synthesizeSpeechWindows(text, outWav, rate = 0) {
  const escaped = text.replace(/'/g, "''");
  const script = [
    "Add-Type -AssemblyName System.Speech",
    "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    `$s.Rate = ${rate}`,
    `$s.SetOutputToWaveFile('${outWav.replace(/'/g, "''")}')`,
    `$s.Speak('${escaped}')`,
    "$s.Dispose()",
  ].join("; ");
  return runCommand("powershell", ["-NoProfile", "-Command", script], { timeoutMs: 120000 });
}

async function generateSegmentAudio(job, ffmpeg, segment, audioRawPath, audioTimedPath) {
  const tts = await synthesizeSpeechWindows(segment.narration, audioRawPath, 0);
  if (tts.code !== 0 || !fs.existsSync(audioRawPath)) {
    pushLog(job, `tts fallback silence for segment ${segment.index + 1}`);
    const silence = await runCommand(ffmpeg, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `anullsrc=channel_layout=stereo:sample_rate=44100`,
      "-t",
      String(segment.durationSec),
      "-q:a",
      "9",
      "-acodec",
      "libmp3lame",
      audioTimedPath,
    ]);
    return silence.code === 0 && fs.existsSync(audioTimedPath);
  }
  const adjust = await runCommand(ffmpeg, [
    "-y",
    "-i",
    audioRawPath,
    "-af",
    "apad=pad_dur=30",
    "-t",
    String(segment.durationSec),
    "-acodec",
    "libmp3lame",
    audioTimedPath,
  ]);
  if (adjust.code === 0 && fs.existsSync(audioTimedPath)) return true;
  return false;
}

async function renderSegment(job, context, segment, preset, knobs, attempt = 1) {
  const { cargo, ffmpeg, varinRoot, runDir } = context;
  const scenePath = path.join(runDir, "segments", `scene_${String(segment.index + 1).padStart(2, "0")}_${sanitizeFileName(segment.key)}.json`);
  const outPath = path.join(runDir, "video", `seg_${String(segment.index + 1).padStart(2, "0")}.mp4`);
  const width = preset.width;
  const height = preset.height;
  const fps = knobs.fps;

  const cpuRatio = Math.max(0.2, Math.min(0.7, knobs.cpuRatio - (attempt - 1) * 0.08));
  const ramRatio = Math.max(0.2, Math.min(0.7, knobs.ramRatio - (attempt - 1) * 0.08));
  const maxThreads = Math.max(1, Math.floor((os.cpus().length || 4) * cpuRatio));

  const args = [
    "run",
    "--release",
    "-p",
    "varin-cli",
    "--",
    "render",
    "--input",
    scenePath,
    "--output",
    outPath,
    "--ffmpeg",
    ffmpeg,
    "--width",
    String(width),
    "--height",
    String(height),
    "--fps",
    String(fps),
    "--cpu-ratio",
    String(cpuRatio.toFixed(2)),
    "--ram-ratio",
    String(ramRatio.toFixed(2)),
    "--max-threads",
    String(maxThreads),
  ];

  const res = await runCommand(cargo, args, { cwd: varinRoot, timeoutMs: 300000 });
  const ok = res.code === 0 && fs.existsSync(outPath);
  return { ok, code: res.code, stdout: res.stdout, stderr: res.stderr, outPath, scenePath, cpuRatio, ramRatio, maxThreads };
}

async function runPool(items, concurrency, handler) {
  let index = 0;
  const out = [];
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const i = index;
      index += 1;
      if (i >= items.length) return;
      out[i] = await handler(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export function getCourseJob(id) {
  return courseJobs.get(id) || null;
}

export function getResolutionPreset(name) {
  return RESOLUTION_PRESETS[name] || RESOLUTION_PRESETS["360p"];
}

export function startCourseTestJob({
  qualityMode = "fast",
  resolutionPreset = "360p",
  ffmpegPath,
  cargoPath,
  varinRoot,
  outputRoot,
  cpuRatio = 0.7,
  ramRatio = 0.65,
  noHwEncode = false,
  noLiveMonitor = false,
  audioSyncMode = "word_level",
}) {
  const id = `course-${courseSeq++}`;
  const job = {
    id,
    type: "course_test",
    qualityMode,
    resolutionPreset,
    status: "starting",
    logs: [],
    error: null,
    exitCode: null,
    startedAt: nowIso(),
    finishedAt: null,
    artifacts: {},
    metrics: {
      startedAt: nowIso(),
      finishedAt: null,
      totalMs: null,
      stages: {},
      segments: [],
      retries: [],
      knobs: { cpuRatio, ramRatio, noHwEncode, noLiveMonitor, audioSyncMode },
    },
  };
  courseJobs.set(id, job);
  runCoursePipeline(job, {
    ffmpegPath,
    cargoPath,
    varinRoot,
    outputRoot,
    cpuRatio,
    ramRatio,
    noHwEncode,
    noLiveMonitor,
    audioSyncMode,
  }).catch((err) => {
    job.status = "failed";
    job.error = String(err);
    pushLog(job, `pipeline crashed: ${job.error}`);
    finishJob(job, 1);
  });
  return job;
}

function finishJob(job, exitCode) {
  job.exitCode = exitCode;
  job.finishedAt = nowIso();
  job.metrics.finishedAt = nowIso();
  job.metrics.totalMs = Date.now() - new Date(job.startedAt).getTime();
}

async function runCoursePipeline(job, options) {
  const preset = getResolutionPreset(job.resolutionPreset);
  const fps = job.qualityMode === "high_quality" || job.qualityMode === "manim_1min" ? 30 : 24;
  const mode =
    job.qualityMode === "high_quality"
      ? "high_quality"
      : job.qualityMode === "manim_1min"
        ? "manim_1min"
        : "fast";

  const root = path.join(
    options.outputRoot,
    "projects",
    "java_oop_5min",
    `${mode}_${job.resolutionPreset}_${Date.now()}`
  );
  const dirs = {
    root,
    segments: path.join(root, "segments"),
    audio: path.join(root, "audio"),
    video: path.join(root, "video"),
    final: path.join(root, "final"),
    reports: path.join(root, "reports"),
    timeline: path.join(root, "timeline"),
  };
  ensureDir(dirs.segments);
  ensureDir(dirs.audio);
  ensureDir(dirs.video);
  ensureDir(dirs.final);
  ensureDir(dirs.reports);
  ensureDir(dirs.timeline);

  job.artifacts.root = root;
  job.artifacts.finalDir = dirs.final;
  pushLog(job, `course run dir: ${root}`);

  markStageStart(job, "outline");
  const targetDuration = mode === "manim_1min" ? 60 : 300;
  const segments = createSegments(mode, targetDuration);
  const outline = {
    topic: "Java OOP Concepts",
    mode,
    resolutionPreset: job.resolutionPreset,
    width: preset.width,
    height: preset.height,
    fps,
    totalSeconds: segments.reduce((a, s) => a + s.durationSec, 0),
    segments,
  };
  const wordTimeline = buildWordTimeline(segments);
  writeJson(path.join(root, "outline.json"), outline);
  writeJson(path.join(dirs.timeline, "word_timeline.json"), wordTimeline);
  fs.writeFileSync(
    path.join(root, "script.txt"),
    segments.map((s, idx) => `${idx + 1}. ${s.title}\n${s.narration}\n`).join("\n"),
    "utf8"
  );
  markStageEnd(job, "outline");

  markStageStart(job, "sceneGen");
  const sceneFiles = [];
  const allScenes = [];
  for (const segment of segments) {
    const scene = mode === "manim_1min"
      ? makeManimInspiredScene(segment, preset.width, preset.height, fps)
      : makeScene(segment, preset.width, preset.height, fps);
    const fileName = `scene_${String(segment.index + 1).padStart(2, "0")}_${sanitizeFileName(segment.key)}.json`;
    const filePath = path.join(dirs.segments, fileName);
    writeJson(filePath, scene);
    sceneFiles.push(filePath);
    allScenes.push({ segment: segment.index + 1, title: segment.title, scene });
  }
  fs.writeFileSync(path.join(root, "all_scenes_export.json"), JSON.stringify(allScenes, null, 2), "utf8");
  markStageEnd(job, "sceneGen");

  markStageStart(job, "tts");
  const audioTimed = [];
  for (const segment of segments) {
    const raw = path.join(dirs.audio, `seg_${String(segment.index + 1).padStart(2, "0")}_raw.wav`);
    const timed = path.join(dirs.audio, `seg_${String(segment.index + 1).padStart(2, "0")}.mp3`);
    const ok = await generateSegmentAudio(job, options.ffmpegPath, segment, raw, timed);
    if (!ok) {
      pushLog(job, `audio failed for segment ${segment.index + 1}, generating silence fallback`);
      await runCommand(options.ffmpegPath, [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-t",
        String(segment.durationSec),
        "-q:a",
        "9",
        "-acodec",
        "libmp3lame",
        timed,
      ]);
    }
    audioTimed.push(timed);
  }
  markStageEnd(job, "tts");

  markStageStart(job, "render");
  job.status = "running";
  const workerCount = mode === "high_quality" ? 2 : mode === "manim_1min" ? 2 : 3;
  const baseCpu = mode === "high_quality" ? Math.min(0.6, options.cpuRatio) : Math.min(0.7, options.cpuRatio);
  const baseRam = mode === "high_quality" ? Math.min(0.5, options.ramRatio) : Math.min(0.45, options.ramRatio);
  const perProcCpu = Math.max(0.25, Number((baseCpu / workerCount).toFixed(2)));
  const perProcRam = Math.max(0.2, Number((baseRam / workerCount).toFixed(2)));

  const renderResults = await runPool(segments, workerCount, async (segment) => {
    const startMs = Date.now();
    const result = await runWithRetry(
      job,
      `render segment ${segment.index + 1}`,
      async (attempt) =>
        renderSegment(
          job,
          {
            cargo: options.cargoPath,
            ffmpeg: options.ffmpegPath,
            varinRoot: options.varinRoot,
            runDir: root,
          },
          segment,
          preset,
          { fps, cpuRatio: perProcCpu, ramRatio: perProcRam },
          attempt
        ),
      3
    );
    const ms = Date.now() - startMs;
    const file = path.join(dirs.video, `seg_${String(segment.index + 1).padStart(2, "0")}.mp4`);
    const sizeMb = fs.existsSync(file) ? Number((fs.statSync(file).size / (1024 * 1024)).toFixed(2)) : 0;
    const entry = {
      segment: segment.index + 1,
      title: segment.title,
      durationSec: segment.durationSec,
      renderMs: ms,
      ok: !!result.ok,
      file,
      sizeMb,
      errorCategory: result.ok ? null : result.category,
    };
    job.metrics.segments.push(entry);
    if (!result.ok) {
      job.metrics.retries.push({
        segment: segment.index + 1,
        category: result.category,
        attempt: result.attempt,
        stderr: truncate(result.stderr, 400),
      });
    }
    return entry;
  });
  markStageEnd(job, "render");

  const failed = renderResults.filter((r) => !r.ok);
  if (failed.length > 0) {
    job.status = "failed";
    job.error = `render failed for ${failed.length} segment(s)`;
    pushLog(job, job.error);
    writeJson(path.join(dirs.reports, "timing_report.json"), job.metrics);
    finishJob(job, 1);
    return;
  }

  markStageStart(job, "merge");
  const videoConcat = path.join(root, "video_concat.txt");
  fs.writeFileSync(
    videoConcat,
    segments
      .map((s) => `file '${path.join(dirs.video, `seg_${String(s.index + 1).padStart(2, "0")}.mp4`).replace(/\\/g, "/")}'`)
      .join("\n"),
    "utf8"
  );
  const mergedVideo = path.join(dirs.final, "merged_video.mp4");
  let mergeVideo = await runWithRetry(job, "merge video", async () => {
    const r = await runCommand(options.ffmpegPath, [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      videoConcat,
      "-c",
      "copy",
      mergedVideo,
    ]);
    return { ok: r.code === 0 && fs.existsSync(mergedVideo), ...r };
  });
  if (!mergeVideo.ok) {
    pushLog(job, "merge video fallback to re-encode");
    mergeVideo = await runWithRetry(job, "merge video re-encode", async () => {
      const r = await runCommand(options.ffmpegPath, [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        videoConcat,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        mergedVideo,
      ]);
      return { ok: r.code === 0 && fs.existsSync(mergedVideo), ...r };
    });
  }
  if (!mergeVideo.ok) {
    job.status = "failed";
    job.error = "video merge failed";
    finishJob(job, 1);
    return;
  }

  const audioConcat = path.join(root, "audio_concat.txt");
  fs.writeFileSync(
    audioConcat,
    audioTimed.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"),
    "utf8"
  );
  const mergedAudio = path.join(dirs.final, "merged_audio.mp3");
  const mergeAudio = await runWithRetry(job, "merge audio", async () => {
    const r = await runCommand(options.ffmpegPath, [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      audioConcat,
      "-c",
      "copy",
      mergedAudio,
    ]);
    return { ok: r.code === 0 && fs.existsSync(mergedAudio), ...r };
  });
  if (!mergeAudio.ok) {
    job.status = "failed";
    job.error = "audio merge failed";
    finishJob(job, 1);
    return;
  }

  const syncMode = options.audioSyncMode === "segment_level" ? "segment_level" : "word_level";
  const srtPath = path.join(dirs.final, "captions.srt");
  const srtContent = syncMode === "word_level"
    ? buildWordLevelSrt(wordTimeline)
    : buildSubtitleSrt(segments);
  fs.writeFileSync(srtPath, srtContent, "utf8");

  const finalName = mode === "manim_1min"
    ? `java-oop-1min-${mode}-${job.resolutionPreset}.mp4`
    : `java-oop-5min-${mode}-${job.resolutionPreset}.mp4`;
  const finalOutput = path.join(dirs.final, finalName);
  const subtitleFilter =
    `subtitles='${srtPath.replace(/\\/g, "/").replace(/:/g, "\\:")}':` +
    "force_style='FontName=Arial,FontSize=24,PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,BorderStyle=3,Outline=1,Shadow=0,MarginV=24'";
  const videoDuration = await probeDurationSec(options.ffmpegPath, mergedVideo);
  const mergedAudioSynced = path.join(dirs.final, "merged_audio_synced.m4a");
  if (videoDuration && videoDuration > 0) {
    await alignAudioDuration(job, options.ffmpegPath, mergedAudio, videoDuration, mergedAudioSynced);
  }
  const muxAudioInput = fs.existsSync(mergedAudioSynced) ? mergedAudioSynced : mergedAudio;
  const mux = await runWithRetry(job, "mux final", async () => {
    const r = await runCommand(options.ffmpegPath, [
      "-y",
      "-i",
      mergedVideo,
      "-i",
      muxAudioInput,
      "-vf",
      subtitleFilter,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-c:a",
      "aac",
      ...(videoDuration ? ["-t", String(videoDuration)] : []),
      finalOutput,
    ]);
    return { ok: r.code === 0 && fs.existsSync(finalOutput), ...r };
  });
  markStageEnd(job, "merge");
  if (!mux.ok) {
    job.status = "failed";
    job.error = "final mux failed";
    finishJob(job, 1);
    return;
  }

  job.artifacts.finalVideo = finalOutput;
  job.artifacts.outline = path.join(root, "outline.json");
  job.artifacts.sceneExport = path.join(root, "all_scenes_export.json");
  job.artifacts.timingReport = path.join(dirs.reports, "timing_report.json");
  writeJson(job.artifacts.timingReport, job.metrics);
  job.status = "completed";
  pushLog(job, `completed: ${finalOutput}`);
  finishJob(job, 0);
}

