import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, type Progress, type LevelProgress } from '../lib/api';

/** Home page: each destination appears once in “Explore”; hero & stats serve different jobs (no duplicate feature grids). */
const EXPLORE_GROUPS: {
  title: string;
  blurb: string;
  tiles: { to: string; label: string; desc: string; span: 'lg' | 'md'; accent: string }[];
}[] = [
  {
    title: 'Plan your path',
    blurb: 'Sequences and maps—nothing here repeats in Practice or Career blocks.',
    tiles: [
      {
        to: '/roadmap',
        label: 'AI roadmap',
        desc: 'Topic order and milestones tailored to your target role.',
        span: 'lg',
        accent: '#0d7a4f',
      },
      {
        to: '/study',
        label: 'Study plan',
        desc: 'Daily tasks and pacing so prep stays consistent.',
        span: 'lg',
        accent: '#1565c0',
      },
    ],
  },
  {
    title: 'Practice & recall',
    blurb: 'Active learning: code, Q&A, and your own notes.',
    tiles: [
      {
        to: '/questions',
        label: 'Interview questions',
        desc: 'Skill-tagged Q&A with difficulty cues.',
        span: 'md',
        accent: '#6a1b9a',
      },
      {
        to: '/challenges',
        label: 'Coding challenges',
        desc: 'Hands-on problems aligned with your profile.',
        span: 'md',
        accent: '#c27a00',
      },
      {
        to: '/notes',
        label: 'Notes',
        desc: 'Consolidate concepts while videos generate in the background.',
        span: 'md',
        accent: '#00838f',
      },
    ],
  },
  {
    title: 'Career surface',
    blurb: 'Artifacts employers see and roles you pursue.',
    tiles: [
      {
        to: '/resume',
        label: 'Resume',
        desc: 'Upload, parse, and keep your story accurate.',
        span: 'md',
        accent: '#37474f',
      },
      {
        to: '/jobs',
        label: 'Applications',
        desc: 'Track where you applied and what’s next.',
        span: 'md',
        accent: '#0d7a4f',
      },
      {
        to: '/profile',
        label: 'Profile',
        desc: 'Resume-derived profile you can refine anytime.',
        span: 'md',
        accent: '#1565c0',
      },
    ],
  },
  {
    title: 'Media & motivation',
    blurb: 'Watch and commit—separate from the practice block above.',
    tiles: [
      {
        to: '/videos',
        label: 'Video tutorials',
        desc: 'Explainer playback for topics you care about.',
        span: 'lg',
        accent: '#c62828',
      },
      {
        to: '/goals',
        label: 'My goals',
        desc: 'Targets, durations, and trending roles in one place.',
        span: 'lg',
        accent: '#6a1b9a',
      },
    ],
  },
];

export function DashboardPage() {
  const { data: progress, isLoading } = useQuery<Progress>({
    queryKey: ['progress'],
    queryFn: async () => {
      const { data } = await api.get('/progress');
      return data;
    },
  });

  const { data: level } = useQuery<LevelProgress>({
    queryKey: ['level'],
    queryFn: async () => {
      const { data } = await api.get('/study/level');
      return data;
    },
  });

  return (
    <div className="animate-fade-in">
      <section className="ez-hero animate-slide-up" aria-labelledby="home-hero-title">
        <div className="ez-hero__grid">
          <div>
            <h1 id="home-hero-title">What do you want to master today?</h1>
            <p>
              Pick up your study plan, unlock the next level, or dive into practice—your portal stays
              organized so each area has a clear job.
            </p>
            <div className="ez-hero__cta">
              <Link to="/study" className="btn btn-primary">
                Continue studying
              </Link>
              <Link to="/levels" className="btn btn-ghost">
                Level map
              </Link>
            </div>
          </div>
          <div className="ez-hero__visual" aria-hidden>
            📚
          </div>
        </div>
      </section>

      {level && (
        <section
          className="card animate-slide-up"
          style={{
            marginBottom: 40,
            padding: 24,
            background: 'linear-gradient(135deg, #ffffff 0%, #f0faf5 100%)',
            border: '1px solid var(--border)',
          }}
          aria-labelledby="momentum-title"
        >
          <h2
            id="momentum-title"
            className="ez-section-title"
            style={{ marginBottom: 16, color: 'var(--text-primary)', fontSize: 18, letterSpacing: '-0.02em', textTransform: 'none' }}
          >
            Your momentum
          </h2>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: 'var(--gradient-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 26,
                  fontWeight: 800,
                  color: '#fff',
                  boxShadow: 'var(--shadow-glow)',
                  animation: 'pulse-glow 3s ease-in-out infinite',
                }}
              >
                {level.level}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Level {level.level}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>
                  {level.xp} / {level.xp_to_next_level} XP to the next level
                </p>
                <div
                  style={{
                    width: 'min(240px, 100%)',
                    maxWidth: '100%',
                    height: 8,
                    background: 'var(--bg-active)',
                    borderRadius: 'var(--radius-full)',
                    marginTop: 12,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${level.progress_percent}%`,
                      height: '100%',
                      background: 'var(--gradient-accent)',
                      borderRadius: 'var(--radius-full)',
                      transition: 'width 0.6s var(--ease-spring)',
                    }}
                  />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className="badge badge-warning" style={{ fontSize: 13, padding: '8px 14px' }}>
                🔥 {level.streak_days}-day streak
              </span>
              <Link to="/progress" className="btn btn-ghost" style={{ fontSize: 13 }}>
                Full stats
              </Link>
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="explore-title">
        <h2 id="explore-title" className="ez-section-title">
          Explore by focus
        </h2>
        <p style={{ margin: '-8px 0 24px', color: 'var(--text-secondary)', fontSize: 15, maxWidth: 640 }}>
          Each block below lists different destinations. Nothing is duplicated across blocks—navigation
          lives in the bar above; this is your map of what each area is for.
        </p>

        {EXPLORE_GROUPS.map((group) => (
          <div key={group.title} style={{ marginBottom: 36 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              {group.title}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>{group.blurb}</p>
            <div className="ez-bento stagger-children" style={{ marginBottom: 0 }}>
              {group.tiles.map((tile) => (
                <Link
                  key={tile.to}
                  to={tile.to}
                  className={`card card-interactive ez-tile ez-bento__tile--${tile.span}`}
                  style={{
                    borderTop: `3px solid ${tile.accent}`,
                  }}
                >
                  <div className="ez-tile__label">{tile.label}</div>
                  <p className="ez-tile__desc">{tile.desc}</p>
                  <span className="ez-tile__meta">Open →</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      {!isLoading && progress && (
        <section style={{ marginTop: 8 }} aria-labelledby="snapshot-title">
          <h2 id="snapshot-title" className="ez-section-title">
            Numbers snapshot
          </h2>
          <p style={{ margin: '-8px 0 20px', fontSize: 14, color: 'var(--text-muted)', maxWidth: 560 }}>
            Read-only totals—links to practice live under Explore, not repeated here.
          </p>
          <div className="ez-stat-board">
            <div className="ez-stat-board__item">
              <div className="ez-stat-board__value" style={{ color: '#1565c0' }}>
                {progress.challenges_completed}
              </div>
              <div className="ez-stat-board__label">Challenges completed</div>
            </div>
            <div className="ez-stat-board__item">
              <div className="ez-stat-board__value" style={{ color: '#6a1b9a' }}>
                {progress.questions_answered}
              </div>
              <div className="ez-stat-board__label">Questions answered</div>
            </div>
            <div className="ez-stat-board__item">
              <div className="ez-stat-board__value" style={{ color: '#0d7a4f' }}>
                {progress.total_time_minutes}
              </div>
              <div className="ez-stat-board__label">Minutes practiced</div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
