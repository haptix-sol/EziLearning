import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Editor from '@monaco-editor/react';
import { api, type Challenge, type Execution } from '../lib/api';
import { useEditorStore } from '../stores/editorStore';

type TabType = 'output' | 'test-results';

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
  const queryClient = useQueryClient();
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
      setChallenge(challenge.id, challenge.starter_code || '', challenge.language);
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
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      if (data.test_results?.every((t) => t.passed)) {
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

  if (isLoading || !challenge) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 'calc(100vh - 120px)',
        minHeight: 400,
        margin: -32,
        background: 'var(--bg-base)',
        gap: 20,
      }}>
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Loading challenge...</span>
          </div>
        )}
        {!isLoading && !challenge && (
          <span style={{ color: 'var(--text-muted)' }}>Challenge not found</span>
        )}
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 'calc(100vh - 120px)',
        minHeight: 400,
        margin: -32,
        background: 'var(--bg-base)',
        gap: 20,
        padding: 32,
      }}>
        <div style={{ fontSize: 48, opacity: 0.5 }}>⚠</div>
        <p style={{ color: 'var(--danger)', fontSize: 18, fontWeight: 600 }}>Failed to load challenge</p>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center' }}>{(error as Error)?.message}</p>
        <Link
          to={fromStudy ? '/study' : '/questions'}
          style={{
            padding: '12px 24px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          ← Back
        </Link>
      </div>
    );
  }

  const testResults = output?.test_results;
  const passedCount = testResults?.filter((t) => t.passed).length ?? 0;
  const totalTests = testResults?.length ?? 0;

  return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 120px)',
            minHeight: 400,
            margin: -32,
            background: 'var(--bg-base)',
            overflow: 'hidden',
          }}
        >
      {/* Top toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 20px',
          background: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        {(fromStudy || levelParam) && (
          <Link
            to={fromStudy ? '/study' : `/levels/${levelParam}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              background: 'var(--bg-active)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 500,
              transition: 'all var(--duration-fast) var(--ease-out)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-active)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <span style={{ fontSize: 16 }}>←</span>
            {fromStudy ? 'Study Plan' : `Level ${levelParam}`}
          </Link>
        )}
        <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />
        <button
          onClick={handleRun}
          disabled={runMutation.isPending}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: 'var(--bg-active)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontWeight: 600,
            cursor: runMutation.isPending ? 'wait' : 'pointer',
            transition: 'all var(--duration-fast) var(--ease-out)',
          }}
          title="Run code (Ctrl+Enter)"
          onMouseEnter={(e) => {
            if (!runMutation.isPending) {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-active)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        >
          {runMutation.isPending ? (
            <>
              <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Running...
            </>
          ) : (
            <>
              <span style={{ fontSize: 14 }}>▶</span>
              Run
            </>
          )}
        </button>
        <button
          onClick={handleSubmit}
          disabled={runMutation.isPending}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: 'var(--gradient-accent)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: runMutation.isPending ? 'wait' : 'pointer',
            boxShadow: '0 2px 8px rgba(88, 166, 255, 0.3)',
            transition: 'all var(--duration-fast) var(--ease-out)',
          }}
          title="Submit solution"
          onMouseEnter={(e) => {
            if (!runMutation.isPending) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(88, 166, 255, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(88, 166, 255, 0.3)';
          }}
        >
          {runMutation.isPending ? (
            <>
              <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Submitting...
            </>
          ) : (
            <>
              <span style={{ fontSize: 12 }}>✓</span>
              Submit
            </>
          )}
        </button>
        <button
          onClick={handleReset}
          style={{
            padding: '8px 14px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-muted)',
            fontSize: 12,
            cursor: 'pointer',
            transition: 'all var(--duration-fast) var(--ease-out)',
          }}
          title="Reset to starter code"
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.borderColor = 'var(--text-muted)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        >
          Reset
        </button>
        <button
          onClick={() => setLeftPanelWidth((w) => (w === 45 ? 55 : 45))}
          style={{
            padding: '8px 10px',
            background: 'var(--bg-active)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-muted)',
            fontSize: 12,
            cursor: 'pointer',
            transition: 'all var(--duration-fast) var(--ease-out)',
          }}
          title="Toggle problem panel width"
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          ⊞
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              fontWeight: 600,
              ...DIFFICULTY_COLORS[challenge.difficulty === 'easy' ? 'easy' : challenge.difficulty === 'hard' ? 'hard' : 'medium'],
            }}
          >
            {DIFFICULTY_COLORS[challenge.difficulty === 'easy' ? 'easy' : challenge.difficulty === 'hard' ? 'hard' : 'medium'].label}
          </span>
          <span
            style={{
              padding: '6px 12px',
              background: 'var(--bg-active)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'monospace',
            }}
          >
            {challenge.language}
          </span>
          <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
            Ctrl+Enter to run
          </span>
        </div>
      </div>

      {/* Main content: Problem | Editor, with collapsible Output at bottom */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left: Problem description */}
        <div
          style={{
            width: `${leftPanelWidth}%`,
            minWidth: 280,
            overflow: 'auto',
            padding: '24px 20px',
            borderRight: '1px solid var(--border)',
            background: 'var(--bg-base)',
          }}
        >
          <h2 style={{
            color: 'var(--text-primary)',
            margin: '0 0 8px',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.3,
          }}>
            {challenge.title}
          </h2>
          {challenge.animation_url && (
            <div style={{
              marginBottom: 24,
              padding: 16,
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 16 }}>🎬</span>
                <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}>Animated explanation</span>
              </div>
              <video
                controls
                style={{ width: '100%', maxWidth: 400, borderRadius: 'var(--radius-md)' }}
                src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${challenge.animation_url}`}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          )}
          <section style={{ marginBottom: 24 }}>
            <h3 style={{
              color: 'var(--text-primary)',
              margin: '0 0 12px',
              fontSize: 13,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              opacity: 0.9,
            }}>
              Description
            </h3>
            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: 14 }}>
              {(challenge.description || '').split('\n').map((line, i) => (
                <p key={i} style={{ margin: '0 0 10px' }}>
                  {line}
                </p>
              ))}
            </div>
          </section>
          <section style={{
            padding: 16,
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
          }}>
            <h3 style={{
              color: 'var(--accent)',
              margin: '0 0 12px',
              fontSize: 13,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Constraints
            </h3>
            <ul style={{ color: 'var(--text-secondary)', margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
              <li>Follow the function signature in starter code</li>
              <li>Return correct type as per problem</li>
              <li>Handle edge cases</li>
            </ul>
          </section>
          {challenge.test_cases && Array.isArray(challenge.test_cases) && challenge.test_cases.filter((t: { is_hidden?: boolean }) => !t?.is_hidden).length > 0 && (
            <section style={{ marginTop: 24 }}>
              <h3 style={{
                color: 'var(--text-primary)',
                margin: '0 0 14px',
                fontSize: 13,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                opacity: 0.9,
              }}>
                Example test cases
              </h3>
              {(challenge.test_cases || [])
                .filter((t: { is_hidden?: boolean }) => !t?.is_hidden)
                .slice(0, 5)
                .map((tc, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 16,
                      marginBottom: 12,
                      fontSize: 13,
                      background: 'var(--bg-card)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 6, fontWeight: 600 }}>Example {i + 1}</div>
                    <div style={{ color: 'var(--accent)', marginBottom: 8, fontFamily: 'monospace', fontSize: 12 }}>Input: {tc?.input ?? ''}</div>
                    <div style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>Output: {tc?.expected_output ?? ''}</div>
                  </div>
                ))}
            </section>
          )}
        </div>

        {/* Center: Code editor */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 320,
            overflow: 'hidden',
            background: '#1e1e1e',
          }}
        >
          <div
            style={{
              padding: '12px 20px',
              background: 'var(--bg-elevated)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                style={{
                  padding: '4px 10px',
                  background: 'var(--bg-active)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'monospace',
                }}
              >
                {challenge.language}
              </span>
              <span
                style={{
                  padding: '4px 8px',
                  background: 'var(--accent-muted)',
                  color: 'var(--accent)',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                Recommended
              </span>
            </div>
            <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
              {code.split('\n').length} lines
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Editor
              height="100%"
              language={challenge.language || 'python'}
              theme="vs-dark"
              value={code}
              onChange={(v) => setCode(v || '')}
              loading={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#1e1e1e', color: 'var(--text-muted)' }}>
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
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            maxHeight: outputPanelExpanded ? 320 : 44,
            transition: 'max-height 0.25s var(--ease-out)',
            overflow: 'hidden',
            boxShadow: outputPanelExpanded ? '0 -4px 24px rgba(0,0,0,0.2)' : 'none',
          }}
        >
          <div
            onClick={() => setOutputPanelExpanded((e) => !e)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 20px',
              cursor: 'pointer',
              background: 'var(--bg-elevated)',
              borderBottom: outputPanelExpanded ? '1px solid var(--border)' : 'none',
              transition: 'background var(--duration-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
          >
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveTab('output'); if (!outputPanelExpanded) setOutputPanelExpanded(true); }}
                style={{
                  padding: '8px 16px',
                  background: activeTab === 'output' ? 'var(--bg-base)' : 'transparent',
                  color: activeTab === 'output' ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  borderBottom: activeTab === 'output' ? '2px solid var(--accent)' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  transition: 'all var(--duration-fast)',
                }}
              >
                Output
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveTab('test-results'); if (!outputPanelExpanded) setOutputPanelExpanded(true); }}
                style={{
                  padding: '8px 16px',
                  background: activeTab === 'test-results' ? 'var(--bg-base)' : 'transparent',
                  color: activeTab === 'test-results' ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  borderBottom: activeTab === 'test-results' ? '2px solid var(--accent)' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  transition: 'all var(--duration-fast)',
                }}
              >
                Test Results {totalTests > 0 && (
                  <span style={{
                    marginLeft: 6,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: passedCount === totalTests ? 'var(--success-bg)' : 'var(--danger-bg)',
                    color: passedCount === totalTests ? 'var(--success)' : 'var(--danger)',
                    fontSize: 11,
                  }}>
                    {passedCount}/{totalTests}
                  </span>
                )}
              </button>
            </div>
            <span style={{
              padding: '4px 10px',
              background: 'var(--bg-active)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 500,
            }}>
              {outputPanelExpanded ? '▼ Minimize' : '▲ Expand output'}
            </span>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 20, background: 'var(--bg-base)', fontFamily: 'ui-monospace, monospace' }}>
            {activeTab === 'output' && (
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                {output ? (
                  <>
                    {output.stdout && (
                      <pre style={{
                        color: 'var(--text-secondary)',
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontFamily: 'ui-monospace, monospace',
                      }}>
                        {output.stdout}
                      </pre>
                    )}
                    {output.stderr && (
                      <pre style={{
                        color: 'var(--danger)',
                        margin: '16px 0 0',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontFamily: 'ui-monospace, monospace',
                        padding: 12,
                        background: 'var(--danger-bg)',
                        borderRadius: 'var(--radius-md)',
                      }}>
                        {output.stderr}
                      </pre>
                    )}
                    {!output.stdout && !output.stderr && (
                      <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>No output</span>
                    )}
                    {output.execution_time_ms != null && (
                      <div style={{
                        marginTop: 16,
                        padding: '8px 12px',
                        background: 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-muted)',
                        fontSize: 12,
                        display: 'inline-block',
                      }}>
                        ✓ Finished in {output.execution_time_ms}ms
                      </div>
                    )}
                  </>
                ) : (
                  <p style={{ color: 'var(--text-dim)', margin: 0, fontStyle: 'italic' }}>
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
                      style={{
                        marginBottom: 20,
                        padding: 16,
                        background: passedCount === totalTests ? 'var(--success-bg)' : 'var(--danger-bg)',
                        borderRadius: 'var(--radius-lg)',
                        border: `1px solid ${passedCount === totalTests ? 'var(--success)' : 'var(--danger)'}`,
                        color: passedCount === totalTests ? 'var(--success)' : 'var(--danger)',
                        fontSize: 15,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{passedCount === totalTests ? '✓' : '✗'}</span>
                      {passedCount === totalTests
                        ? `All ${totalTests} test cases passed!`
                        : `${passedCount} of ${totalTests} test cases passed`}
                    </div>
                    {testResults.map((tr, i) => (
                      <div
                        key={i}
                        style={{
                          padding: 16,
                          marginBottom: 12,
                          background: tr.passed ? 'var(--success-bg)' : 'var(--danger-bg)',
                          borderRadius: 'var(--radius-md)',
                          borderLeft: `4px solid ${tr.passed ? 'var(--success)' : 'var(--danger)'}`,
                          transition: 'opacity var(--duration-fast)',
                        }}
                      >
                        <div style={{
                          fontWeight: 700,
                          color: tr.passed ? 'var(--success)' : 'var(--danger)',
                          marginBottom: 10,
                          fontSize: 14,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}>
                          <span>{tr.passed ? '✓' : '✗'}</span>
                          Test case {i + 1} {tr.passed ? 'Passed' : 'Failed'}
                        </div>
                        {tr.input != null && (
                          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 6, fontFamily: 'monospace' }}>
                            Input: {tr.input}
                          </div>
                        )}
                        {!tr.passed && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Expected: <code style={{ background: 'var(--bg-active)', padding: '2px 6px', borderRadius: 4 }}>{tr.expected}</code></div>
                            <div style={{ color: 'var(--danger)', fontSize: 12 }}>Got: <code style={{ background: 'var(--danger-bg)', padding: '2px 6px', borderRadius: 4 }}>{tr.actual}</code></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                ) : (
                  <p style={{ color: 'var(--text-dim)', margin: 0, fontStyle: 'italic' }}>
                    Submit your code to run test cases.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
