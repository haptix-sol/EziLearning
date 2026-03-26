import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Question } from '../lib/api';

type TabType = 'trending' | 'quiz' | 'solved';

export function QuestionsPage() {
  const [searchParams] = useSearchParams();
  const levelParam = searchParams.get('level');
  const [activeTab, setActiveTab] = useState<TabType>('trending');
  const [expandedId, setExpandedId] = useState<string | null>(searchParams.get('q') || null);
  const [answer, setAnswer] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

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
      await api.post(`/questions/${qId}/answer`, { user_answer: text });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      if (levelParam) {
        queryClient.invalidateQueries({ queryKey: ['level-content', parseInt(levelParam, 10)] });
        queryClient.invalidateQueries({ queryKey: ['level-map'] });
      }
    },
  });

  const handleSubmit = (qId: string) => {
    const text = answer[qId];
    if (text) submitMutation.mutate({ qId, text });
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'trending', label: 'Trending Coding' },
    { id: 'quiz', label: 'Quick Quizzes' },
    { id: 'solved', label: 'Solved' },
  ];

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
        {levelParam && (
          <Link
            to={`/levels/${levelParam}`}
            className="btn btn-ghost"
            style={{ textDecoration: 'none' }}
          >
            ← Level {levelParam}
          </Link>
        )}
        <div>
          <h1 style={{
            color: 'var(--text-primary)',
            margin: '0 0 4px',
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}>
            Questions
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 15 }}>
            Trending coding, quick quizzes, and your solved problems
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px',
              background: activeTab === tab.id ? 'var(--accent-muted)' : 'transparent',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Trending tab */}
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
                className="card"
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
                  <span className={`badge ${c.difficulty === 'easy' ? 'badge-success' : c.difficulty === 'hard' ? 'badge-danger' : 'badge-warning'}`} style={{ flexShrink: 0 }}>
                    {c.difficulty || 'medium'}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Quiz tab */}
      {activeTab === 'quiz' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {quizQuestions?.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center', borderStyle: 'dashed' }}>
              <p style={{ color: 'var(--text-secondary)' }}>No questions for quiz yet.</p>
            </div>
          ) : (
            quizQuestions?.map((q, i) => (
              <div key={q.id} className="card animate-slide-up" style={{ padding: 24, animationDelay: `${i * 40}ms` }}>
                <div onClick={() => setExpandedId(expandedId === q.id ? null : q.id)} style={{ cursor: 'pointer' }}>
                  <h3 style={{ color: 'var(--text-primary)', margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>{q.question_text}</h3>
                  <span className="badge badge-info" style={{ fontSize: 12 }}>{q.skill_name}</span>
                </div>
                {expandedId === q.id && (
                  <div style={{ marginTop: 20 }}>
                    <textarea
                      placeholder="Your answer..."
                      value={answer[q.id] ?? ''}
                      onChange={(e) => setAnswer((a) => ({ ...a, [q.id]: e.target.value }))}
                      className="input"
                      style={{ minHeight: 80, resize: 'vertical' }}
                    />
                    <button
                      onClick={() => handleSubmit(q.id)}
                      disabled={!answer[q.id] || submitMutation.isPending}
                      className="btn btn-primary"
                      style={{ marginTop: 12 }}
                    >
                      Save Answer
                    </button>
                    {q.answer_text && (
                      <div className="card" style={{ marginTop: 16, padding: 16, background: 'var(--bg-base)' }}>
                        <h4 style={{ color: 'var(--accent)', margin: '0 0 8px', fontSize: 14 }}>Model Answer</h4>
                        <p style={{ color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', fontSize: 14 }}>{q.answer_text}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Solved tab */}
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
                className="card"
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
                <span className="badge badge-success">✓ Solved</span>
              </Link>
            ))
          )}
        </div>
      )}

    </div>
  );
}
