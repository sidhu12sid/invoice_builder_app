'use client';

export type View = 'create' | 'saved' | 'clients' | 'profile';

/** Small inline icons so the collapsed rail still reads at a glance. */
const ICONS: Record<View, React.ReactNode> = {
  create: (
    <>
      <path d="M14 2H6v20h12V7z" />
      <path d="M14 2v5h5M12 11v6M9 14h6" />
    </>
  ),
  saved: (
    <>
      <path d="M3 7h13v14H3zM7 7V3h14v14h-5" />
      <path d="M6 12h7M6 16h7" />
    </>
  ),
  clients: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11a3 3 0 1 0-2-5.2M21 20c0-2.4-1.4-4.4-3.4-5.4" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </>
  ),
};

const ITEMS: { id: View; label: string; hint: string }[] = [
  { id: 'create', label: 'Create invoice', hint: 'Fill in a new invoice' },
  { id: 'saved', label: 'Saved invoices', hint: 'View, print, email' },
  { id: 'clients', label: 'Clients', hint: 'People you bill' },
  { id: 'profile', label: 'My details', hint: 'Your name and bank details' },
];

type Props = {
  view: View;
  onChange: (view: View) => void;
  account: string;
  synced: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onSignOut: () => void;
};

export default function Sidebar({
  view,
  onChange,
  account,
  synced,
  collapsed,
  onToggle,
  onSignOut,
}: Props) {
  return (
    <nav className={`sidebar${collapsed ? ' is-collapsed' : ''}`}>
      <div className="sidebar__top">
        {!collapsed && <span className="sidebar__brand">Invoice Generator</span>}
        <button
          type="button"
          className="sidebar__toggle"
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d={collapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <ul className="sidebar__nav">
        {ITEMS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`sidebar__link${view === item.id ? ' is-active' : ''}`}
              onClick={() => onChange(item.id)}
              aria-current={view === item.id ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
            >
              <svg
                className="sidebar__icon"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {ICONS[item.id]}
              </svg>

              {!collapsed && (
                <span className="sidebar__text">
                  <span className="sidebar__label">{item.label}</span>
                  <span className="sidebar__hint">{item.hint}</span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {!collapsed && (
        <div className="sidebar__foot">
          <span className="badge badge--block" title={account}>
            {synced ? account || 'Synced' : 'This browser only'}
          </span>
          {synced && (
            <button type="button" className="linkBtn" onClick={onSignOut}>
              Sign out
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
