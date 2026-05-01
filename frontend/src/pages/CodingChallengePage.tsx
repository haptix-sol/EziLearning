import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Editor from '@monaco-editor/react';
import {
  Check,
  Clapperboard,
  Code2,
  FileText,
  LayoutPanelLeft,
  Mic,
  PanelBottom,
  Play,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  api,
  type AnneHintRequestBody,
  type AnneHintResponseBody,
  type AnneHintStyle,
  type Challenge,
  type Execution,
} from '../lib/api';
import { challengeLanguageLabel, monacoLanguageId, normalizeChallengeLanguage } from '../lib/codeLanguages';
import { useEditorStore } from '../stores/editorStore';

type TabType = 'output' | 'test-results';

const CODE_EXCERPT_MAX_CHARS = 10000;
const CODE_EXCERPT_TAIL_LINES = 140;

function tailCodeExcerpt(src: string): string {
  const lines = src.split('\n');
  const tail = lines.slice(Math.max(0, lines.length - CODE_EXCERPT_TAIL_LINES)).join('\n');
  if (tail.length <= CODE_EXCERPT_MAX_CHARS) return tail;
  return tail.slice(-CODE_EXCERPT_MAX_CHARS);
}

function buildTestFailureSummary(ex: Execution | null): string | null {
  if (!ex) return null;
  const parts: string[] = [];
  if (ex.stderr?.trim()) parts.push(`stderr:\n${ex.stderr.trim().slice(0, 2000)}`);
  const tr = ex.test_results;
  if (tr?.length) {
    const failed = tr.filter((t) => !t.passed);
    failed.slice(0, 8).forEach((t, i) => {
      parts.push(
        `Failed test ${i + 1}: input=${String(t.input ?? '')} expected=${String(t.expected ?? '')} actual=${String(t.actual ?? '')}`,
      );
    });
  }
  const s = parts.join('\n\n');
  return s.trim() || null;
}

function pickAnneVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const prefer =
    voices.find((v) => /Samantha|Victoria|Karen|Google UK English Female/i.test(v.name)) ??
    voices.find((v) => v.lang.startsWith('en') && /female/i.test(v.name)) ??
    voices.find((v) => v.lang.startsWith('en'));
  return prefer ?? voices[0] ?? null;
}

/** Softer on-screen copy: trim markdown-ish list leaders and long dashes from model text. */
function sanitizeAnneDisplayText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.replace(/^\s*[-*]\s+/, '').replace(/^\s*\d+\.\s+/, ''))
    .join('\n')
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*–\s*/g, ', ')
    .trim();
}

const DIFFICULTY_COLORS = {
  easy: { bg: 'var(--success-bg)', color: 'var(--success)', label: 'Easy' },
  medium: { bg: 'var(--warning-bg)', color: 'var(--warning)', label: 'Medium' },
  hard: { bg: 'var(--danger-bg)', color: 'var(--danger)', label: 'Hard' },
} as const;

export function CodingChallengePage() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const [searchParams] = useSearchParams();
  const levelParam = searchParams.get('level');
  const fromStudy = searchParams.get('from') === 'study';
  const [output, setOutput] = useState<Execution | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('output');
  const [leftPanelWidth, setLeftPanelWidth] = useState(45);
  const [outputPanelExpanded, setOutputPanelExpanded] = useState(false);
  const problemRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [anneOpen, setAnneOpen] = useState(false);
  const [anneReadAloud, setAnneReadAloud] = useState(false);
  const [anneInput, setAnneInput] = useState('');
  type AnneMsg = { role: 'user' | 'anne'; text: string; fallback?: boolean };
  const [anneMessages, setAnneMessages] = useState<AnneMsg[]>([]);
  const [tapPop, setTapPop] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const fireTapPop = useCallback((id: string) => {
    setTapPop(id);
    window.setTimeout(() => setTapPop(null), 440);
  }, []);
  const { code, setCode, setChallenge, resetCode, language } = useEditorStore();

  const { data: challenge, isLoading, isError, error } = useQuery<Challenge>({
    queryKey: ['challenge', challengeId],
    queryFn: async () => {
      const { data } = await api.get(`/challenges/${challengeId}`);
      return data;
    },
    enabled: !!challengeId,
  });

  useEffect(() => {
    if (challenge) {
      setChallenge(challenge.id, challenge.starter_code || '', normalizeChallengeLanguage(challenge.language));
    }
    return () => setChallenge(null, '', 'python');
  }, [challenge, setChallenge]);

  const runMutation = useMutation({
    mutationFn: async ({ codeToRun, mode }: { codeToRun: string; mode: 'run' | 'submit' }) => {
      const { data } = await api.post<Execution>('/executions', {
        code: codeToRun,
        language: language,
        challenge_id: challengeId,
        mode,
      });
      return data;
    },
    onSuccess: (data) => {
      setOutput(data);
      if (data.test_results && data.test_results.length > 0) {
        setActiveTab('test-results');
      } else {
        setActiveTab('output');
      }
      setOutputPanelExpanded(true);
      const passedAll = data.test_results?.length && data.test_results.every((t) => t.passed);
      if (passedAll) {
        queryClient.invalidateQueries({ queryKey: ['progress'] });
        queryClient.invalidateQueries({ queryKey: ['questions-solved'] });
        if (levelParam) {
          queryClient.invalidateQueries({ queryKey: ['level-content', parseInt(levelParam, 10)] });
          queryClient.invalidateQueries({ queryKey: ['level-map'] });
        }
      }
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setOutput({
        id: '',
        status: 'failed',
        stdout: null,
        stderr: err?.response?.data?.detail || 'Execution failed. Please try again.',
        execution_time_ms: null,
        test_results: null,
        created_at: '',
      });
      setActiveTab('output');
      setOutputPanelExpanded(true);
    },
  });

  const handleRun = useCallback(() => runMutation.mutate({ codeToRun: code, mode: 'run' }), [code, runMutation]);
  const handleSubmit = useCallback(() => runMutation.mutate({ codeToRun: code, mode: 'submit' }), [code, runMutation]);
  const handleReset = () => challenge && resetCode(challenge.starter_code || '');

  const speakAnne = useCallback(
    (text: string) => {
      if (!anneReadAloud || typeof window === 'undefined' || !window.speechSynthesis) return;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.96;
      const v = pickAnneVoice();
      if (v) u.voice = v;
      window.speechSynthesis.speak(u);
    },
    [anneReadAloud],
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const load = () => pickAnneVoice();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    load();
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  const anneMutation = useMutation({
    mutationFn: async (body: AnneHintRequestBody) => {
      const { data } = await api.post<AnneHintResponseBody>(`/challenges/${challengeId}/anne-hint`, body);
      return data;
    },
    onSuccess: (data) => {
      const reply = sanitizeAnneDisplayText(data.reply || '…');
      setAnneMessages((m) => [...m, { role: 'anne', text: reply, fallback: data.fallback }]);
      speakAnne(reply);
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      const msg = err?.response?.data?.detail || 'Could not reach Anne. Try again in a moment.';
      setAnneMessages((m) => [...m, { role: 'anne', text: msg, fallback: true }]);
    },
  });

  const askAnne = useCallback(
    (opts: { hint_style: AnneHintStyle; student_message?: string | null }) => {
      if (!challengeId) return;
      const userLine =
        opts.student_message?.trim() ||
        (opts.hint_style === 'light'
          ? 'Give me a light hint, just a nudge.'
          : opts.hint_style === 'stuck'
            ? "I'm stuck: help me unblock without the full answer."
            : 'Help me debug from my last run and errors.');
      setAnneMessages((m) => [...m, { role: 'user', text: userLine }]);
      const body: AnneHintRequestBody = {
        hint_style: opts.hint_style ?? 'light',
        student_message: opts.student_message?.trim() || null,
        code_excerpt: tailCodeExcerpt(code),
        stderr_excerpt: output?.stderr?.trim() || null,
        test_failure_summary: buildTestFailureSummary(output),
      };
      anneMutation.mutate(body);
    },
    [challengeId, code, output, anneMutation],
  );

  const jumpTo = useCallback((section: 'problem' | 'editor' | 'output' | 'tests') => {
    if (section === 'output') {
      setOutputPanelExpanded(true);
      setActiveTab('output');
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
      return;
    }
    if (section === 'tests') {
      setOutputPanelExpanded(true);
      setActiveTab('test-results');
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
      return;
    }
    const el = section === 'problem' ? problemRef.current : editorRef.current;
    requestAnimationFrame(() => el?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, []);

  const startVoiceToAnne = useCallback(() => {
    if (typeof window === 'undefined') return;
    type RecCtor = new () => {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: ((ev: { results: { [k: number]: { [j: number]: { transcript: string } } } }) => void) | null;
      start: () => void;
    };
    const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (ev) => {
      const t = ev.results[0]?.[0]?.transcript?.trim();
      if (t) setAnneInput((prev) => (prev ? `${prev} ${t}` : t));
    };
    r.start();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleRun]);

  useEffect(() => {
    if (!anneOpen && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [anneOpen]);

  if (isLoading || !challenge) {
    return (
      <div className="ez-compiler-state">
        {isLoading && (
          <div className="ez-compiler-state__inner">
            <div className="ez-compiler-state__spinner" />
            <span className="ez-compiler-state__label">Loading challenge...</span>
          </div>
        )}
        {!isLoading && !challenge && (
          <span className="ez-compiler-state__muted">Challenge not found</span>
        )}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="ez-compiler-state ez-compiler-state--error">
        <div className="ez-compiler-state__icon">⚠</div>
        <p className="ez-compiler-state__error-title">Failed to load challenge</p>
        <p className="ez-compiler-state__error-sub">{(error as Error)?.message}</p>
        <Link
          to={fromStudy ? '/study' : '/questions'}
          className="btn btn-ghost"
        >
          ← Back
        </Link>
      </div>
    );
  }

  const testResults = output?.test_results;
  const passedCount = testResults?.filter((t) => t.passed).length ?? 0;
  const totalTests = testResults?.length ?? 0;
  const difficultyKey = challenge.difficulty === 'easy' ? 'easy' : challenge.difficulty === 'hard' ? 'hard' : 'medium';

  return (
    <div className="ez-compiler">
      {/* Top toolbar */}
      <div className="ez-compiler__toolbar">
        <div className="ez-compiler__toolbar-left">
        {(fromStudy || levelParam) && (
          <Link
            to={fromStudy ? '/study' : `/levels/${levelParam}`}
            className="ez-compiler__back-link"
          >
            <span className="ez-compiler__back-arrow">←</span>
            {fromStudy ? 'Study Plan' : `Level ${levelParam}`}
          </Link>
        )}
        <div className="ez-compiler__divider" />
        <button
          onClick={handleRun}
          disabled={runMutation.isPending}
          className="btn btn-ghost btn-sm"
          title="Run code (Ctrl+Enter)"
        >
          {runMutation.isPending ? (
            <>
              <span className="ez-compiler__btn-spinner" />
              Running...
            </>
          ) : (
            <>
              <Play size={14} strokeWidth={2} fill="currentColor" aria-hidden />
              Run
            </>
          )}
        </button>
        <button
          onClick={handleSubmit}
          disabled={runMutation.isPending}
          className="btn btn-primary btn-sm"
          title="Submit solution"
        >
          {runMutation.isPending ? (
            <>
              <span className="ez-compiler__btn-spinner ez-compiler__btn-spinner--light" />
              Submitting...
            </>
          ) : (
            <>
              <Check size={14} strokeWidth={2.5} aria-hidden />
              Submit
            </>
          )}
        </button>
        <button
          onClick={handleReset}
          className="btn btn-ghost btn-sm"
          title="Reset to starter code"
        >
          Reset
        </button>
        <button
          onClick={() => setLeftPanelWidth((w) => (w === 45 ? 55 : 45))}
          className="btn btn-ghost btn-sm"
          title="Toggle problem panel width"
        >
          <LayoutPanelLeft size={16} strokeWidth={1.75} aria-hidden />
        </button>
        </div>
        <div className="ez-compiler__toolbar-right">
          <span
            className="ez-compiler__difficulty"
            style={DIFFICULTY_COLORS[difficultyKey]}
          >
            {DIFFICULTY_COLORS[difficultyKey].label}
          </span>
          <span className="ez-compiler__language">
            {challengeLanguageLabel(challenge.language)}
          </span>
          <span className="ez-compiler__hint">
            Ctrl+Enter to run
          </span>
        </div>
      </div>

      {/* Main content: Problem | Editor, with collapsible Output at bottom */}
      <div className="ez-compiler__body">
        <nav className="ez-compiler__jump" aria-label="Jump to workspace">
          <span className="ez-compiler__jump-label">Jump</span>
          <button
            type="button"
            className={`ez-compiler__jump-btn${tapPop === 'jump-problem' ? ' ez-compiler__jump-btn--boop' : ''}`}
            onClick={() => {
              fireTapPop('jump-problem');
              jumpTo('problem');
            }}
          >
            <FileText size={14} strokeWidth={2} aria-hidden />
            Problem
          </button>
          <button
            type="button"
            className={`ez-compiler__jump-btn${tapPop === 'jump-editor' ? ' ez-compiler__jump-btn--boop' : ''}`}
            onClick={() => {
              fireTapPop('jump-editor');
              jumpTo('editor');
            }}
          >
            <Code2 size={14} strokeWidth={2} aria-hidden />
            Editor
          </button>
          <button
            type="button"
            className={`ez-compiler__jump-btn${tapPop === 'jump-output' ? ' ez-compiler__jump-btn--boop' : ''}`}
            onClick={() => {
              fireTapPop('jump-output');
              jumpTo('output');
            }}
          >
            <PanelBottom size={14} strokeWidth={2} aria-hidden />
            Output
          </button>
          <button
            type="button"
            className={`ez-compiler__jump-btn${tapPop === 'jump-tests' ? ' ez-compiler__jump-btn--boop' : ''}`}
            onClick={() => {
              fireTapPop('jump-tests');
              jumpTo('tests');
            }}
          >
            <Check size={14} strokeWidth={2.5} aria-hidden />
            Tests
          </button>
        </nav>
        <div className="ez-compiler__split">
        {/* Left: Problem description */}
        <div
          ref={problemRef}
          className="ez-compiler__problem"
          style={{ width: `${leftPanelWidth}%` }}
        >
          <h2 className="ez-compiler__title">
            {challenge.title}
          </h2>
          {challenge.animation_url && (
            <div className="ez-compiler__video-card">
              <div className="ez-compiler__video-head">
                <Clapperboard size={16} strokeWidth={1.75} aria-hidden />
                <span>Animated explanation</span>
              </div>
              <video
                controls
                className="ez-compiler__video"
                src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${challenge.animation_url}`}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          )}
          <section className="ez-compiler__section">
            <h3 className="ez-compiler__section-title">
              Description
            </h3>
            <div className="ez-compiler__description">
              {(challenge.description || '').split('\n').map((line, i) => (
                <p key={i}>
                  {line}
                </p>
              ))}
            </div>
          </section>
          <section className="ez-compiler__constraint-card">
            <h3 className="ez-compiler__constraint-title">
              Constraints
            </h3>
            <ul className="ez-compiler__constraint-list">
              <li>Follow the function signature in starter code</li>
              <li>Return correct type as per problem</li>
              <li>Handle edge cases</li>
            </ul>
          </section>
          {challenge.test_cases && Array.isArray(challenge.test_cases) && challenge.test_cases.filter((t: { is_hidden?: boolean }) => !t?.is_hidden).length > 0 && (
            <section className="ez-compiler__examples">
              <h3 className="ez-compiler__section-title">
                Example test cases
              </h3>
              {(challenge.test_cases || [])
                .filter((t: { is_hidden?: boolean }) => !t?.is_hidden)
                .slice(0, 5)
                .map((tc, i) => (
                  <div key={i} className="ez-compiler__example-card">
                    <div className="ez-compiler__example-label">Example {i + 1}</div>
                    <div className="ez-compiler__example-input">Input: {tc?.input ?? ''}</div>
                    <div className="ez-compiler__example-output">Output: {tc?.expected_output ?? ''}</div>
                  </div>
                ))}
            </section>
          )}
        </div>

        {/* Center: Code editor */}
        <div
          ref={editorRef}
          className="ez-compiler__editor-pane"
        >
          <div className="ez-compiler__editor-head">
            <div className="ez-compiler__editor-head-left">
              <span className="ez-compiler__editor-lang">
                {challengeLanguageLabel(challenge.language)}
              </span>
              <span className="ez-compiler__editor-tag">
                Recommended
              </span>
            </div>
            <span className="ez-compiler__editor-lines">
              {code.split('\n').length} lines
            </span>
          </div>
          <div className="ez-compiler__editor-body">
            <Editor
              height="100%"
              language={monacoLanguageId(challenge.language)}
              theme="vs"
              value={code}
              onChange={(v) => setCode(v || '')}
              loading={
                <div className="ez-compiler__editor-loading">
                  Loading editor...
                </div>
              }
              options={{
                minimap: { enabled: false },
                fontSize: 15,
                lineHeight: 22,
                padding: { top: 20 },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                renderLineHighlight: 'all',
                cursorBlinking: 'smooth',
                smoothScrolling: true,
                fontLigatures: true,
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true, indentation: true },
              }}
            />
          </div>
        </div>
        </div>

        {/* Bottom: Collapsible Output / Test results */}
        <div ref={resultsRef} className={`ez-compiler__results ${outputPanelExpanded ? 'ez-compiler__results--open' : ''}`}>
          <div
            onClick={() => setOutputPanelExpanded((e) => !e)}
            className="ez-compiler__results-head"
          >
            <div className="ez-compiler__tabs">
              <button
                onClick={(e) => { e.stopPropagation(); setActiveTab('output'); if (!outputPanelExpanded) setOutputPanelExpanded(true); }}
                className={`ez-compiler__tab ${activeTab === 'output' ? 'ez-compiler__tab--active' : ''}`}
              >
                Output
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveTab('test-results'); if (!outputPanelExpanded) setOutputPanelExpanded(true); }}
                className={`ez-compiler__tab ${activeTab === 'test-results' ? 'ez-compiler__tab--active' : ''}`}
              >
                Test Results {totalTests > 0 && (
                  <span className={`ez-compiler__tab-badge ${passedCount === totalTests ? 'ez-compiler__tab-badge--ok' : 'ez-compiler__tab-badge--bad'}`}>
                    {passedCount}/{totalTests}
                  </span>
                )}
              </button>
            </div>
            <span className="ez-compiler__results-toggle">
              {outputPanelExpanded ? '▼ Minimize' : '▲ Expand output'}
            </span>
          </div>

          <div className="ez-compiler__results-body">
            {activeTab === 'output' && (
              <div className="ez-compiler__output">
                {output ? (
                  <>
                    {output.stdout && (
                      <pre className="ez-compiler__stdout">
                        {output.stdout}
                      </pre>
                    )}
                    {output.stderr && (
                      <pre className="ez-compiler__stderr">
                        {output.stderr}
                      </pre>
                    )}
                    {!output.stdout && !output.stderr && (
                      <span className="ez-compiler__empty">No output</span>
                    )}
                    {output.execution_time_ms != null && (
                      <div className="ez-compiler__exec-time">
                        <Check size={14} strokeWidth={2.5} aria-hidden />
                        Finished in {output.execution_time_ms}ms
                      </div>
                    )}
                  </>
                ) : (
                  <p className="ez-compiler__empty">
                    Click Run or press Ctrl+Enter to execute your code.
                  </p>
                )}
              </div>
            )}

            {activeTab === 'test-results' && (
              <div>
                {testResults && testResults.length > 0 ? (
                  <>
                    <div
                      className={`ez-compiler__tests-summary ${passedCount === totalTests ? 'ez-compiler__tests-summary--ok' : 'ez-compiler__tests-summary--bad'}`}
                    >
                      <span className="ez-compiler__tests-summary-icon">
                        {passedCount === totalTests ? (
                          <Check size={22} strokeWidth={2.5} aria-hidden />
                        ) : (
                          <X size={22} strokeWidth={2.5} aria-hidden />
                        )}
                      </span>
                      {passedCount === totalTests
                        ? `All ${totalTests} test cases passed!`
                        : `${passedCount} of ${totalTests} test cases passed`}
                    </div>
                    {testResults.map((tr, i) => (
                      <div
                        key={i}
                        className={`ez-compiler__test-card ${tr.passed ? 'ez-compiler__test-card--ok' : 'ez-compiler__test-card--bad'}`}
                      >
                        <div className={`ez-compiler__test-title ${tr.passed ? 'ez-compiler__test-title--ok' : 'ez-compiler__test-title--bad'}`}>
                          <span className="ez-compiler__test-icon">
                            {tr.passed ? <Check size={16} strokeWidth={2.5} aria-hidden /> : <X size={16} strokeWidth={2.5} aria-hidden />}
                          </span>
                          Test case {i + 1} {tr.passed ? 'Passed' : 'Failed'}
                        </div>
                        {tr.input != null && (
                          <div className="ez-compiler__test-input">
                            Input: {tr.input}
                          </div>
                        )}
                        {!tr.passed && (
                          <div className="ez-compiler__test-diff">
                            <div className="ez-compiler__test-expected">Expected: <code>{tr.expected}</code></div>
                            <div className="ez-compiler__test-actual">Got: <code>{tr.actual}</code></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="ez-compiler__empty">
                    Submit your code to run test cases.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {anneOpen && (
        <button
          type="button"
          className="ez-anne-backdrop"
          aria-label="Close Anne"
          onClick={() => setAnneOpen(false)}
        />
      )}
      {!anneOpen && (
        <button
          type="button"
          className={`ez-anne-fab ez-anne-fab--compact${tapPop === 'anne-fab' ? ' ez-anne-fab--boop' : ''}`}
          title="Anne: hints while you code"
          aria-label="Open Anne, coding tutor"
          onClick={() => {
            fireTapPop('anne-fab');
            setAnneOpen(true);
            setAnneMessages((prev) =>
              prev.length
                ? prev
                : [
                    {
                      role: 'anne',
                      text:
                        "Hi, I'm Anne. I won't hand you the full solution, but I can nudge you, read errors with you, or suggest what to try next. Tap Nudge, Stuck, or Debug, or type your own question.",
                    },
                  ],
            );
          }}
        >
          <Sparkles size={17} strokeWidth={2} aria-hidden />
        </button>
      )}
      {anneOpen && (
        <aside className="ez-anne-panel" role="dialog" aria-modal="true" aria-labelledby="ez-anne-title">
          <div className="ez-anne-panel__head">
            <div className="ez-anne-panel__brand">
              <Sparkles size={18} strokeWidth={2} className="ez-anne-panel__spark" aria-hidden />
              <div>
                <h2 id="ez-anne-title" className="ez-anne-panel__title">
                  Anne
                </h2>
                <p className="ez-anne-panel__subtitle">
                  Hints for this challenge when the server tutor is on. Otherwise you still get quick ideas.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="ez-anne-panel__close"
              onClick={() => setAnneOpen(false)}
              aria-label="Close"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
          <div className="ez-anne-ribbon" role="toolbar" aria-label="Quick prompts">
            <button
              type="button"
              className={`ez-anne-ribbon__hit${tapPop === 'anne-nudge' ? ' ez-anne-ribbon__hit--boop' : ''}`}
              disabled={anneMutation.isPending}
              onClick={() => {
                fireTapPop('anne-nudge');
                askAnne({ hint_style: 'light' });
              }}
            >
              Nudge
            </button>
            <span className="ez-anne-ribbon__sep" aria-hidden>
              ·
            </span>
            <button
              type="button"
              className={`ez-anne-ribbon__hit${tapPop === 'anne-stuck' ? ' ez-anne-ribbon__hit--boop' : ''}`}
              disabled={anneMutation.isPending}
              onClick={() => {
                fireTapPop('anne-stuck');
                askAnne({ hint_style: 'stuck' });
              }}
            >
              Stuck
            </button>
            <span className="ez-anne-ribbon__sep" aria-hidden>
              ·
            </span>
            <button
              type="button"
              className={`ez-anne-ribbon__hit${tapPop === 'anne-debug' ? ' ez-anne-ribbon__hit--boop' : ''}`}
              disabled={anneMutation.isPending}
              onClick={() => {
                fireTapPop('anne-debug');
                askAnne({ hint_style: 'debug' });
              }}
            >
              Debug
            </button>
          </div>
          <div className="ez-anne-messages">
            {anneMessages.map((msg, i) => (
              <div
                key={i}
                className={`ez-anne-stream ${msg.role === 'anne' ? 'ez-anne-stream--anne' : 'ez-anne-stream--user'}`}
              >
                <span className="ez-anne-stream__who">{msg.role === 'anne' ? 'Anne' : 'You'}</span>
                <p className="ez-anne-stream__text">
                  {msg.role === 'anne' ? sanitizeAnneDisplayText(msg.text) : msg.text}
                </p>
                {msg.role === 'anne' && msg.fallback && (
                  <span className="ez-anne-stream__meta">Offline tips (no live model).</span>
                )}
              </div>
            ))}
            {anneMutation.isPending && (
              <div className="ez-anne-stream ez-anne-stream--anne ez-anne-stream--pending">
                <span className="ez-anne-stream__who">Anne</span>
                <span className="ez-anne-dots" aria-live="polite">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            )}
          </div>
          <div className="ez-anne-compose">
            <div className="ez-anne-toolbar">
              <button
                type="button"
                className={`ez-anne-icon-btn ez-anne-icon-btn--sm ${anneReadAloud ? 'ez-anne-icon-btn--on' : ''}`}
                title={anneReadAloud ? 'Turn off read aloud' : 'Read Anne aloud'}
                onClick={() => setAnneReadAloud((v) => !v)}
              >
                {anneReadAloud ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              <button
                type="button"
                className="ez-anne-icon-btn ez-anne-icon-btn--sm"
                title="Speak your question (browser mic)"
                onClick={startVoiceToAnne}
              >
                <Mic size={16} />
              </button>
            </div>
            <div className="ez-anne-compose__row">
              <input
                className="ez-anne-compose__input"
                placeholder="Ask about this problem..."
                value={anneInput}
                onChange={(e) => setAnneInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const t = anneInput.trim();
                    if (!t || anneMutation.isPending) return;
                    setAnneInput('');
                    const style =
                      output?.stderr?.trim() || output?.test_results?.some((x) => !x.passed) ? 'debug' : 'light';
                    askAnne({ hint_style: style, student_message: t });
                  }
                }}
              />
              <button
                type="button"
                className="ez-anne-icon-btn ez-anne-icon-btn--sm"
                disabled={anneMutation.isPending || !anneInput.trim()}
                title="Send"
                onClick={() => {
                  const t = anneInput.trim();
                  if (!t || anneMutation.isPending) return;
                  setAnneInput('');
                  const style =
                    output?.stderr?.trim() || output?.test_results?.some((x) => !x.passed) ? 'debug' : 'light';
                  askAnne({ hint_style: style, student_message: t });
                }}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
