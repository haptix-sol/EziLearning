import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FileText, Pencil, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';

const DURATION_OPTIONS = [
  { days: 7, label: '1 Week', description: 'Quick prep' },
  { days: 14, label: '2 Weeks', description: 'Balanced' },
  { days: 30, label: '1 Month', description: 'Complete roadmap' },
];

interface AddGoalModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddGoalModal({ open, onClose }: AddGoalModalProps) {
  const [goalType, setGoalType] = useState<'manual' | 'trending' | 'resume'>('manual');
  const [manualGoal, setManualGoal] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [durationDays, setDurationDays] = useState<number>(7);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: trending } = useQuery({
    queryKey: ['trending-roles'],
    queryFn: async () => {
      const { data } = await api.get('/onboarding/trending');
      return data;
    },
    enabled: open && goalType === 'trending',
  });

  const setGoalMutation = useMutation({
    mutationFn: async (payload: { goal_type: string; goal_text?: string; target_role_id?: string; duration_days?: number }) => {
      const { data } = await api.post<{
        message: string;
        goal_id: string;
        study_plan_id: string | null;
        study_plan_error?: string | null;
      }>('/onboarding/goal', payload);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-goals'] });
      queryClient.invalidateQueries({ queryKey: ['study-plans'] });
      onClose();
      if (data?.study_plan_error) {
        const detail =
          data.study_plan_error.length > 500 ? `${data.study_plan_error.slice(0, 500)}…` : data.study_plan_error;
        window.alert(
          `Your goal was saved, but the day-by-day study plan could not be generated (this is usually an LLM/API issue on the server, not your form).\n\n${detail}`
        );
      }
      navigate('/growth?focus=goals');
    },
  });

  const handleSubmit = () => {
    if (goalType === 'manual' && manualGoal.trim()) {
      setGoalMutation.mutate({ goal_type: 'manual', goal_text: manualGoal.trim(), duration_days: durationDays });
    } else if (goalType === 'trending' && selectedRoleId) {
      setGoalMutation.mutate({ goal_type: 'trending', target_role_id: selectedRoleId, duration_days: durationDays });
    } else if (goalType === 'resume') {
      onClose();
      navigate('/resume');
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="card animate-slide-up"
        style={{
          maxWidth: 480,
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 28,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em' }}>Add New Goal</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {(['manual', 'trending', 'resume'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setGoalType(type)}
              className="card"
              style={{
                padding: 16,
                textAlign: 'left',
                border: `2px solid ${goalType === type ? 'var(--accent)' : 'var(--border)'}`,
                background: goalType === type ? 'var(--accent-muted)' : 'var(--bg-card)',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {type === 'manual' && (
                  <>
                    <Pencil size={16} strokeWidth={1.65} aria-hidden />
                    Set goal manually
                  </>
                )}
                {type === 'trending' && (
                  <>
                    <TrendingUp size={16} strokeWidth={1.65} aria-hidden />
                    Choose trending role
                  </>
                )}
                {type === 'resume' && (
                  <>
                    <FileText size={16} strokeWidth={1.65} aria-hidden />
                    Upload resume
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
        {goalType === 'manual' && (
          <input
            type="text"
            className="input"
            value={manualGoal}
            onChange={(e) => setManualGoal(e.target.value)}
            placeholder="e.g. Frontend Developer, Learn Python"
            style={{ width: '100%', marginBottom: 20 }}
          />
        )}
        {goalType === 'trending' && (
          <div style={{ maxHeight: 200, overflow: 'auto', marginBottom: 20 }}>
            {trending?.map((r: { id: string; name: string }) => (
              <button
                key={r.id}
                onClick={() => setSelectedRoleId(r.id)}
                className="card"
                style={{
                  width: '100%',
                  padding: 12,
                  marginBottom: 8,
                  textAlign: 'left',
                  border: `2px solid ${selectedRoleId === r.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: selectedRoleId === r.id ? 'var(--accent-muted)' : 'var(--bg-card)',
                  cursor: 'pointer',
                }}
              >
                {r.name}
              </button>
            ))}
          </div>
        )}
        {(goalType === 'manual' || goalType === 'trending') && (
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ color: 'var(--text-primary)', margin: '0 0 12px', fontSize: 13, fontWeight: 600 }}>Study plan duration</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => setDurationDays(opt.days)}
                  className="card"
                  style={{
                    padding: 16,
                    textAlign: 'left',
                    border: `2px solid ${durationDays === opt.days ? 'var(--accent)' : 'var(--border)'}`,
                    background: durationDays === opt.days ? 'var(--accent-muted)' : 'var(--bg-card)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{opt.label}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>{opt.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={
              setGoalMutation.isPending ||
              (goalType === 'manual' && !manualGoal.trim()) ||
              (goalType === 'trending' && !selectedRoleId)
            }
            className="btn btn-primary"
          >
            {setGoalMutation.isPending ? 'Setting...' : goalType === 'resume' ? 'Go to Resume' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
