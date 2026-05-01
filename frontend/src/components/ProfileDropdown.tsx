import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function ProfileDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: me } = useQuery({
    queryKey: ['me-display'],
    queryFn: async () => {
      const { data } = await api.get('/resumes/me-display');
      return data;
    },
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = me?.full_name || 'Guest';
  const avatarUrl = me?.avatar_url ? `${API_BASE}${me.avatar_url}` : null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className={`ez-profile-trigger${open ? ' ez-profile-trigger--open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <div className="ez-profile-trigger__avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span className="ez-profile-trigger__letter">{displayName.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <span className="ez-profile-trigger__chev" aria-hidden>
          ▼
        </span>
      </button>

      {open && (
        <div className="ez-profile-panel" role="menu">
          <div className="ez-profile-panel__head">
            <div className="ez-profile-panel__name">{displayName}</div>
            {me?.email ? <div className="ez-profile-panel__email">{me.email}</div> : null}
          </div>
          <div className="ez-profile-panel__links">
            <Link to="/profile" className="ez-profile-panel__link" role="menuitem" onClick={() => setOpen(false)}>
              Profile
            </Link>
            <Link to="/resume" className="ez-profile-panel__link" role="menuitem" onClick={() => setOpen(false)}>
              Resume
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
