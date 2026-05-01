import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Sparkles } from 'lucide-react';
import { api, type DayPlan, type StudyPlan } from '../lib/api';

type OnboardingStatus = { has_goal?: boolean };

/**
 * Primary “what’s next” CTA in the top bar — replaces placeholder search.
 */
export function ContinueStrip() {
  const { data: onboarding } = useQuery<OnboardingStatus>({
    queryKey: ['onboarding-status'],
    queryFn: async () => {
      const { data } = await api.get('/onboarding/status');
      return data;
    },
  });

  const { data: plans } = useQuery<StudyPlan[]>({
    queryKey: ['study-plans'],
    queryFn: async () => {
      const { data } = await api.get('/study/plans');
      return data;
    },
  });

  const primaryPlanId = plans?.[0]?.id ?? null;

  const { data: days, isPending: daysPending } = useQuery<DayPlan[]>({
    queryKey: ['plan-days', primaryPlanId],
    queryFn: async () => {
      const { data } = await api.get(`/study/plans/${primaryPlanId}/days`);
      return data;
    },
    enabled: !!primaryPlanId,
  });

  if (onboarding && !onboarding.has_goal) {
    return (
      <div className="ez-continue">
        <Link to="/onboarding" className="ez-continue__link" aria-label="Choose your learning goal">
          <span className="ez-continue__kicker">Next step</span>
          <span className="ez-continue__body">
            <span className="ez-continue__title">Choose your goal</span>
            <span className="ez-continue__sub">We’ll shape your roadmap and daily levels around it</span>
          </span>
          <Sparkles size={14} strokeWidth={1.6} className="ez-continue__chev" aria-hidden />
        </Link>
      </div>
    );
  }

  if (!plans?.length) {
    return (
      <div className="ez-continue">
        <Link to="/roadmap" className="ez-continue__link" aria-label="Open your roadmap">
          <span className="ez-continue__kicker">Next step</span>
          <span className="ez-continue__body">
            <span className="ez-continue__title">Open your roadmap</span>
            <span className="ez-continue__sub">See your topic path and generate a study plan when you’re ready</span>
          </span>
          <ChevronRight size={14} strokeWidth={1.75} className="ez-continue__chev" aria-hidden />
        </Link>
      </div>
    );
  }

  if (primaryPlanId && daysPending) {
    return (
      <div className="ez-continue" aria-busy="true">
        <div
          className="ez-continue__link"
          style={{ cursor: 'default', pointerEvents: 'none', opacity: 0.85 }}
        >
          <span className="ez-continue__kicker">Continue</span>
          <span className="ez-continue__body">
            <span className="ez-continue__title">Loading your next day…</span>
            <span className="ez-continue__sub">One moment</span>
          </span>
        </div>
      </div>
    );
  }

  const nextDay = days?.find((d) => !d.is_completed);
  const planId = primaryPlanId!;

  if (nextDay) {
    const href = `/study?plan=${encodeURIComponent(planId)}&day=${encodeURIComponent(nextDay.id)}`;
    return (
      <div className="ez-continue">
        <Link to={href} className="ez-continue__link" aria-label={`Continue day ${nextDay.day_number}: ${nextDay.title}`}>
          <span className="ez-continue__kicker">Continue</span>
          <span className="ez-continue__body">
            <span className="ez-continue__title">
              Day {nextDay.day_number}: {nextDay.title}
            </span>
            <span className="ez-continue__sub">Pick up your daily level in the study plan</span>
          </span>
          <ChevronRight size={14} strokeWidth={1.75} className="ez-continue__chev" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div className="ez-continue">
      <Link to="/roadmap" className="ez-continue__link" aria-label="Plan your next stretch">
        <span className="ez-continue__kicker">Nice</span>
        <span className="ez-continue__body">
          <span className="ez-continue__title">You’re caught up on this plan</span>
          <span className="ez-continue__sub">Review the roadmap or add your next career milestone</span>
        </span>
        <ChevronRight size={17} strokeWidth={1.75} className="ez-continue__chev" aria-hidden />
      </Link>
    </div>
  );
}
