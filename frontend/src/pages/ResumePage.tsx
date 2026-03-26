import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ResumeData } from '../lib/api';

export function ResumePage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const queryClient = useQueryClient();

  const { data: resume, isLoading } = useQuery<ResumeData | null>({
    queryKey: ['resume'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/resumes/me');
        return data;
      } catch {
        return null;
      }
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (f: File) => {
      const form = new FormData();
      form.append('file', f);
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${baseURL}/resumes/upload`, {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = Array.isArray(err.detail) ? err.detail[0]?.msg : err.detail;
        throw new Error(typeof msg === 'string' ? msg : 'Upload failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setFile(null);
      setUploadError('');
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      setUploadError(err?.response?.data?.detail || err.message || 'Upload failed');
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/content/generate');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
  });

  const handleUpload = () => {
    if (!file) return;
    if (!file.name.match(/\.(pdf|docx)$/i)) {
      setUploadError('Only PDF and DOCX files are supported');
      return;
    }
    uploadMutation.mutate(file);
  };

  return (
    <div className="animate-fade-in">
      <h1 style={{
        color: 'var(--text-primary)',
        marginBottom: 8,
        fontSize: 28,
        fontWeight: 700,
        letterSpacing: '-0.02em',
      }}>
        Resume
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: 15 }}>
        Upload your resume to extract skills and personalize your preparation.
      </p>

      <div className="card animate-slide-up" style={{ marginBottom: 28, padding: 28 }}>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: 12, fontSize: 18, fontWeight: 600 }}>
          Upload Resume
        </h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14 }}>
          PDF or DOCX. We'll extract skills, experience, and education.
        </p>
        <div
          style={{
            padding: 24,
            background: 'var(--bg-base)',
            borderRadius: 'var(--radius-md)',
            border: '2px dashed var(--border)',
            marginBottom: 16,
            transition: 'border-color var(--duration-fast), background var(--duration-fast)',
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.background = 'var(--accent-muted)';
          }}
          onDragLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.background = 'var(--bg-base)';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.background = 'var(--bg-base)';
            const f = e.dataTransfer.files[0];
            if (f && /\.(pdf|docx)$/i.test(f.name)) setFile(f);
          }}
        >
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{
              color: 'var(--text-secondary)',
              fontSize: 14,
            }}
          />
          {file && (
            <p style={{ marginTop: 12, color: 'var(--success)', fontSize: 14 }}>
              ✓ {file.name}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleUpload}
            disabled={!file || uploadMutation.isPending}
            className="btn btn-primary"
          >
            {uploadMutation.isPending ? 'Processing...' : 'Upload'}
          </button>
        </div>
        {uploadError && (
          <p style={{ color: 'var(--danger)', marginTop: 16, fontSize: 14 }}>
            {uploadError}
          </p>
        )}
      </div>

      {resume?.profile && (
        <div className="card animate-slide-up" style={{ marginBottom: 28, padding: 28 }}>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: 12, fontSize: 18, fontWeight: 600 }}>
            Extracted Profile
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
            Experience: {resume.profile.experience_level || 'N/A'} • Years: {resume.profile.years_experience ?? 'N/A'}
          </p>
          {resume.profile.skills?.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ color: 'var(--text-muted)', marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
                Skills
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {resume.profile.skills.map((s) => (
                  <span
                    key={s.skill_name}
                    className="badge badge-info"
                    style={{ padding: '6px 12px', fontSize: 13 }}
                  >
                    {s.skill_name}
                  </span>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="btn btn-accent"
          >
            {generateMutation.isPending ? 'Generating...' : 'Generate Questions & Challenges'}
          </button>
        </div>
      )}

      {!resume && !isLoading && (
        <p style={{ color: 'var(--text-muted)' }}>Upload a resume to get started.</p>
      )}
    </div>
  );
}
