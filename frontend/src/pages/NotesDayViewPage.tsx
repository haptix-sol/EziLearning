import { useCallback, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { SkeletonLine, SkeletonLineLg } from '../components/ui/Skeleton';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type NotesRendered = { title: string; html: string; animation_url?: string | null };

export function NotesDayViewPage() {
  const { dayId } = useParams<{ dayId: string }>();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('plan') || '';

  const prepare = useQuery({
    queryKey: ['notes-prepare', dayId],
    queryFn: async () => {
      if (!dayId) throw new Error('missing day');
      const { data } = await api.post<{ day_id: string; cached: boolean }>(`/study/days/${dayId}/notes/build`);
      return data;
    },
    enabled: !!dayId,
    staleTime: Infinity,
    retry: 1,
  });

  const rendered = useQuery({
    queryKey: ['notes-rendered', dayId],
    queryFn: async () => {
      if (!dayId) throw new Error('missing day');
      const { data } = await api.get<NotesRendered>(`/study/days/${dayId}/notes/rendered`);
      return data;
    },
    enabled: !!dayId && prepare.isSuccess,
    staleTime: 60_000,
  });

  const blockContext = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const blockClipboard = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S')) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const studyHref = planId
    ? `/study?plan=${encodeURIComponent(planId)}&day=${encodeURIComponent(dayId || '')}`
    : `/study?day=${encodeURIComponent(dayId || '')}`;

  if (!dayId) {
    return (
      <div className="animate-fade-in ez-page-zone">
        <PageHeader title="Notes" description="Missing day." />
        <Link to="/study" className="btn btn-primary">
          Back to study
        </Link>
      </div>
    );
  }

  if (prepare.isError || rendered.isError) {
    return (
      <div className="animate-fade-in ez-page-zone">
        <PageHeader title="Notes" description="Could not load notes." />
        <Link to={studyHref} className="btn btn-primary">
          Back to study
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in ez-page-zone">
      <PageHeader
        title={rendered.data?.title || 'Study notes'}
        description="In-app reader. Browsers cannot fully block screenshots or every save path; this view hides obvious export and blunts casual copying."
        actions={
          <Link to={studyHref} className="btn btn-ghost btn-sm">
            Back to study
          </Link>
        }
      />
      {prepare.isPending || rendered.isPending ? (
        <div aria-busy="true">
          <SkeletonLineLg />
          <SkeletonLine />
          <SkeletonLine />
        </div>
      ) : (
        <div
          className="card ez-notes-secure"
          onContextMenu={blockContext}
          onCopy={blockClipboard}
          onCut={blockClipboard}
          role="article"
          aria-label="Study notes"
        >
          {rendered.data?.animation_url ? (
            <div className="ez-notes-secure__media">
              <h3 className="ez-notes-secure__media-title">Animated explanation</h3>
              <video
                controls
                className="ez-notes-secure__video"
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                onContextMenu={blockContext}
              >
                <source src={`${API_BASE}${rendered.data.animation_url}`} type="video/mp4" />
              </video>
            </div>
          ) : null}
          <div
            className="ez-notes-secure__inner"
            dangerouslySetInnerHTML={{ __html: rendered.data?.html || '' }}
          />
        </div>
      )}
    </div>
  );
}
