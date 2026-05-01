import { useRef, useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, MessageSquareText, Mic, Sparkles } from 'lucide-react';
import { api, type Question, type QuestionAnswerResult } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';

/** Minimal typing; Web Speech API typings vary by TS lib version. */
type WebSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((ev: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

type WebSpeechRecognitionCtor = new () => WebSpeechRecognition;

type TabType = 'trending' | 'quiz' | 'solved';

function VerdictPanel({ result }: { result: QuestionAnswerResult }) {
  const v = result.verdict;
  const title =
    v === 'correct' ? 'Strong answer' : v === 'partial' ? 'Partially right' : 'Not quite there yet';
  const subtitle =
    v === 'correct'
      ? 'You demonstrated the core ideas.'
      : v === 'partial'
        ? 'What to tighten and how to deliver it better in an interview.'
        : 'How to improve your delivery next time.';
  const border =
    v === 'correct' ? 'var(--success)' : v === 'partial' ? 'var(--warning)' : 'var(--danger)';
  return (
    <div
      className="card animate-slide-up"
      style={{
        marginTop: 16,
        padding: 18,
        background: 'var(--bg-base)',
        border: `1px solid var(--border)`,
        borderLeft: `4px solid ${border}`,
      }}
      role="status"
      aria-live="polite"
    >
      <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, letterSpacing: '0.02em' }}>
        {subtitle}
      </div>
      <span
        className={`badge ${v === 'correct' ? 'badge-success' : v === 'partial' ? 'badge-warning' : 'badge-danger'}`}
        style={{ marginBottom: 12 }}
      >
        {v === 'correct' ? 'Correct' : v === 'partial' ? 'Partial credit' : 'Needs improvement'}
      </span>
      <p style={{ color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>
        {result.feedback}
      </p>
    </div>
  );
}

type AnswerPanelProps = {
  answerText: string;
  onAnswerChange: (text: string) => void;
  listening: boolean;
  onSpeakAppend: () => void;
  onSpeakAndCheck: () => void;
  onCheck: () => void;
  canSubmit: boolean;
  submitting: boolean;
  feedback: QuestionAnswerResult | undefined;
};

function AnswerPanel({
  answerText,
  onAnswerChange,
  listening,
  onSpeakAppend,
  onSpeakAndCheck,
  onCheck,
  canSubmit,
  submitting,
  feedback,
}: AnswerPanelProps) {
  return (
    <div style={{ marginTop: 4 }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
        Answer in your own words: type below, use <strong>Voice answer</strong> to dictate (you can edit the text after),
        or <strong>Speak &amp; check</strong> to transcribe and grade in one step. We never show a copy-paste model
        answer—only whether you are correct, partially right, or off track, plus coaching.
      </p>
      <textarea
        placeholder="Type your answer here…"
        value={answerText}
        onChange={(e) => onAnswerChange(e.target.value)}
        className="input"
        style={{ minHeight: 100, resize: 'vertical' }}
        aria-label="Your answer"
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12, alignItems: 'center' }}>
        <button
          type="button"
          onClick={onSpeakAppend}
          disabled={listening}
          className="btn btn-ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <Mic size={18} aria-hidden />
          {listening ? 'Listening…' : 'Voice answer'}
        </button>
        <button
          type="button"
          onClick={onSpeakAndCheck}
          disabled={listening || submitting}
          className="btn btn-ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          title="Transcribe speech and submit for grading immediately"
        >
          <Sparkles size={18} aria-hidden />
          Speak &amp; check
        </button>
        <button type="button" onClick={onCheck} disabled={!canSubmit || submitting} className="btn btn-primary">
          {submitting ? 'Checking…' : 'Check answer'}
        </button>
      </div>
      {feedback ? <VerdictPanel result={feedback} /> : null}
    </div>
  );
}

export function QuestionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const levelParam = searchParams.get('level');
  const qParam = searchParams.get('q');
  const [activeTab, setActiveTab] = useState<TabType>('quiz');
  const [expandedId, setExpandedId] = useState<string | null>(qParam || null);
  const [answer, setAnswer] = useState<Record<string, string>>({});
  const [feedbackById, setFeedbackById] = useState<Record<string, QuestionAnswerResult>>({});
  const [listeningId, setListeningId] = useState<string | null>(null);
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const queryClient = useQueryClient();

  const { data: linkedQuestion, isLoading: linkedLoading } = useQuery<Question>({
    queryKey: ['question-one', qParam],
    queryFn: async () => {
      const { data } = await api.get(`/questions/one/${qParam}`);
      return data;
    },
    enabled: !!qParam,
  });

  useEffect(() => {
    if (qParam) {
      setExpandedId(qParam);
      setActiveTab('quiz');
    }
  }, [qParam]);

  const { data: trendingChallenges } = useQuery({
    queryKey: ['questions-trending'],
    queryFn: async () => {
      const { data } = await api.get('/questions/trending');
      return data;
    },
  });

  const { data: quizQuestions } = useQuery<Question[]>({
    queryKey: ['questions-quiz'],
    queryFn: async () => {
      const { data } = await api.get('/questions/quiz?count=8');
      return data;
    },
    enabled: activeTab === 'quiz',
  });

  const { data: solvedChallenges } = useQuery({
    queryKey: ['questions-solved'],
    queryFn: async () => {
      const { data } = await api.get('/questions/solved');
      return data;
    },
    enabled: activeTab === 'solved',
  });

  const submitMutation = useMutation({
    mutationFn: async ({ qId, text }: { qId: string; text: string }) => {
      const { data } = await api.post<QuestionAnswerResult>(`/questions/${qId}/answer`, { user_answer: text });
      return { qId, data };
    },
    onSuccess: ({ qId, data }) => {
      setFeedbackById((f) => ({ ...f, [qId]: data }));
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['level-content'] });
      queryClient.invalidateQueries({ queryKey: ['level-map'] });
    },
  });

  const handleSubmit = useCallback(
    (qId: string, textOverride?: string) => {
      const text = (textOverride ?? answer[qId] ?? '').trim();
      if (text) submitMutation.mutate({ qId, text });
    },
    [answer, submitMutation],
  );

  const getRecognition = useCallback((): WebSpeechRecognitionCtor | null => {
    const win = window as unknown as {
      SpeechRecognition?: WebSpeechRecognitionCtor;
      webkitSpeechRecognition?: WebSpeechRecognitionCtor;
    };
    return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
  }, []);

  const startVoiceInput = (qId: string, mode: 'append' | 'check') => {
    const Ctor = getRecognition();
    if (!Ctor) {
      window.alert('Voice input is not supported in this browser. Try Chrome or Edge, or type your answer.');
      return;
    }
    recognitionRef.current?.abort?.();
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onresult = (ev) => {
      const said = ev.results[0]?.[0]?.transcript?.trim();
      if (said) {
        if (mode === 'append') {
          setAnswer((a) => {
            const prev = (a[qId] ?? '').trim();
            const next = prev ? `${prev} ${said}` : said;
            return { ...a, [qId]: next };
          });
        } else {
          setAnswer((a) => ({ ...a, [qId]: said }));
          submitMutation.mutate({ qId, text: said });
        }
      } else if (mode === 'check') {
        window.alert('No speech detected. Try again or type your answer.');
      }
      setListeningId(null);
    };
    rec.onerror = () => {
      setListeningId(null);
    };
    rec.onend = () => {
      setListeningId(null);
    };
    recognitionRef.current = rec;
    setListeningId(qId);
    rec.start();
  };

  const clearLinkedQuestion = () => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete('q');
        return p;
      },
      { replace: true },
    );
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'trending', label: 'Trending Coding' },
    { id: 'quiz', label: 'Quick Quizzes' },
    { id: 'solved', label: 'Solved' },
  ];

  const quizList = quizQuestions?.filter((q) => !qParam || q.id !== qParam) ?? [];

  return (
    <div className="animate-fade-in ez-page-zone">
      <PageHeader
        title="Interview questions"
        description="Answer in text or by voice. Check answer to get a verdict—correct, partially right, or needs improvement—with coaching on gaps and how to deliver better (no pasted model answers)."
        actions={
          levelParam ? (
            <Link to={`/levels/${levelParam}`} className="btn btn-ghost btn-sm">
              ← Level {levelParam}
            </Link>
          ) : null
        }
      />

      {qParam && (
        <div className="card animate-slide-up" style={{ padding: 22, marginBottom: 24, borderColor: 'var(--brand)', borderWidth: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
              <MessageSquareText size={18} aria-hidden />
              From your level
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearLinkedQuestion}>
              Dismiss
            </button>
          </div>
          {linkedLoading || !linkedQuestion ? (
            <p style={{ color: 'var(--text-secondary)', marginTop: 12 }}>Loading question…</p>
          ) : (
            <>
              <h2 style={{ color: 'var(--text-primary)', margin: '12px 0 8px', fontSize: 17, fontWeight: 600, lineHeight: 1.45 }}>
                {linkedQuestion.question_text}
              </h2>
              <span className="badge badge-info" style={{ fontSize: 12 }}>
                {linkedQuestion.skill_name}
              </span>
              <AnswerPanel
                answerText={answer[linkedQuestion.id] ?? ''}
                onAnswerChange={(t) => setAnswer((a) => ({ ...a, [linkedQuestion.id]: t }))}
                listening={listeningId === linkedQuestion.id}
                onSpeakAppend={() => startVoiceInput(linkedQuestion.id, 'append')}
                onSpeakAndCheck={() => startVoiceInput(linkedQuestion.id, 'check')}
                onCheck={() => handleSubmit(linkedQuestion.id)}
                canSubmit={!!(answer[linkedQuestion.id] ?? '').trim()}
                submitting={submitMutation.isPending && submitMutation.variables?.qId === linkedQuestion.id}
                feedback={feedbackById[linkedQuestion.id]}
              />
            </>
          )}
        </div>
      )}

      <div className="ez-tabs" role="tablist" aria-label="Question modes">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`ez-tab${activeTab === tab.id ? ' ez-tab--active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'trending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {trendingChallenges?.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center', borderStyle: 'dashed' }}>
              <p style={{ color: 'var(--text-secondary)' }}>No trending challenges yet.</p>
              <Link to="/challenges" className="btn btn-primary" style={{ marginTop: 16, textDecoration: 'none' }}>
                Browse Challenges
              </Link>
            </div>
          ) : (
            trendingChallenges?.map((c: { id: string; title: string; description?: string; difficulty: string; language: string }) => (
              <Link
                key={c.id}
                to={`/challenges/${c.id}`}
                className="card card-interactive"
                style={{
                  padding: 20,
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'block',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div>
                    <h3 style={{ color: 'var(--text-primary)', margin: '0 0 8px', fontSize: 17, fontWeight: 600 }}>{c.title}</h3>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 14, lineHeight: 1.5 }}>{c.description ?? ''}</p>
                  </div>
                  <span
                    className={`badge ${c.difficulty === 'easy' ? 'badge-success' : c.difficulty === 'hard' ? 'badge-danger' : 'badge-warning'}`}
                    style={{ flexShrink: 0 }}
                  >
                    {c.difficulty || 'medium'}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {activeTab === 'quiz' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {quizQuestions?.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center', borderStyle: 'dashed' }}>
              <p style={{ color: 'var(--text-secondary)' }}>No questions for quiz yet.</p>
            </div>
          ) : (
            quizList.map((q, i) => (
              <div key={q.id} className="card animate-slide-up" style={{ padding: 24, animationDelay: `${i * 40}ms` }}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                  style={{
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                    color: 'inherit',
                  }}
                  aria-expanded={expandedId === q.id}
                >
                  <h3 style={{ color: 'var(--text-primary)', margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>{q.question_text}</h3>
                  <span className="badge badge-info" style={{ fontSize: 12 }}>
                    {q.skill_name}
                  </span>
                  <span style={{ display: 'block', marginTop: 8, fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                    {expandedId === q.id ? '▼ Hide answer area' : '▶ Answer'}
                  </span>
                </button>
                {expandedId === q.id && (
                  <AnswerPanel
                    answerText={answer[q.id] ?? ''}
                    onAnswerChange={(t) => setAnswer((a) => ({ ...a, [q.id]: t }))}
                    listening={listeningId === q.id}
                    onSpeakAppend={() => startVoiceInput(q.id, 'append')}
                    onSpeakAndCheck={() => startVoiceInput(q.id, 'check')}
                    onCheck={() => handleSubmit(q.id)}
                    canSubmit={!!(answer[q.id] ?? '').trim()}
                    submitting={submitMutation.isPending && submitMutation.variables?.qId === q.id}
                    feedback={feedbackById[q.id]}
                  />
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'solved' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {solvedChallenges?.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center', borderStyle: 'dashed' }}>
              <p style={{ color: 'var(--text-secondary)' }}>No solved challenges yet. Complete some from the Trending tab!</p>
              <Link to="/challenges" className="btn btn-primary" style={{ marginTop: 16, textDecoration: 'none' }}>
                Browse Challenges
              </Link>
            </div>
          ) : (
            solvedChallenges?.map((c: { id: string; title: string; difficulty: string; solved_at: string }) => (
              <Link
                key={c.id}
                to={`/challenges/${c.id}`}
                className="card card-interactive"
                style={{
                  padding: 20,
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: 17, fontWeight: 600 }}>{c.title}</h3>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Solved {c.solved_at ? new Date(c.solved_at).toLocaleDateString() : ''}</span>
                </div>
                <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Check size={12} strokeWidth={2.5} aria-hidden /> Solved
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
