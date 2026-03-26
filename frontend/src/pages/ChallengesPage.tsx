import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, type Challenge } from '../lib/api';

const DIFF_COLORS: Record<string, string> = {
  easy: '#3fb950',
  medium: '#d29922',
  hard: '#f85149',
};

export function ChallengesPage() {
  const { data: challenges, isLoading } = useQuery<Challenge[]>({
    queryKey: ['challenges'],
    queryFn: async () => {
      const { data } = await api.get('/challenges');
      return data;
    },
  });

  return (
    <div className="animate-fade-in">
      <h1 style={{
        color: 'var(--text-primary)',
        marginBottom: 8,
        fontSize: 28,
        fontWeight: 700,
        letterSpacing: '-0.02em',
      }}>
        Coding Challenges
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: 15 }}>
        Practice with personalized challenges based on your resume.
      </p>

      {isLoading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : challenges?.length === 0 ? (
        <div
          className="card"
          style={{
            padding: 48,
            textAlign: 'center',
            borderStyle: 'dashed',
            borderColor: 'var(--border)',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>{'{}'}</div>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 16 }}>
            No challenges yet. Upload your resume and click "Generate Questions & Challenges" to get personalized challenges.
          </p>
        </div>
      ) : (
        <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {challenges?.map((c) => (
            <Link
              key={c.id}
              to={`/challenges/${c.id}`}
              className="card card-interactive"
              style={{
                padding: 24,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 16,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{
                    margin: '0 0 10px',
                    color: 'var(--text-primary)',
                    fontSize: 18,
                    fontWeight: 600,
                  }}>
                    {c.title}
                  </h3>
                  <p style={{
                    color: 'var(--text-secondary)',
                    margin: 0,
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}>
                    {c.description.slice(0, 180)}...
                  </p>
                  <div style={{
                    marginTop: 14,
                    display: 'flex',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}>
                    {c.required_skills?.map((s) => (
                      <span
                        key={s}
                        className="badge badge-info"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <span
                  style={{
                    padding: '6px 12px',
                    background: `${DIFF_COLORS[c.difficulty || 'medium']}20`,
                    color: DIFF_COLORS[c.difficulty || 'medium'],
                    borderRadius: 'var(--radius-full)',
                    fontSize: 12,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {c.difficulty || 'medium'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
