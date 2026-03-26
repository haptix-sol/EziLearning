import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

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
      <div className="animate-fade-in" style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>You've already set your goal.</p>
        <button onClick={() => navigate('/roadmap')} className="btn btn-primary">
          Go to Roadmap
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ color: 'var(--text-primary)', marginBottom: 8, fontSize: 28, fontWeight: 700 }}>
        Set Your Learning Goal
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: 15 }}>
        Choose how you'd like to get started
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
        {(['manual', 'trending', 'resume'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setGoalType(type)}
            className="card"
            style={{
              padding: 20,
              textAlign: 'left',
              border: `2px solid ${goalType === type ? 'var(--accent)' : 'var(--border)'}`,
              background: goalType === type ? 'var(--accent-muted)' : 'var(--bg-card)',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
              {type === 'manual' && '✏️ Set goal manually'}
              {type === 'trending' && '📈 Choose from trending roles'}
              {type === 'resume' && '📄 Upload resume for skill gap analysis'}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 6 }}>
              {type === 'manual' && 'Enter what you want to learn or become'}
              {type === 'trending' && 'Pick a role based on current market demand'}
              {type === 'resume' && 'We\'ll analyze your resume and suggest a path'}
            </div>
          </button>
        ))}
      </div>

      {goalType === 'manual' && (
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>
            Your goal
          </label>
          <input
            type="text"
            className="input"
            value={manualGoal}
            onChange={(e) => setManualGoal(e.target.value)}
            placeholder="e.g. Frontend Developer, Data Scientist, Learn Python"
            style={{ width: '100%' }}
          />
        </div>
      )}

      {goalType === 'trending' && (
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 12, fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>
            Select a role
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {trending?.map((r: { id: string; name: string; description: string; skills: string[] }) => (
              <button
                key={r.id}
                onClick={() => setSelectedRoleId(r.id)}
                className="card"
                style={{
                  padding: 16,
                  textAlign: 'left',
                  border: `2px solid ${selectedRoleId === r.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: selectedRoleId === r.id ? 'var(--accent-muted)' : 'var(--bg-card)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{r.description}</div>
                {r.skills?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {r.skills.slice(0, 5).map((s: string) => (
                      <span key={s} className="badge badge-info" style={{ fontSize: 11 }}>{s}</span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        {goalType !== 'resume' && (
          <button
            onClick={handleSubmit}
            disabled={
              setGoalMutation.isPending ||
              (goalType === 'manual' && !manualGoal.trim()) ||
              (goalType === 'trending' && !selectedRoleId)
            }
            className="btn btn-primary"
          >
            {setGoalMutation.isPending ? 'Setting...' : 'Continue'}
          </button>
        )}
        {goalType === 'resume' && (
          <button onClick={() => navigate('/resume')} className="btn btn-primary">
            Go to Resume Upload
          </button>
        )}
      </div>
    </div>
  );
}
