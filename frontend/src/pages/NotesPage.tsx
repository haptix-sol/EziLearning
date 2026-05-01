import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StickyNote, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonLine, SkeletonLineLg } from '../components/ui/Skeleton';

export function NotesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: notes, isLoading } = useQuery({
    queryKey: ['study-notes'],
    queryFn: async () => {
      const { data } = await api.get('/study/notes');
      return data;
    },
  });

  const openNote = async (dayId: string) => {
    await api.post(`/study/days/${dayId}/notes/build`);
    navigate(`/study/notes/${dayId}`);
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
      <div className="animate-fade-in ez-page-zone" aria-busy="true">
        <PageHeader title="Notes" description="Loading your generated study notes…" />
        <SkeletonLineLg />
        <SkeletonLine />
        <SkeletonLine />
      </div>
    );
  }

  return (
    <div className="animate-fade-in ez-page-zone">
      <PageHeader
        title="Notes"
        description="Generated study notes open inside the app in a focused reader after they are built for that day."
      />

      {!notes?.length ? (
        <EmptyState
          icon={<StickyNote size={48} strokeWidth={1.25} aria-hidden />}
          title="No notes yet"
          description="Create a study plan and work through days—notes are generated as you open each day’s topics."
          action={
            <Link to="/study" className="btn btn-primary">
              Open study plan
            </Link>
          }
        />
      ) : null}

      {notes && notes.length > 0 ? (
        <>
          <div style={{ marginBottom: 20 }}>
            <Link to="/study" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
              Back to study plan
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {notes.map((n: { id: string; day_number: number; title: string; topics: string[] }) => (
              <div
                key={n.id}
                className="card card-interactive animate-slide-up"
                style={{
                  padding: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  void openNote(n.id);
                }}
              >
                <div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Day {n.day_number}: {n.title}
                  </div>
                  {n.topics?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {n.topics.map((t: string) => (
                        <span key={t} className="badge badge-info" style={{ fontSize: 11 }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteNotes(e, n.id)}
                    disabled={deleteNotesMutation.isPending}
                    className="btn btn-ghost"
                    style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 12px' }}
                    title="Delete notes (will regenerate on next view)"
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Trash2 size={15} strokeWidth={1.75} aria-hidden />
                      Delete
                    </span>
                  </button>
                  <span style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 500 }}>View →</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
