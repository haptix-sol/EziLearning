import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { FileText, Pencil, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';

export function OnboardingPage() {
  const [goalType, setGoalType] = useState<'manual' | 'trending' | 'resume'>('manual');
  const [manualGoal, setManualGoal] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: status } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: async () => {
      const { data } = await api.get('/onboarding/status');
      return data;
    },
  });

  const { data: trending } = useQuery({
    queryKey: ['trending-roles'],
    queryFn: async () => {
      const { data } = await api.get('/onboarding/trending');
      return data;
    },
  });

  const setGoalMutation = useMutation({
    mutationFn: async (payload: { goal_type: string; goal_text?: string; target_role_id?: string }) => {
      const { data } = await api.post('/onboarding/goal', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      navigate('/roadmap');
    },
  });

  const handleSubmit = () => {
    if (goalType === 'manual' && manualGoal.trim()) {
      setGoalMutation.mutate({ goal_type: 'manual', goal_text: manualGoal.trim() });
    } else if (goalType === 'trending' && selectedRoleId) {
      setGoalMutation.mutate({ goal_type: 'trending', target_role_id: selectedRoleId });
    } else if (goalType === 'resume') {
      navigate('/resume');
    }
  };

  if (status?.has_goal) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="You’re already on a path"
          description="Your goal is saved. Head to the roadmap to see day-wise levels, or open the dashboard for the full workspace."
        />
        <EmptyState
          title="Goal locked in"
          description="Switch to your roadmap to work through daily topics, or review study plans when you’re ready."
          action={
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
              <Link to="/roadmap" className="btn btn-primary">
                Open roadmap
              </Link>
              <Link to="/" className="btn btn-ghost">
                Dashboard
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="What do you want to become?"
        description="Pick one path to start. You can refine skills, resume, and applications later—this goal shapes your roadmap and daily levels."
      />

      <div className="ez-onb-stack">
        {(['manual', 'trending', 'resume'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setGoalType(type)}
            className={`ez-onb-choice card${goalType === type ? ' ez-onb-choice--active' : ''}`}
          >
            <div className="ez-onb-choice__title">
              {type === 'manual' && (
                <>
                  <Pencil size={20} strokeWidth={1.75} aria-hidden />
                  Describe your goal
                </>
              )}
              {type === 'trending' && (
                <>
                  <TrendingUp size={20} strokeWidth={1.75} aria-hidden />
                  Start from a trending role
                </>
              )}
              {type === 'resume' && (
                <>
                  <FileText size={20} strokeWidth={1.75} aria-hidden />
                  Use your resume first
                </>
              )}
            </div>
            <p className="ez-onb-choice__hint">
              {type === 'manual' && 'Best when you already know the title or skills you’re chasing.'}
              {type === 'trending' && 'We’ll align topics to market demand for that role.'}
              {type === 'resume' && 'Upload on the next screen—we’ll infer strengths and gaps, then suggest a path.'}
            </p>
          </button>
        ))}
      </div>

      {goalType === 'manual' && (
        <div className="ez-onb-field">
          <label className="ez-onb-label" htmlFor="onb-manual-goal">
            Your goal in one line
          </label>
          <input
            id="onb-manual-goal"
            type="text"
            className="input"
            value={manualGoal}
            onChange={(e) => setManualGoal(e.target.value)}
            placeholder="e.g. Staff backend engineer, ML on product teams, Crack FAANG system design"
          />
        </div>
      )}

      {goalType === 'trending' && (
        <div className="ez-onb-field">
          <p className="ez-onb-label">Pick a role</p>
          <div className="ez-onb-roles">
            {trending?.map((r: { id: string; name: string; description: string; skills: string[] }) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRoleId(r.id)}
                className={`ez-onb-role card${selectedRoleId === r.id ? ' ez-onb-choice--active' : ''}`}
              >
                <div className="ez-onb-role__name">{r.name}</div>
                <div className="ez-onb-role__desc">{r.description}</div>
                {r.skills?.length > 0 ? (
                  <div className="ez-onb-role__skills">
                    {r.skills.slice(0, 5).map((s: string) => (
                      <span key={s} className="badge badge-info" style={{ fontSize: 11 }}>
                        {s}
                      </span>
                    ))}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="ez-onb-actions">
        {goalType !== 'resume' ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              setGoalMutation.isPending ||
              (goalType === 'manual' && !manualGoal.trim()) ||
              (goalType === 'trending' && !selectedRoleId)
            }
            className="btn btn-primary"
          >
            {setGoalMutation.isPending ? 'Saving…' : 'Continue to roadmap'}
          </button>
        ) : (
          <button type="button" onClick={() => navigate('/resume')} className="btn btn-primary">
            Continue to resume upload
          </button>
        )}
      </div>
    </div>
  );
}
