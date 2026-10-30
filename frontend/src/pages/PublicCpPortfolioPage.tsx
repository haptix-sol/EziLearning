import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api, type CpUnifiedPublic } from '../lib/api';
import { CpStatsDashboard } from '../features/cp-portfolio/CpStatsDashboard';

function platformLabel(slug: string) {
  const m: Record<string, string> = {
    leetcode: 'LeetCode',
    codeforces: 'Codeforces',
    github: 'GitHub',
    atcoder: 'AtCoder',
    codechef: 'CodeChef',
    geeksforgeeks: 'GeeksforGeeks',
  };
  return m[slug] ?? slug;
}

export function PublicCpPortfolioPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, isError } = useQuery<CpUnifiedPublic>({
    queryKey: ['cp-public', slug],
    queryFn: async () => {
      const { data: d } = await api.get(`/cp/public/${encodeURIComponent(slug ?? '')}`);
      return d;
    },
    enabled: Boolean(slug?.trim()),
    retry: false,
  });

  if (!slug?.trim()) {
    return (
      <div className="ez-cp-public-wrap">
        <p>Invalid link.</p>
        <Link to="/">Home</Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="ez-cp-public-wrap" aria-busy="true">
        <p>Loading…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="ez-cp-public-wrap">
        <h1>Profile not found</h1>
        <p className="text-muted">This public CP page is disabled or does not exist.</p>
        <Link to="/" className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
          Back to EziLearning
        </Link>
      </div>
    );
  }

  return (
    <div className="ez-cp-public-wrap ez-cp-public-page animate-fade-in">
      <header className="ez-cp-public-header">
        <p className="ez-cp-public-kicker">EziLearning · CP portfolio</p>
        <h1>{data.display_name || 'Developer'}</h1>
        {data.headline ? <p className="ez-cp-public-headline">{data.headline}</p> : null}
      </header>

      {data.platforms.length === 0 ? (
        <p className="text-muted">No verified platforms to show yet.</p>
      ) : (
        <div className="ez-cp-public-stack">
          {data.platforms.map((p) => (
            <article key={`${p.platform}-${p.handle}`} className="ez-cp-surface ez-cp-public-platform">
              <div className="ez-cp-public-card-head">
                <h2>{platformLabel(p.platform)}</h2>
                <p className="text-muted">@{p.handle}</p>
              </div>
              <CpStatsDashboard platform={p.platform} stats={p.stats} variant="public" />
            </article>
          ))}
        </div>
      )}

      <footer className="ez-cp-public-footer">
        <Link to="/">Create your own on EziLearning</Link>
      </footer>
    </div>
  );
}
