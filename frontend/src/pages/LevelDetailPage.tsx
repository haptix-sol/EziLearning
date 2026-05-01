import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Check, HelpCircle, Laptop, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { SkeletonLine, SkeletonLineLg } from '../components/ui/Skeleton';

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
      navigate('/growth?focus=levels');
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      alert(err?.response?.data?.detail || 'Complete all tasks first.');
    },
  });

  if (isLoading || !content) {
    return (
      <div className="animate-fade-in ez-page-zone" style={{ maxWidth: 840, margin: '0 auto' }} aria-busy="true">
        <PageHeader
          title={`Level ${level}`}
          description="Loading personalized challenges and questions from your profile…"
        />
        <SkeletonLineLg />
        <SkeletonLine />
        <SkeletonLine />
      </div>
    );
  }

  const { challenges, questions, all_complete } = content;

  return (
    <div className="animate-fade-in ez-page-zone" style={{ maxWidth: 840, margin: '0 auto' }}>
      <PageHeader
        title={`Level ${level}`}
        description="Finish the coding task and interview questions here, then mark the level complete to advance on the map."
        actions={
          <Link to="/growth?focus=levels" className="btn btn-ghost btn-sm">
            ← Growth hub
          </Link>
        }
      />

      {challenges.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: 20, fontSize: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Laptop size={22} strokeWidth={1.75} aria-hidden />
            Coding challenge
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
                      {c.completed && (
                        <span style={{ marginLeft: 10, color: 'var(--success)', display: 'inline-flex', verticalAlign: 'middle' }}>
                          <Check size={18} strokeWidth={2.5} aria-label="Completed" />
                        </span>
                      )}
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
          <h2 style={{ color: 'var(--text-primary)', marginBottom: 20, fontSize: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
            <HelpCircle size={22} strokeWidth={1.75} aria-hidden />
            Questions
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
                    <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Check size={12} strokeWidth={2.5} aria-hidden /> Answered
                    </span>
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
            {completeMutation.isPending ? (
              'Completing...'
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} strokeWidth={1.75} aria-hidden />
                Complete level & unlock next
              </span>
            )}
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
