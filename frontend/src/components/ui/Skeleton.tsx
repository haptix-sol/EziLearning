/** Indeterminate loading blocks — pair with `.ez-skeleton` in CSS. */
export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`ez-skeleton ez-skeleton-line ${className}`.trim()} aria-hidden />;
}

export function SkeletonLineLg() {
  return <div className="ez-skeleton ez-skeleton-line ez-skeleton-line--lg" aria-hidden />;
}

export function SkeletonCard() {
  return <div className="ez-skeleton ez-skeleton-card" aria-hidden />;
}

export function RoadmapSkeleton() {
  return (
    <div className="ez-roadmap-skel" aria-busy="true" aria-label="Loading roadmap">
      <SkeletonLineLg />
      <SkeletonLine />
      <SkeletonLine />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

export function LevelMapSkeleton() {
  return (
    <div className="ez-page-zone animate-fade-in" aria-busy="true" aria-label="Loading level map">
      <div className="card ez-level-summary">
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div className="ez-skeleton" style={{ width: 56, height: 56, borderRadius: 16 }} aria-hidden />
          <div style={{ flex: 1 }}>
            <SkeletonLineLg />
            <SkeletonLine />
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 24, maxWidth: 720, margin: '0 auto' }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="ez-skeleton" style={{ width: 60, height: 60, borderRadius: '50%', margin: '0 auto' }} aria-hidden />
        ))}
      </div>
    </div>
  );
}

export function StudyDaysSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} aria-busy="true" aria-label="Loading days">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="ez-skeleton ez-skeleton-card" style={{ height: 72 }} aria-hidden />
      ))}
    </div>
  );
}
