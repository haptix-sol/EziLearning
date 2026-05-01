import { useParams, useSearchParams } from 'react-router-dom';
import { DailyLessonVisualExplainer } from '../features/visualLesson/DailyLessonVisualExplainer';

export function DailyLessonVisualPage() {
  const { dayId } = useParams<{ dayId: string }>();
  const [searchParams] = useSearchParams();
  const topic = searchParams.get('topic') || '';
  const planId = searchParams.get('plan');

  if (!dayId) {
    return (
      <div className="ez-vlesson-app ez-vlesson-app--center" role="alert">
        <p className="ez-vlesson-page__err">Invalid day.</p>
      </div>
    );
  }

  return <DailyLessonVisualExplainer dayId={dayId} topic={topic} planId={planId} />;
}
