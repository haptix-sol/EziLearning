import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Sparkles, UploadCloud } from 'lucide-react';
import { api, type ResumeData } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';

export function ResumePage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
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

  const handleFilePicked = (picked: File | null) => {
    if (!picked) return;
    if (!picked.name.match(/\.(pdf|docx)$/i)) {
      setUploadError('Only PDF and DOCX files are supported');
      return;
    }
    setUploadError('');
    setFile(picked);
  };

  const profile = resume?.profile;

  return (
    <div className="animate-fade-in ez-page-zone">
      <PageHeader
        title="Resume center"
        description="Upload once—we extract skills and sync your profile. Generated questions and challenges use what we learn here."
      />

      <section className="card animate-slide-up ez-resume-shell">
        <div className="ez-resume-shell__header">
          <h3 className="ez-resume-shell__title">Upload resume</h3>
          <p className="ez-resume-shell__subtitle">
            PDF or DOCX. We extract skills, experience, and education to personalize your learning path.
          </p>
        </div>

        <label
          className={`ez-resume-dropzone${isDragging ? ' ez-resume-dropzone--drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFilePicked(e.dataTransfer.files?.[0] || null);
          }}
        >
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={(e) => handleFilePicked(e.target.files?.[0] || null)}
            className="ez-resume-dropzone__input"
          />
          <div className="ez-resume-dropzone__icon" aria-hidden>
            <UploadCloud size={20} strokeWidth={1.9} />
          </div>
          <div className="ez-resume-dropzone__title">Drop your resume here</div>
          <p className="ez-resume-dropzone__hint">or click to choose a file (max 5MB)</p>
          <span className="ez-resume-dropzone__formats">Supports .pdf and .docx</span>
        </label>

        {file && (
          <div className="ez-resume-picked">
            <FileText size={16} strokeWidth={1.9} aria-hidden />
            <span className="ez-resume-picked__name">{file.name}</span>
            <span className="ez-resume-picked__size">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
          </div>
        )}

        <div className="ez-resume-actions">
          <button onClick={handleUpload} disabled={!file || uploadMutation.isPending} className="btn btn-primary">
            {uploadMutation.isPending ? 'Processing…' : 'Upload resume'}
          </button>
          {resume?.file_name && (
            <span className="ez-resume-actions__meta">Latest upload: {resume.file_name}</span>
          )}
        </div>

        {uploadError && (
          <p className="ez-resume-error">{uploadError}</p>
        )}
      </section>

      {profile && (
        <div className="ez-milestone-card animate-slide-up">
          <div className="ez-milestone-card__title">Profile unlocked</div>
          <p className="ez-milestone-card__desc">
            Your prep path, level content, and interview questions can now align with these skills. Tailor applications from the Jobs area when you are ready.
          </p>
        </div>
      )}

      {profile && (
        <section className="card animate-slide-up ez-resume-profile">
          <div className="ez-resume-profile__header">
            <div>
              <h3 className="ez-resume-profile__title">Extracted profile</h3>
              <p className="ez-resume-profile__subtitle">
                Experience: {profile.experience_level || 'N/A'} • Years: {profile.years_experience ?? 'N/A'}
              </p>
            </div>
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="btn btn-accent"
            >
              <Sparkles size={15} strokeWidth={1.9} aria-hidden />
              {generateMutation.isPending ? 'Generating…' : 'Generate Questions & Challenges'}
            </button>
          </div>

          {profile.skills?.length > 0 && (
            <div className="ez-resume-profile__skills">
              <h4 className="ez-resume-profile__skills-title">Skills detected</h4>
              <div className="ez-resume-profile__skills-list">
                {profile.skills.map((s) => (
                  <span key={s.skill_name} className="badge badge-info ez-resume-skill-pill">
                    {s.skill_name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {!resume && !isLoading && (
        <p className="ez-resume-empty">Upload a resume to get started.</p>
      )}
    </div>
  );
}
