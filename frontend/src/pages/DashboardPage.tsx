import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, Flame, Sparkles, Target } from 'lucide-react';
import { api, type Progress, type LevelProgress } from '../lib/api';

const EXPLORE_GROUPS: {
  title: string;
  blurb: string;
  tiles: { to: string; label: string; desc: string; span: 'lg' | 'md' }[];
}[] = [
  {
    title: 'Plan your path',
    blurb: 'Role-aware roadmap and a day-by-day study plan—no duplicate shortcuts elsewhere.',
    tiles: [
      {
        to: '/roadmap',
        label: 'AI roadmap',
        desc: 'Topic order and milestones aligned to where you want to land.',
        span: 'lg',
      },
      {
        to: '/study',
        label: 'Study plan',
        desc: 'Daily tasks, pacing, notes, and quizzes tied to your roadmap.',
        span: 'lg',
      },
    ],
  },
  {
    title: 'Practice and recall',
    blurb: 'Active prep: questions, coding, and notes—some challenges link to prerendered explainer clips when topics match.',
    tiles: [
      {
        to: '/questions',
        label: 'Interview questions',
        desc: 'Skill-tagged Q&A with difficulty cues.',
        span: 'md',
      },
      {
        to: '/challenges',
        label: 'Coding challenges',
        desc: 'Hands-on problems; matching topics can show prerendered animations.',
        span: 'md',
      },
      {
        to: '/notes',
        label: 'Notes',
        desc: 'Capture concepts alongside your daily plan.',
        span: 'md',
      },
    ],
  },
  {
    title: 'Career surface',
    blurb: 'Resume-derived profile, applications, and the story you show employers.',
    tiles: [
      {
        to: '/resume',
        label: 'Resume',
        desc: 'Upload, parse, and keep skills and summary in sync.',
        span: 'md',
      },
      {
        to: '/jobs',
        label: 'Applications',
        desc: 'Track where you applied and what is next.',
        span: 'md',
      },
      {
        to: '/profile',
        label: 'Profile',
        desc: 'Refine the profile your resume powers.',
        span: 'md',
      },
    ],
  },
  {
    title: 'Growth hub',
    blurb: 'Goals, level map, and practice stats in one place.',
    tiles: [
      {
        to: '/growth',
        label: 'Growth hub',
        desc: 'Track goals, stages, streaks, and activity without jumping between menus.',
        span: 'lg',
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

  const { data: onboarding } = useQuery<{ has_goal?: boolean }>({
    queryKey: ['onboarding-status'],
    queryFn: async () => {
      const { data } = await api.get('/onboarding/status');
      return data;
    },
  });

  const needsGoal = onboarding?.has_goal === false;
  const exploreCount = EXPLORE_GROUPS.reduce((sum, group) => sum + group.tiles.length, 0);

  return (
    <div className="animate-fade-in ez-page-zone">
      <section className="ez-overview-hero animate-slide-up" aria-labelledby="home-hero-title">
        <div className="ez-overview-hero__content">
          <div>
            <span className="ez-overview-kicker">
              <Sparkles size={14} strokeWidth={2} aria-hidden />
              Overview workspace
            </span>
            <h1 id="home-hero-title">Build momentum with one clear flow</h1>
            <p>
              Plan your roadmap, finish daily levels, and practice with intent. Everything below is arranged by what you do
              next, not by feature noise.
            </p>
            <div className="ez-overview-hero__cta ez-cta-row">
              <Link to={needsGoal ? '/onboarding' : '/study'} className="btn btn-primary btn-pill">
                {needsGoal ? 'Choose your goal' : 'Continue studying'}
              </Link>
              <Link to="/growth" className="btn btn-ghost btn-pill">
                Growth hub
              </Link>
              <Link to="/roadmap" className="btn btn-ghost btn-pill">
                Roadmap
              </Link>
            </div>
          </div>
          <div className="ez-overview-hero__stats">
            <article className="ez-overview-stat-card">
              <div className="ez-overview-stat-card__label">Current level</div>
              <div className="ez-overview-stat-card__value">{level?.level ?? '—'}</div>
              <p className="ez-overview-stat-card__meta">{level ? `${level.progress_percent}% to next level` : 'Loading your momentum'}</p>
            </article>
            <article className="ez-overview-stat-card">
              <div className="ez-overview-stat-card__label">Practice streak</div>
              <div className="ez-overview-stat-card__value">{level ? `${level.streak_days} days` : '—'}</div>
              <p className="ez-overview-stat-card__meta">Consistency compounds your XP.</p>
            </article>
            <article className="ez-overview-stat-card">
              <div className="ez-overview-stat-card__label">Total areas</div>
              <div className="ez-overview-stat-card__value">{exploreCount}</div>
              <p className="ez-overview-stat-card__meta">Roadmap, study, practice, and career stack.</p>
            </article>
          </div>
        </div>
      </section>

      {level && (
        <section className="ez-momentum ez-overview-momentum animate-slide-up" aria-labelledby="momentum-title">
          <h2 id="momentum-title" className="ez-momentum__title">
            Your momentum
          </h2>
          <div className="ez-momentum__row">
            <div className="ez-momentum__left">
              <div className="ez-momentum__level ez-momentum__level--pulse">{level.level}</div>
              <div>
                <p className="ez-momentum__name">Level {level.level}</p>
                <p className="ez-momentum__xp-line">
                  {level.xp} / {level.xp_to_next_level} XP to the next level
                </p>
                <div className="ez-momentum__bar-track">
                  <div className="ez-momentum__bar-fill" style={{ width: `${level.progress_percent}%` }} />
                </div>
              </div>
            </div>
            <div className="ez-momentum__actions">
              <span className="ez-pill-streak">
                <Flame size={14} strokeWidth={2} aria-hidden />
                {level.streak_days}-day streak
              </span>
              <Link to="/growth?focus=activity" className="btn btn-ghost btn-pill btn-sm">
                Activity
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="ez-overview-layout" aria-labelledby="explore-title">
        <div>
          <h2 id="explore-title" className="ez-section-title">
            Explore by focus
          </h2>
          <p className="ez-explore-lead">
            Jump into the right lane quickly. Each block is a focused part of your learning workflow.
          </p>

          {EXPLORE_GROUPS.map((group) => (
            <div key={group.title} className="ez-explore-group ez-explore-group--overview">
              <h3 className="ez-explore-group__title">{group.title}</h3>
              <p className="ez-explore-group__blurb">{group.blurb}</p>
              <div className="ez-bento stagger-children ez-overview-bento">
                {group.tiles.map((tile) => (
                  <Link
                    key={tile.to}
                    to={tile.to}
                    className={`card card-interactive ez-tile ez-explore-tile ez-bento__tile--${tile.span}`}
                  >
                    <div className="ez-tile__label">{tile.label}</div>
                    <p className="ez-tile__desc">{tile.desc}</p>
                    <span className="ez-tile__meta">
                      Open <ArrowRight size={12} strokeWidth={2} style={{ verticalAlign: 'middle', marginLeft: 4 }} aria-hidden />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <aside className="ez-overview-side">
          <section className="ez-overview-panel">
            <h3 className="ez-overview-panel__title">
              <Target size={15} strokeWidth={1.9} aria-hidden />
              Today focus
            </h3>
            <ul className="ez-overview-checklist">
              <li>{needsGoal ? 'Choose a clear target role and time horizon.' : 'Complete your next study level.'}</li>
              <li>Practice with at least one coding challenge.</li>
              <li>Capture one key concept in notes.</li>
            </ul>
          </section>

          <section className="ez-overview-panel">
            <h3 className="ez-overview-panel__title">
              <Compass size={15} strokeWidth={1.9} aria-hidden />
              Quick routes
            </h3>
            <div className="ez-overview-links">
              <Link to="/study" className="ez-overview-link">Open study plan</Link>
              <Link to="/growth?focus=activity" className="ez-overview-link">Growth &amp; activity</Link>
              <Link to="/jobs" className="ez-overview-link">Track applications</Link>
            </div>
          </section>
        </aside>
      </section>

      <section className="ez-under-hood" aria-labelledby="under-hood-title">
        <h2 id="under-hood-title" className="ez-under-hood__title">
          What is different here
        </h2>
        <p className="ez-under-hood__lead">
          Built around real pipelines in the product—not generic “learning” copy.
        </p>
        <ul className="ez-under-hood__list">
          <li className="ez-under-hood__item">
            <strong>Adaptive study graph</strong>
            Roadmap and daily plan connect to levels, XP, and streaks so effort shows up as progression, not busywork.
          </li>
          <li className="ez-under-hood__item">
            <strong>Notes and optional clips</strong>
            Study notes open in a focused view; when a topic lines up with a bundled animation, you get a simple embedded clip—not a separate render pipeline.
          </li>
          <li className="ez-under-hood__item">
            <strong>Practice tied to concepts</strong>
            Challenges can link to prerendered animations when the topic matches, so code and visuals reinforce the same idea.
          </li>
        </ul>
      </section>

      {!isLoading && progress && (
        <section className="ez-stats-section ez-overview-snapshot" aria-labelledby="snapshot-title">
          <h2 id="snapshot-title" className="ez-section-title">
            Snapshot
          </h2>
          <p className="ez-explore-lead ez-overview-snapshot__lead">Totals from your latest practice and learning sessions.</p>
          <div className="ez-stat-board">
            <div className="ez-stat-board__item">
              <div className="ez-stat-board__value">{progress.challenges_completed}</div>
              <div className="ez-stat-board__label">Challenges completed</div>
            </div>
            <div className="ez-stat-board__item">
              <div className="ez-stat-board__value">{progress.questions_answered}</div>
              <div className="ez-stat-board__label">Questions answered</div>
            </div>
            <div className="ez-stat-board__item">
              <div className="ez-stat-board__value">{progress.total_time_minutes}</div>
              <div className="ez-stat-board__label">Minutes practiced</div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
