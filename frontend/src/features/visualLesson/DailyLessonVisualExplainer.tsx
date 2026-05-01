import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { VisualLessonManifest } from './types';
import { LessonSlidePlayer } from './LessonSlidePlayer';

type Props = {
  dayId: string;
  topic: string;
  planId: string | null;
};

export function DailyLessonVisualExplainer({ dayId, topic, planId }: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const backHref = `/study?plan=${encodeURIComponent(planId || '')}&day=${encodeURIComponent(dayId)}`;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['visual-lesson', dayId, topic],
    queryFn: async () => {
      const { data: m } = await api.get<VisualLessonManifest>(`/study/days/${dayId}/visual-lesson`, { params: { topic } });
      return m;
    },
    enabled: Boolean(dayId && topic),
  });

  const onComplete = () => {
    if (planId) {
      queryClient.invalidateQueries({ queryKey: ['plan-days', planId] });
    } else {
      queryClient.invalidateQueries({ queryKey: ['plan-days'] });
    }
    queryClient.invalidateQueries({ queryKey: ['level'] });
    navigate(backHref);
  };

  if (!topic) {
    return (
      <div className="ez-vlesson-app ez-vlesson-app--center" role="alert">
        <p className="ez-vlesson-page__err">
          Missing topic. Return to your study plan and open a topic from the day card.
        </p>
        <Link to={backHref} className="btn btn-primary btn-sm">
          Back to study plan
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="ez-vlesson-app ez-vlesson-app--center" aria-busy="true">
        <div className="ez-vlesson-page__spinner" />
        <p className="ez-vlesson-page__loading">Preparing your guided lesson…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="ez-vlesson-app ez-vlesson-app--center" role="alert">
        <p className="ez-vlesson-page__err">{(error as Error)?.message || 'Could not load this visual lesson.'}</p>
        <Link to={backHref} className="btn btn-primary btn-sm">
          Back to study plan
        </Link>
      </div>
    );
  }

  return (
    <div className="ez-vlesson-app">
      <header className="ez-vlesson-app__toolbar">
        <Link to={backHref} className="ez-vlesson-page__back">
          ← Back to day
        </Link>
        <div className="ez-vlesson-page__meta">
          <span className="ez-vlesson-page__pill">{data.lesson_type}</span>
          <span className="ez-vlesson-page__muted">{data.day_context}</span>
        </div>
      </header>
      <div className="ez-vlesson-app__body">
        <LessonSlidePlayer dayId={dayId} manifest={data} onComplete={onComplete} />
      </div>
    </div>
  );
}
