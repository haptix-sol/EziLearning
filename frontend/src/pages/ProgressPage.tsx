import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, type Progress } from '../lib/api';

const STAT_CARDS = [
  {
    key: 'challenges',
    valueKey: 'challenges_completed' as const,
    label: 'Challenges Completed',
    link: '/challenges',
    icon: '{ }',
    color: '#58a6ff',
  },
  {
    key: 'questions',
    valueKey: 'questions_answered' as const,
    label: 'Questions Answered',
    link: '/questions',
    icon: '?',
    color: '#a371f7',
  },
  {
    key: 'minutes',
    valueKey: 'total_time_minutes' as const,
    label: 'Minutes Practiced',
    link: null,
    icon: '⏱',
    color: '#3fb950',
  },
];

export function ProgressPage() {
  const { data: progress, isLoading } = useQuery<Progress>({
    queryKey: ['progress'],
    queryFn: async () => {
      const { data } = await api.get('/progress');
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
        Progress
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: 15 }}>
        Your learning stats at a glance.
      </p>

      {isLoading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : (
        <div
          className="stagger-children"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 24,
          }}
        >
          {STAT_CARDS.map((stat) => (
            <div
              key={stat.key}
              className="card"
              style={{
                padding: 28,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 100,
                height: 100,
                background: `radial-gradient(circle, ${stat.color}15 0%, transparent 70%)`,
                pointerEvents: 'none',
              }} />
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: `${stat.color}20`,
                color: stat.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                marginBottom: 16,
                fontFamily: 'monospace',
              }}>
                {stat.icon}
              </div>
              <div style={{
                fontSize: 40,
                fontWeight: 800,
                color: stat.color,
                letterSpacing: '-0.02em',
              }}>
                {progress?.[stat.valueKey] ?? 0}
              </div>
              <div style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 15 }}>
                {stat.label}
              </div>
              {stat.link && (
                <Link
                  to={stat.link}
                  style={{
                    display: 'inline-block',
                    marginTop: 16,
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--accent)',
                  }}
                >
                  Practice more →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
