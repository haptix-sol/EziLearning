import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Check, Flame, Sparkles, Trash2, Trophy, Wand2, X } from 'lucide-react';
import {
  api,
  type StudyPlan as StudyPlanType,
  type DayPlan,
  type LevelProgress,
  type Mcq,
  type EarnedBadge,
} from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { StudyDaysSkeleton } from '../components/ui/Skeleton';
import { topicSlug } from '../features/visualLesson/topicSlug';

export function StudyPlanPage() {
  const [searchParams] = useSearchParams();
  const planFromUrl = searchParams.get('plan');
  const dayFromUrl = searchParams.get('day');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null);
  const [celebrateDayLabel, setCelebrateDayLabel] = useState<string | null>(null);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: plans } = useQuery<StudyPlanType[]>({
    queryKey: ['study-plans'],
    queryFn: async () => {
      const { data } = await api.get('/study/plans');
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

  const { data: badges } = useQuery<{ badges: EarnedBadge[] }>({
    queryKey: ['study-badges'],
    queryFn: async () => {
      const { data } = await api.get('/study/badges');
      return data;
    },
  });

  const { data: days, isLoading: daysLoading } = useQuery<DayPlan[]>({
    queryKey: ['plan-days', selectedPlanId],
    queryFn: async () => {
      const { data } = await api.get(`/study/plans/${selectedPlanId}/days`);
      return data;
    },
    enabled: !!selectedPlanId,
  });

  const { data: mcqs, refetch: refetchMcqs } = useQuery<Mcq[]>({
    queryKey: ['day-mcqs', expandedDayId],
    queryFn: async () => {
      if (!expandedDayId) return [];
      const { data } = await api.get(`/study/days/${expandedDayId}/mcqs`);
      return data;
    },
    enabled: !!expandedDayId,
  });

  useEffect(() => {
    if (!plans?.length) return;
    const validFromUrl = planFromUrl && plans.some((p) => p.id === planFromUrl);
    setSelectedPlanId((prev) => {
      if (validFromUrl) return planFromUrl;
      if (!prev || !plans.some((p) => p.id === prev)) return plans[0].id;
      return prev;
    });
  }, [plans, planFromUrl]);

  useEffect(() => {
    if (!dayFromUrl || !days?.length) return;
    if (days.some((d) => d.id === dayFromUrl)) {
      setExpandedDayId(dayFromUrl);
    }
  }, [dayFromUrl, days]);

  useEffect(() => {
    return () => {
      if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
    };
  }, []);

  const completeMutation = useMutation({
    mutationFn: async (dayId: string) => {
      const { data } = await api.post(`/study/days/${dayId}/complete`);
      return data;
    },
    onSuccess: (_, dayId) => {
      queryClient.invalidateQueries({ queryKey: ['plan-days', selectedPlanId] });
      queryClient.invalidateQueries({ queryKey: ['study-plans'] });
      queryClient.invalidateQueries({ queryKey: ['level'] });
      queryClient.invalidateQueries({ queryKey: ['study-badges'] });
      const day = days?.find((d) => d.id === dayId);
      setCelebrateDayLabel(day ? `Day ${day.day_number} complete` : 'Day complete');
      if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
      celebrateTimer.current = setTimeout(() => setCelebrateDayLabel(null), 5000);
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      await api.delete(`/study/plans/${planId}`);
    },
    onSuccess: (_, planId) => {
      if (selectedPlanId === planId) setSelectedPlanId(null);
      queryClient.invalidateQueries({ queryKey: ['study-plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan-days'] });
      queryClient.invalidateQueries({ queryKey: ['study-notes'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-goals'] });
    },
  });

  const deleteAllPlansMutation = useMutation({
    mutationFn: async () => {
      await api.delete('/study/plans/all');
    },
    onSuccess: () => {
      setSelectedPlanId(null);
      queryClient.invalidateQueries({ queryKey: ['study-plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan-days'] });
      queryClient.invalidateQueries({ queryKey: ['study-notes'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-goals'] });
    },
  });

  const deleteNotesMutation = useMutation({
    mutationFn: (dayId: string) => api.delete(`/study/days/${dayId}/notes`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-days', selectedPlanId] });
      queryClient.invalidateQueries({ queryKey: ['study-notes'] });
    },
  });

  const submitMcqMutation = useMutation({
    mutationFn: async ({
      dayId,
      mcqId,
      selectedOptionId,
    }: {
      dayId: string;
      mcqId: string;
      selectedOptionId: string;
    }) => {
      const { data } = await api.post(`/study/days/${dayId}/mcqs/${mcqId}/answer`, {
        selected_option_id: selectedOptionId,
      });
      return data;
    },
    onSuccess: (_, { dayId }) => {
      refetchMcqs();
      queryClient.invalidateQueries({ queryKey: ['day-mcqs', dayId] });
      queryClient.invalidateQueries({ queryKey: ['level'] });
    },
  });

  const openNotesInApp = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/study/days/${id}/notes/build`);
    },
    onSuccess: (_, id) => {
      const q = selectedPlanId ? `?plan=${encodeURIComponent(selectedPlanId)}` : '';
      navigate(`/study/notes/${id}${q}`);
    },
  });

  const generateVisualLessonMutation = useMutation({
    mutationFn: async ({ dayId, topic }: { dayId: string; topic: string }) => {
      await api.post(`/study/days/${dayId}/visual-lesson/build`, null, {
        params: { topic },
      });
    },
    onSuccess: (_, { dayId, topic }) => {
      queryClient.invalidateQueries({ queryKey: ['plan-days', selectedPlanId] });
      queryClient.invalidateQueries({ queryKey: ['visual-lesson', dayId, topic] });
      const q = new URLSearchParams();
      q.set('topic', topic);
      if (selectedPlanId) q.set('plan', selectedPlanId);
      navigate(`/study/day/${dayId}/visual?${q.toString()}`);
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { detail?: string } } };
      const detail = ax.response?.data?.detail;
      window.alert(typeof detail === 'string' ? detail : 'Could not generate the AI lesson. Check that an LLM is configured.');
    },
  });

  const formatPlanLabel = (planType: string) => planType.replaceAll('_', ' ');

  return (
    <div className="animate-fade-in ez-page-zone ez-study-page">
      <PageHeader
        title="Study plan"
        description="Work through each day in sequence. Expand for topics, quizzes, challenge, and complete when done."
        actions={
          <Link to="/roadmap" className="btn btn-ghost btn-sm">
            Roadmap
          </Link>
        }
      />

      {celebrateDayLabel ? (
        <div className="ez-celebrate" role="status">
          <Sparkles size={20} strokeWidth={1.75} aria-hidden />
          {celebrateDayLabel}. Streak and XP are updated—open the level map to see what unlocked.
        </div>
      ) : null}

      {level ? (
        <div className="ez-momentum-card animate-slide-up">
          <div className="ez-momentum-card__row">
            <div className="ez-study-level-head">
              <span className="ez-momentum-card__level">Level {level.level}</span>
              <span className="ez-momentum-card__xp">
                {level.xp} <span className="ez-study-level-head__muted">/ {level.xp_to_next_level} XP</span>
              </span>
            </div>
            <div className="ez-momentum-card__badges">
              <span className="ez-pill-streak--card">
                <Flame size={15} strokeWidth={2} aria-hidden />
                {level.streak_days} day streak
              </span>
              {badges?.badges?.map((b) => (
                <span key={b.goal_id} className="ez-pill-badge--card">
                  <Trophy size={14} strokeWidth={2} aria-hidden />
                  {b.role_name}
                </span>
              ))}
            </div>
          </div>
          <div className="ez-momentum-card__track">
            <div className="ez-momentum-card__fill" style={{ width: `${level.progress_percent}%` }} />
          </div>
        </div>
      ) : null}

      <div className="ez-study-layout">
        <aside className="ez-study-sidebar card">
          <h2 className="ez-study-sidebar__title">Your plans</h2>
          {plans && plans.length > 0 ? (
            <div className="ez-study-sidebar__content">
              <div className="ez-study-sidebar__head">
                <span className="ez-study-sidebar__kicker">Available plans</span>
                <button
                  onClick={() =>
                    window.confirm('Delete all plans? Linked goals will also be deleted.') &&
                    deleteAllPlansMutation.mutate()
                  }
                  disabled={deleteAllPlansMutation.isPending}
                  className="btn btn-ghost ez-study-clear-btn"
                >
                  Clear all
                </button>
              </div>
              {plans.map((p) => (
                <div
                  key={p.id}
                  className={`ez-study-plan-item${selectedPlanId === p.id ? ' ez-study-plan-item--active' : ''}`}
                  onClick={() => setSelectedPlanId(p.id)}
                >
                  <span className="ez-study-plan-item__text">
                    {formatPlanLabel(p.plan_type)} • {p.completed_days}/{p.total_days}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Delete this plan? Linked goals will also be deleted.'))
                        deletePlanMutation.mutate(p.id);
                    }}
                    className="ez-study-plan-item__delete"
                    aria-label="Delete plan"
                  >
                    <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No study plans yet"
              description="Create a goal from the sidebar or My goals—then generate a timed plan to populate these days."
              action={
                <Link to="/growth?focus=goals" className="btn btn-primary">
                  My goals
                </Link>
              }
            />
          )}
        </aside>

        <section className="ez-study-main">
          {selectedPlanId && daysLoading && <StudyDaysSkeleton />}
          {selectedPlanId && !daysLoading && days && days.length > 0 && (
            <div className="ez-study-days">
              <h3 className="ez-study-days__title">Day-wise plan</h3>
              <div className="ez-study-days__list">
                {days.map((day) => {
                  const isExpanded = expandedDayId === day.id;
                  const isUnlocked = day.day_number === 1 || days.find((d) => d.day_number === day.day_number - 1)?.is_completed;
                  return (
                    <div
                      key={day.id}
                      className={`card animate-slide-up ez-study-day-card${
                        day.is_completed ? ' ez-study-day-card--done' : ''
                      }${isExpanded ? ' ez-study-day-card--expanded' : ''}`}
                    >
                      <div
                        onClick={() => isUnlocked && setExpandedDayId(isExpanded ? null : day.id)}
                        className={`ez-study-day-card__head${!isUnlocked ? ' ez-study-day-card__head--locked' : ''}`}
                      >
                        <div className="ez-study-day-card__left">
                          <span className={`ez-study-day-card__badge${day.is_completed ? ' ez-study-day-card__badge--done' : ''}`}>
                            {day.is_completed ? <Check size={14} strokeWidth={2.5} aria-label="Completed" /> : day.day_number}
                          </span>
                          <div className="ez-study-day-card__copy">
                            <div className="ez-study-day-card__title">
                              Day {day.day_number} — {day.title}
                            </div>
                            <div className="ez-study-day-card__meta">
                              {(day.topics?.length ?? 0)} topics
                              {day.challenge_id && ' • Coding challenge'}
                              {mcqs && expandedDayId === day.id && mcqs.length > 0 && ` • ${mcqs.length} quiz(zes)`}
                            </div>
                          </div>
                        </div>
                        <span className="ez-study-day-card__toggle" aria-hidden>
                          {isExpanded ? '−' : '+'}
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="ez-day-expand">
                          {day.notes && (
                            <div className="ez-day-expand__notes-bar">
                              <span className="ez-day-expand__notes-label">Study notes are saved for this day.</span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm('Delete notes for this day? They will be regenerated when you view again.')) {
                                    deleteNotesMutation.mutate(day.id);
                                  }
                                }}
                                disabled={deleteNotesMutation.isPending}
                                className="btn btn-ghost"
                                style={{ fontSize: 12 }}
                                title="Delete notes (will regenerate on next view)"
                              >
                                Delete notes
                              </button>
                            </div>
                          )}

                          <section className="ez-day-section" aria-labelledby={`topics-head-${day.id}`}>
                            <div className="ez-day-section__head">
                              <div>
                                <h4 id={`topics-head-${day.id}`} className="ez-day-section__title">
                                  Topics
                                </h4>
                                <p className="ez-day-section__hint">
                                  Generate AI lesson creates a tailored slide deck (like building notes). Quick open uses the library template instantly.
                                </p>
                              </div>
                            </div>
                            {(day.topics || []).map((topic) => {
                              const subtopics = day.subtopics?.[topic] ?? [];
                              const vSlug = topicSlug(topic);
                              const visualDone = day.visual_lesson_progress?.[vSlug]?.completed;
                              const hasAiLesson = day.visual_lesson_progress?.[vSlug]?.has_generated;
                              const visualHref = `/study/day/${day.id}/visual?topic=${encodeURIComponent(topic)}&plan=${encodeURIComponent(selectedPlanId || '')}`;
                              const genPending =
                                generateVisualLessonMutation.isPending &&
                                generateVisualLessonMutation.variables?.dayId === day.id &&
                                generateVisualLessonMutation.variables?.topic === topic;
                              return (
                                <div key={topic} className="ez-day-topic">
                                  <div className="ez-day-topic__head">
                                    <h5 className="ez-day-topic__title">{topic}</h5>
                                    <div className="ez-day-topic__badges">
                                      {hasAiLesson ? (
                                        <span className="ez-day-topic__pill ez-day-topic__pill--ai" title="AI-generated lesson saved">
                                          AI
                                        </span>
                                      ) : null}
                                      {visualDone ? (
                                        <span className="ez-day-topic__pill ez-day-topic__pill--done" title="Lesson completed">
                                          Done
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                  {subtopics.length > 0 && (
                                    <ul className="ez-day-topic__subtopics">
                                      {subtopics.map((st) => (
                                        <li key={st}>{st}</li>
                                      ))}
                                    </ul>
                                  )}
                                  <div className="ez-day-topic__actions-primary">
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-sm ez-day-topic__btn-ai"
                                      disabled={genPending}
                                      onClick={() => generateVisualLessonMutation.mutate({ dayId: day.id, topic })}
                                    >
                                      <Wand2 size={14} strokeWidth={2} aria-hidden />
                                      {genPending ? 'Generating…' : 'Generate AI lesson'}
                                    </button>
                                    <Link to={visualHref} className="btn btn-ghost btn-sm ez-day-topic__btn-quick">
                                      <BookOpen size={14} strokeWidth={2} aria-hidden />
                                      Quick open
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={() => openNotesInApp.mutate(day.id)}
                                      disabled={openNotesInApp.isPending}
                                      className="btn btn-ghost btn-sm ez-day-topic__notes"
                                    >
                                      Open notes
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </section>

                          <section className="ez-day-section" aria-labelledby={`tests-head-${day.id}`}>
                            <h4 id={`tests-head-${day.id}`} className="ez-day-section__title ez-day-section__title--with-gap">
                              Tests &amp; practice
                            </h4>
                            <div className="ez-day-tests-stack">
                              {mcqs && mcqs.length > 0 && (
                                <div className="ez-day-tests-panel">
                                  <div className="ez-day-tests-panel__title">Quizzes (multiple choice)</div>
                                  {mcqs.map((mcq) => (
                                    <McqCard
                                      key={mcq.id}
                                      mcq={mcq}
                                      dayId={day.id}
                                      onSubmit={(optId) =>
                                        submitMcqMutation.mutate({
                                          dayId: day.id,
                                          mcqId: mcq.id,
                                          selectedOptionId: optId,
                                        })
                                      }
                                      isSubmitting={submitMcqMutation.isPending}
                                    />
                                  ))}
                                </div>
                              )}
                              {day.challenge_id && (
                                <Link
                                  to={`/challenges/${day.challenge_id}?from=study&day=${day.id}`}
                                  className="btn btn-primary"
                                  style={{ textDecoration: 'none', width: 'fit-content' }}
                                >
                                  Coding challenge
                                </Link>
                              )}
                              {(!mcqs || mcqs.length === 0) && !day.challenge_id && (
                                <p className="ez-day-tests-empty">
                                  No quizzes or coding challenge for this day.
                                </p>
                              )}
                            </div>
                          </section>

                          <div className="ez-day-expand__complete">
                            {day.is_completed ? (
                              <div className="ez-day-complete-chip">
                                <span className="ez-day-complete-chip__icon">
                                  <Check size={14} strokeWidth={2.5} aria-hidden />
                                </span>
                                Day completed
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  completeMutation.mutate(day.id);
                                  setExpandedDayId(null);
                                }}
                                disabled={completeMutation.isPending}
                                className="btn btn-primary ez-day-complete-btn"
                              >
                                Complete Day
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function McqCard({
  mcq,
  onSubmit,
  isSubmitting,
}: {
  mcq: Mcq;
  dayId: string;
  onSubmit: (optionId: string) => void;
  isSubmitting: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const answered = mcq.answered ?? false;

  const handleSubmit = () => {
    if (!selected || answered) return;
    onSubmit(selected);
    setSubmitted(true);
  };

  if (answered) {
    return (
      <div className={`ez-mcq-card ez-mcq-card--answered ${mcq.is_correct ? 'ez-mcq-card--correct' : 'ez-mcq-card--wrong'}`}>
        <div className="ez-mcq-card__question">
          {mcq.question_text}
        </div>
        <span className={`ez-mcq-card__result ${mcq.is_correct ? 'ez-mcq-card__result--ok' : 'ez-mcq-card__result--bad'}`}>
          {mcq.is_correct ? (
            <>
              <Check size={14} strokeWidth={2.5} style={{ verticalAlign: 'middle', marginRight: 4 }} aria-hidden /> Correct
            </>
          ) : (
            <>
              <X size={14} strokeWidth={2.5} style={{ verticalAlign: 'middle', marginRight: 4 }} aria-hidden /> Incorrect
            </>
          )}{' '}
          {mcq.is_correct && '+5 XP'}
        </span>
      </div>
    );
  }

  return (
    <div className="ez-mcq-card">
      <div className="ez-mcq-card__question">
        {mcq.question_text}
      </div>
      <div className="ez-mcq-options">
        {(mcq.options || []).map((opt) => (
          <label
            key={opt.id}
            className={`ez-mcq-option ${selected === opt.id ? 'ez-mcq-option--selected' : ''}`}
          >
            <input type="radio" name={`mcq-${mcq.id}`} checked={selected === opt.id} onChange={() => setSelected(opt.id)} disabled={submitted} />
            {opt.text}
          </label>
        ))}
      </div>
      <button
        onClick={handleSubmit}
        disabled={!selected || isSubmitting || submitted}
        className="btn btn-primary ez-mcq-submit"
      >
        Submit
      </button>
    </div>
  );
}
