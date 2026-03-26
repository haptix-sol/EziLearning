import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, type LevelProgress } from '../lib/api';

interface LevelMapItem {
  level_number: number;
  completed: boolean;
  unlocked: boolean;
  stars: number | null;
  is_current: boolean;
}

interface LevelMapResponse {
  levels: LevelMapItem[];
  current_level: number;
  total_levels: number;
  completed_count: number;
}

export function LevelMapPage() {
  const { data: levelProgress } = useQuery<LevelProgress>({
    queryKey: ['level'],
    queryFn: async () => {
      const { data } = await api.get('/study/level');
      return data;
    },
  });

  const { data: mapData, isLoading } = useQuery<LevelMapResponse>({
    queryKey: ['level-map'],
    queryFn: async () => {
      const { data } = await api.get('/levels/map');
      return data;
    },
  });

  if (isLoading || !mapData) {
    return (
      <div className="animate-fade-in" style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading your journey...
      </div>
    );
  }

  const { levels, current_level, completed_count, total_levels } = mapData;

  return (
    <div
      className="animate-fade-in"
      style={{
        minHeight: '100%',
        background: 'var(--gradient-hero)',
        margin: -32,
        padding: 32,
      }}
    >
      {/* Header bar */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 28px',
          marginBottom: 32,
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'var(--gradient-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 800,
              color: '#fff',
              boxShadow: '0 4px 16px rgba(88, 166, 255, 0.4)',
            }}
          >
            {levelProgress?.level ?? 1}
          </div>
          <div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 20 }}>
              Level {current_level}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
              {completed_count} / {total_levels} completed
            </div>
            <div
              style={{
                width: 140,
                height: 6,
                background: 'var(--bg-active)',
                borderRadius: 'var(--radius-full)',
                marginTop: 10,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(completed_count / total_levels) * 100}%`,
                  height: '100%',
                  background: 'var(--gradient-accent)',
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 0.5s var(--ease-spring)',
                }}
              />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <span style={{
            padding: '10px 16px',
            background: 'rgba(240, 136, 62, 0.15)',
            borderRadius: 'var(--radius-md)',
            color: '#f0883e',
            fontSize: 14,
            fontWeight: 600,
          }}>
            🔥 {levelProgress?.streak_days ?? 0} streak
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            ⭐ {levelProgress?.xp ?? 0} XP
          </span>
        </div>
      </div>

      <h1 style={{
        color: 'var(--text-primary)',
        marginBottom: 8,
        paddingLeft: 0,
        fontSize: 28,
        fontWeight: 700,
        letterSpacing: '-0.02em',
      }}>
        Your Interview Journey
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 36, fontSize: 15 }}>
        Complete each level to unlock the next. Content is personalized from your resume.
      </p>

      {/* Level map grid */}
      <div style={{ padding: '0 0 100px', maxWidth: 720, margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '24px 28px',
          }}
        >
          {levels.map((level, i) => {
            const isCurrent = level.is_current;
            return (
              <div
                key={level.level_number}
                className="animate-slide-up"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  animationDelay: `${i * 30}ms`,
                }}
              >
                {level.unlocked ? (
                  <Link
                    to={`/levels/${level.level_number}`}
                    style={{
                      textDecoration: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: '50%',
                        background: level.completed
                          ? 'var(--gradient-success)'
                          : isCurrent
                            ? 'var(--gradient-accent)'
                            : 'var(--bg-active)',
                        border: `3px solid ${level.completed ? 'var(--success)' : isCurrent ? 'var(--accent)' : 'var(--border)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                        fontWeight: 800,
                        color: '#fff',
                        boxShadow: isCurrent ? '0 0 24px rgba(88, 166, 255, 0.4)' : 'none',
                        transition: 'all var(--duration-normal) var(--ease-out)',
                      }}
                      onMouseEnter={(e) => {
                        if (level.unlocked) {
                          e.currentTarget.style.transform = 'scale(1.08)';
                          e.currentTarget.style.boxShadow = '0 0 28px rgba(88, 166, 255, 0.5)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = isCurrent ? '0 0 24px rgba(88, 166, 255, 0.4)' : 'none';
                      }}
                    >
                      {level.level_number}
                    </div>
                    {level.completed && level.stars && (
                      <div style={{ display: 'flex', gap: 2, marginTop: 8 }}>
                        {[1, 2, 3].map((s) => (
                          <span key={s} style={{ color: '#f0c14b', fontSize: 14 }}>★</span>
                        ))}
                      </div>
                    )}
                    {isCurrent && !level.completed && (
                      <span style={{ color: 'var(--accent)', fontSize: 12, marginTop: 6, fontWeight: 600 }}>
                        Current
                      </span>
                    )}
                  </Link>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: '50%',
                        background: 'var(--bg-card)',
                        border: '2px dashed var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        fontWeight: 700,
                        color: 'var(--text-dim)',
                        opacity: 0.7,
                      }}
                    >
                      🔒
                    </div>
                    <span style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 6 }}>Locked</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom nav */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: 16,
          background: 'var(--bg-elevated)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <Link
          to="/"
          className="btn btn-ghost"
          style={{ textDecoration: 'none' }}
        >
          Dashboard
        </Link>
        <Link
          to="/profile"
          className="btn btn-ghost"
          style={{ textDecoration: 'none' }}
        >
          Profile
        </Link>
      </div>
    </div>
  );
}
