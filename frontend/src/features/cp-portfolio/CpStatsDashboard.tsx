import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Stats = Record<string, unknown>;

const COL = {
  easy: '#16a34a',
  medium: '#d97706',
  hard: '#dc2626',
  accent: '#4f46e5',
  grid: 'rgba(0,0,0,0.07)',
  tick: 'rgba(0,0,0,0.45)',
};

/** Activity window presets (skyline = one column per day, oldest → newest left → right). */
const ACTIVITY_PRESETS = [
  { days: 28, label: '4w' },
  { days: 90, label: '3m' },
  { days: 120, label: '4m' },
  { days: 180, label: '6m' },
] as const;

const CONTEST_WINDOWS = [
  { n: 12, label: '12' },
  { n: 24, label: '24' },
  { n: 36, label: '36' },
] as const;

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function totalSolved(diff: Record<string, number> | undefined): number {
  if (!diff) return 0;
  if (typeof diff.all === 'number') return diff.all;
  return ['easy', 'medium', 'hard'].reduce((s, k) => s + (diff[k] ?? 0), 0);
}

const DAY_MS = 86_400_000;

/** YYYY-MM-DD in UTC — matches backend calendar keys. */
function utcDayKey(offsetFromToday: number): string {
  const now = new Date();
  const t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + offsetFromToday * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

/** Decorative “city block” height only (not real stats) — deterministic from index. */
function ghostBuildingHeightPct(i: number): number {
  const h = 38 + ((i * 47 + (i >> 2) * 13) % 58);
  return Math.min(96, h);
}

/**
 * Left → right timeline: one transparent “building” silhouette per day in the back,
 * solid bar on top = submissions that day (UTC keys, same as API).
 */
function SubmissionCityscape({ daily, days }: { daily: Record<string, number>; days: number }) {
  const { series, maxC, subs, active } = useMemo(() => {
    const s: { key: string; c: number }[] = [];
    for (let i = 0; i < days; i++) {
      const key = utcDayKey(i - (days - 1));
      s.push({ key, c: daily[key] ?? 0 });
    }
    let maxC = 1;
    let subs = 0;
    let active = 0;
    for (const x of s) {
      if (x.c > 0) {
        active += 1;
        subs += x.c;
        maxC = Math.max(maxC, x.c);
      }
    }
    return { series: s, maxC: Math.max(1, maxC), subs, active };
  }, [daily, days]);

  const colW = days > 100 ? 3 : 4;
  const gap = 1;
  const innerW = Math.max(1, series.length) * colW + Math.max(0, series.length - 1) * gap;

  return (
    <div className="ez-cp-heat-wrap">
      <div className="ez-cp-heat-meta">
        <span>
          <strong className="ez-cp-heat-stat">{subs}</strong> ·{' '}
          <strong className="ez-cp-heat-stat">{active}</strong> days
        </span>
        <span className="ez-cp-heat-legend">UTC · older → newer</span>
      </div>
      <div className="ez-cp-cityscape-scroll">
        <div
          className="ez-cp-cityscape"
          style={{ width: innerW, gap: `${gap}px` }}
          role="img"
          aria-label={`Submissions over ${days} days: ${subs} total, ${active} active days`}
        >
          {series.map((d, i) => {
            const ghostH = ghostBuildingHeightPct(i);
            const t = d.c / maxC;
            const dataH = d.c === 0 ? 8 : 12 + t * 88;
            const alpha = d.c === 0 ? 0.14 : 0.28 + t * 0.62;
            const ghostRadius =
              i % 5 === 0 ? '3px 2px 0 3px' : i % 5 === 2 ? '2px 4px 1px 2px' : i % 5 === 4 ? '1px 3px 2px 2px' : undefined;
            return (
              <div
                key={d.key}
                className="ez-cp-city-col"
                style={{ width: colW, flex: `0 0 ${colW}px` }}
                title={`${d.key}: ${d.c}`}
              >
                <div
                  className="ez-cp-city-ghost"
                  style={{ height: `${ghostH}%`, ...(ghostRadius ? { borderRadius: ghostRadius } : {}) }}
                  aria-hidden
                />
                <div
                  className="ez-cp-city-bar"
                  style={{
                    height: `${dataH}%`,
                    background: `rgba(22, 163, 74, ${alpha})`,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SegToggle<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="ez-cp-seg" role="tablist" aria-label="Range">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={`ez-cp-seg-btn ${value === o.value ? 'ez-cp-seg-btn--on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function LeetCodeDashboard({ stats }: { stats: Stats }) {
  const [activityDays, setActivityDays] = useState<(typeof ACTIVITY_PRESETS)[number]['days']>(120);
  const [contestN, setContestN] = useState<(typeof CONTEST_WINDOWS)[number]['n']>(24);

  const preset = ACTIVITY_PRESETS.find((p) => p.days === activityDays) ?? ACTIVITY_PRESETS[2];

  const diff = stats.solved_by_difficulty as Record<string, number> | undefined;
  const barData = useMemo(() => {
    if (!diff) return [];
    return ['easy', 'medium', 'hard']
      .filter((k) => diff[k] != null)
      .map((k) => ({ name: k[0]!.toUpperCase() + k.slice(1), value: diff[k] ?? 0, key: k }));
  }, [diff]);

  const beats = (stats.beats_by_difficulty as { difficulty?: string; percentage?: number }[]) || [];
  const beatLine = beats
    .filter((b) => b.difficulty && b.difficulty.toLowerCase() !== 'all')
    .map((b) => {
      const raw = Number(b.percentage ?? 0);
      const pct = raw > 0 && raw <= 1 ? raw * 100 : raw;
      return `${b.difficulty}: ${Math.round(pct)}%`;
    })
    .join(' · ');

  const topics = (stats.tag_topics as { tag?: string; solved?: number }[]) || [];
  const topicRows = topics
    .filter((t) => t.tag)
    .map((t) => ({ tag: String(t.tag), solved: Number(t.solved ?? 0) }))
    .slice(0, 8);

  const contest = stats.contest as Record<string, unknown> | undefined;
  const hist = (stats.contest_history as Record<string, unknown>[]) || [];
  const lineData = useMemo(() => {
    const rows = [...hist].reverse().slice(-contestN);
    return rows.map((h, idx) => {
      const c = h.contest as Record<string, unknown> | undefined;
      const title = (c?.title as string) || `#${idx + 1}`;
      return { name: title.length > 10 ? `${title.slice(0, 9)}…` : title, rating: num(h.rating) };
    });
  }, [hist, contestN]);

  const cal = (stats.calendar as Record<string, unknown>) || {};
  const daily = (cal.daily_submissions as Record<string, number>) || {};
  const streak = num(cal.streak);
  const totalActive = num(cal.total_active_days);

  const prof = (stats.profile as Record<string, unknown>) || {};
  const langs = (stats.languages as { languageName?: string; problemsSolved?: number }[]) || [];
  const langTop = langs
    .filter((l) => l.languageName && (l.problemsSolved ?? 0) > 0)
    .slice(0, 5)
    .map((l) => `${l.languageName} ${l.problemsSolved}`)
    .join(' · ');

  const recent = (stats.recent_ac as { title?: string; titleSlug?: string }[]) || [];
  const total = totalSolved(diff);
  const contestRating = contest ? num(contest.rating) : null;
  const globalR = contest ? num(contest.global_ranking) : null;
  const topPct = contest ? num(contest.top_percentage) : null;

  return (
    <div className="ez-cp-dash ez-cp-dash--tight">
      <div className="ez-cp-kpis">
        <div className="ez-cp-kpi">
          <span className="ez-cp-kpi-v">{total}</span>
          <span className="ez-cp-kpi-l">Solved</span>
        </div>
        {contestRating != null ? (
          <div className="ez-cp-kpi">
            <span className="ez-cp-kpi-v">{Math.round(contestRating)}</span>
            <span className="ez-cp-kpi-l">Contest</span>
          </div>
        ) : null}
        {globalR != null ? (
          <div className="ez-cp-kpi">
            <span className="ez-cp-kpi-v">#{globalR.toLocaleString()}</span>
            <span className="ez-cp-kpi-l">Global{topPct != null ? ` · top ${topPct}%` : ''}</span>
          </div>
        ) : null}
        <div className="ez-cp-kpi">
          <span className="ez-cp-kpi-v">{streak ?? '—'}</span>
          <span className="ez-cp-kpi-l">Streak</span>
        </div>
        <div className="ez-cp-kpi">
          <span className="ez-cp-kpi-v">{prof.ranking != null ? `#${Number(prof.ranking).toLocaleString()}` : '—'}</span>
          <span className="ez-cp-kpi-l">Site rank</span>
        </div>
        {totalActive != null ? (
          <div className="ez-cp-kpi">
            <span className="ez-cp-kpi-v">{totalActive}</span>
            <span className="ez-cp-kpi-l">Active days</span>
          </div>
        ) : null}
      </div>

      <div className="ez-cp-split">
        <section className="ez-cp-card">
          <h4 className="ez-cp-h">By difficulty</h4>
          <div className="ez-cp-chart ez-cp-chart--sm">
            {barData.length ? (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={barData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COL.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: COL.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: COL.tick, fontSize: 10 }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [v, '']} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {barData.map((e) => (
                      <Cell key={e.key} fill={COL[e.key as keyof typeof COL] ?? COL.accent} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="ez-cp-muted">—</p>
            )}
          </div>
          {beatLine ? <p className="ez-cp-sub">Beats peers: {beatLine}</p> : null}
        </section>

        <section className="ez-cp-card">
          <div className="ez-cp-card-head">
            <h4 className="ez-cp-h">Contest rating</h4>
            <SegToggle
              value={contestN}
              onChange={setContestN}
              options={CONTEST_WINDOWS.map((w) => ({ value: w.n, label: w.label }))}
            />
          </div>
          <p className="ez-cp-card-hint">Last N contests</p>
          <div className="ez-cp-chart ez-cp-chart--sm">
            {lineData.some((d) => d.rating != null) ? (
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={lineData} margin={{ top: 4, right: 4, left: -18, bottom: 18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COL.grid} />
                  <XAxis dataKey="name" tick={{ fill: COL.tick, fontSize: 9 }} interval={0} angle={-22} textAnchor="end" height={32} />
                  <YAxis tick={{ fill: COL.tick, fontSize: 10 }} width={36} domain={['auto', 'auto']} />
                  <Tooltip />
                  <Line type="monotone" dataKey="rating" stroke="#15803d" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="ez-cp-muted">No contest data</p>
            )}
          </div>
        </section>
      </div>

      <section className="ez-cp-card ez-cp-card--activity">
        <div className="ez-cp-card-head">
          <h4 className="ez-cp-h">Activity skyline</h4>
          <SegToggle
            value={activityDays}
            onChange={(d) => setActivityDays(d)}
            options={ACTIVITY_PRESETS.map((p) => ({ value: p.days, label: p.label }))}
          />
        </div>
        <p className="ez-cp-card-hint">Each column is one day; bar height = submissions.</p>
        <SubmissionCityscape daily={daily} days={preset.days} />
      </section>

      <div className="ez-cp-split">
        <section className="ez-cp-card">
          <h4 className="ez-cp-h">Top topics</h4>
          {topicRows.length ? (
            <table className="ez-cp-table">
              <tbody>
                {topicRows.map((r, i) => (
                  <tr key={r.tag}>
                    <td className="ez-cp-td-r">{i + 1}</td>
                    <td>{r.tag}</td>
                    <td className="ez-cp-td-n">{r.solved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="ez-cp-muted">—</p>
          )}
        </section>

        <section className="ez-cp-card">
          <h4 className="ez-cp-h">Languages</h4>
          {langTop ? <p className="ez-cp-lang-line">{langTop}</p> : <p className="ez-cp-muted">—</p>}
          <h4 className="ez-cp-h ez-cp-h--sub">Recent AC</h4>
          <ul className="ez-cp-links">
            {recent.slice(0, 6).map((r) => (
              <li key={r.titleSlug ?? r.title}>
                <a href={`https://leetcode.com/problems/${r.titleSlug}/`} target="_blank" rel="noopener noreferrer">
                  {r.title}
                </a>
              </li>
            ))}
          </ul>
          {!recent.length ? <p className="ez-cp-muted">—</p> : null}
        </section>
      </div>
    </div>
  );
}

function CodeforcesDashboard({ stats }: { stats: Stats }) {
  const [contestN, setContestN] = useState<(typeof CONTEST_WINDOWS)[number]['n']>(24);
  const hist = (stats.rating_history as Record<string, unknown>[]) || [];
  const lineData = useMemo(() => {
    const tail = hist.slice(-contestN);
    return tail.map((h, i) => ({
      name: String(h.contest_name ?? `#${i + 1}`).slice(0, 10),
      rating: num(h.new_rating),
    }));
  }, [hist, contestN]);

  return (
    <div className="ez-cp-dash ez-cp-dash--tight">
      <div className="ez-cp-kpis">
        <div className="ez-cp-kpi">
          <span className="ez-cp-kpi-v">{stats.rating != null ? String(stats.rating) : '—'}</span>
          <span className="ez-cp-kpi-l">Rating</span>
        </div>
        <div className="ez-cp-kpi">
          <span className="ez-cp-kpi-v">{stats.max_rating != null ? String(stats.max_rating) : '—'}</span>
          <span className="ez-cp-kpi-l">Max</span>
        </div>
        <div className="ez-cp-kpi">
          <span className="ez-cp-kpi-v">{stats.rank != null ? String(stats.rank) : '—'}</span>
          <span className="ez-cp-kpi-l">Rank</span>
        </div>
      </div>
      <section className="ez-cp-card">
        <div className="ez-cp-card-head">
          <h4 className="ez-cp-h">Rating timeline</h4>
          <SegToggle
            value={contestN}
            onChange={setContestN}
            options={CONTEST_WINDOWS.map((w) => ({ value: w.n, label: w.label }))}
          />
        </div>
        <p className="ez-cp-card-hint">Last N contests</p>
        <div className="ez-cp-chart ez-cp-chart--sm">
          {lineData.some((d) => d.rating != null) ? (
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={lineData} margin={{ top: 4, right: 8, left: -12, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COL.grid} />
                <XAxis dataKey="name" tick={{ fill: COL.tick, fontSize: 9 }} interval={0} angle={-18} textAnchor="end" height={36} />
                <YAxis tick={{ fill: COL.tick, fontSize: 10 }} width={34} domain={['auto', 'auto']} />
                <Tooltip />
                <Line type="monotone" dataKey="rating" stroke="#15803d" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="ez-cp-muted">No history in cache</p>
          )}
        </div>
      </section>
    </div>
  );
}

function GitHubMini({ stats }: { stats: Stats }) {
  return (
    <div className="ez-cp-dash ez-cp-dash--tight">
      <div className="ez-cp-kpis">
        <div className="ez-cp-kpi">
          <span className="ez-cp-kpi-v">{stats.public_repos != null ? String(stats.public_repos) : '—'}</span>
          <span className="ez-cp-kpi-l">Repos</span>
        </div>
        <div className="ez-cp-kpi">
          <span className="ez-cp-kpi-v">{stats.followers != null ? String(stats.followers) : '—'}</span>
          <span className="ez-cp-kpi-l">Followers</span>
        </div>
      </div>
    </div>
  );
}

type Props = {
  platform: string;
  stats: Stats | null;
  variant?: 'page' | 'public';
};

export function CpStatsDashboard({ platform, stats, variant = 'page' }: Props) {
  if (!stats) {
    return <p className="ez-cp-muted">Sync to load stats.</p>;
  }

  const wrap = variant === 'public' ? 'ez-cp-dash-outer ez-cp-dash-outer--pub' : 'ez-cp-dash-outer';

  if (platform === 'leetcode' && stats.source === 'leetcode_graphql') {
    return (
      <div className={wrap}>
        <LeetCodeDashboard stats={stats} />
      </div>
    );
  }
  if (platform === 'codeforces' && stats.source === 'codeforces_api') {
    return (
      <div className={wrap}>
        <CodeforcesDashboard stats={stats} />
      </div>
    );
  }
  if (platform === 'github' && stats.source === 'github_api') {
    return (
      <div className={wrap}>
        <GitHubMini stats={stats} />
      </div>
    );
  }
  if (stats.note) {
    return <p className="ez-cp-muted">{String(stats.note)}</p>;
  }
  return <p className="ez-cp-muted">Charts available for LeetCode & Codeforces after sync.</p>;
}
