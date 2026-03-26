import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function VideoTutorialPage() {
  const queryClient = useQueryClient();
  const { data: videos, isLoading } = useQuery({
    queryKey: ['videos'],
    queryFn: async () => {
      const { data } = await api.get('/videos');
      return data;
    },
    refetchInterval: (query) => {
      const v = query.state.data as { status: string }[] | undefined;
      const hasGenerating = v?.some((x) => x.status === 'generating');
      return hasGenerating ? 8000 : false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (videoId: string) => {
      await api.delete(`/videos/${videoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['plan-days'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (videoId: string) => {
      await api.post(`/videos/${videoId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['plan-days'] });
    },
  });

  if (isLoading) {
    return (
      <div className="animate-fade-in" style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading videos...
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 style={{ color: 'var(--text-primary)', marginBottom: 8, fontSize: 28, fontWeight: 700 }}>
        Video Tutorial
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: 15 }}>
        Videos are generated from your Study Plan topics using the Varin Rust engine (storyboard renders).
      </p>

      <div className="card" style={{ padding: 24, marginBottom: 32, background: 'var(--accent-muted)', border: '1px solid var(--accent)' }}>
        <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: 15 }}>
          📚 Videos are tied to your Study Plan. Go to <Link to="/study" style={{ fontWeight: 600 }}>Study Roadmap</Link> to unlock topics and generate videos for each level.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
        {videos?.map((v: { id: string; topic: string; status: string; url?: string; captions_url?: string; progress_percent?: number; estimated_seconds_remaining?: number }) => (
          <div key={v.id} className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 14 }}>
            {v.status === 'completed' && v.url ? (
              <video
                controls
                style={{ width: '100%', aspectRatio: '16/9', background: '#000' }}
                src={`${API_BASE}${v.url}`}
              />
            ) : (
              <div
                style={{
                  aspectRatio: '16/9',
                  background: 'linear-gradient(135deg, var(--bg-active) 0%, var(--bg-elevated) 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  gap: 16,
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {v.status === 'generating' ? (
                  <>
                    <span style={{ fontSize: 14, textAlign: 'center', padding: '0 12px' }}>
                      {(v as { status_message?: string }).status_message ?? 'Generating video...'}
                    </span>
                    {typeof v.progress_percent === 'number' && (
                      <>
                        <div style={{ width: '80%', height: 8, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${v.progress_percent}%`, height: '100%', background: 'var(--gradient-accent)', borderRadius: 6, transition: 'width 0.5s' }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{v.progress_percent}%</span>
                        {v.estimated_seconds_remaining != null && v.estimated_seconds_remaining > 0 && (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            ~{Math.floor(v.estimated_seconds_remaining / 60)}:{String(v.estimated_seconds_remaining % 60).padStart(2, '0')} remaining
                          </span>
                        )}
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => cancelMutation.mutate(v.id)}
                      disabled={cancelMutation.isPending}
                      className="btn btn-ghost"
                      style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', border: '1px solid rgba(248,81,73,0.35)', marginTop: 4 }}
                    >
                      Stop generation
                    </button>
                  </>
                ) : v.status === 'failed' ? (
                  <span>{(v as { status_message?: string }).status_message?.toLowerCase().includes('cancel') ? 'Stopped' : 'Generation failed'}</span>
                ) : (
                  <span>—</span>
                )}
              </div>
            )}
            <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ minWidth: 0, flex: '1 1 160px' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{v.topic}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{v.status}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {v.status === 'completed' && v.captions_url && (
                  <a
                    href={`${API_BASE}${v.captions_url}`}
                    download={`${v.topic.replace(/\s+/g, '-')}-captions.srt`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Download SRT captions for TTS/audio generation"
                    style={{
                      fontSize: 12,
                      padding: '6px 12px',
                      color: 'var(--accent)',
                      textDecoration: 'none',
                      borderRadius: 8,
                      border: '1px solid rgba(88,166,255,0.3)',
                      background: 'rgba(88,166,255,0.08)',
                      fontWeight: 500,
                    }}
                  >
                    📄 Captions
                  </a>
                )}
                {(v.status === 'failed' || v.status === 'completed') && (
                <button
                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(v.id); }}
                  disabled={deleteMutation.isPending}
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: '6px 12px', color: v.status === 'failed' ? 'var(--danger)' : 'var(--text-muted)' }}
                >
                  {v.status === 'failed' ? 'Delete & clean residue' : 'Delete'}
                </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {(!videos || videos.length === 0) && (
        <div className="card" style={{ padding: 48, textAlign: 'center', borderStyle: 'dashed' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>🎬</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
            No videos yet. Create a Study Plan from <Link to="/goals">My Goals</Link> to get started.
          </p>
          <Link to="/study" className="btn btn-primary">Go to Study Roadmap</Link>
        </div>
      )}
    </div>
  );
}
