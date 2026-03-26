import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function NotesPage() {
  const queryClient = useQueryClient();
  const { data: notes, isLoading } = useQuery({
    queryKey: ['study-notes'],
    queryFn: async () => {
      const { data } = await api.get('/study/notes');
      return data;
    },
  });

  const openNote = (dayId: string) => {
    window.open(`${API_BASE}/study/days/${dayId}/notes/view`, '_blank', 'noopener,noreferrer');
  };

  const deleteNotesMutation = useMutation({
    mutationFn: (dayId: string) => api.delete(`/study/days/${dayId}/notes`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-notes'] });
    },
  });

  const handleDeleteNotes = (e: React.MouseEvent, dayId: string) => {
    e.stopPropagation();
    if (window.confirm('Delete notes for this day? They will be regenerated when you view again.')) {
      deleteNotesMutation.mutate(dayId);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-fade-in" style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading notes...
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 style={{ color: 'var(--text-primary)', marginBottom: 8, fontSize: 28, fontWeight: 700 }}>
        Notes
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: 15 }}>
        Generated study notes from your plan. View only — not downloadable.
      </p>

      {!notes?.length ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', borderStyle: 'dashed' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📝</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
            No notes yet. Create a Study Plan and complete days to generate notes.
          </p>
          <Link to="/study" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Go to Study Plan
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {notes.map((n: { id: string; day_number: number; title: string; topics: string[] }) => (
            <div
              key={n.id}
              className="card animate-slide-up"
              style={{
                padding: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
              onClick={() => openNote(n.id)}
            >
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Day {n.day_number}: {n.title}
                </div>
                {n.topics?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {n.topics.map((t: string) => (
                      <span key={t} className="badge badge-info" style={{ fontSize: 11 }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={(e) => handleDeleteNotes(e, n.id)}
                  disabled={deleteNotesMutation.isPending}
                  className="btn btn-ghost"
                  style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 12px' }}
                  title="Delete notes (will regenerate on next view)"
                >
                  🗑️ Delete
                </button>
                <span style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 500 }}>View →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
