import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Compass, GraduationCap, Sparkles, X } from 'lucide-react';
import { api, type DayPlan } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { RoadmapSkeleton } from '../components/ui/Skeleton';

/** Path grid: one cute row for week-sized plans; snake layout for longer plans. */
function roadmapColsPerRow(dayCount: number): number {
  if (dayCount <= 0) return 7;
  if (dayCount <= 7) return dayCount;
  if (dayCount <= 14) return 7;
  return 5;
}

const ROADMAP_CELL_PX = 34;

interface GoalRoadmapResponse {
  goal: {
    id: string;
    goal_label: string;
    study_plan_id: string | null;
    completed_days: number;
    total_days: number;
  };
  days: DayPlan[];
}

interface GoalSummary {
  id: string;
  goal_label: string;
  completed_days: number;
  total_days: number;
}

export function RoadmapPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const goalIdFromUrl = searchParams.get('goal') || undefined;
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(goalIdFromUrl || null);
  const [expandedLevel, setExpandedLevel] = useState<DayPlan | null>(null);
  const [hoveredLevel, setHoveredLevel] = useState<DayPlan | null>(null);
  const queryClient = useQueryClient();

  const { data: goals } = useQuery<GoalSummary[]>({
    queryKey: ['onboarding-goals'],
    queryFn: async () => {
      const { data } = await api.get('/onboarding/goals');
      return data;
    },
  });

  const { data: roadmapData, isLoading } = useQuery<GoalRoadmapResponse>({
    queryKey: ['goal-roadmap', selectedGoalId],
    queryFn: async () => {
      const { data } = await api.get(`/study/goals/${selectedGoalId}/roadmap`);
      return data;
    },
    enabled: !!selectedGoalId,
  });

  useEffect(() => {
    if (!goals?.length) return;
    const validFromUrl = goalIdFromUrl && goals.some((g: { id: string }) => g.id === goalIdFromUrl);
    setSelectedGoalId((prev) => {
      if (validFromUrl) return goalIdFromUrl;
      if (!prev || !goals.some((g: { id: string }) => g.id === prev)) return goals[0].id;
      return prev;
    });
  }, [goals, goalIdFromUrl]);

  useEffect(() => {
    if (selectedGoalId && selectedGoalId !== goalIdFromUrl) {
      setSearchParams({ goal: selectedGoalId }, { replace: true });
    }
  }, [selectedGoalId, goalIdFromUrl, setSearchParams]);

  const days = roadmapData?.days || [];
  const goal = roadmapData?.goal;
  const colsPerRow = useMemo(() => roadmapColsPerRow(days.length), [days.length]);
  const ROWS = days.length ? Math.ceil(days.length / colsPerRow) : 1;
  const selectedGoal = goals?.find((g) => g.id === selectedGoalId) ?? null;
  const completedPct = goal && goal.total_days > 0 ? Math.round((goal.completed_days / goal.total_days) * 100) : 0;
  const nextDay = days.find((d) => !d.is_completed) ?? null;
  const totalTopics = days.reduce((sum, day) => sum + (day.topics?.length ?? 0), 0);

  const getLevelPosition = (index: number) => {
    const row = Math.floor(index / colsPerRow);
    const colInRow = index % colsPerRow;
    const isReversed = row % 2 === 1;
    const col = isReversed ? colsPerRow - 1 - colInRow : colInRow;
    return { row, col };
  };

  const currentLevelIndex = days.findIndex((d) => !d.is_completed);
  const avatarAt = currentLevelIndex < 0 ? Math.max(0, days.length - 1) : Math.max(0, currentLevelIndex);

  const completeMutation = useMutation({
    mutationFn: async (dayId: string) => {
      const { data } = await api.post(`/study/days/${dayId}/complete`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goal-roadmap', selectedGoalId] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-goals'] });
    },
  });

  if (!goals?.length) {
    return (
      <div className="animate-fade-in ez-page-zone ez-roadmap-page" style={{ maxWidth: 720 }}>
        <PageHeader
          title="Roadmap"
          description="Your day-wise path appears after you set a goal and generate a plan."
        />
        <EmptyState
          title="No goals yet"
          description="Create a goal to unlock a personalized topic order and daily levels."
          action={
            <Link to="/growth?focus=goals" className="btn btn-primary">
              My goals
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in ez-page-zone ez-roadmap-page" style={{ maxWidth: 720 }}>
      <PageHeader
        title="Roadmap"
        description="Lightweight path for each goal—tap a day for topics, or open your full study plan."
      />

      <section className="ez-roadmap-goals ez-roadmap-goals--petite" aria-label="Goal selector">
        {goals.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setSelectedGoalId(g.id)}
            className={`ez-goal-pill${selectedGoalId === g.id ? ' ez-goal-pill--active' : ''}`}
          >
            {g.goal_label}
            <span className="ez-goal-pill__meta">
              {g.completed_days}/{g.total_days} days
            </span>
          </button>
        ))}
      </section>

      {selectedGoalId && isLoading && <RoadmapSkeleton />}

      {selectedGoalId && !isLoading && goal && (
        <section className="ez-roadmap-shell ez-roadmap-shell--petite card">
          <div className="ez-roadmap-shell__hero">
            <nav className="ez-roadmap-trail" aria-label="Context">
              <span className="ez-roadmap-trail__goal" title={goal.goal_label}>
                {goal.goal_label}
              </span>
              <ChevronRight className="ez-roadmap-trail__chev" size={11} strokeWidth={2} aria-hidden />
              {goal.study_plan_id ? (
                <Link to={`/study?plan=${goal.study_plan_id}`} className="ez-roadmap-trail__link">
                  Plan
                </Link>
              ) : (
                <span className="ez-roadmap-trail__muted">Plan</span>
              )}
              <ChevronRight className="ez-roadmap-trail__chev" size={11} strokeWidth={2} aria-hidden />
              <span className="ez-roadmap-trail__here">Days</span>
            </nav>
            <div className="ez-roadmap-shell__hero-row">
              <p className="ez-roadmap-shell__micro">
                {goal.completed_days}/{goal.total_days} done
                <span className="ez-roadmap-shell__micro-sep">·</span>
                {completedPct}%
              </p>
              {goal.study_plan_id ? (
                <Link to={`/study?plan=${goal.study_plan_id}`} className="ez-roadmap-shell__mini-link">
                  Open plan →
                </Link>
              ) : null}
            </div>
            <div className="ez-roadmap-progress ez-roadmap-progress--petite" aria-label={`Progress ${completedPct}%`}>
              <div className="ez-roadmap-progress__fill" style={{ width: `${completedPct}%` }} />
            </div>
          </div>

          {days.length === 0 ? (
            <div className="ez-roadmap-shell__empty">
              {goal.study_plan_id
                ? 'No days in this plan yet.'
                : 'This goal has no study plan yet. Add a timed goal from My goals to generate days.'}
            </div>
          ) : (
            <div className="ez-roadmap-shell__content">
              <div className="ez-roadmap-legend ez-roadmap-legend--petite" aria-label="Roadmap legend">
                <span className="ez-roadmap-legend__item">
                  <span className="ez-roadmap-legend__dot ez-roadmap-legend__dot--done" />
                  Completed
                </span>
                <span className="ez-roadmap-legend__item">
                  <span className="ez-roadmap-legend__dot ez-roadmap-legend__dot--current" />
                  Current
                </span>
                <span className="ez-roadmap-legend__item">
                  <span className="ez-roadmap-legend__dot ez-roadmap-legend__dot--locked" />
                  Locked
                </span>
              </div>

              <div className="ez-roadmap-layout ez-roadmap-layout--petite">
                <section className="ez-roadmap-grid-wrap">
                  <div
                    className="ez-roadmap-grid ez-roadmap-grid--petite"
                    style={{
                      gridTemplateColumns: `repeat(${colsPerRow}, ${ROADMAP_CELL_PX}px)`,
                      gridTemplateRows: `repeat(${ROWS}, ${ROADMAP_CELL_PX}px)`,
                    }}
                  >
                    {days.map((day, i) => {
                      const unlocked = i === 0 || days[i - 1]?.is_completed;
                      const nodeClass = [
                        'ez-path-node',
                        day.is_completed && 'ez-path-node--done',
                        avatarAt === i && !day.is_completed && 'ez-path-node--current',
                        !unlocked && 'ez-path-node--locked',
                        unlocked && 'ez-path-node--clickable',
                      ]
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <div
                          key={day.id}
                          className="ez-roadmap-grid__cell"
                          style={{
                            gridColumn: getLevelPosition(i).col + 1,
                            gridRow: getLevelPosition(i).row + 1,
                          }}
                        >
                          <div
                            className="ez-roadmap-node"
                            onClick={() => unlocked && setExpandedLevel(day)}
                            onMouseEnter={() => unlocked && setHoveredLevel(day)}
                            onMouseLeave={() => setHoveredLevel(null)}
                            onKeyDown={(e) => {
                              if ((e.key === 'Enter' || e.key === ' ') && unlocked) {
                                e.preventDefault();
                                setExpandedLevel(day);
                              }
                            }}
                            role={unlocked ? 'button' : undefined}
                            tabIndex={unlocked ? 0 : undefined}
                            aria-label={unlocked ? `Day ${day.day_number}: ${day.title}` : `Locked day ${day.day_number}`}
                          >
                            {hoveredLevel?.id === day.id && (day.topics?.length ?? 0) > 0 && (
                              <div className="ez-path-tooltip ez-path-tooltip--petite">
                                <div className="ez-roadmap-tooltip__title">Topics</div>
                                {(day.topics || []).slice(0, 4).map((t) => (
                                  <div key={t} className="ez-roadmap-tooltip__topic">
                                    • {t}
                                  </div>
                                ))}
                                {(day.topics?.length ?? 0) > 4 && (
                                  <div className="ez-roadmap-tooltip__more">+{(day.topics?.length ?? 0) - 4} more</div>
                                )}
                              </div>
                            )}
                            <div className={nodeClass}>
                              {avatarAt === i && !day.is_completed && (
                                <span className="ez-roadmap-node__cap">
                                  <GraduationCap size={14} strokeWidth={2} aria-hidden />
                                </span>
                              )}
                              <span className="ez-roadmap-node__number ez-roadmap-node__number--petite">
                                {day.is_completed ? <Check size={13} strokeWidth={2.5} aria-label="Completed" /> : day.day_number}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <aside className="ez-roadmap-insights ez-roadmap-insights--petite">
                  <h3 className="ez-roadmap-insights__title">Insights</h3>
                  <div className="ez-roadmap-insights__stats">
                    <div className="ez-roadmap-stat">
                      <span className="ez-roadmap-stat__label">Selected goal</span>
                      <span className="ez-roadmap-stat__value">{selectedGoal?.goal_label ?? goal.goal_label}</span>
                    </div>
                    <div className="ez-roadmap-stat">
                      <span className="ez-roadmap-stat__label">Total topics</span>
                      <span className="ez-roadmap-stat__value">{totalTopics}</span>
                    </div>
                    <div className="ez-roadmap-stat">
                      <span className="ez-roadmap-stat__label">Next level</span>
                      <span className="ez-roadmap-stat__value">
                        {nextDay ? `Day ${nextDay.day_number}` : 'All done'}
                      </span>
                    </div>
                  </div>

                  {nextDay ? (
                    <div className="ez-roadmap-next">
                      <div className="ez-roadmap-next__head">
                        <Compass size={15} strokeWidth={1.9} aria-hidden />
                        <span>Up next</span>
                      </div>
                      <p className="ez-roadmap-next__title">{nextDay.title}</p>
                      <p className="ez-roadmap-next__sub">{nextDay.topics?.length ?? 0} topics queued</p>
                    </div>
                  ) : (
                    <div className="ez-roadmap-next ez-roadmap-next--done">
                      <div className="ez-roadmap-next__head">
                        <Sparkles size={15} strokeWidth={1.9} aria-hidden />
                        <span>Milestone reached</span>
                      </div>
                      <p className="ez-roadmap-next__title">You completed this roadmap.</p>
                      <p className="ez-roadmap-next__sub">Pick another goal to keep momentum.</p>
                    </div>
                  )}
                </aside>
              </div>
            </div>
          )}
        </section>
      )}

      {expandedLevel && (
        <div
          className="ez-modal-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby="roadmap-modal-title"
          onClick={() => setExpandedLevel(null)}
        >
          <div className="ez-modal-panel animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="ez-modal-head">
              <div>
                <h3 id="roadmap-modal-title" className="ez-roadmap-modal__title">
                  Level {expandedLevel.day_number} — {expandedLevel.title}
                </h3>
                <p className="ez-roadmap-modal__meta">
                  {expandedLevel.topics?.length ?? 0} topics
                </p>
              </div>
              <button type="button" className="ez-modal-close" onClick={() => setExpandedLevel(null)} aria-label="Close">
                <X size={22} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <div className="ez-modal-body">
              <ul className="ez-roadmap-modal__topics">
                {(expandedLevel.topics || []).map((topic) => (
                  <li key={topic} className="ez-roadmap-modal__topic">
                    {topic}
                  </li>
                ))}
              </ul>
              <div className="ez-roadmap-modal__actions">
                {expandedLevel.is_completed ? (
                  <span className="ez-roadmap-modal__done">
                    <Check size={16} strokeWidth={2.5} aria-hidden /> Level completed
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      completeMutation.mutate(expandedLevel.id);
                      setExpandedLevel(null);
                    }}
                    disabled={completeMutation.isPending}
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                  >
                    Mark level complete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
