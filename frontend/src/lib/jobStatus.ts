/** Semantic class suffix for job pipeline status (pairs with `.ez-status-pill` in CSS). */
export function jobStatusPillClass(status: string | undefined | null): string {
  const k = (status || 'applied').toLowerCase();
  const map: Record<string, string> = {
    applied: 'ez-status-pill--applied',
    screening: 'ez-status-pill--screening',
    interview: 'ez-status-pill--interview',
    offered: 'ez-status-pill--offered',
    rejected: 'ez-status-pill--rejected',
  };
  return `ez-status-pill ${map[k] ?? map.applied}`;
}
