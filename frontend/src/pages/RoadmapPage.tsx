import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type DayPlan } from '../lib/api';

const LEVELS_PER_ROW = 5;

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

export function RoadmapPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const goalIdFromUrl = searchParams.get('goal') || undefined;
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(goalIdFromUrl || null);
  const [expandedLevel, setExpandedLevel] = useState<DayPlan | null>(null);
  const [hoveredLevel, setHoveredLevel] = useState<DayPlan | null>(null);
  const queryClient = useQueryClient();

  const { data: goals } = useQuery({
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
  const ROWS = days.length ? Math.ceil(days.length / LEVELS_PER_ROW) : 1;

  const getLevelPosition = (index: number) => {
    const row = Math.floor(index / LEVELS_PER_ROW);
    const colInRow = index % LEVELS_PER_ROW;
    const isReversed = row % 2 === 1;
    const col = isReversed ? LEVELS_PER_ROW - 1 - colInRow : colInRow;
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
      <div className="animate-fade-in">
        <div className="card" style={{ padding: 48, textAlign: 'center', borderStyle: 'dashed' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 16 }}>
            No goals yet. Create a goal to see your personalized roadmap.
          </p>
          <Link to="/goals" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            Create a goal →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ color: 'var(--text-primary)', margin: '0 0 8px', fontSize: 28, fontWeight: 700 }}>
          Roadmap
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 15 }}>
          Your study plan based on your goals. Select a goal to view its roadmap.
        </p>
      </div>

      {/* Goal selector */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        {goals.map((g: { id: string; goal_label: string; completed_days: number; total_days: number }) => (
          <button
            key={g.id}
            onClick={() => setSelectedGoalId(g.id)}
            style={{
              padding: '14px 20px',
              border: `2px solid ${selectedGoalId === g.id ? 'var(--accent)' : 'var(--border)'}`,
              background: selectedGoalId === g.id ? 'var(--accent-muted)' : 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              borderRadius: 'var(--radius-lg)',
              transition: 'all var(--duration-fast)',
            }}
          >
            {g.goal_label}
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>
              {g.completed_days}/{g.total_days} days
            </span>
          </button>
        ))}
      </div>

      {selectedGoalId && isLoading && (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading roadmap...</div>
      )}

      {selectedGoalId && !isLoading && goal && (
        <div
          className="card"
          style={{
            padding: 0,
            overflow: 'hidden',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <div
            style={{
              padding: 24,
              background: 'linear-gradient(135deg, rgba(88,166,255,0.15) 0%, transparent 100%)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <h2 style={{ color: 'var(--text-primary)', margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>
              {goal.goal_label}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '6px 12px',
                  background: 'var(--accent-muted)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--accent)',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {goal.completed_days} / {goal.total_days} completed
              </span>
              {goal.study_plan_id && (
                <Link
                  to={`/study?plan=${goal.study_plan_id}`}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--gradient-accent)',
                    color: '#fff',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Full study plan →
                </Link>
              )}
            </div>
          </div>

          {days.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
              {goal.study_plan_id
                ? 'No days in this plan yet.'
                : 'This goal has no study plan. Create a new goal with a duration to get a roadmap.'}
            </div>
          ) : (
            <div style={{ padding: 24 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${LEVELS_PER_ROW}, 64px)`,
                  gridTemplateRows: `repeat(${ROWS}, 64px)`,
                  gap: 12,
                  justifyContent: 'center',
                }}
              >
                {days.map((day, i) => (
                  <div
                    key={day.id}
                    style={{
                      gridColumn: getLevelPosition(i).col + 1,
                      gridRow: getLevelPosition(i).row + 1,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{ position: 'relative' }}
                      onClick={() => (i === 0 || days[i - 1]?.is_completed) && setExpandedLevel(day)}
                      onMouseEnter={() => (i === 0 || days[i - 1]?.is_completed) && setHoveredLevel(day)}
                      onMouseLeave={() => setHoveredLevel(null)}
                    >
                      {/* Hover tooltip - topics preview */}
                      {hoveredLevel?.id === day.id && (day.topics?.length ?? 0) > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginBottom: 8,
                            padding: '10px 14px',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: 'var(--shadow-lg)',
                            zIndex: 10,
                            minWidth: 160,
                            maxWidth: 220,
                            pointerEvents: 'none',
                          }}
                        >
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Topics</div>
                          {(day.topics || []).slice(0, 4).map((t) => (
                            <div key={t} style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 2 }}>• {t}</div>
                          ))}
                          {(day.topics?.length ?? 0) > 4 && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{(day.topics?.length ?? 0) - 4} more</div>
                          )}
                        </div>
                      )}
                      <div
                        className="card animate-slide-up"
                        style={{
                          width: 52,
                          height: 52,
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: (i === 0 || days[i - 1]?.is_completed) ? 'pointer' : 'default',
                          opacity: (i === 0 || days[i - 1]?.is_completed) ? 1 : 0.45,
                          background: day.is_completed
                            ? 'linear-gradient(145deg, rgba(63,185,80,0.25) 0%, var(--bg-card) 100%)'
                            : 'var(--bg-card)',
                          border: `2px solid ${day.is_completed ? 'var(--success)' : avatarAt === i ? 'var(--accent)' : 'var(--border)'}`,
                          boxShadow: avatarAt === i ? '0 0 20px rgba(88,166,255,0.3)' : day.is_completed ? '0 4px 12px rgba(63,185,80,0.2)' : 'none',
                          transition: 'all 0.25s var(--ease-spring)',
                          position: 'relative',
                        }}
                      >
                        {avatarAt === i && !day.is_completed && (
                          <span style={{ position: 'absolute', top: -8, right: -4, fontSize: 20 }}>🧑‍🎓</span>
                        )}
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: 18,
                            color: day.is_completed ? 'var(--success)' : 'var(--text-primary)',
                          }}
                        >
                          {day.is_completed ? '✓' : day.day_number}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Level detail modal - Treasure map: topics only (no notes/video here) */}
      {expandedLevel && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
          onClick={() => setExpandedLevel(null)}
        >
          <div
            className="card animate-slide-up"
            style={{
              maxWidth: 420,
              width: '100%',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: 20,
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 18, fontWeight: 700 }}>
                  Level {expandedLevel.day_number} — {expandedLevel.title}
                </h3>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  {expandedLevel.topics?.length ?? 0} topics
                </p>
              </div>
              <button
                onClick={() => setExpandedLevel(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 24, cursor: 'pointer', padding: 4 }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 20 }}>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {(expandedLevel.topics || []).map((topic) => (
                  <li
                    key={topic}
                    style={{
                      padding: '10px 14px',
                      marginBottom: 6,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    {topic}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                {expandedLevel.is_completed ? (
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Level completed</span>
                ) : (
                  <button
                    onClick={() => {
                      completeMutation.mutate(expandedLevel.id);
                      setExpandedLevel(null);
                    }}
                    disabled={completeMutation.isPending}
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                  >
                    Complete Level
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
