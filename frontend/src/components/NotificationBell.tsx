import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: videos } = useQuery({
    queryKey: ['videos'],
    queryFn: async () => {
      const { data } = await api.get('/videos');
      return data;
    },
    refetchInterval: (query) => {
      const v = query.state.data as { status: string }[] | undefined;
      const hasGenerating = v?.some((x) => x.status === 'generating');
      return hasGenerating ? 4000 : false;
    },
  });

  const generating = (videos ?? []).filter((v: { status: string }) => v.status === 'generating');
  const hasGenerating = generating.length > 0;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: hasGenerating ? 'var(--brand-muted)' : 'var(--bg-elevated)',
          color: hasGenerating ? 'var(--brand)' : 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 18,
          marginRight: 12,
        }}
        title={hasGenerating ? 'Video generating' : 'Notifications'}
      >
        🔔
        {hasGenerating && (
          <span
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--brand)',
              animation: 'pulse-glow 1s ease-in-out infinite',
            }}
          />
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            minWidth: 320,
            maxWidth: 400,
            padding: 20,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-lg)',
            zIndex: 100,
          }}
        >
          {hasGenerating ? (
            <>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, fontSize: 15 }}>
                Video generation started
              </div>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
                You can leave this page and study the notes. The video will continue generating in the background.
              </p>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {generating.map((v: { id: string; topic: string; progress_percent?: number; status_message?: string; segments_done?: number; segments_total?: number }) => (
                  <div
                    key={v.id}
                    style={{
                      padding: 12,
                      background: 'var(--brand-muted)',
                      borderRadius: 8,
                      fontSize: 13,
                      color: 'var(--text-primary)',
                    }}
                  >
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>{v.topic}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {v.segments_done != null && v.segments_total != null && v.segments_total > 0
                          ? `Segments: ${v.segments_done}/${v.segments_total}`
                          : (v.status_message ?? 'Generating...')}
                      </span>
                      {typeof v.progress_percent === 'number' && (
                        <span style={{ color: 'var(--brand)', fontWeight: 600, fontSize: 12 }}>
                          {v.progress_percent}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Link
                to="/notes"
                onClick={() => setOpen(false)}
                style={{
                  display: 'inline-block',
                  marginTop: 16,
                  color: 'var(--brand)',
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Study notes →
              </Link>
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No active notifications</div>
          )}
        </div>
      )}
    </div>
  );
}
