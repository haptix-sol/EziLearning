import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

/** Consistent page title + optional description + action slot (design system). */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="ez-page-header">
      <div className="ez-page-header__row">
        <div>
          <h1 className="ez-page-header__title">{title}</h1>
          {description ? <p className="ez-page-header__desc">{description}</p> : null}
        </div>
        {actions ? <div className="ez-page-header__actions">{actions}</div> : null}
      </div>
    </header>
  );
}
