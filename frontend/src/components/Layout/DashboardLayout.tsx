import { useState, useCallback } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Code2,
  FileText,
  Flame,
  HelpCircle,
  Home,
  ListChecks,
  Map,
  Medal,
  Menu,
  Orbit,
  StickyNote,
  X,
} from 'lucide-react';
import { api, type LevelProgress } from '../../lib/api';
import { ProfileDropdown } from '../ProfileDropdown';
import { AddGoalModal } from '../AddGoalModal';
import { NotificationBell } from '../NotificationBell';
import { ContinueStrip } from '../ContinueStrip';

type NavItem = { to: string; label: string; Icon: typeof Home };
type NavGroup = { id: string; label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    id: 'journey',
    label: 'Learn',
    items: [
      { to: '/', label: 'Overview', Icon: Home },
      { to: '/roadmap', label: 'Roadmap', Icon: Map },
      { to: '/study', label: 'Study plan', Icon: BookOpen },
      { to: '/growth', label: 'Growth', Icon: Orbit },
    ],
  },
  {
    id: 'career',
    label: 'Career',
    items: [
      { to: '/resume', label: 'Resume', Icon: FileText },
      { to: '/jobs', label: 'Applications', Icon: Briefcase },
    ],
  },
  {
    id: 'practice',
    label: 'Practice',
    items: [
      { to: '/questions', label: 'Questions', Icon: HelpCircle },
      { to: '/challenges', label: 'Coding', Icon: Code2 },
      { to: '/cp-portfolio', label: 'CP portfolio', Icon: Medal },
      { to: '/notes', label: 'Notes', Icon: StickyNote },
    ],
  },
];

const TOPBAR_PILLS: { to: string; label: string }[] = [
  { to: '/', label: 'Overview' },
  { to: '/study', label: 'Study' },
  { to: '/challenges', label: 'Coding' },
  { to: '/cp-portfolio', label: 'CP' },
  { to: '/resume', label: 'Resume' },
];

const SIDEBAR_COLLAPSED_KEY = 'ez-sidebar-collapsed';

function readSidebarCollapsed(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function isNavActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/';
  if (to === '/growth') {
    return pathname === '/growth' || /^\/levels\/[^/]+$/.test(pathname);
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function DashboardLayout() {
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [navBoop, setNavBoop] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const location = useLocation();

  const fireNavBoop = useCallback((id: string) => {
    setNavBoop(id);
    window.setTimeout(() => setNavBoop(null), 440);
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const { data: level } = useQuery<LevelProgress>({
    queryKey: ['level'],
    queryFn: async () => {
      const { data } = await api.get('/study/level');
      return data;
    },
  });

  return (
    <div className="ez-app ez-app--stack ez-app--thita">
      <div className="ez-shell__glow" aria-hidden />

      {mobileNavOpen && (
        <button
          type="button"
          className="ez-navsheet-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <header className="ez-topbar ez-topbar--workspace ez-topbar--thita">
        <div className="ez-topbar__inner ez-topbar__inner--workspace">
          <button
            type="button"
            className="ez-menu-btn ez-icon-btn"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu size={18} strokeWidth={1.75} aria-hidden />
          </button>

          <Link to="/" className="ez-brand ez-brand--sidebar ez-brand--lockup ez-brand--text">
            <span className="ez-brand__text">
              <span className="ez-brand__name">EziLearnings</span>
              <span className="ez-brand__tag ez-brand__tag--below">Workspace — learn, build, apply</span>
            </span>
          </Link>

          <nav className="ez-topbar-center" aria-label="Quick sections">
            {TOPBAR_PILLS.map(({ to, label }) => {
              const active = isNavActive(location.pathname, to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`ez-topbar-pill${active ? ' ez-topbar-pill--active' : ''}`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <ContinueStrip />

          {level != null && (
            <div className="ez-topbar__stats" aria-label="Current learning streak">
              <span className="ez-topbar__chip">Level {level.level}</span>
              <span className="ez-topbar__chip ez-topbar__chip--warm">
                <Flame size={12} strokeWidth={1.9} aria-hidden />
                {level.streak_days}d
              </span>
            </div>
          )}

          <div className="ez-topbar__actions">
            <button type="button" className="ez-btn-goal" onClick={() => setGoalModalOpen(true)}>
              <ListChecks size={15} strokeWidth={2} aria-hidden />
              <span className="ez-btn-goal__label">New goal</span>
            </button>
            <NotificationBell />
            <ProfileDropdown />
          </div>
        </div>
      </header>

      <div className="ez-workspace">
        <aside
          className={`ez-workspace-sidebar${sidebarCollapsed ? ' ez-workspace-sidebar--collapsed' : ''}`}
          aria-label="Workspace navigation"
        >
          <div
            className={`ez-workspace-sidebar__head${sidebarCollapsed ? ' ez-workspace-sidebar__head--collapsed' : ''}`}
          >
            {!sidebarCollapsed && level != null ? (
              <div
                className="ez-ws-head-kpi"
                aria-label={`Level ${level.level}, ${level.streak_days} day streak`}
              >
                <span className="ez-ws-head-kpi__bit" title={`Level ${level.level}`}>
                  <span className="ez-ws-head-kpi__muted">Lv</span>
                  <span className="ez-ws-head-kpi__num">{level.level}</span>
                </span>
                <span className="ez-ws-head-kpi__sep" aria-hidden>
                  ·
                </span>
                <span className="ez-ws-head-kpi__bit ez-ws-head-kpi__bit--warm" title={`${level.streak_days} day streak`}>
                  <Flame size={10} strokeWidth={2.1} aria-hidden />
                  <span className="ez-ws-head-kpi__num">{level.streak_days}d</span>
                </span>
              </div>
            ) : null}
            <div className="ez-ws-head-tools">
              <button
                type="button"
                className="ez-ws-head-goal"
                onClick={() => setGoalModalOpen(true)}
                aria-label="New goal"
                title="New goal"
              >
                <ListChecks size={14} strokeWidth={2} aria-hidden />
              </button>
              <button
                type="button"
                className="ez-workspace-sidebar__collapse"
                onClick={toggleSidebarCollapsed}
                aria-expanded={!sidebarCollapsed}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? (
                  <ChevronRight size={15} strokeWidth={2} aria-hidden />
                ) : (
                  <ChevronLeft size={15} strokeWidth={2} aria-hidden />
                )}
              </button>
            </div>
          </div>

          <nav className="ez-workspace-sidebar__nav ez-scrollable" aria-label="Primary">
            {navGroups.map((group) => (
              <section
                key={group.id}
                className="ez-nav-cluster"
                {...(sidebarCollapsed
                  ? ({ 'aria-label': group.label } as const)
                  : ({ 'aria-labelledby': `desk-nav-${group.id}` } as const))}
              >
                {!sidebarCollapsed ? (
                  <h2 className="ez-nav-cluster__label" id={`desk-nav-${group.id}`}>
                    {group.label}
                  </h2>
                ) : null}
                <ul className="ez-nav-cluster__list">
                  {group.items.map(({ to, label, Icon }) => {
                    const isActive = isNavActive(location.pathname, to);
                    return (
                      <li key={to}>
                        <Link
                          to={to}
                          title={sidebarCollapsed ? label : undefined}
                          onMouseDown={() => fireNavBoop(`desk-${to}`)}
                          className={`ez-sidebar__link${isActive ? ' ez-sidebar__link--active' : ''}${navBoop === `desk-${to}` ? ' ez-sidebar__link--boop' : ''}`}
                        >
                          <span className="ez-nav-icon" aria-hidden>
                            <Icon size={15} strokeWidth={1.65} />
                          </span>
                          <span className="ez-sidebar__link-text">{label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </nav>
        </aside>

        <div className="ez-workspace-main">
          <main className="ez-main layout-main">
            <div className="ez-main__inner">
              <Outlet />
            </div>
          </main>

          <footer className="ez-footer">
            <div className="ez-footer__inner">
              <span>© {new Date().getFullYear()} EziLearnings — roadmap, resume, and applications in one workspace.</span>
              <div className="ez-footer__links">
                <Link to="/onboarding">Goal setup</Link>
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

      <aside className={`ez-navsheet${mobileNavOpen ? ' ez-navsheet--open' : ''}`} aria-label="Mobile menu">
        <div className="ez-navsheet__head">
          <div className="ez-navsheet__brand">
            <span className="ez-brand__name">EziLearnings</span>
            <span className="ez-brand__tag ez-brand__tag--below">Menu</span>
          </div>
          <button
            type="button"
            className="ez-icon-btn"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          >
            <X size={18} strokeWidth={1.9} aria-hidden />
          </button>
        </div>

        {level != null ? (
          <div className="ez-navsheet__quick">
            <div
              className="ez-ws-head-kpi ez-ws-head-kpi--navsheet"
              aria-label={`Level ${level.level}, ${level.streak_days} day streak`}
            >
              <span className="ez-ws-head-kpi__bit" title={`Level ${level.level}`}>
                <span className="ez-ws-head-kpi__muted">Lv</span>
                <span className="ez-ws-head-kpi__num">{level.level}</span>
              </span>
              <span className="ez-ws-head-kpi__sep" aria-hidden>
                ·
              </span>
              <span className="ez-ws-head-kpi__bit ez-ws-head-kpi__bit--warm" title={`${level.streak_days} day streak`}>
                <Flame size={11} strokeWidth={2} aria-hidden />
                <span className="ez-ws-head-kpi__num">{level.streak_days}d</span>
              </span>
            </div>
            <button
              type="button"
              className="ez-ws-head-goal ez-ws-head-goal--navsheet"
              onClick={() => setGoalModalOpen(true)}
              aria-label="New goal"
              title="New goal"
            >
              <ListChecks size={15} strokeWidth={2} aria-hidden />
            </button>
          </div>
        ) : null}

        <nav className="ez-navsheet__nav ez-scrollable" aria-label="Primary navigation links">
          {navGroups.map((group) => (
            <section key={group.id} className="ez-nav-cluster" aria-labelledby={`sheet-nav-${group.id}`}>
              <h2 className="ez-nav-cluster__label" id={`sheet-nav-${group.id}`}>
                {group.label}
              </h2>
              <ul className="ez-nav-cluster__list">
                {group.items.map(({ to, label, Icon }) => {
                  const isActive = isNavActive(location.pathname, to);
                  return (
                    <li key={to}>
                      <Link
                        to={to}
                        onMouseDown={() => fireNavBoop(`sheet-${to}`)}
                        className={`ez-sidebar__link${isActive ? ' ez-sidebar__link--active' : ''}${navBoop === `sheet-${to}` ? ' ez-sidebar__link--boop' : ''}`}
                        onClick={() => setMobileNavOpen(false)}
                      >
                        <span className="ez-nav-icon" aria-hidden>
                          <Icon size={15} strokeWidth={1.65} />
                        </span>
                        <span className="ez-sidebar__link-text">{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>
      </aside>

      <AddGoalModal open={goalModalOpen} onClose={() => setGoalModalOpen(false)} />
    </div>
  );
}
