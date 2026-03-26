import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  api,
  type StudyPlan as StudyPlanType,
  type DayPlan,
  type LevelProgress,
  type TopicVideoStatus,
  type Mcq,
  type EarnedBadge,
} from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Per-day + topic so the same topic title on different days does not share generating UI. */
function topicGenKey(dayId: string, topic: string) {
  return `${dayId}:${topic}`;
}

function isCancelledVideo(tv: TopicVideoStatus): boolean {
  return (
    tv.status === 'failed' &&
    (tv.status_message?.toLowerCase().includes('cancel') ?? false)
  );
}

export function StudyPlanPage() {
  const [searchParams] = useSearchParams();
  const planFromUrl = searchParams.get('plan');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null);
  /** Set of `topicGenKey(dayId, topic)` — optimistic / in-flight generation per day row. */
  const [generatingTopics, setGeneratingTopics] = useState<Set<string>>(new Set());
  const [countdownByTopic, setCountdownByTopic] = useState<Record<string, number>>({});
  const [videoStyleModal, setVideoStyleModal] = useState<{ day: DayPlan; topic: string } | null>(null);
  const [generatingVideos, setGeneratingVideos] = useState<Map<string, { dayId: string; topic: string }>>(new Map());
  const queryClient = useQueryClient();

  const { data: videoStyleOptions } = useQuery({
    queryKey: ['video-style-options'],
    queryFn: async () => {
      const { data } = await api.get('/study/video-style-options');
      return data;
    },
  });

  const { data: plans } = useQuery<StudyPlanType[]>({
    queryKey: ['study-plans'],
    queryFn: async () => {
      const { data } = await api.get('/study/plans');
      return data;
    },
  });

  const { data: level } = useQuery<LevelProgress>({
    queryKey: ['level'],
    queryFn: async () => {
      const { data } = await api.get('/study/level');
      return data;
    },
  });

  const { data: badges } = useQuery<{ badges: EarnedBadge[] }>({
    queryKey: ['study-badges'],
    queryFn: async () => {
      const { data } = await api.get('/study/badges');
      return data;
    },
  });

  const { data: days, isLoading: daysLoading } = useQuery<DayPlan[]>({
    queryKey: ['plan-days', selectedPlanId],
    queryFn: async () => {
      const { data } = await api.get(`/study/plans/${selectedPlanId}/days`);
      return data;
    },
    enabled: !!selectedPlanId,
  });

  const { data: mcqs, refetch: refetchMcqs } = useQuery<Mcq[]>({
    queryKey: ['day-mcqs', expandedDayId],
    queryFn: async () => {
      if (!expandedDayId) return [];
      const { data } = await api.get(`/study/days/${expandedDayId}/mcqs`);
      return data;
    },
    enabled: !!expandedDayId,
  });

  useEffect(() => {
    if (!plans?.length) return;
    const validFromUrl = planFromUrl && plans.some((p) => p.id === planFromUrl);
    setSelectedPlanId((prev) => {
      if (validFromUrl) return planFromUrl;
      if (!prev || !plans.some((p) => p.id === prev)) return plans[0].id;
      return prev;
    });
  }, [plans, planFromUrl]);

  // Sync generatingVideos from days when we have generating videos (e.g. after page refresh)
  useEffect(() => {
    if (!days || generatingVideos.size > 0) return;
    const toAdd: [string, { dayId: string; topic: string }][] = [];
    const keys = new Set<string>();
    days.forEach((d) => {
      d.topic_videos?.forEach((tv) => {
        if (tv.status === 'generating' && tv.video_id && !tv.video_id.startsWith('static-')) {
          toAdd.push([tv.video_id, { dayId: d.id, topic: tv.topic }]);
          keys.add(topicGenKey(d.id, tv.topic));
        }
      });
    });
    if (toAdd.length > 0) {
      setGeneratingVideos((m) => {
        const next = new Map(m);
        toAdd.forEach(([id, meta]) => next.set(id, meta));
        return next;
      });
      setGeneratingTopics((prev) => new Set([...prev, ...keys]));
    }
  }, [days, generatingVideos.size]);

  // Poll lightweight video status endpoint instead of full plan-days (reduces API load)
  const hasGenerating = generatingVideos.size > 0;
  useEffect(() => {
    if (!hasGenerating || !selectedPlanId) return;
    const poll = async () => {
      for (const [videoId, { dayId, topic }] of generatingVideos) {
        try {
          const { data } = await api.get(`/videos/${videoId}/status`);
          queryClient.setQueryData<DayPlan[]>(['plan-days', selectedPlanId], (prev) => {
            if (!prev) return prev;
            return prev.map((d) => {
              if (d.id !== dayId) return d;
              const tvs = (d.topic_videos ?? []).map((tv) =>
                tv.topic === topic
                  ? {
                      ...tv,
                      video_id: data.id,
                      status: data.status,
                      progress_percent: data.progress_percent ?? tv.progress_percent,
                      status_message: data.status_message ?? tv.status_message,
                      segments_done: data.segments_done ?? tv.segments_done,
                      segments_total: data.segments_total ?? tv.segments_total,
                      url: data.url ?? tv.url,
                      captions_url: data.captions_url ?? tv.captions_url,
                      estimated_seconds_remaining: data.estimated_seconds_remaining ?? tv.estimated_seconds_remaining,
                    }
                  : tv
              );
              return { ...d, topic_videos: tvs };
            });
          });
          if (data.status === 'completed' || data.status === 'failed') {
            setGeneratingVideos((m) => {
              const next = new Map(m);
              next.delete(videoId);
              return next;
            });
            setGeneratingTopics((prev) => new Set([...prev].filter((k) => k !== topicGenKey(dayId, topic))));
            queryClient.invalidateQueries({ queryKey: ['videos'] });
          } else if (data.estimated_seconds_remaining != null && data.estimated_seconds_remaining > 0) {
            setCountdownByTopic((prev) => ({ ...prev, [`${dayId}:${topic}`]: data.estimated_seconds_remaining }));
          }
        } catch {
          // Keep polling on transient errors
        }
      }
    };
    poll();
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [hasGenerating, selectedPlanId, queryClient, generatingVideos]);

  // Countdown timer for generating videos
  useEffect(() => {
    const topics = new Set<string>();
    days?.forEach((d) =>
      d.topic_videos?.forEach((tv) => {
        if (tv.status === 'generating' && (tv.estimated_seconds_remaining ?? 0) > 0) {
          topics.add(`${d.id}:${tv.topic}`);
        }
      })
    );
    if (topics.size === 0) return;
    const interval = setInterval(() => {
      setCountdownByTopic((prev) => {
        const next: Record<string, number> = {};
        let changed = false;
        for (const key of Object.keys(prev)) {
          const v = prev[key] - 1;
          if (v > 0) {
            next[key] = v;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [days]);

  // Sync countdown from API when we get new data (API is source of truth)
  useEffect(() => {
    const updates: Record<string, number> = {};
    days?.forEach((d) =>
      d.topic_videos?.forEach((tv) => {
        if (tv.status === 'generating' && tv.estimated_seconds_remaining != null && tv.estimated_seconds_remaining > 0) {
          updates[`${d.id}:${tv.topic}`] = tv.estimated_seconds_remaining;
        }
      })
    );
    setCountdownByTopic((prev) => {
      const next = { ...prev, ...updates };
      for (const key of Object.keys(next)) {
        if (!(key in updates)) delete next[key];
      }
      return next;
    });
  }, [days]);

  const completeMutation = useMutation({
    mutationFn: async (dayId: string) => {
      const { data } = await api.post(`/study/days/${dayId}/complete`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-days', selectedPlanId] });
      queryClient.invalidateQueries({ queryKey: ['study-plans'] });
      queryClient.invalidateQueries({ queryKey: ['level'] });
      queryClient.invalidateQueries({ queryKey: ['study-badges'] });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      await api.delete(`/study/plans/${planId}`);
    },
    onSuccess: (_, planId) => {
      if (selectedPlanId === planId) setSelectedPlanId(null);
      queryClient.invalidateQueries({ queryKey: ['study-plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan-days'] });
      queryClient.invalidateQueries({ queryKey: ['study-notes'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-goals'] });
    },
  });

  const deleteAllPlansMutation = useMutation({
    mutationFn: async () => {
      await api.delete('/study/plans/all');
    },
    onSuccess: () => {
      setSelectedPlanId(null);
      queryClient.invalidateQueries({ queryKey: ['study-plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan-days'] });
      queryClient.invalidateQueries({ queryKey: ['study-notes'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-goals'] });
    },
  });

  const deleteVideoMutation = useMutation({
    mutationFn: async (videoId: string) => {
      await api.delete(`/videos/${videoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-days', selectedPlanId] });
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });

  const cancelVideoMutation = useMutation({
    mutationFn: async (vars: { videoId: string; dayId: string; topic: string }) => {
      const { data } = await api.post<{ ok: boolean; status?: string; status_message?: string }>(
        `/videos/${vars.videoId}/cancel`
      );
      return { ...vars, ...data };
    },
    onSuccess: (res) => {
      const { videoId, dayId, topic, ok, status_message: msg } = res;
      if (ok) {
        const gk = topicGenKey(dayId, topic);
        setGeneratingVideos((m) => {
          const next = new Map(m);
          next.delete(videoId);
          return next;
        });
        setGeneratingTopics((prev) => new Set([...prev].filter((k) => k !== gk)));
        if (selectedPlanId) {
          queryClient.setQueryData<DayPlan[]>(['plan-days', selectedPlanId], (prev) => {
            if (!prev) return prev;
            return prev.map((d) => {
              if (d.id !== dayId) return d;
              const tvs = (d.topic_videos ?? []).map((tv) =>
                tv.topic === topic
                  ? {
                      ...tv,
                      status: 'failed' as const,
                      progress_percent: 0,
                      status_message: msg ?? 'Cancelled by user',
                      estimated_seconds_remaining: undefined,
                      segments_done: undefined,
                      segments_total: undefined,
                    }
                  : tv
              );
              return { ...d, topic_videos: tvs };
            });
          });
        }
        setCountdownByTopic((prev) => {
          const next = { ...prev };
          delete next[`${dayId}:${topic}`];
          return next;
        });
      }
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['plan-days', selectedPlanId] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['plan-days', selectedPlanId] });
    },
  });

  const deleteNotesMutation = useMutation({
    mutationFn: (dayId: string) => api.delete(`/study/days/${dayId}/notes`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-days', selectedPlanId] });
      queryClient.invalidateQueries({ queryKey: ['study-notes'] });
    },
  });

  const generateVideoMutation = useMutation({
    mutationFn: async ({ dayId, topic, videoStyle }: { dayId: string; topic: string; videoStyle: string }) => {
      const { data } = await api.post(`/study/days/${dayId}/generate-video`, { topic, video_style: videoStyle });
      return data;
    },
    onMutate: ({ dayId, topic }) => {
      setGeneratingTopics((prev) => new Set([...prev, topicGenKey(dayId, topic)]));
    },
    onSuccess: (data, { dayId, topic }) => {
      setVideoStyleModal(null);
      const key = topicGenKey(dayId, topic);
      const videoId = data?.id;
      if (videoId && String(videoId).startsWith('static-')) {
        setGeneratingTopics((prev) => new Set([...prev].filter((k) => k !== key)));
        queryClient.invalidateQueries({ queryKey: ['plan-days', selectedPlanId] });
        queryClient.invalidateQueries({ queryKey: ['videos'] });
        return;
      }
      const est = data?.estimated_seconds_remaining ?? 300;
      setCountdownByTopic((prev) => ({ ...prev, [`${dayId}:${topic}`]: est }));
      if (videoId && !String(videoId).startsWith('static-')) {
        setGeneratingVideos((m) => new Map(m).set(videoId, { dayId, topic }));
        queryClient.setQueryData<DayPlan[]>(['plan-days', selectedPlanId], (prev) => {
          if (!prev) return prev;
          return prev.map((d) => {
            if (d.id !== dayId) return d;
            const tvs = (d.topic_videos ?? []).map((tv) =>
              tv.topic === topic
                ? {
                    ...tv,
                    video_id: videoId,
                    status: 'generating' as const,
                    progress_percent: data?.progress_percent ?? 0,
                    status_message: (data as { status_message?: string })?.status_message ?? 'Queued — Varin pipeline…',
                    url: null,
                    estimated_seconds_remaining: est,
                  }
                : tv
            );
            return { ...d, topic_videos: tvs };
          });
        });
      } else {
        setGeneratingTopics((prev) => new Set([...prev].filter((k) => k !== key)));
        queryClient.invalidateQueries({ queryKey: ['plan-days', selectedPlanId] });
      }
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
    onError: (_, { dayId, topic }) => {
      setVideoStyleModal(null);
      setGeneratingTopics((prev) => new Set([...prev].filter((k) => k !== topicGenKey(dayId, topic))));
    },
  });

  const submitMcqMutation = useMutation({
    mutationFn: async ({
      dayId,
      mcqId,
      selectedOptionId,
    }: {
      dayId: string;
      mcqId: string;
      selectedOptionId: string;
    }) => {
      const { data } = await api.post(`/study/days/${dayId}/mcqs/${mcqId}/answer`, {
        selected_option_id: selectedOptionId,
      });
      return data;
    },
    onSuccess: (_, { dayId }) => {
      refetchMcqs();
      queryClient.invalidateQueries({ queryKey: ['day-mcqs', dayId] });
      queryClient.invalidateQueries({ queryKey: ['level'] });
    },
  });

  const openNotesView = (dayId: string) => {
    window.open(`${API_BASE}/study/days/${dayId}/notes/view`, '_blank', 'noopener,noreferrer');
  };

  const handleVideoClick = (day: DayPlan, tv: TopicVideoStatus) => {
    if (tv.status === 'completed' && tv.url) {
      const videoUrl = tv.video_id?.startsWith('static-')
        ? `${API_BASE}/animations/${tv.video_id.replace('static-', '')}`
        : `${API_BASE}${tv.url}`;
      window.open(videoUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (tv.status === 'none' || tv.status === 'failed') {
      setVideoStyleModal({ day, topic: tv.topic });
    }
  };

  const startVideoGeneration = (videoStyle: string) => {
    if (!videoStyleModal) return;
    generateVideoMutation.mutate({
      dayId: videoStyleModal.day.id,
      topic: videoStyleModal.topic,
      videoStyle,
    });
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 920, margin: '0 auto', padding: '0 16px' }}>
      {level && (
        <div
          className="card animate-slide-up"
          style={{
            marginBottom: 32,
            padding: 28,
            background: 'linear-gradient(135deg, rgba(26,35,50,0.95) 0%, rgba(13,17,23,0.98) 100%)',
            border: '1px solid rgba(88,166,255,0.2)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(88,166,255,0.05)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.02em' }}>
                Level {level.level}
              </span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 15, fontWeight: 500 }}>
                {level.xp} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/ {level.xp_to_next_level} XP</span>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '10px 18px',
                  background: 'rgba(240, 136, 62, 0.12)',
                  borderRadius: 12,
                  color: '#f0883e',
                  fontSize: 14,
                  fontWeight: 600,
                  border: '1px solid rgba(240,136,62,0.25)',
                }}
              >
                🔥 {level.streak_days} day streak
              </span>
              {badges?.badges?.map((b) => (
                <span
                  key={b.goal_id}
                  style={{
                    padding: '10px 18px',
                    background: 'rgba(63, 185, 80, 0.12)',
                    borderRadius: 12,
                    color: 'var(--success)',
                    fontSize: 13,
                    fontWeight: 600,
                    border: '1px solid rgba(63,185,80,0.25)',
                  }}
                >
                  🏆 {b.role_name}
                </span>
              ))}
            </div>
          </div>
          <div style={{ height: 10, background: 'rgba(48,54,61,0.6)', borderRadius: 10, overflow: 'hidden' }}>
            <div
              style={{
                width: `${level.progress_percent}%`,
                height: '100%',
                background: 'var(--gradient-accent)',
                borderRadius: 10,
                transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                boxShadow: '0 0 20px rgba(88,166,255,0.3)',
              }}
            />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '0 0 240px', minWidth: 200 }}>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: 20, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Study Plan
          </h2>
          {plans && plans.length > 0 ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your plans</span>
                <button
                  onClick={() =>
                    window.confirm('Delete all plans? Linked goals will also be deleted.') &&
                    deleteAllPlansMutation.mutate()
                  }
                  disabled={deleteAllPlansMutation.isPending}
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '6px 12px', color: 'var(--danger)', opacity: 0.8 }}
                >
                  Clear all
                </button>
              </div>
              {plans.map((p) => (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 16,
                    marginBottom: 10,
                    background: selectedPlanId === p.id ? 'rgba(88,166,255,0.08)' : 'var(--bg-card)',
                    border: `1px solid ${selectedPlanId === p.id ? 'rgba(88,166,255,0.4)' : 'var(--border)'}`,
                    cursor: 'pointer',
                    borderRadius: 12,
                    transition: 'all 0.2s ease',
                    boxShadow: selectedPlanId === p.id ? '0 4px 16px rgba(88,166,255,0.1)' : 'none',
                  }}
                  onClick={() => setSelectedPlanId(p.id)}
                >
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
                    {p.plan_type.replace('_', ' ')} • {p.completed_days}/{p.total_days}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Delete this plan? Linked goals will also be deleted.'))
                        deletePlanMutation.mutate(p.id);
                    }}
                    style={{ padding: 6, background: 'rgba(248,81,73,0.1)', border: 'none', color: 'var(--danger)', cursor: 'pointer', borderRadius: 8, opacity: 0.8 }}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ padding: 32, textAlign: 'center', borderStyle: 'dashed', borderColor: 'var(--border-muted)', borderRadius: 12 }}>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 14, lineHeight: 1.6 }}>
                No study plans. Create a goal via <strong>+ Add New Goal</strong>.
              </p>
              <Link to="/goals" style={{ display: 'inline-block', marginTop: 16, color: 'var(--accent)', fontWeight: 600, fontSize: 14 }}>
                My Goals →
              </Link>
            </div>
          )}
        </div>

        <div style={{ flex: '1 1 560px', minWidth: 0 }}>
          {selectedPlanId && daysLoading && (
            <div style={{ padding: 64, textAlign: 'center', color: 'var(--text-muted)', fontSize: 15 }}>Loading days...</div>
          )}
          {selectedPlanId && !daysLoading && days && days.length > 0 && (
            <div>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: 24, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>
                Day-wise Plan
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {days.map((day) => {
                  const isExpanded = expandedDayId === day.id;
                  const isUnlocked = day.day_number === 1 || days.find((d) => d.day_number === day.day_number - 1)?.is_completed;
                  return (
                    <div
                      key={day.id}
                      className="card animate-slide-up"
                      style={{
                        border: `1px solid ${day.is_completed ? 'rgba(63,185,80,0.3)' : isExpanded ? 'rgba(88,166,255,0.3)' : 'var(--border)'}`,
                        background: day.is_completed ? 'rgba(63,185,80,0.04)' : 'var(--bg-card)',
                        overflow: 'hidden',
                        borderRadius: 14,
                        boxShadow: isExpanded ? '0 8px 24px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.2)',
                        transition: 'all 0.25s ease',
                      }}
                    >
                      <div
                        onClick={() => isUnlocked && setExpandedDayId(isExpanded ? null : day.id)}
                        style={{
                          padding: 20,
                          cursor: isUnlocked ? 'pointer' : 'default',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          opacity: isUnlocked ? 1 : 0.6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <span
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 12,
                              background: day.is_completed ? 'var(--success)' : 'rgba(88,166,255,0.15)',
                              color: day.is_completed ? '#fff' : 'var(--accent)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: 17,
                              boxShadow: day.is_completed ? '0 4px 12px rgba(63,185,80,0.3)' : 'none',
                            }}
                          >
                            {day.is_completed ? '✓' : day.day_number}
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 16 }}>
                              Day {day.day_number} — {day.title}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                              {(day.topics?.length ?? 0)} topics
                              {day.challenge_id && ' • Coding challenge'}
                              {mcqs && expandedDayId === day.id && mcqs.length > 0 && ` • ${mcqs.length} quiz(zes)`}
                            </div>
                          </div>
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: 20, fontWeight: 300 }}>
                          {isExpanded ? '−' : '+'}
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="ez-day-expand">
                          {day.notes && (
                            <div className="ez-day-expand__notes-bar">
                              <span className="ez-day-expand__notes-label">Study notes are saved for this day.</span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm('Delete notes for this day? They will be regenerated when you view again.')) {
                                    deleteNotesMutation.mutate(day.id);
                                  }
                                }}
                                disabled={deleteNotesMutation.isPending}
                                className="btn btn-ghost"
                                style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 14px' }}
                                title="Delete notes (will regenerate on next view)"
                              >
                                Delete notes
                              </button>
                            </div>
                          )}

                          <section className="ez-day-section" aria-labelledby={`topics-head-${day.id}`}>
                            <div className="ez-day-section__head">
                              <div>
                                <h4 id={`topics-head-${day.id}`} className="ez-day-section__title">
                                  Topics &amp; videos
                                </h4>
                                <p className="ez-day-section__hint">
                                  Generate with Varin on the server. <strong>Stop</strong> cancels after the current step; Varin may finish the active render first.
                                </p>
                              </div>
                            </div>
                            {(day.topics || []).map((topic) => {
                              const subtopics = day.subtopics?.[topic] ?? [];
                              const tv =
                                day.topic_videos?.find((t) => t.topic === topic) ?? {
                                  topic,
                                  video_id: null,
                                  status: 'none' as const,
                                  url: null,
                                  progress_percent: 0,
                                };
                              const genKey = topicGenKey(day.id, topic);
                              const mutationBusy =
                                generateVideoMutation.isPending &&
                                generateVideoMutation.variables?.dayId === day.id &&
                                generateVideoMutation.variables?.topic === topic;
                              const isGenerating =
                                tv.status === 'generating' || generatingTopics.has(genKey) || mutationBusy;
                              const countdownKey = `${day.id}:${topic}`;
                              const countdown = countdownByTopic[countdownKey] ?? tv.estimated_seconds_remaining ?? 0;
                              const displayPct =
                                mutationBusy && tv.status !== 'generating' ? 0 : (tv.progress_percent ?? 0);
                              const statusLine =
                                mutationBusy && tv.status !== 'generating'
                                  ? 'Submitting request…'
                                  : tv.segments_done != null && tv.segments_total != null && tv.segments_total > 0
                                    ? `Segments: ${tv.segments_done}/${tv.segments_total}`
                                    : (tv.status_message ?? 'Generating…');
                              const canStop =
                                isGenerating &&
                                tv.video_id &&
                                !String(tv.video_id).startsWith('static-') &&
                                !mutationBusy;
                              const showCaptions =
                                tv.status === 'completed' &&
                                tv.captions_url &&
                                tv.video_id &&
                                !tv.video_id.startsWith('static-');
                              const showDeleteResidue = tv.status === 'failed' && tv.video_id && !isGenerating;
                              const showSecondaryRow = canStop || showCaptions || showDeleteResidue;
                              return (
                                <div key={topic} className="ez-day-topic">
                                  <h5 className="ez-day-topic__title">{topic}</h5>
                                  {subtopics.length > 0 && (
                                    <ul className="ez-day-topic__subtopics">
                                      {subtopics.map((st) => (
                                        <li key={st}>{st}</li>
                                      ))}
                                    </ul>
                                  )}
                                  <div className="ez-day-topic__actions-primary">
                                    <button
                                      type="button"
                                      onClick={() => openNotesView(day.id)}
                                      className="btn btn-ghost"
                                      style={{ fontSize: 13, padding: '10px 16px', borderRadius: 10, fontWeight: 500 }}
                                    >
                                      Open notes
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleVideoClick(day, tv)}
                                      disabled={isGenerating}
                                      className="btn btn-ghost"
                                      style={{
                                        fontSize: 13,
                                        padding: '10px 16px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        borderRadius: 10,
                                        fontWeight: 500,
                                        minHeight: 42,
                                        justifyContent: 'center',
                                      }}
                                    >
                                      Video
                                      {tv.status === 'completed' && (
                                        <span style={{ padding: '4px 10px', background: 'rgba(63,185,80,0.2)', borderRadius: 8, color: 'var(--success)', fontSize: 12, fontWeight: 600 }}>Ready</span>
                                      )}
                                      {isGenerating && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                          <span style={{ padding: '4px 10px', background: 'rgba(88,166,255,0.2)', borderRadius: 8, color: 'var(--accent)', fontSize: 12, fontWeight: 600 }}>
                                            {displayPct}%
                                          </span>
                                          {countdown > 0 && (
                                            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                                              ~{formatCountdown(countdown)}
                                            </span>
                                          )}
                                        </span>
                                      )}
                                      {tv.status === 'none' && !isGenerating && (
                                        <span style={{ padding: '4px 10px', background: 'rgba(210,153,34,0.2)', borderRadius: 8, color: 'var(--warning)', fontSize: 12, fontWeight: 600 }}>Generate</span>
                                      )}
                                      {tv.status === 'failed' && !isGenerating && (
                                        <span style={{ padding: '4px 10px', background: 'rgba(248,81,73,0.2)', borderRadius: 8, color: 'var(--danger)', fontSize: 12, fontWeight: 600 }}>
                                          {isCancelledVideo(tv) ? 'Stopped' : 'Retry'}
                                        </span>
                                      )}
                                    </button>
                                  </div>
                                  {showSecondaryRow && (
                                    <div className="ez-day-topic__actions-secondary">
                                      {canStop && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            cancelVideoMutation.mutate({
                                              videoId: tv.video_id!,
                                              dayId: day.id,
                                              topic,
                                            })
                                          }
                                          disabled={cancelVideoMutation.isPending}
                                          className="btn btn-ghost"
                                          style={{
                                            fontSize: 13,
                                            padding: '8px 14px',
                                            borderRadius: 10,
                                            fontWeight: 600,
                                            color: 'var(--danger)',
                                            border: '1px solid rgba(248,81,73,0.35)',
                                          }}
                                        >
                                          Stop generation
                                        </button>
                                      )}
                                      {showCaptions && (
                                        <a
                                          href={`${API_BASE}${tv.captions_url}`}
                                          download={`${topic.replace(/\s+/g, '-')}-captions.srt`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title="Download SRT captions"
                                          className="btn btn-ghost"
                                          style={{ fontSize: 13, padding: '8px 14px', borderRadius: 10, fontWeight: 500, textDecoration: 'none', color: 'var(--accent)' }}
                                        >
                                          Captions (SRT)
                                        </a>
                                      )}
                                      {showDeleteResidue && (
                                        <button
                                          type="button"
                                          onClick={() => deleteVideoMutation.mutate(tv.video_id!)}
                                          disabled={deleteVideoMutation.isPending}
                                          className="btn btn-ghost"
                                          style={{ fontSize: 12, padding: '8px 14px', color: 'var(--text-muted)' }}
                                        >
                                          Delete residue
                                        </button>
                                      )}
                                    </div>
                                  )}
                                  {isGenerating && (
                                    <div className="ez-day-topic__progress">
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 12 }}>
                                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, flex: 1, minWidth: 0 }}>
                                          {statusLine}
                                        </span>
                                        <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>{displayPct}%</span>
                                      </div>
                                      {countdown <= 0 && tv.status === 'generating' && (
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Estimating time…</div>
                                      )}
                                      <div style={{ height: 6, background: 'var(--bg-active)', borderRadius: 6, overflow: 'hidden' }}>
                                        <div
                                          style={{
                                            width: `${Math.min(100, Math.max(2, displayPct))}%`,
                                            height: '100%',
                                            background: 'var(--gradient-accent)',
                                            borderRadius: 6,
                                            transition: 'width 0.5s ease',
                                          }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </section>

                          <section className="ez-day-section" aria-labelledby={`tests-head-${day.id}`}>
                            <h4 id={`tests-head-${day.id}`} className="ez-day-section__title" style={{ marginBottom: 14 }}>
                              Tests &amp; practice
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                              {mcqs && mcqs.length > 0 && (
                                <div className="ez-day-tests-panel">
                                  <div className="ez-day-tests-panel__title">Quizzes (multiple choice)</div>
                                  {mcqs.map((mcq) => (
                                    <McqCard
                                      key={mcq.id}
                                      mcq={mcq}
                                      dayId={day.id}
                                      onSubmit={(optId) =>
                                        submitMcqMutation.mutate({
                                          dayId: day.id,
                                          mcqId: mcq.id,
                                          selectedOptionId: optId,
                                        })
                                      }
                                      isSubmitting={submitMcqMutation.isPending}
                                    />
                                  ))}
                                </div>
                              )}
                              {day.challenge_id && (
                                <Link
                                  to={`/challenges/${day.challenge_id}?from=study&day=${day.id}`}
                                  className="btn btn-primary"
                                  style={{
                                    fontSize: 14,
                                    padding: '12px 20px',
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    width: 'fit-content',
                                    borderRadius: 12,
                                    fontWeight: 600,
                                    boxShadow: '0 4px 14px rgba(88,166,255,0.25)',
                                  }}
                                >
                                  Coding challenge
                                </Link>
                              )}
                              {(!mcqs || mcqs.length === 0) && !day.challenge_id && (
                                <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0, padding: '12px 0' }}>
                                  No quizzes or coding challenge for this day.
                                </p>
                              )}
                            </div>
                          </section>

                          <div className="ez-day-expand__complete">
                            {day.is_completed ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--success)', fontWeight: 600, fontSize: 15 }}>
                                <span>✓</span> Day completed
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  completeMutation.mutate(day.id);
                                  setExpandedDayId(null);
                                }}
                                disabled={completeMutation.isPending}
                                className="btn btn-primary"
                                style={{ width: '100%', padding: 14, fontSize: 15, fontWeight: 600, borderRadius: 12, boxShadow: '0 4px 14px rgba(88,166,255,0.25)' }}
                              >
                                Complete Day
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video style selection modal */}
      {videoStyleModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
          onClick={() => setVideoStyleModal(null)}
        >
          <div
            className="card animate-slide-up"
            style={{
              maxWidth: 480,
              width: '100%',
              padding: 28,
              background: 'linear-gradient(135deg, rgba(26,35,50,0.98) 0%, rgba(13,17,23,0.99) 100%)',
              border: '1px solid rgba(88,166,255,0.25)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(88,166,255,0.08)',
              borderRadius: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: 'var(--text-primary)', marginBottom: 8, fontSize: 20, fontWeight: 700 }}>
              Choose video style
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>{videoStyleModal.topic}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(videoStyleOptions ?? []).map((opt: { id: string; label: string; desc: string; video_length_min: number; video_length_max: number; est_generation_min: number; est_generation_max: number }) => (
                <button
                  key={opt.id}
                  onClick={() => startVideoGeneration(opt.id)}
                  disabled={generateVideoMutation.isPending}
                  className="btn btn-ghost"
                  style={{
                    padding: 18,
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    background: 'rgba(88,166,255,0.06)',
                    border: '1px solid rgba(88,166,255,0.2)',
                    borderRadius: 12,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(88,166,255,0.12)';
                    e.currentTarget.style.borderColor = 'rgba(88,166,255,0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(88,166,255,0.06)';
                    e.currentTarget.style.borderColor = 'rgba(88,166,255,0.2)';
                  }}
                >
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>{opt.label}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{opt.desc}</span>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                    <span style={{ color: 'var(--accent)' }}>
                      Video: {opt.video_length_min}–{opt.video_length_max} min
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      Gen: ~{opt.est_generation_min}–{opt.est_generation_max} min
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setVideoStyleModal(null)}
              className="btn btn-ghost"
              style={{ marginTop: 20, width: '100%', padding: 12, color: 'var(--text-muted)', fontSize: 14 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function McqCard({
  mcq,
  onSubmit,
  isSubmitting,
}: {
  mcq: Mcq;
  dayId: string;
  onSubmit: (optionId: string) => void;
  isSubmitting: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const answered = mcq.answered ?? false;

  const handleSubmit = () => {
    if (!selected || answered) return;
    onSubmit(selected);
    setSubmitted(true);
  };

  if (answered) {
    return (
      <div
        style={{
          padding: 14,
          marginBottom: 12,
          background: mcq.is_correct ? 'rgba(63,185,80,0.08)' : 'rgba(248,81,73,0.08)',
          border: `1px solid ${mcq.is_correct ? 'rgba(63,185,80,0.3)' : 'rgba(248,81,73,0.3)'}`,
          borderRadius: 12,
        }}
      >
        <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8, fontSize: 14 }}>
          {mcq.question_text}
        </div>
        <span style={{ fontSize: 13, color: mcq.is_correct ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
          {mcq.is_correct ? '✓ Correct' : '✗ Incorrect'} {mcq.is_correct && '+5 XP'}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 14,
        marginBottom: 12,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
      }}
    >
      <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12, fontSize: 14 }}>
        {mcq.question_text}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(mcq.options || []).map((opt) => (
          <label
            key={opt.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              background: selected === opt.id ? 'rgba(88,166,255,0.08)' : 'var(--bg-elevated)',
              border: `1px solid ${selected === opt.id ? 'rgba(88,166,255,0.4)' : 'var(--border)'}`,
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 14,
              transition: 'all 0.2s ease',
            }}
          >
            <input type="radio" name={`mcq-${mcq.id}`} checked={selected === opt.id} onChange={() => setSelected(opt.id)} disabled={submitted} />
            {opt.text}
          </label>
        ))}
      </div>
      <button
        onClick={handleSubmit}
        disabled={!selected || isSubmitting || submitted}
        className="btn btn-primary"
        style={{ marginTop: 12, fontSize: 13, padding: '10px 18px', borderRadius: 10, fontWeight: 600 }}
      >
        Submit
      </button>
    </div>
  );
}
