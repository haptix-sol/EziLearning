import type { ReactNode } from 'react';

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="ez-empty" role="status">
      {icon != null ? <div className="ez-empty__icon">{icon}</div> : null}
      <h2 className="ez-empty__title">{title}</h2>
      {description ? <p className="ez-empty__text">{description}</p> : null}
      {action}
    </div>
  );
}
