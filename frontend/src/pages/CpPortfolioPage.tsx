import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Copy, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { api, type CpPlatformConnection, type CpPlatformSlug, type CpUnifiedPrivate } from '../lib/api';
import { CpStatsDashboard } from '../features/cp-portfolio/CpStatsDashboard';
import { PageHeader } from '../components/ui/PageHeader';
import { SkeletonLine, SkeletonLineLg } from '../components/ui/Skeleton';

const PLATFORMS: { value: CpPlatformSlug; label: string }[] = [
  { value: 'leetcode', label: 'LeetCode' },
  { value: 'codeforces', label: 'Codeforces' },
  { value: 'github', label: 'GitHub' },
  { value: 'atcoder', label: 'AtCoder' },
  { value: 'codechef', label: 'CodeChef' },
  { value: 'geeksforgeeks', label: 'GeeksforGeeks' },
];

function platformLabel(slug: string) {
  return PLATFORMS.find((p) => p.value === slug)?.label ?? slug;
}

function StatsSummary({ platform, stats }: { platform: string; stats: Record<string, unknown> | null }) {
  if (!stats) return <span className="text-muted">No stats yet — sync after verifying.</span>;
  const src = String(stats.source ?? '');
  if (platform === 'codeforces' && stats.rating != null) {
    return (
      <span>
        Rating <strong>{String(stats.rating)}</strong>
        {stats.max_rating != null ? ` (max ${String(stats.max_rating)})` : ''}
        {stats.rank ? ` · ${String(stats.rank)}` : ''}
      </span>
    );
  }
  if (platform === 'github') {
    return (
      <span>
        {stats.public_repos != null ? `${String(stats.public_repos)} repos` : ''}
        {stats.followers != null ? ` · ${String(stats.followers)} followers` : ''}
      </span>
    );
  }
  if (platform === 'leetcode' && stats.solved_by_difficulty && typeof stats.solved_by_difficulty === 'object') {
    const m = stats.solved_by_difficulty as Record<string, number>;
    const total = typeof m.all === 'number' ? m.all : ['easy', 'medium', 'hard'].reduce((s, k) => s + (m[k] ?? 0), 0);
    const c = stats.contest as Record<string, unknown> | undefined;
    const cr = c?.rating != null ? ` · contest ${Math.round(Number(c.rating))}` : '';
    return (
      <span>
        <strong>{total}</strong> accepted{cr} — full charts below.
      </span>
    );
  }
  if (stats.note) return <span className="text-muted">{String(stats.note)}</span>;
  return <span className="text-muted">{src ? `Source: ${src}` : 'Synced'}</span>;
}

export function CpPortfolioPage() {
  const qc = useQueryClient();
  const [slugInput, setSlugInput] = useState('');
  const [headlineInput, setHeadlineInput] = useState('');
  const [publicEnabled, setPublicEnabled] = useState(false);
  const [platform, setPlatform] = useState<CpPlatformSlug>('leetcode');
  const [handle, setHandle] = useState('');
  const [toast, setToast] = useState('');
  const [didInitForm, setDidInitForm] = useState(false);

  const { data, isLoading, error } = useQuery<CpUnifiedPrivate>({
    queryKey: ['cp-unified'],
    queryFn: async () => {
      const { data: d } = await api.get('/cp/me/unified');
      return d;
    },
  });

  useEffect(() => {
    if (!data || didInitForm) return;
    setSlugInput(data.settings.public_slug ?? '');
    setHeadlineInput(data.settings.headline ?? '');
    setPublicEnabled(data.settings.public_enabled);
    setDidInitForm(true);
  }, [data, didInitForm]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      const { data: d } = await api.put('/cp/me/settings', {
        public_slug: slugInput.trim() || null,
        public_enabled: publicEnabled,
        headline: headlineInput.trim() || null,
      });
      return d;
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['cp-unified'] });
      if (saved && typeof saved === 'object' && 'public_slug' in saved) {
        const s = saved as { public_slug?: string | null; headline?: string | null; public_enabled?: boolean };
        setSlugInput(s.public_slug ?? '');
        setHeadlineInput(s.headline ?? '');
        if (typeof s.public_enabled === 'boolean') setPublicEnabled(s.public_enabled);
      }
      setToast('Settings saved.');
      window.setTimeout(() => setToast(''), 2500);
    },
    onError: (e: unknown) => {
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? String((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? 'Save failed')
          : 'Save failed';
      setToast(msg);
      window.setTimeout(() => setToast(''), 4000);
    },
  });

  const addConn = useMutation({
    mutationFn: async () => {
      const { data: d } = await api.post('/cp/me/connections', { platform, handle: handle.trim() });
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cp-unified'] });
      setHandle('');
      setToast('Connection added — copy the verify phrase to your public profile, then verify.');
      window.setTimeout(() => setToast(''), 4000);
    },
    onError: (e: unknown) => {
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? String((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? 'Could not add')
          : 'Could not add';
      setToast(msg);
      window.setTimeout(() => setToast(''), 4000);
    },
  });

  const verifyConn = useMutation({
    mutationFn: async (id: string) => {
      const { data: d } = await api.post<CpPlatformConnection>(`/cp/me/connections/${id}/verify`);
      return d;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['cp-unified'] });
      if (d.verification_status === 'verified') {
        setToast('Verified. You can sync stats next.');
        window.setTimeout(() => setToast(''), 3000);
      } else {
        setToast(d.last_sync_error || 'Verification did not succeed—check the phrase on your public profile.');
        window.setTimeout(() => setToast(''), 8000);
      }
    },
    onError: (e: unknown) => {
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? String((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? 'Verify failed')
          : 'Verify failed';
      setToast(msg);
      window.setTimeout(() => setToast(''), 6000);
    },
  });

  const syncConn = useMutation({
    mutationFn: async (id: string) => {
      const { data: d } = await api.post<CpPlatformConnection>(`/cp/me/connections/${id}/sync`);
      return d;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['cp-unified'] });
      if (d.last_sync_error) {
        setToast(d.last_sync_error);
        window.setTimeout(() => setToast(''), 6000);
      } else {
        setToast('Stats updated.');
        window.setTimeout(() => setToast(''), 2500);
      }
    },
    onError: (e: unknown) => {
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? String((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? 'Sync failed')
          : 'Sync failed';
      setToast(msg);
      window.setTimeout(() => setToast(''), 5000);
    },
  });

  const deleteConn = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/cp/me/connections/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cp-unified'] });
      setToast('Connection removed.');
      window.setTimeout(() => setToast(''), 2500);
    },
  });

  const regenToken = useMutation({
    mutationFn: async (id: string) => {
      const { data: d } = await api.post(`/cp/me/connections/${id}/regenerate-token`);
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cp-unified'] });
      setToast('New verify phrase generated.');
      window.setTimeout(() => setToast(''), 3000);
    },
  });

  const publicUrl =
    typeof window !== 'undefined' && data?.settings.public_slug
      ? `${window.location.origin}/p/${data.settings.public_slug}`
      : null;

  if (isLoading) {
    return (
      <div className="animate-fade-in ez-page-zone" aria-busy="true">
        <PageHeader title="CP portfolio" description="Loading…" />
        <SkeletonLineLg />
        <SkeletonLine />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="animate-fade-in ez-page-zone">
        <PageHeader title="CP portfolio" description="Could not load portfolio settings." />
      </div>
    );
  }

  return (
    <div className="animate-fade-in ez-page-zone ez-cp-page">
      <PageHeader
        title="CP portfolio"
        description="Verify profiles, sync stats, and share one public page."
      />

      {toast ? <div className="ez-cp-toast-banner">{toast}</div> : null}

      <div className="ez-cp-layout">
        <aside className="ez-cp-aside">
          <section className="ez-cp-surface">
            <h2 className="ez-cp-section-title">Public page</h2>
            <p className="text-muted" style={{ marginBottom: 14, fontSize: '0.88rem', lineHeight: 1.45 }}>
              Slug and headline. Only <strong>verified</strong> accounts appear on <code>/p/…</code>.
            </p>
            <div className="ez-cp-field-grid">
              <label className="ez-cp-label">
                Public slug
                <input
                  className="input"
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value)}
                  placeholder="e.g. alex-cp"
                  autoComplete="off"
                />
              </label>
              <label className="ez-cp-label">
                Headline (optional)
                <input
                  className="input"
                  value={headlineInput}
                  onChange={(e) => setHeadlineInput(e.target.value)}
                  placeholder="e.g. Backend · contests"
                />
              </label>
            </div>
            <label className="ez-cp-check">
              <input type="checkbox" checked={publicEnabled} onChange={(e) => setPublicEnabled(e.target.checked)} />
              Public page visible
            </label>
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={saveSettings.isPending}
                onClick={() => saveSettings.mutate()}
              >
                {saveSettings.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
            {publicUrl && data.settings.public_enabled ? (
              <p className="ez-cp-public-link-line">
                <Link to={`/p/${data.settings.public_slug}`}>{publicUrl}</Link>
              </p>
            ) : null}
          </section>

          <section className="ez-cp-surface">
            <h2 className="ez-cp-section-title">Add platform</h2>
            <div className="ez-cp-add-row">
              <select className="input" value={platform} onChange={(e) => setPlatform(e.target.value as CpPlatformSlug)}>
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                className="input"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder={
                  platform === 'leetcode'
                    ? 'User or profile URL'
                    : 'Handle or profile URL'
                }
              />
              <button type="button" className="btn btn-primary btn-sm" disabled={addConn.isPending} onClick={() => addConn.mutate()}>
                {addConn.isPending ? 'Adding…' : 'Add'}
              </button>
            </div>
            <p className="text-muted" style={{ marginTop: 10, fontSize: '0.8rem', lineHeight: 1.45 }}>
              Paste the verify phrase on your profile (LeetCode <strong>About</strong>, GitHub <strong>bio</strong>), then Verify.
            </p>
          </section>
        </aside>

        <div className="ez-cp-main">
          <section className="ez-cp-surface">
            <h2 className="ez-cp-section-title">Connections</h2>
            {data.connections.length === 0 ? (
              <p className="text-muted">No platforms linked yet.</p>
            ) : (
              <ul className="ez-cp-conn-list">
                {data.connections.map((c) => (
                  <li key={c.id} className="ez-cp-conn">
                    <div className="ez-cp-conn-head">
                      <strong>{platformLabel(c.platform)}</strong>
                      <span className="text-muted">@{c.handle}</span>
                      {c.verified_at ? (
                        <span className="ez-cp-badge ez-cp-badge--ok">Verified</span>
                      ) : (
                        <span className="ez-cp-badge">Pending</span>
                      )}
                    </div>
                    {!c.verified_at && c.verify_phrase ? (
                      <div className="ez-cp-verify-box">
                        <code>{c.verify_phrase}</code>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            void navigator.clipboard.writeText(c.verify_phrase ?? '');
                            setToast('Copied verify phrase.');
                            window.setTimeout(() => setToast(''), 2000);
                          }}
                        >
                          <Copy size={14} aria-hidden /> Copy
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={regenToken.isPending}
                          onClick={() => regenToken.mutate(c.id)}
                        >
                          <RefreshCw size={14} aria-hidden /> New phrase
                        </button>
                      </div>
                    ) : null}
                    {c.last_sync_error ? <div className="ez-cp-err">{c.last_sync_error}</div> : null}
                    <div className="ez-cp-conn-stats">
                      <StatsSummary platform={c.platform} stats={c.stats_json} />
                    </div>
                    <div className="ez-cp-conn-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={verifyConn.isPending}
                        onClick={() => verifyConn.mutate(c.id)}
                      >
                        <ShieldCheck size={14} aria-hidden /> Verify
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={!c.verified_at || syncConn.isPending}
                        onClick={() => syncConn.mutate(c.id)}
                      >
                        Sync stats
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm ez-cp-danger"
                        disabled={deleteConn.isPending}
                        onClick={() => deleteConn.mutate(c.id)}
                      >
                        <Trash2 size={14} aria-hidden /> Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.connections.some((c) => c.verified_at && c.stats_json) ? (
            <section className="ez-cp-surface ez-cp-analytics">
              <div className="ez-cp-analytics-head">
                <h2 className="ez-cp-section-title ez-cp-analytics-title">Stats</h2>
                <p className="text-muted ez-cp-analytics-lead">Last sync — use <strong>Sync stats</strong> to refresh.</p>
              </div>
              {data.connections
                .filter((c) => c.verified_at && c.stats_json)
                .map((c) => (
                  <div key={c.id} className="ez-cp-analytics-block">
                    <h3 className="ez-cp-analytics-platform">
                      {platformLabel(c.platform)} <span className="text-muted">@{c.handle}</span>
                    </h3>
                    <CpStatsDashboard platform={c.platform} stats={c.stats_json} variant="page" />
                  </div>
                ))}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
