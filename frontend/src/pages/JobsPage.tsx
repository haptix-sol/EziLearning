import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type JobApplication } from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const STATUS_OPTIONS = ['applied', 'screening', 'interview', 'offered', 'rejected'];
const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  applied: { color: '#58a6ff', bg: 'rgba(88, 166, 255, 0.15)' },
  screening: { color: '#d29922', bg: 'rgba(210, 153, 34, 0.15)' },
  interview: { color: '#a371f7', bg: 'rgba(163, 113, 247, 0.15)' },
  offered: { color: '#3fb950', bg: 'rgba(63, 185, 80, 0.15)' },
  rejected: { color: '#f85149', bg: 'rgba(248, 81, 73, 0.15)' },
};

const NOTIFICATION_TYPES = ['status_update', 'new_opening', 'viewed'];
const GOV_PORTALS = ['SSC', 'UPSC', 'State PSC', 'Other'];

export function JobsPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [revealCredsId, setRevealCredsId] = useState<string | null>(null);
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [sector, setSector] = useState<'private' | 'government'>('private');
  const [source, setSource] = useState('manual');
  const [notes, setNotes] = useState('');
  const [appliedDate, setAppliedDate] = useState('');
  const [notificationDate, setNotificationDate] = useState('');
  const [notificationType, setNotificationType] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [companyIndustry, setCompanyIndustry] = useState('');
  const [governmentPortal, setGovernmentPortal] = useState('');
  const [portalUsername, setPortalUsername] = useState('');
  const [portalPassword, setPortalPassword] = useState('');
  const [gmailMessage, setGmailMessage] = useState('');
  const queryClient = useQueryClient();

  const { data: jobs } = useQuery<JobApplication[]>({
    queryKey: ['jobs'],
    queryFn: async () => {
      const { data } = await api.get('/jobs');
      return data;
    },
  });

  const { data: gmailStatus } = useQuery<{ connected: boolean; email?: string }>({
    queryKey: ['gmail-status'],
    queryFn: async () => {
      const { data } = await api.get('/gmail/status');
      return data;
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail_connected') === '1') {
      setGmailMessage('Gmail connected! Click Sync to fetch job emails.');
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
      window.history.replaceState({}, '', '/jobs');
    }
    if (params.get('gmail_error')) {
      setGmailMessage('Gmail connection failed: ' + params.get('gmail_error'));
      window.history.replaceState({}, '', '/jobs');
    }
  }, [queryClient]);

  const addMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/jobs', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setCompany('');
      setRole('');
      setNotes('');
      setShowAdd(false);
      setAppliedDate('');
      setNotificationDate('');
      setNotificationType('');
      setCompanyWebsite('');
      setCompanyIndustry('');
      setGovernmentPortal('');
      setPortalUsername('');
      setPortalPassword('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/jobs/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/gmail/sync');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setGmailMessage(`Synced: ${data.created} new, ${data.updated} updated from ${data.total} emails`);
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setGmailMessage(err?.response?.data?.detail || 'Sync failed');
    },
  });

  const handleConnectGmail = () => {
    window.location.href = `${API_BASE}/gmail/connect`;
  };

  const handleAdd = () => {
    const payload: Record<string, unknown> = {
      company,
      role,
      sector,
      source,
      notes: notes || undefined,
    };
    if (appliedDate) payload.applied_date = appliedDate;
    if (notificationDate) payload.notification_date = notificationDate;
    if (notificationType) payload.notification_type = notificationType;
    if (companyWebsite || companyIndustry) {
      payload.company_details = { website: companyWebsite || undefined, industry: companyIndustry || undefined };
    }
    if (sector === 'government') {
      if (governmentPortal) payload.government_portal = governmentPortal;
      if (portalUsername) payload.portal_username = portalUsername;
      if (portalPassword) payload.portal_password = portalPassword;
    }
    addMutation.mutate(payload);
  };

  const privateJobs = jobs?.filter((j) => (j.sector || 'private') === 'private') ?? [];
  const governmentJobs = jobs?.filter((j) => j.sector === 'government') ?? [];

  const renderJobCard = (job: JobApplication, i: number) => (
    <div
      key={job.id}
      className="card animate-slide-up"
      style={{ padding: 24, animationDelay: `${i * 40}ms` }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h4 style={{ color: 'var(--text-primary)', margin: '0 0 6px', fontSize: 18, fontWeight: 600 }}>
            {job.company}
          </h4>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 15 }}>{job.role}</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 10px', background: 'var(--bg-active)', borderRadius: 'var(--radius-full)', fontSize: 12, color: 'var(--text-muted)' }}>
              {job.source}
            </span>
            {job.applied_date && (
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                Applied {new Date(job.applied_date).toLocaleDateString()}
              </span>
            )}
            {job.notification_date && (
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                Notified {new Date(job.notification_date).toLocaleDateString()}
                {job.notification_type && ` (${job.notification_type.replace('_', ' ')})`}
              </span>
            )}
            {job.last_synced_at && (
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                Synced {new Date(job.last_synced_at).toLocaleDateString()}
              </span>
            )}
          </div>
          {job.company_details && (job.company_details.website || job.company_details.industry) && (
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
              {job.company_details.website && <span>🌐 {job.company_details.website}</span>}
              {job.company_details.industry && <span style={{ marginLeft: 12 }}>📁 {job.company_details.industry}</span>}
            </div>
          )}
          {job.sector === 'government' && (job.government_portal || job.portal_username) && (
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
              {job.government_portal && <span>🏛 {job.government_portal}</span>}
              {job.portal_username && (
                <span style={{ marginLeft: 12 }}>
                  👤 {job.portal_username}
                  {job.portal_password_masked && (
                    <button
                      onClick={() => setRevealCredsId(revealCredsId === job.id ? null : job.id)}
                      style={{ marginLeft: 8, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
                    >
                      {revealCredsId === job.id ? 'Hide' : 'Show password'}
                    </button>
                  )}
                </span>
              )}
              {revealCredsId === job.id && (
                <CredsDisplay jobId={job.id} onClose={() => setRevealCredsId(null)} />
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <select
            value={job.status}
            onChange={(e) => updateMutation.mutate({ id: job.id, status: e.target.value })}
            style={{
              padding: '10px 14px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: STATUS_CONFIG[job.status]?.color || 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {job.status_updates && job.status_updates.length > 0 && (
            <button
              onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
              className="btn btn-ghost"
              style={{ fontSize: 13 }}
            >
              {expandedId === job.id ? 'Hide' : 'Updates'}
            </button>
          )}
          <button onClick={() => deleteMutation.mutate(job.id)} className="btn btn-danger" style={{ fontSize: 13 }}>
            Delete
          </button>
        </div>
      </div>
      {expandedId === job.id && job.status_updates && job.status_updates.length > 0 && (
        <div className="animate-slide-up" style={{ marginTop: 20, padding: 16, background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <h5 style={{ color: 'var(--text-muted)', margin: '0 0 12px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
            Status history (from emails)
          </h5>
          {[...job.status_updates].reverse().map((u, idx) => (
            <div
              key={idx}
              style={{
                padding: '10px 0',
                borderBottom: idx < job.status_updates!.length - 1 ? '1px solid var(--border-muted)' : 'none',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ color: STATUS_CONFIG[u.status]?.color || 'var(--text-primary)', fontWeight: 600 }}>{u.status}</span>
              {u.message && <span style={{ color: 'var(--text-secondary)' }}>— {u.message}</span>}
              <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{u.date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="animate-fade-in" style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 20 }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', margin: '0 0 6px', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Job Applications
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 15 }}>
            Track Private & Government applications. Sync from Gmail.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {gmailStatus?.connected ? (
            <>
              <span style={{ padding: '8px 14px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600 }}>
                ✓ Gmail connected
              </span>
              <button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} className="btn btn-accent">
                {syncMutation.isPending ? 'Syncing...' : 'Sync from Gmail'}
              </button>
              <button
                onClick={() => api.delete('/gmail/disconnect').then(() => queryClient.invalidateQueries({ queryKey: ['gmail-status'] }))}
                className="btn btn-ghost"
                style={{ fontSize: 13 }}
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={handleConnectGmail}
              className="btn"
              style={{ background: 'linear-gradient(135deg, #ea4335, #d93025)', color: '#fff', boxShadow: '0 2px 8px rgba(234, 67, 53, 0.3)' }}
            >
              Connect Gmail
            </button>
          )}
          <button onClick={() => setShowAdd(!showAdd)} className="btn btn-primary">
            + Add Manual
          </button>
        </div>
      </div>

      {gmailMessage && (
        <div className="animate-slide-up" style={{ marginBottom: 20, padding: 16, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 14 }}>
          {gmailMessage}
        </div>
      )}

      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
        Connect Gmail to auto-import from LinkedIn, Naukri & government portals (SSC, UPSC, etc.).
      </p>

      {showAdd && (
        <div className="card animate-slide-up" style={{ marginBottom: 28, padding: 24 }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: 20, fontSize: 18, fontWeight: 600 }}>
            Add Application
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="radio" checked={sector === 'private'} onChange={() => setSector('private')} />
                <span>Private</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="radio" checked={sector === 'government'} onChange={() => setSector('government')} />
                <span>Government</span>
              </label>
            </div>
            <input placeholder="Company / Organization" value={company} onChange={(e) => setCompany(e.target.value)} className="input" />
            <input placeholder="Role / Post" value={role} onChange={(e) => setRole(e.target.value)} className="input" />
            <select value={source} onChange={(e) => setSource(e.target.value)} className="input">
              <option value="manual">Manual</option>
              <option value="linkedin">LinkedIn</option>
              <option value="naukri">Naukri</option>
              <option value="ssc">SSC</option>
              <option value="upsc">UPSC</option>
              <option value="government">Government Portal</option>
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Applied on</label>
                <input type="date" value={appliedDate} onChange={(e) => setAppliedDate(e.target.value)} className="input" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Notification on</label>
                <input type="date" value={notificationDate} onChange={(e) => setNotificationDate(e.target.value)} className="input" />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Notification type</label>
              <select value={notificationType} onChange={(e) => setNotificationType(e.target.value)} className="input">
                <option value="">—</option>
                {NOTIFICATION_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            {(sector === 'private' || companyWebsite || companyIndustry) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <input placeholder="Company website" value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} className="input" />
                <input placeholder="Industry" value={companyIndustry} onChange={(e) => setCompanyIndustry(e.target.value)} className="input" />
              </div>
            )}
            {sector === 'government' && (
              <>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Government portal</label>
                  <select value={governmentPortal} onChange={(e) => setGovernmentPortal(e.target.value)} className="input">
                    <option value="">—</option>
                    {GOV_PORTALS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <input placeholder="Portal username" value={portalUsername} onChange={(e) => setPortalUsername(e.target.value)} className="input" type="text" />
                  <input placeholder="Portal password" value={portalPassword} onChange={(e) => setPortalPassword(e.target.value)} className="input" type="password" />
                </div>
          <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Stored encrypted. Set SECRET_KEY in backend for encryption.</p>
              </>
            )}
            <textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="input" style={{ minHeight: 80, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={handleAdd} disabled={!company || !role || addMutation.isPending} className="btn btn-primary">
                Add
              </button>
              <button onClick={() => setShowAdd(false)} className="btn btn-ghost">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {jobs?.length === 0 ? (
          <div className="card" style={{ padding: 60, textAlign: 'center', borderStyle: 'dashed', borderColor: 'var(--border)' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>◉</div>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 16 }}>
              No applications yet. Connect Gmail to sync, or add manually.
            </p>
          </div>
        ) : (
          <>
            <section>
              <h2 style={{ color: 'var(--text-primary)', marginBottom: 16, fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ padding: '4px 10px', background: 'rgba(88, 166, 255, 0.15)', borderRadius: 'var(--radius-md)', color: 'var(--accent)' }}>Private</span>
                {privateJobs.length} applications
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {privateJobs.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No private sector applications.</p>
                ) : (
                  privateJobs.map((job, i) => renderJobCard(job, i))
                )}
              </div>
            </section>
            <section>
              <h2 style={{ color: 'var(--text-primary)', marginBottom: 16, fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ padding: '4px 10px', background: 'rgba(163, 113, 247, 0.15)', borderRadius: 'var(--radius-md)', color: 'var(--purple)' }}>Government</span>
                {governmentJobs.length} applications
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {governmentJobs.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No government applications.</p>
                ) : (
                  governmentJobs.map((job, i) => renderJobCard(job, i))
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function CredsDisplay({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['job-credentials', jobId],
    queryFn: async () => {
      const { data: d } = await api.get(`/jobs/${jobId}/credentials`);
      return d;
    },
    enabled: !!jobId,
  });
  if (isLoading) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading...</span>;
  if (!data) return null;
  return (
    <span style={{ marginLeft: 8, fontSize: 12 }}>
      🔑 {data.password ?? '—'}
      <button onClick={onClose} style={{ marginLeft: 8, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}>
        Hide
      </button>
    </span>
  );
}
