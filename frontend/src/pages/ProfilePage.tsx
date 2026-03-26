import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, type ResumeProfile } from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function ProfilePage() {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    experience_level: '',
    years_experience: '' as string | number,
    target_role: '',
    target_industry: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery<ResumeProfile | null>({
    queryKey: ['profile'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/resumes/profile');
        return data;
      } catch {
        return null;
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const { data: res } = await api.patch('/resumes/profile', {
        full_name: data.full_name || null,
        email: data.email || null,
        phone: data.phone || null,
        experience_level: data.experience_level || null,
        years_experience: data.years_experience === '' ? null : Number(data.years_experience),
        target_role: data.target_role || null,
        target_industry: data.target_industry || null,
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['me-display'] });
      setEditing(false);
    },
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/resumes/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['me-display'] });
    },
  });

  const handleEdit = () => {
    setForm({
      full_name: profile?.full_name ?? '',
      email: profile?.email ?? '',
      phone: profile?.phone ?? '',
      experience_level: profile?.experience_level ?? '',
      years_experience: profile?.years_experience ?? '',
      target_role: profile?.target_role ?? '',
      target_industry: profile?.target_industry ?? '',
    });
    setEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate(form);
  };

  const handleAvatarClick = () => fileInputRef.current?.click();
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) avatarMutation.mutate(file);
    e.target.value = '';
  };

  if (isLoading) {
    return (
      <div className="animate-fade-in" style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading profile...
      </div>
    );
  }

  const avatarUrl = profile?.avatar_url ? `${API_BASE}${profile.avatar_url}` : null;
  const displayName = profile?.full_name || 'Guest';

  return (
    <div className="animate-fade-in">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 32,
        flexWrap: 'wrap',
        gap: 20,
      }}>
        <div>
          <h1 style={{
            color: 'var(--text-primary)',
            margin: '0 0 6px',
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}>
            Profile
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 15 }}>
            Manage your profile and avatar
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/resume" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
            Upload Resume
          </Link>
          {!editing ? (
            <button onClick={handleEdit} className="btn btn-primary">
              Edit Profile
            </button>
          ) : (
            <>
              <button onClick={() => setEditing(false)} className="btn btn-ghost">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="btn btn-primary"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Avatar section */}
      <div
        className="card"
        style={{
          padding: 32,
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleAvatarChange}
          style={{ display: 'none' }}
        />
        <button
          onClick={handleAvatarClick}
          disabled={avatarMutation.isPending}
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '3px solid var(--border)',
            background: 'var(--gradient-accent)',
            cursor: avatarMutation.isPending ? 'not-allowed' : 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'border-color var(--duration-fast), transform var(--duration-fast)',
          }}
          onMouseEnter={(e) => {
            if (!avatarMutation.isPending) {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.transform = 'scale(1.02)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ fontSize: 48, fontWeight: 700, color: '#fff' }}>
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </button>
        <div>
          <h3 style={{ color: 'var(--text-primary)', margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>
            Profile Picture
          </h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 14 }}>
            Click to upload. JPEG, PNG, WebP or GIF. Max 5MB.
          </p>
          {avatarMutation.isError && (
            <p style={{ color: 'var(--danger)', marginTop: 8, fontSize: 13 }}>
              {(avatarMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Upload failed'}
            </p>
          )}
        </div>
      </div>

      {/* Profile form */}
      <div className="card" style={{ padding: 32 }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  className="input"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder="Your name"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                  Email
                </label>
                <input
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                  Phone
                </label>
                <input
                  type="text"
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+1 234 567 8900"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                  Experience Level
                </label>
                <select
                  className="input"
                  value={form.experience_level}
                  onChange={(e) => setForm((f) => ({ ...f, experience_level: e.target.value }))}
                  style={{ width: '100%' }}
                >
                  <option value="">Select</option>
                  <option value="junior">Junior</option>
                  <option value="mid">Mid</option>
                  <option value="senior">Senior</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                  Years of Experience
                </label>
                <input
                  type="number"
                  className="input"
                  min={0}
                  max={50}
                  value={form.years_experience}
                  onChange={(e) => setForm((f) => ({ ...f, years_experience: e.target.value }))}
                  placeholder="5"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                  Target Role
                </label>
                <input
                  type="text"
                  className="input"
                  value={form.target_role}
                  onChange={(e) => setForm((f) => ({ ...f, target_role: e.target.value }))}
                  placeholder="e.g. Frontend Developer"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                  Target Industry
                </label>
                <input
                  type="text"
                  className="input"
                  value={form.target_industry}
                  onChange={(e) => setForm((f) => ({ ...f, target_industry: e.target.value }))}
                  placeholder="e.g. Tech, Finance"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>
        ) : !profile ? (
          <div style={{ padding: 48, textAlign: 'center', borderStyle: 'dashed', borderColor: 'var(--border)' }}>
            <div style={{ fontSize: 56, marginBottom: 20, opacity: 0.5 }}>◇</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 16, maxWidth: 400, margin: '0 auto 24px' }}>
              No profile yet. Upload your resume to auto-fill, or edit manually.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/resume" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                Upload Resume
              </Link>
              <button onClick={handleEdit} className="btn btn-ghost">
                Create Profile Manually
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Full Name</span>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 4 }}>{profile.full_name || '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Email</span>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 4 }}>{profile.email || '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Phone</span>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 4 }}>{profile.phone || '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Experience Level</span>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 4 }}>{profile.experience_level || '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Years of Experience</span>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 4 }}>{profile.years_experience != null ? `${profile.years_experience} years` : '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Target Role</span>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 4 }}>{profile.target_role || '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Target Industry</span>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 4 }}>{profile.target_industry || '—'}</div>
              </div>
            </div>
            {profile.professional_summary && (
              <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
                <h4 style={{ color: 'var(--accent)', marginBottom: 12, fontSize: 14, fontWeight: 600 }}>Professional Summary</h4>
                <p style={{ color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{profile.professional_summary}</p>
              </div>
            )}
            {profile.education_summary && (
              <div style={{ marginTop: 24 }}>
                <h4 style={{ color: 'var(--accent)', marginBottom: 12, fontSize: 14, fontWeight: 600 }}>Education</h4>
                <p style={{ color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{profile.education_summary}</p>
              </div>
            )}
            {profile.skills && profile.skills.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h4 style={{ color: 'var(--accent)', marginBottom: 12, fontSize: 14, fontWeight: 600 }}>Skills</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {profile.skills.map((s) => (
                    <span key={s.skill_name} className="badge badge-info" style={{ padding: '8px 14px', fontSize: 13 }}>
                      {s.skill_name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
