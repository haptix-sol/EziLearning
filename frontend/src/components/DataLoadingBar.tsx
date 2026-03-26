import { useEffect, useState } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';

/**
 * Global indeterminate bar while React Query has in-flight queries or mutations.
 * Intentionally does not show URLs or API labels — only that data is loading.
 */
export function DataLoadingBar() {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const busy = fetching > 0 || mutating > 0;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (busy) {
      const show = window.setTimeout(() => setVisible(true), 100);
      return () => window.clearTimeout(show);
    }
    const hide = window.setTimeout(() => setVisible(false), 180);
    return () => window.clearTimeout(hide);
  }, [busy]);

  return (
    <div
      className={`ez-data-loading${visible ? ' ez-data-loading--active' : ''}`}
      role="progressbar"
      aria-busy={visible}
      aria-label="Loading data"
    >
      <div className="ez-data-loading__track" aria-hidden>
        <div className="ez-data-loading__bar" />
      </div>
    </div>
  );
}
