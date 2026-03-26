import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface LevelContent {
  level_number: number;
  challenges: { id: string; title: string; description: string; difficulty: string | null; completed: boolean }[];
  questions: { id: string; question_text: string; skill_name: string; difficulty: string | null; answered: boolean }[];
  all_complete: boolean;
  can_complete: boolean;
}

const DIFF_COLORS: Record<string, string> = {
  easy: '#3fb950',
  medium: '#d29922',
  hard: '#f85149',
};

export function LevelDetailPage() {
  const { levelNumber } = useParams<{ levelNumber: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const level = parseInt(levelNumber || '1', 10);

  const { data: content, isLoading } = useQuery<LevelContent>({
    queryKey: ['level-content', level],
    queryFn: async () => {
      const { data } = await api.get(`/levels/${level}/content`);
      return data;
    },
    enabled: level >= 1,
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/levels/${level}/complete`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['level-map'] });
      queryClient.invalidateQueries({ queryKey: ['level-content', level] });
      queryClient.invalidateQueries({ queryKey: ['level'] });
      navigate('/levels');
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      alert(err?.response?.data?.detail || 'Complete all tasks first.');
    },
  });

  if (isLoading || !content) {
    return (
      <div className="animate-fade-in" style={{ padding: 48, color: 'var(--text-secondary)' }}>
        Loading level {level}... Generating personalized content from your resume.
      </div>
    );
  }

  const { challenges, questions, all_complete } = content;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 840, margin: '0 auto' }}>
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 20 }}>
        <Link
          to="/levels"
          className="btn btn-ghost"
          style={{ textDecoration: 'none' }}
        >
          ← Map
        </Link>
        <h1 style={{ color: 'var(--text-primary)', margin: 0, fontSize: 26, fontWeight: 700 }}>
          Level {level}
        </h1>
      </div>

      <p style={{ color: 'var(--text-secondary)', marginBottom: 36, fontSize: 15 }}>
        Complete the coding challenge and answer the questions to unlock the next level.
      </p>

      {challenges.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: 20, fontSize: 20, fontWeight: 600 }}>
            💻 Coding Challenge
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {challenges.map((c) => (
              <div
                key={c.id}
                className="card"
                style={{
                  padding: 24,
                  background: c.completed ? 'var(--success-bg)' : 'var(--bg-card)',
                  border: `1px solid ${c.completed ? 'var(--success)' : 'var(--border)'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div>
                    <h3 style={{ color: 'var(--text-primary)', margin: '0 0 8px', fontSize: 17, fontWeight: 600 }}>
                      {c.title}
                      {c.completed && <span style={{ marginLeft: 10, color: 'var(--success)' }}>✓</span>}
                    </h3>
                    <span
                      style={{
                        padding: '4px 10px',
                        background: `${DIFF_COLORS[c.difficulty || 'medium']}20`,
                        color: DIFF_COLORS[c.difficulty || 'medium'],
                        borderRadius: 'var(--radius-full)',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {c.difficulty || 'medium'}
                    </span>
                  </div>
                  {!c.completed && (
                    <Link
                      to={`/challenges/${c.id}?level=${level}`}
                      className="btn btn-primary"
                      style={{ textDecoration: 'none' }}
                    >
                      Solve
                    </Link>
                  )}
                </div>
                <p style={{ color: 'var(--text-secondary)', marginTop: 14, fontSize: 14, lineHeight: 1.5 }}>
                  {c.description.slice(0, 220)}...
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {questions.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: 20, fontSize: 20, fontWeight: 600 }}>
            ❓ Questions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {questions.map((q) => (
              <div
                key={q.id}
                className="card"
                style={{
                  padding: 24,
                  background: q.answered ? 'var(--success-bg)' : 'var(--bg-card)',
                  border: `1px solid ${q.answered ? 'var(--success)' : 'var(--border)'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div>
                    <p style={{ color: 'var(--text-primary)', margin: '0 0 8px', fontSize: 15 }}>
                      {q.question_text}
                    </p>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{q.skill_name}</span>
                  </div>
                  {!q.answered && (
                    <Link
                      to={`/questions?q=${q.id}&level=${level}`}
                      className="btn btn-accent"
                      style={{ textDecoration: 'none' }}
                    >
                      Answer
                    </Link>
                  )}
                  {q.answered && (
                    <span className="badge badge-success">✓ Answered</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 28, marginTop: 32 }}>
        {all_complete ? (
          <button
            onClick={() => completeMutation.mutate()}
            disabled={completeMutation.isPending}
            className="btn btn-primary"
            style={{
              padding: '16px 36px',
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            {completeMutation.isPending ? 'Completing...' : '🎉 Complete Level & Unlock Next'}
          </button>
        ) : (
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 15 }}>
            Complete all challenges and answer all questions to unlock the next level.
          </p>
        )}
      </div>
    </div>
  );
}
