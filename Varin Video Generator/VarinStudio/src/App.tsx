import { useEffect, useMemo, useRef, useState } from "react";

type Config = {
  defaultFfmpeg: string;
  defaultOutputPath: string;
};

type Job = {
  id: string;
  status: "starting" | "running" | "completed" | "failed";
  logs: string[];
  resources: {
    totalRamGb: number;
    freeRamGb: number;
    usedRamGb: number;
    cpuLogical: number;
    at: string;
  } | null;
  outputPath: string;
  error: string | null;
  exitCode: number | null;
};

type ValidateIssue = {
  severity: "error" | "info";
  line: number | null;
  column: number | null;
  message: string;
};

type ValidateResponse = {
  ok: boolean;
  error?: string;
  exitCode?: number;
  messages?: string[];
  issues?: ValidateIssue[];
};

type PromptResponse = {
  prompt: string;
  suggestedSceneCount: number;
  feedSteps: string[];
};

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [inputJson, setInputJson] = useState("");
  const [ffmpegPath, setFfmpegPath] = useState("");
  const [outputPath, setOutputPath] = useState("");
  const [cpuRatio, setCpuRatio] = useState(0.7);
  const [ramRatio, setRamRatio] = useState(0.65);
  const [maxThreads, setMaxThreads] = useState<number | "">("");
  const [noHwEncode, setNoHwEncode] = useState(false);
  const [noLiveMonitor, setNoLiveMonitor] = useState(false);
  const [strictMode, setStrictMode] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [validating, setValidating] = useState(false);

  const [title, setTitle] = useState("");
  const [topicDetails, setTopicDetails] = useState("");
  const [sectionsText, setSectionsText] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(3);
  const [audienceLevel, setAudienceLevel] = useState("beginner");
  const [styleTone, setStyleTone] = useState("clean");
  const [aspect, setAspect] = useState("16:9");
  const [resolution, setResolution] = useState("1280x720");
  const [mustInclude, setMustInclude] = useState("");
  const [avoid, setAvoid] = useState("");
  const [autoSceneCount, setAutoSceneCount] = useState(true);
  const [sceneCount, setSceneCount] = useState(8);
  const [conceptDensity, setConceptDensity] = useState("medium");
  const [animationIntensity, setAnimationIntensity] = useState("balanced");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [promptSteps, setPromptSteps] = useState<string[]>([]);
  const [suggestedSceneCount, setSuggestedSceneCount] = useState<number | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [promptError, setPromptError] = useState("");
  const [promptBusy, setPromptBusy] = useState(false);

  const pollRef = useRef<number | null>(null);

  const canRun = useMemo(
    () => inputJson.trim().length > 0 && outputPath.trim().length > 0,
    [inputJson, outputPath]
  );

  const formatInsight = useMemo(() => {
    if (!inputJson.trim()) return "empty";
    try {
      const parsed = JSON.parse(inputJson) as { scenes?: unknown[]; layers?: unknown[] };
      if (Array.isArray(parsed.scenes)) return "storyboard";
      if (Array.isArray(parsed.layers)) return "scene";
      return "unknown_json";
    } catch {
      return "invalid_json";
    }
  }, [inputJson]);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((c: Config) => {
        setConfig(c);
        setFfmpegPath(c.defaultFfmpeg);
        setOutputPath(c.defaultOutputPath);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, []);

  function autoGenerateSections() {
    const count = Math.min(10, Math.max(4, Math.round(durationMinutes * 2.5)));
    const defaults = [
      "Intro and learning goals",
      "Core idea explained simply",
      "Visual example / walkthrough",
      "Common mistake and fix",
      "Practical use case",
      "Quick recap and key takeaway",
    ];
    const picked: string[] = [];
    for (let i = 0; i < count; i += 1) {
      picked.push(defaults[i] || `Section ${i + 1}`);
    }
    setSectionsText(picked.join("\n"));
  }

  async function generateLlmPrompt() {
    setPromptBusy(true);
    setPromptError("");
    const sections = sectionsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const r = await fetch("/api/llm-prompt/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          topicDetails,
          sections,
          durationMinutes,
          audienceLevel,
          styleTone,
          aspect,
          resolution,
          mustInclude,
          avoid,
          autoSceneCount,
          sceneCount,
          conceptDensity,
          animationIntensity,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setPromptError(data?.error || "Prompt generation failed.");
        return;
      }
      const okData = data as PromptResponse;
      setGeneratedPrompt(okData.prompt || "");
      setPromptSteps(okData.feedSteps || []);
      setSuggestedSceneCount(okData.suggestedSceneCount ?? null);
    } catch (err) {
      setPromptError(`Prompt generation failed: ${String(err)}`);
    } finally {
      setPromptBusy(false);
    }
  }

  async function copyPrompt() {
    if (!generatedPrompt.trim()) return;
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopyStatus("Prompt copied.");
      window.setTimeout(() => setCopyStatus(""), 1800);
    } catch {
      setCopyStatus("Copy failed. Select and copy manually.");
    }
  }

  async function validateInput(): Promise<boolean> {
    if (!inputJson.trim()) return false;
    setValidating(true);
    try {
      const r = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputJson }),
      });
      const data: ValidateResponse = await r.json();
      setValidation(data);
      return !!data.ok;
    } catch {
      setValidation({ ok: false, error: "validation request failed", messages: [] });
      return false;
    } finally {
      setValidating(false);
    }
  }

  async function startRender() {
    if (!canRun) return;
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    const ok = await validateInput();
    if (strictMode && !ok) return;
    const r = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputJson,
        outputPath,
        ffmpegPath,
        cpuRatio,
        ramRatio,
        maxThreads: maxThreads === "" ? undefined : Number(maxThreads),
        noHwEncode,
        noLiveMonitor,
      }),
    });
    const data = await r.json();
    if (!data.jobId) return;
    await pollJob(data.jobId);
    pollRef.current = window.setInterval(() => {
      pollJob(data.jobId).catch(() => undefined);
    }, 1000);
  }

  async function pollJob(id: string) {
    const r = await fetch(`/api/job/${id}`);
    if (!r.ok) return;
    const data: Job = await r.json();
    setJob(data);
    if (data.status === "completed" || data.status === "failed") {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }

  return (
    <div className="container">
      <h1>Varin Studio</h1>
      <p className="sub">Prompt-first storyboard workflow for high-quality educational video generation.</p>

      <div className="grid">
        <section className="card">
          <h2>Prompt Builder</h2>
          <label>Video title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Java OOP explained visually" />

          <label>Topic details</label>
          <textarea value={topicDetails} onChange={(e) => setTopicDetails(e.target.value)} placeholder="What exactly should the video teach?" />

          <div className="row two-col">
            <div>
              <label>Target duration (minutes)</label>
              <input type="number" min={1} max={20} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value || 3))} />
            </div>
            <div>
              <label>Audience</label>
              <select value={audienceLevel} onChange={(e) => setAudienceLevel(e.target.value)}>
                <option value="beginner">beginner</option>
                <option value="intermediate">intermediate</option>
                <option value="advanced">advanced</option>
              </select>
            </div>
          </div>

          <div className="row two-col">
            <div>
              <label>Style tone</label>
              <select value={styleTone} onChange={(e) => setStyleTone(e.target.value)}>
                <option value="clean">clean</option>
                <option value="energetic">energetic</option>
                <option value="minimal">minimal</option>
                <option value="high_contrast">high_contrast</option>
              </select>
            </div>
            <div>
              <label>Concept density</label>
              <select value={conceptDensity} onChange={(e) => setConceptDensity(e.target.value)}>
                <option value="light">light</option>
                <option value="medium">medium</option>
                <option value="deep">deep</option>
              </select>
            </div>
          </div>

          <div className="row two-col">
            <div>
              <label>Animation intensity</label>
              <select value={animationIntensity} onChange={(e) => setAnimationIntensity(e.target.value)}>
                <option value="calm">calm</option>
                <option value="balanced">balanced</option>
                <option value="dynamic">dynamic</option>
              </select>
            </div>
            <div>
              <label>Aspect / Resolution</label>
              <div className="two-col">
                <select value={aspect} onChange={(e) => setAspect(e.target.value)}>
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
                </select>
                <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
                  <option value="1280x720">1280x720</option>
                  <option value="720x1280">720x1280</option>
                  <option value="1920x1080">1920x1080</option>
                </select>
              </div>
            </div>
          </div>

          <div className="row two-col">
            <div>
              <label>Must include (optional)</label>
              <input value={mustInclude} onChange={(e) => setMustInclude(e.target.value)} placeholder="key points/keywords" />
            </div>
            <div>
              <label>Avoid (optional)</label>
              <input value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder="things to avoid" />
            </div>
          </div>

          <div className="row two-col">
            <div>
              <label className="inline-toggle">
                <input type="checkbox" checked={autoSceneCount} onChange={(e) => setAutoSceneCount(e.target.checked)} />
                Auto scene count by duration
              </label>
            </div>
            <div>
              <label>Scene count (when auto off)</label>
              <input type="number" min={3} max={20} value={sceneCount} onChange={(e) => setSceneCount(Number(e.target.value || 8))} disabled={autoSceneCount} />
            </div>
          </div>

          <label>Sections (one per line)</label>
          <textarea value={sectionsText} onChange={(e) => setSectionsText(e.target.value)} placeholder={"Intro\nCore idea\nExample\nRecap"} />
          <div className="button-row">
            <button onClick={autoGenerateSections}>Auto-generate section breakdown</button>
            <button onClick={generateLlmPrompt} disabled={promptBusy}>
              {promptBusy ? "Generating..." : "Generate LLM Prompt"}
            </button>
            <button onClick={copyPrompt} disabled={!generatedPrompt.trim()}>Copy Prompt</button>
          </div>
          {promptError ? <p className="warn">{promptError}</p> : null}
          {copyStatus ? <small>{copyStatus}</small> : null}
          {suggestedSceneCount !== null ? <small>Suggested scenes: {suggestedSceneCount}</small> : null}

          <label>Generated LLM prompt</label>
          <textarea value={generatedPrompt} onChange={(e) => setGeneratedPrompt(e.target.value)} className="llm-prompt" />
          {promptSteps.length > 0 ? (
            <>
              <label>How to use</label>
              <ul className="issue-list">
                {promptSteps.map((s, i) => <li key={`${s}-${i}`}>{s}</li>)}
              </ul>
            </>
          ) : null}
        </section>

        <section className="card">
          <h2>Input + Render</h2>
          <p className="sub">Paste LLM output JSON here (storyboard preferred).</p>
          <label>Input JSON</label>
          <textarea
            value={inputJson}
            onChange={(e) => setInputJson(e.target.value)}
            placeholder='{"version":"v1","scenes":[...]}'
          />
          <small>Detected format: {formatInsight}</small>

          <div className="row">
            <label className="inline-toggle">
              <input type="checkbox" checked={strictMode} onChange={(e) => setStrictMode(e.target.checked)} />
              Strict mode (block render on validation failure)
            </label>
          </div>

          <label>Final output path (MP4)</label>
          <input value={outputPath} onChange={(e) => setOutputPath(e.target.value)} />
          <label>FFmpeg path</label>
          <input value={ffmpegPath} onChange={(e) => setFfmpegPath(e.target.value)} />

          <div className="row two-col">
            <div>
              <label>CPU ratio</label>
              <input type="number" min={0.1} max={0.7} step={0.01} value={cpuRatio} onChange={(e) => setCpuRatio(Number(e.target.value || 0.7))} />
            </div>
            <div>
              <label>RAM ratio</label>
              <input type="number" min={0.1} max={0.7} step={0.01} value={ramRatio} onChange={(e) => setRamRatio(Number(e.target.value || 0.65))} />
            </div>
          </div>

          <div className="row">
            <label>Max threads</label>
            <input
              type="number"
              min={1}
              value={maxThreads}
              onChange={(e) => setMaxThreads(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="optional"
            />
          </div>
          <div className="row split">
            <label className="inline-toggle">
              <input type="checkbox" checked={noHwEncode} onChange={(e) => setNoHwEncode(e.target.checked)} />
              Disable hardware encoder
            </label>
            <label className="inline-toggle">
              <input type="checkbox" checked={noLiveMonitor} onChange={(e) => setNoLiveMonitor(e.target.checked)} />
              Disable live resource monitor
            </label>
          </div>

          <div className="button-row">
            <button onClick={validateInput} disabled={!inputJson.trim() || validating}>
              {validating ? "Validating..." : "Validate Input"}
            </button>
            <button disabled={!canRun} onClick={startRender}>Generate Video</button>
          </div>
          {config ? <small>Default ffmpeg: {config.defaultFfmpeg}</small> : null}

          {validation ? (
            <div className="validation-box">
              <h3>Validation Result</h3>
              <p className={validation.ok ? "ok" : "warn"}>
                {validation.ok ? "Validation passed." : validation.error || "Validation failed."}
              </p>
              {validation.issues && validation.issues.length > 0 ? (
                <ul className="issue-list">
                  {validation.issues.slice(0, 10).map((issue, idx) => (
                    <li key={`${issue.message}-${idx}`}>
                      {issue.line ? `line ${issue.line}` : "line ?"}
                      {issue.column ? `, col ${issue.column}` : ""}: {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              <pre>{(validation.messages || []).join("\n") || "No validator messages."}</pre>
            </div>
          ) : null}
        </section>

        <section className="card span-2">
          <h2>Generation Flow</h2>
          <div className="status">
            Status: <b>{job?.status ?? "idle"}</b>
            {job?.outputPath ? <> | Output: {job.outputPath}</> : null}
          </div>
          <div className="resources">
            <h3>Live Resources</h3>
            {job?.resources ? (
              <ul>
                <li>Total RAM: {job.resources.totalRamGb} GB</li>
                <li>Used RAM: {job.resources.usedRamGb} GB</li>
                <li>Free RAM: {job.resources.freeRamGb} GB</li>
                <li>Logical CPU: {job.resources.cpuLogical}</li>
                <li>Updated: {new Date(job.resources.at).toLocaleTimeString()}</li>
              </ul>
            ) : (
              <p>No active job yet.</p>
            )}
          </div>
          <h3>Logs</h3>
          <pre>{job?.logs?.join("\n") || "No logs yet."}</pre>
        </section>
      </div>
    </div>
  );
}
