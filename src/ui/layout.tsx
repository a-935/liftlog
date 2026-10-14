import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { navigate, type Route } from '../router';
import type { DayType } from '../db/schema';
import { DAY_LABEL } from '../lib/format';
import { haptic } from '../lib/haptics';

export function TopBar({ title, subtitle, back, right }: { title: ReactNode; subtitle?: ReactNode; back?: () => void; right?: ReactNode }) {
  return (
    <header className="topbar">
      {back ? (
        <button className="icon-btn" onClick={back} aria-label="Back">
          <Icon name="back" />
        </button>
      ) : (
        <span className="topbar-spacer" />
      )}
      <div className="topbar-titles">
        <h1 className="topbar-title">{title}</h1>
        {subtitle && <div className="topbar-sub">{subtitle}</div>}
      </div>
      {right ?? <span className="topbar-spacer" />}
    </header>
  );
}

/** Large page heading used on the tab screens. */
export function PageHeader({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <header className="page-header">
      {sub && <div className="page-sub">{sub}</div>}
      <h1 className="page-title">{title}</h1>
    </header>
  );
}

const TABS: { name: Route['name']; path: string; label: string; icon: IconName }[] = [
  { name: 'home', path: '/', label: 'Home', icon: 'home' },
  { name: 'history', path: '/history', label: 'History', icon: 'history' },
  { name: 'progress', path: '/progress', label: 'Progress', icon: 'chart' },
  { name: 'exercises', path: '/exercises', label: 'Exercises', icon: 'list' },
  { name: 'settings', path: '/settings', label: 'Settings', icon: 'gear' },
];

export function TabBar({ active }: { active: Route['name'] }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <button
          key={t.name}
          className={`tab${active === t.name ? ' active' : ''}`}
          aria-current={active === t.name ? 'page' : undefined}
          onClick={() => {
            if (active === t.name) return window.scrollTo({ top: 0, behavior: 'smooth' });
            haptic();
            navigate(t.path);
          }}
        >
          <Icon name={t.icon} size={24} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function DayBadge({ type, label }: { type: DayType; label?: string }) {
  return <span className={`day-badge day-${type}`}>{label ?? DAY_LABEL[type]}</span>;
}

export function EmptyState({ icon, title, text, children }: { icon: IconName; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={30} />
      </div>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
