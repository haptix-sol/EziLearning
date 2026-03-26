import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, type LevelProgress } from '../../lib/api';
import { ProfileDropdown } from '../ProfileDropdown';
import { AddGoalModal } from '../AddGoalModal';
import { NotificationBell } from '../NotificationBell';
import { ThemeToggle } from '../ThemeToggle';

const SIDEBAR_WIDTH = 252;

const navItems = [
  { to: '/', label: 'Home', icon: '⌂' },
  { to: '/roadmap', label: 'Roadmap', icon: '▸' },
  { to: '/study', label: 'Study plan', icon: '📖' },
  { to: '/levels', label: 'Levels', icon: '◆' },
  { to: '/videos', label: 'Videos', icon: '▶' },
  { to: '/questions', label: 'Questions', icon: '?' },
  { to: '/challenges', label: 'Coding', icon: '{ }' },
  { to: '/notes', label: 'Notes', icon: '📝' },
  { to: '/goals', label: 'Goals', icon: '🎯' },
  { to: '/jobs', label: 'Jobs', icon: '◉' },
  { to: '/progress', label: 'Progress', icon: '▣' },
];

export function DashboardLayout() {
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const { data: level } = useQuery<LevelProgress>({
    queryKey: ['level'],
    queryFn: async () => {
      const { data } = await api.get('/study/level');
      return data;
    },
  });

  return (
    <div className="ez-app">
      <div className="ez-shell__glow" aria-hidden />

      {mobileNavOpen && (
        <button
          type="button"
          className="ez-sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside
        className={`ez-sidebar${mobileNavOpen ? ' ez-sidebar--open' : ''}`}
        style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH }}
      >
        <div className="ez-sidebar__brand">
          <Link to="/" className="ez-brand ez-brand--sidebar" onClick={() => setMobileNavOpen(false)}>
            <span className="ez-brand__mark">E</span>
            <span className="ez-brand__text">
              <span className="ez-brand__name">EziLearning</span>
              <span className="ez-brand__tag">Interview &amp; skills</span>
            </span>
          </Link>
          {level != null && (
            <div className="ez-sidebar__level">
              <span className="badge badge-success">Lv.{level.level}</span>
              <span className="ez-sidebar__streak" title="Day streak">
                🔥 {level.streak_days}
              </span>
            </div>
          )}
          <button type="button" className="ez-btn-goal ez-btn-goal--sidebar" onClick={() => setGoalModalOpen(true)}>
            <span>+</span> New goal
          </button>
        </div>
        <nav className="ez-sidebar__nav" aria-label="Primary">
          {navItems.map(({ to, label, icon }) => {
            const isActive =
              to === '/'
                ? location.pathname === '/'
                : location.pathname === to || location.pathname.startsWith(`${to}/`);
            return (
              <Link
                key={to}
                to={to}
                className={`ez-sidebar__link${isActive ? ' ez-sidebar__link--active' : ''}`}
                onClick={() => setMobileNavOpen(false)}
              >
                <span className="ez-sidebar__icon" aria-hidden>{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="ez-sidebar-spacer" style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH, flexShrink: 0 }} aria-hidden />

      <div className="ez-main-column">
        <header className="ez-topbar">
          <div className="ez-topbar__inner">
            <button
              type="button"
              className="ez-menu-btn"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              ☰
            </button>

            <div className="ez-search" role="search">
              <div className="ez-search__wrap">
                <span className="ez-search__icon" aria-hidden>🔍</span>
                <input
                  type="search"
                  className="ez-search__input"
                  placeholder="Search topics, skills, or goals…"
                  aria-label="Search"
                  readOnly
                  onFocus={(e) => e.target.blur()}
                  title="Search coming soon"
                />
              </div>
            </div>

            <div className="ez-topbar__actions">
              <ThemeToggle />
              <NotificationBell />
              <ProfileDropdown />
            </div>
          </div>
        </header>

        <AddGoalModal open={goalModalOpen} onClose={() => setGoalModalOpen(false)} />

        <main className="ez-main layout-main">
          <div className="ez-main__inner">
            <Outlet />
          </div>
        </main>

        <footer className="ez-footer">
          <div className="ez-footer__inner">
            <span>© {new Date().getFullYear()} EziLearning — structured prep, one step at a time.</span>
            <div className="ez-footer__links">
              <Link to="/resume">Resume</Link>
              <Link to="/profile">Profile</Link>
              <a href="https://www.geeksforgeeks.org/" target="_blank" rel="noopener noreferrer">
                Learning inspiration
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
