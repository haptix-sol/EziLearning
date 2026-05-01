import { Link } from 'react-router-dom';

type MinimalAppChromeProps = {
  children: React.ReactNode;
};

/**
 * Focused shell for onboarding / first-run flows (no sidebar).
 */
export function MinimalAppChrome({ children }: MinimalAppChromeProps) {
  return (
    <div className="ez-minimal-root">
      <header className="ez-minimal-topbar">
        <Link to="/" className="ez-minimal-brand">
          EziLearnings
        </Link>
        <div className="ez-minimal-actions">
          <Link to="/" className="ez-topbar-pill">
            Dashboard
          </Link>
        </div>
      </header>
      <main className="ez-minimal-main">{children}</main>
    </div>
  );
}
