import type { ReactNode } from 'react';

type PageSectionProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export function PageSection({ title, children, className = '' }: PageSectionProps) {
  return (
    <section className={`ez-section ${className}`.trim()}>
      {title ? <h2 className="ez-section__title">{title}</h2> : null}
      {children}
    </section>
  );
}
