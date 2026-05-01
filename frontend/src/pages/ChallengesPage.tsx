import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, type Challenge } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { TOPIC_FILTERS, topicLabel } from '../lib/challengeTopics';
import { CHALLENGE_LANGUAGE_FILTERS, challengeLanguageLabel } from '../lib/codeLanguages';

const DIFF_COLORS: Record<string, string> = {
  easy: '#3fb950',
  medium: '#d29922',
  hard: '#f85149',
};

export function ChallengesPage() {
  const queryClient = useQueryClient();
  const [topicFilter, setTopicFilter] = useState('all');
  const [langFilter, setLangFilter] = useState('all');

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ deleted: number; message: string }>('/challenges/reset');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
    },
  });

  const { data: challenges, isLoading } = useQuery<Challenge[]>({
    queryKey: ['challenges', topicFilter, langFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (topicFilter !== 'all') params.topic = topicFilter;
      if (langFilter !== 'all') params.language = langFilter;
      const { data } = await api.get<Challenge[]>('/challenges', { params });
      return data;
    },
  });

  return (
    <div className="animate-fade-in ez-page-zone">
      <PageHeader
        title="Coding challenges"
        description="Browse by topic (arrays, linked lists, streams, …). Each card shows the language you code in. Run and submit use the server when Python, Node, gcc/g++, or JDK are available on PATH."
      />

      <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
        TOPICS
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 20,
          maxHeight: 200,
          overflowY: 'auto',
          paddingBottom: 4,
        }}
      >
        {TOPIC_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setTopicFilter(f.value)}
            className={topicFilter === f.value ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
            style={{ fontSize: 12 }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
        marginBottom: 24,
        justifyContent: 'space-between',
        rowGap: 16,
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
            LANGUAGE (OPTIONAL)
          </span>
          <select
            className="input"
            value={langFilter}
            onChange={(e) => setLangFilter(e.target.value)}
            style={{ maxWidth: 220, fontSize: 13, padding: '8px 12px' }}
            aria-label="Filter by programming language"
          >
            {CHALLENGE_LANGUAGE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={resetMutation.isPending}
          onClick={() => {
            if (
              !window.confirm(
                'Remove all coding challenges from the library? Study-plan links to those problems will be cleared. You can generate new challenges afterward from your resume or profile.',
              )
            ) {
              return;
            }
            resetMutation.mutate();
          }}
          style={{ fontSize: 12, color: 'var(--text-secondary)' }}
        >
          {resetMutation.isPending ? 'Resetting…' : 'Reset all challenges'}
        </button>
      </div>
      {resetMutation.isError ? (
        <p style={{ color: 'var(--danger, #f85149)', fontSize: 13, marginTop: -12, marginBottom: 16 }}>
          Could not reset challenges. Try again or check that you are signed in.
        </p>
      ) : null}
      {resetMutation.isSuccess && resetMutation.data ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: -12, marginBottom: 16 }}>
          Removed {resetMutation.data.deleted} challenge{resetMutation.data.deleted === 1 ? '' : 's'}. Regenerate from your resume or dashboard.
        </p>
      ) : null}

      {isLoading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : !challenges?.length ? (
        <div
          className="card"
          style={{
            padding: 48,
            textAlign: 'center',
            borderStyle: 'dashed',
            borderColor: 'var(--border)',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>{'{}'}</div>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 16 }}>
            No challenges match these filters. Try &quot;All topics&quot; and &quot;All languages&quot;, or generate challenges from your resume.
          </p>
        </div>
      ) : (
        <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {challenges.map((c) => (
            <Link
              key={c.id}
              to={`/challenges/${c.id}`}
              className="card card-interactive"
              style={{
                padding: 24,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 16,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{
                    margin: '0 0 10px',
                    color: 'var(--text-primary)',
                    fontSize: 18,
                    fontWeight: 600,
                  }}>
                    {c.title}
                  </h3>
                  <p style={{
                    color: 'var(--text-secondary)',
                    margin: 0,
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}>
                    {(c.description ?? '').slice(0, 180)}
                    {(c.description?.length ?? 0) > 180 ? '…' : ''}
                  </p>
                  <div style={{
                    marginTop: 12,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    alignItems: 'center',
                  }}>
                    {(c.topics?.length ? c.topics : ['general']).map((slug) => (
                      <span
                        key={slug}
                        className="badge badge-info"
                        style={{ padding: '3px 8px', fontSize: 11 }}
                      >
                        {topicLabel(slug)}
                      </span>
                    ))}
                  </div>
                  {c.required_skills?.length ? (
                    <div style={{
                      marginTop: 10,
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}>
                      {c.required_skills.map((s) => (
                        <span
                          key={s}
                          style={{ fontSize: 11, color: 'var(--text-muted)' }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                      CODE IN
                    </div>
                    <span className="badge badge-success" style={{ fontSize: 12 }}>
                      {challengeLanguageLabel(c.language)}
                    </span>
                  </div>
                  <span
                    style={{
                      padding: '6px 12px',
                      background: `${DIFF_COLORS[c.difficulty || 'medium']}20`,
                      color: DIFF_COLORS[c.difficulty || 'medium'],
                      borderRadius: 'var(--radius-full)',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {c.difficulty || 'medium'}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
