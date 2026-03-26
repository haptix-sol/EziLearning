import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

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

interface DayPlan {
  id: string;
  day_number: number;
  title: string;
  is_completed: boolean;
  activity_type: string;
  challenge_id: string | null;
}

const ACTIVITY_ICONS: Record<string, string> = {
  read: '📖',
  study: '📚',
  practice: '💻',
  test: '✅',
};

function AdventureMapTile({ day, index }: { day: DayPlan; index: number; total: number }) {
  const isCompleted = day.is_completed;
  const isEven = index % 2 === 0;
  const baseStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 72,
    minWidth: 72,
    minHeight: 72,
    borderRadius: 16,
    background: isCompleted
      ? 'linear-gradient(145deg, #3fb950 0%, #238636 100%)'
      : 'linear-gradient(145deg, #21262d 0%, #161b22 100%)',
    border: `3px solid ${isCompleted ? 'rgba(63,185,80,0.6)' : 'var(--border)'}`,
    boxShadow: isCompleted
      ? '0 8px 24px rgba(63,185,80,0.35), inset 0 1px 0 rgba(255,255,255,0.2)'
      : '0 6px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
    transform: `translateY(${isEven ? 0 : 4}px) rotateY(${(index % 3 - 1) * 2}deg)`,
    transition: 'all 0.3s var(--ease-spring)',
    textDecoration: 'none',
    color: 'inherit',
  };

  const tileContent = (
    <>
      <span style={{ fontSize: 24, marginBottom: 2 }}>
        {isCompleted ? '✓' : ACTIVITY_ICONS[day.activity_type] || '📌'}
      </span>
      <span style={{ fontSize: 14, fontWeight: 700, color: isCompleted ? '#fff' : 'var(--text-primary)' }}>
        Day {day.day_number}
      </span>
    </>
  );

  const handlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      (e.currentTarget as HTMLElement).style.transform = `translateY(${isEven ? -6 : -2}px) scale(1.08) rotateY(0deg)`;
      (e.currentTarget as HTMLElement).style.boxShadow = isCompleted
        ? '0 12px 32px rgba(63,185,80,0.45)'
        : '0 10px 28px rgba(88,166,255,0.25)';
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      (e.currentTarget as HTMLElement).style.transform = `translateY(${isEven ? 0 : 4}px) rotateY(${(index % 3 - 1) * 2}deg)`;
      (e.currentTarget as HTMLElement).style.boxShadow = isCompleted
        ? '0 8px 24px rgba(63,185,80,0.35), inset 0 1px 0 rgba(255,255,255,0.2)'
        : '0 6px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)';
    },
  };

  if (day.challenge_id) {
    return (
      <Link
        to={`/challenges/${day.challenge_id}?from=study&day=${day.id}`}
        style={baseStyle}
        {...handlers}
      >
        {tileContent}
      </Link>
    );
  }
  return (
    <div style={{ ...baseStyle, cursor: 'default' }} {...handlers}>
      {tileContent}
    </div>
  );
}

function AdventurePath({ days }: { days: DayPlan[] }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'center',
        padding: 24,
        perspective: '1000px',
      }}
    >
      {days.map((day, i) => (
        <AdventureMapTile key={day.id} day={day} index={i} total={days.length} />
      ))}
    </div>
  );
}

export function MyGoalsPage() {
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const queryClient = useQueryClient();

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

  const { data: goals, isLoading } = useQuery<GoalWithPlan[]>({
    queryKey: ['onboarding-goals'],
    queryFn: async () => {
      const { data } = await api.get('/onboarding/goals');
      return data;
    },
  });

  const selectedGoal = goals?.find((g) => g.id === selectedGoalId) || goals?.[0];
  const planIdForDays = selectedGoal?.study_plan_id;

  const { data: days } = useQuery<DayPlan[]>({
    queryKey: ['plan-days', planIdForDays],
    queryFn: async () => {
      const { data } = await api.get(`/study/plans/${planIdForDays}/days`);
      return data;
    },
    enabled: !!planIdForDays,
  });

  const effectiveGoalId = selectedGoalId || selectedGoal?.id;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <div style={{ width: 48, height: 48, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ color: 'var(--text-primary)', marginBottom: 8, fontSize: 28, fontWeight: 700 }}>
        My Goals
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: 15 }}>
        Your learning adventures. Complete days to progress along the path.
      </p>

      {(!goals || goals.length === 0) && (
        <div
          className="card"
          style={{
            padding: 48,
            textAlign: 'center',
            borderStyle: 'dashed',
            background: 'var(--bg-card)',
          }}
        >
          <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.6 }}>🎯</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 16 }}>
            No goals yet. Create a goal to start your adventure!
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Click <strong>+ Add New Goal</strong> in the sidebar to create a goal with a study plan.
          </p>
        </div>
      )}

      {goals && goals.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
            {goals.map((g) => (
              <div
                key={g.id}
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  gap: 0,
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  border: `2px solid ${effectiveGoalId === g.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: effectiveGoalId === g.id ? 'var(--accent-muted)' : 'var(--bg-card)',
                }}
              >
                <button
                  onClick={() => setSelectedGoalId(g.id)}
                  style={{
                    padding: '14px 20px',
                    border: 'none',
                    background: 'none',
                    color: 'var(--text-primary)',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all var(--duration-fast)',
                    flex: 1,
                  }}
                >
                  <div>{g.goal_label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    {g.completed_days}/{g.total_days} days • {g.duration_days === 7 ? '1 Week' : g.duration_days === 14 ? '2 Weeks' : '1 Month'}
                  </div>
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete goal "${g.goal_label}"? This will also delete its study plan and roadmap progress.`)) {
                      deleteGoalMutation.mutate(g.id);
                    }
                  }}
                  disabled={deleteGoalMutation.isPending}
                  style={{
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    borderLeft: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: 18,
                  }}
                  title="Delete goal"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>

          {selectedGoal?.study_plan_id && days && (
            <div
              className="card"
              style={{
                padding: 0,
                overflow: 'hidden',
                background: 'linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-base) 100%)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
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
                  {selectedGoal.goal_label}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '6px 12px',
                    background: 'var(--accent-muted)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--accent)',
                    fontSize: 13,
                    fontWeight: 600,
                  }}>
                    {selectedGoal.completed_days} / {selectedGoal.total_days} completed
                  </span>
                  <Link
                    to={`/study?plan=${selectedGoal.study_plan_id}`}
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
                    View full plan →
                  </Link>
                  <Link
                    to={`/roadmap?goal=${selectedGoal.id}`}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--bg-active)',
                      color: 'var(--text-primary)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: 'none',
                      border: '1px solid var(--border)',
                    }}
                  >
                    Roadmap →
                  </Link>
                </div>
              </div>
              <div style={{ padding: '16px 0' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16, textAlign: 'center' }}>
                  Adventure map — complete each day to unlock the next
                </div>
                <AdventurePath days={days} />
              </div>
            </div>
          )}

          {selectedGoal && !selectedGoal.study_plan_id && (
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>
                This goal doesn't have a study plan. Create a new goal with a duration to get an adventure map.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
