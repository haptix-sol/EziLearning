import { createElement, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BookMarked,
  BookOpen,
  Check,
  ClipboardCheck,
  Download,
  Flame,
  Laptop,
  Lock,
  Pin,
  Sparkles,
  Star,
  Target,
  Trash2,
} from 'lucide-react';
import { api, type LevelProgress, type Progress } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { LevelMapSkeleton } from '../components/ui/Skeleton';

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

interface GoalWithPlan {
  id: string;
  goal_type: string;
  goal_text: string | null;
  goal_label: string;
  study_plan_id: string | null;
  duration_days: number | null;
  completed_days: number;
  total_days: number;
  created_at: string | null;
}

interface DayPlanTile {
  id: string;
  day_number: number;
  title: string;
  is_completed: boolean;
  activity_type: string;
  challenge_id: string | null;
}

const ACTIVITY_LUCIDE: Record<string, LucideIcon> = {
  read: BookOpen,
  study: BookMarked,
  practice: Laptop,
  test: ClipboardCheck,
};

function durationLabel(days: number | null): string {
  if (days === 7) return '1 Week';
  if (days === 14) return '2 Weeks';
  if (days === 30) return '1 Month';
  return days ? `${days} Days` : 'Flexible';
}

function AdventureMapTile({ day, index }: { day: DayPlanTile; index: number }) {
  const isCompleted = day.is_completed;
  const yShift = index % 2 === 0 ? 0 : 4;
  const yTilt = (index % 3 - 1) * 1.5;
  const baseStyle = {
    '--tile-shift': `${yShift}px`,
    '--tile-tilt': `${yTilt}deg`,
  } as React.CSSProperties;
  const ActivityIcon = isCompleted ? Check : (ACTIVITY_LUCIDE[day.activity_type] || Pin);
  const tileContent = (
    <>
      <span className="ez-goals-path-tile__icon">
        {createElement(ActivityIcon, {
          size: 18,
          strokeWidth: isCompleted ? 2.25 : 1.65,
          'aria-hidden': true,
        })}
      </span>
      <span className="ez-goals-path-tile__day">Day {day.day_number}</span>
    </>
  );

  if (day.challenge_id) {
    return (
      <Link
        to={`/challenges/${day.challenge_id}?from=study&day=${day.id}`}
        style={baseStyle}
        className={`ez-goals-path-tile ez-goals-path-tile--link ez-growth-hub__path-tile${isCompleted ? ' ez-goals-path-tile--done' : ''}`}
      >
        {tileContent}
      </Link>
    );
  }
  return (
    <div
      style={baseStyle}
      className={`ez-goals-path-tile ez-growth-hub__path-tile${isCompleted ? ' ez-goals-path-tile--done' : ''}`}
    >
      {tileContent}
    </div>
  );
}

function AdventurePath({ days }: { days: DayPlanTile[] }) {
  return (
    <div className="ez-goals-path ez-growth-hub__path">
      {days.map((day, i) => (
        <AdventureMapTile key={day.id} day={day} index={i} />
      ))}
    </div>
  );
}

type ProgressCountKey = 'challenges_completed' | 'questions_answered' | 'total_time_minutes';

const ACTIVITY_STATS: {
  key: string;
  valueKey: ProgressCountKey;
  label: string;
  link: string | null;
  color: string;
}[] = [
  { key: 'challenges', valueKey: 'challenges_completed', label: 'Challenges', link: '/challenges', color: '#58a6ff' },
  { key: 'questions', valueKey: 'questions_answered', label: 'Questions', link: '/questions', color: '#a371f7' },
  { key: 'minutes', valueKey: 'total_time_minutes', label: 'Minutes', link: null, color: '#3fb950' },
];

export function GrowthTrackPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const focus = searchParams.get('focus') || '';
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: levelProgress } = useQuery<LevelProgress>({
    queryKey: ['level'],
    queryFn: async () => {
      const { data } = await api.get('/study/level');
      return data;
    },
  });

  const { data: mapData, isLoading: mapLoading } = useQuery<LevelMapResponse>({
    queryKey: ['level-map'],
    queryFn: async () => {
      const { data } = await api.get('/levels/map');
      return data;
    },
  });

  const { data: progress, isLoading: progressLoading } = useQuery<Progress>({
    queryKey: ['progress'],
    queryFn: async () => {
      const { data } = await api.get('/progress');
      return data;
    },
  });

  const { data: goals, isLoading: goalsLoading } = useQuery<GoalWithPlan[]>({
    queryKey: ['onboarding-goals'],
    queryFn: async () => {
      const { data } = await api.get('/onboarding/goals');
      return data;
    },
  });

  const selectedGoal = useMemo(
    () => goals?.find((g) => g.id === selectedGoalId) || goals?.[0],
    [goals, selectedGoalId],
  );
  const totalDaysDone = useMemo(
    () => goals?.reduce((a, g) => a + (g.completed_days || 0), 0) ?? 0,
    [goals],
  );
  const planIdForDays = selectedGoal?.study_plan_id;
  const effectiveGoalId = selectedGoalId || selectedGoal?.id;

  const { data: days } = useQuery<DayPlanTile[]>({
    queryKey: ['plan-days', planIdForDays],
    queryFn: async () => {
      const { data } = await api.get(`/study/plans/${planIdForDays}/days`);
      return data;
    },
    enabled: !!planIdForDays,
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      await api.delete(`/onboarding/goals/${goalId}`);
    },
    onSuccess: (_, goalId) => {
      if (selectedGoalId === goalId) setSelectedGoalId(null);
      queryClient.invalidateQueries({ queryKey: ['onboarding-goals'] });
      queryClient.invalidateQueries({ queryKey: ['plan-days'] });
      queryClient.invalidateQueries({ queryKey: ['study-plans'] });
    },
  });

  useEffect(() => {
    const allowed = ['goals', 'levels', 'activity'];
    if (!focus || !allowed.includes(focus)) return;
    const id = focus === 'activity' ? 'growth-section-activity' : `growth-section-${focus}`;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [focus]);

  const setFocus = (next: string) => {
    if (!next) {
      setSearchParams({}, { replace: true });
      return;
    }
    setSearchParams({ focus: next }, { replace: true });
  };

  const showGoals = !focus || focus === 'goals';
  const showLevels = !focus || focus === 'levels';
  const showActivity = !focus || focus === 'activity';
  const dualColumn = showGoals && showLevels;

  if (mapLoading || !mapData) {
    return <LevelMapSkeleton />;
  }

  const { levels, current_level, completed_count, total_levels } = mapData;
  const pct = total_levels ? (completed_count / total_levels) * 100 : 0;
  const isAllLevelsComplete = total_levels > 0 && completed_count >= total_levels;

  return (
    <div className="animate-fade-in ez-growth-hub ez-page-zone">
      <PageHeader
        title="Growth hub"
        description="Levels, goals, and practice stats in one calm surface—dense where it helps, never noisy."
        actions={
          <Link to="/study" className="btn btn-ghost btn-sm">
            Study
          </Link>
        }
      />

      <section className="ez-growth-hub__hero card" aria-label="Momentum summary">
        <div className="ez-growth-hub__hero-main">
          <div className="ez-growth-hub__level-ring" aria-hidden>
            {levelProgress?.level ?? current_level}
          </div>
          <div className="ez-growth-hub__hero-copy">
            <div className="ez-growth-hub__hero-kicker">Interview journey</div>
            <div className="ez-growth-hub__hero-title">
              Level {current_level}
              <span className="ez-growth-hub__hero-sep">·</span>
              <span className="ez-growth-hub__hero-muted">
                {completed_count}/{total_levels} stages cleared
              </span>
            </div>
            <div className="ez-growth-hub__xp-track" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
              <div className="ez-growth-hub__xp-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="ez-growth-hub__hero-meta">
              <span className="ez-growth-hub__pill">
                <Star size={12} strokeWidth={1.85} aria-hidden />
                {levelProgress?.xp ?? 0} / {levelProgress?.xp_to_next_level ?? '—'} XP
              </span>
              <span className="ez-growth-hub__pill ez-growth-hub__pill--warm">
                <Flame size={12} strokeWidth={2} aria-hidden />
                {levelProgress?.streak_days ?? 0}d streak
              </span>
            </div>
          </div>
        </div>
      </section>

      <nav className="ez-growth-hub__rail" aria-label="Section shortcuts">
        <button type="button" className={focus === 'goals' ? 'ez-growth-hub__rail-btn ez-growth-hub__rail-btn--on' : 'ez-growth-hub__rail-btn'} onClick={() => setFocus('goals')}>
          Goals
        </button>
        <button type="button" className={focus === 'levels' ? 'ez-growth-hub__rail-btn ez-growth-hub__rail-btn--on' : 'ez-growth-hub__rail-btn'} onClick={() => setFocus('levels')}>
          Levels
        </button>
        <button type="button" className={focus === 'activity' ? 'ez-growth-hub__rail-btn ez-growth-hub__rail-btn--on' : 'ez-growth-hub__rail-btn'} onClick={() => setFocus('activity')}>
          Activity
        </button>
        <button type="button" className={focus ? 'ez-growth-hub__rail-btn' : 'ez-growth-hub__rail-btn ez-growth-hub__rail-btn--on'} onClick={() => setFocus('')}>
          All
        </button>
      </nav>

      {(showGoals || showLevels) && (
        <div
          className="ez-growth-hub__grid"
          style={{
            gridTemplateColumns: dualColumn ? 'minmax(260px, 0.46fr) minmax(260px, 1fr)' : '1fr',
          }}
        >
          {showGoals ? (
        <section id="growth-section-goals" className="ez-growth-hub__panel card">
          <header className="ez-growth-hub__panel-head ez-growth-hub__panel-head--split">
            <h2 className="ez-growth-hub__panel-title">Goals</h2>
            <p className="ez-growth-hub__panel-desc">Targets tied to study plans and roadmap pacing.</p>
          </header>

          {goalsLoading ? (
            <p className="ez-growth-hub__muted">Loading goals…</p>
          ) : !goals?.length ? (
            <EmptyState
              icon={<Target size={40} strokeWidth={1.25} aria-hidden />}
              title="No goals yet"
              description="Use New goal in the header to attach a role or outcome—plans appear here."
            />
          ) : (
            <>
              <div className="ez-growth-hub__goal-summary" role="group" aria-label="Goal overview">
                <div className="ez-growth-hub__goal-metrics">
                  <div className="ez-growth-hub__metric">
                    <span className="ez-growth-hub__metric-label">Active</span>
                    <strong className="ez-growth-hub__metric-value">{goals.length}</strong>
                  </div>
                  <div className="ez-growth-hub__metric">
                    <span className="ez-growth-hub__metric-label">Days done</span>
                    <strong className="ez-growth-hub__metric-value">{totalDaysDone}</strong>
                  </div>
                </div>
                <div className="ez-growth-hub__goal-focus">
                  <span className="ez-growth-hub__goal-focus-label">Focus</span>
                  <p
                    className="ez-growth-hub__goal-focus-title"
                    title={selectedGoal?.goal_label ?? undefined}
                  >
                    {selectedGoal?.goal_label ?? '—'}
                  </p>
                </div>
              </div>

              <div className="ez-growth-hub__goal-cards">
                {goals.map((g) => (
                  <article key={g.id} className={`ez-growth-hub__goal-chip${effectiveGoalId === g.id ? ' ez-growth-hub__goal-chip--active' : ''}`}>
                    <button type="button" className="ez-growth-hub__goal-chip-main" onClick={() => setSelectedGoalId(g.id)}>
                      <span className="ez-growth-hub__goal-chip-title">{g.goal_label}</span>
                      <span className="ez-growth-hub__goal-chip-meta">
                        {g.completed_days}/{g.total_days} · {durationLabel(g.duration_days)}
                      </span>
                      <span className="ez-growth-hub__goal-chip-bar" aria-hidden>
                        <span
                          className="ez-growth-hub__goal-chip-bar-fill"
                          style={{
                            width: `${Math.min(100, Math.round(((g.completed_days || 0) / Math.max(1, g.total_days || 0)) * 100))}%`,
                          }}
                        />
                      </span>
                    </button>
                    <button
                      type="button"
                      className="ez-growth-hub__goal-chip-del"
                      title="Delete goal"
                      aria-label="Delete goal"
                      disabled={deleteGoalMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete goal "${g.goal_label}"? This will also delete its study plan and roadmap progress.`,
                          )
                        ) {
                          deleteGoalMutation.mutate(g.id);
                        }
                      }}
                    >
                      <Trash2 size={15} strokeWidth={1.75} aria-hidden />
                    </button>
                  </article>
                ))}
              </div>

              {selectedGoal?.study_plan_id && days && (
                <div className="ez-growth-hub__goal-path">
                  <div className="ez-growth-hub__goal-path-head">
                    <span className="ez-growth-hub__goal-path-title">{selectedGoal.goal_label}</span>
                    <div className="ez-growth-hub__goal-path-actions">
                      <Link to={`/study?plan=${selectedGoal.study_plan_id}`} className="btn btn-primary btn-sm">
                        Plan
                      </Link>
                      <Link to={`/roadmap?goal=${selectedGoal.id}`} className="btn btn-ghost btn-sm">
                        Roadmap
                      </Link>
                    </div>
                  </div>
                  <AdventurePath days={days} />
                </div>
              )}

              {selectedGoal && !selectedGoal.study_plan_id && (
                <p className="ez-growth-hub__muted ez-growth-hub__muted--tight">
                  This goal has no study plan yet. Create a goal with a duration to unlock the day path.
                </p>
              )}
            </>
          )}
        </section>
          ) : null}

          {showLevels ? (
        <section id="growth-section-levels" className="ez-growth-hub__panel card">
          <header className="ez-growth-hub__panel-head">
            <h2 className="ez-growth-hub__panel-title">Levels</h2>
            <p className="ez-growth-hub__panel-desc">Clear stages in order—reward unlocks when every stage is done.</p>
          </header>

          <div className="ez-growth-hub__legend" aria-label="Legend">
            <span>
              <i className="ez-growth-hub__dot ez-growth-hub__dot--done" /> Done
            </span>
            <span>
              <i className="ez-growth-hub__dot ez-growth-hub__dot--current" /> Current
            </span>
            <span>
              <i className="ez-growth-hub__dot ez-growth-hub__dot--locked" /> Locked
            </span>
          </div>

          <div className="ez-growth-hub__level-map">
            {levels.map((level, i) => {
              const isCurrent = level.is_current;
              const discClass = [
                'ez-path-disc',
                'ez-growth-hub__disc',
                level.completed && 'ez-path-disc--done',
                isCurrent && !level.completed && 'ez-path-disc--current',
                !level.unlocked && 'ez-path-disc--locked',
                level.unlocked && 'ez-path-disc--link',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <div key={level.level_number} className="ez-growth-hub__level-cell animate-slide-up" style={{ animationDelay: `${i * 24}ms` }}>
                  {level.unlocked ? (
                    <Link to={`/levels/${level.level_number}`} className="ez-level-map-grid__link">
                      <div className={discClass}>{level.level_number}</div>
                      {level.completed && level.stars ? (
                        <div className="ez-level-map-grid__stars ez-growth-hub__stars">
                          {[1, 2, 3].map((s) => (
                            <Star key={s} size={11} fill="#f0c14b" color="#f0c14b" strokeWidth={1.5} aria-hidden />
                          ))}
                        </div>
                      ) : null}
                      {isCurrent && !level.completed ? <span className="ez-growth-hub__level-tag">Now</span> : null}
                    </Link>
                  ) : (
                    <div className="ez-level-map-grid__link">
                      <div className="ez-path-disc ez-path-disc--locked ez-growth-hub__disc">
                        <Lock size={18} strokeWidth={1.75} aria-hidden />
                      </div>
                      <span className="ez-growth-hub__level-tag ez-growth-hub__level-tag--muted">Locked</span>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="ez-growth-hub__reward">
              <div className={`ez-growth-hub__reward-inner${isAllLevelsComplete ? ' ez-growth-hub__reward-inner--live' : ''}`}>
                <Award size={16} strokeWidth={1.85} aria-hidden />
                <div>
                  <div className="ez-growth-hub__reward-title">ATS resume reward</div>
                  <p className="ez-growth-hub__reward-text">
                    {isAllLevelsComplete ? 'Unlocked — open resume center.' : 'Finish all stages to unlock.'}
                  </p>
                </div>
                <Link to="/resume" className="btn btn-primary btn-sm">
                  <Download size={13} strokeWidth={1.85} aria-hidden />
                  {isAllLevelsComplete ? 'Resume' : 'Details'}
                </Link>
              </div>
            </div>
          </div>

          {isAllLevelsComplete && (
            <div className="ez-growth-hub__banner">
              <Sparkles size={14} strokeWidth={2} aria-hidden />
              <span>Reward ready — create your ATS resume.</span>
              <Link to="/resume" className="btn btn-ghost btn-sm">
                Open
              </Link>
            </div>
          )}
        </section>
          ) : null}
        </div>
      )}

      {showActivity ? (
      <section id="growth-section-activity" className="ez-growth-hub__activity card">
        <header className="ez-growth-hub__panel-head ez-growth-hub__panel-head--inline">
          <h2 className="ez-growth-hub__panel-title">Activity</h2>
          <p className="ez-growth-hub__panel-desc">Practice totals—tap a tile to drill in.</p>
        </header>
        {progressLoading ? (
          <p className="ez-growth-hub__muted">Loading stats…</p>
        ) : (
          <div className="ez-growth-hub__stat-row">
            {ACTIVITY_STATS.map((stat) => (
              <div key={stat.key} className="ez-growth-hub__stat-tile">
                <div className="ez-growth-hub__stat-tile-glow" style={{ background: `radial-gradient(circle at 30% 20%, ${stat.color}22, transparent 65%)` }} aria-hidden />
                <div className="ez-growth-hub__stat-tile-value" style={{ color: stat.color }}>
                  {progress?.[stat.valueKey] ?? 0}
                </div>
                <div className="ez-growth-hub__stat-tile-label">{stat.label}</div>
                {stat.link ? (
                  <Link to={stat.link} className="ez-growth-hub__stat-tile-link">
                    Open →
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
      ) : null}
    </div>
  );
}
