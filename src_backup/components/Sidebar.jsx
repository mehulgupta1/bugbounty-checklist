/**
 * Sidebar with branding, progress ring, and category navigation.
 */
export default function Sidebar({
  categories,
  activeTab,
  setActiveTab,
  progress,
  globalPct,
  totalDone,
  totalAll,
  isEditMode,
  onResetProgress,
  onAddCategory,
  onDeleteCategory,
}) {
  const circumference = 2 * Math.PI * 28;

  return (
    <aside className="sidebar" aria-label="Navigation">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-inner">
          <div className="sidebar-logo-icon">🐛</div>
          <div>
            <div className="sidebar-logo-title">BUG BOUNTY</div>
            <div className="sidebar-logo-subtitle">Checklist</div>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="sidebar-progress">
        <div className="sidebar-progress-card">
          <div className="progress-ring-wrap">
            <svg width={72} height={72} className="progress-ring-svg">
              <circle cx={36} cy={36} r={28} className="progress-ring-track" />
              <circle
                cx={36} cy={36} r={28}
                className="progress-ring-fill"
                stroke={globalPct === 100 ? "#059669" : "#dc2626"}
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - globalPct / 100)}
              />
            </svg>
            <div className="progress-ring-label">
              <span className="progress-ring-pct">{globalPct}%</span>
              <span className="progress-ring-count">{totalDone}/{totalAll}</span>
            </div>
          </div>

          <div className="progress-stats">
            <div className="progress-stat">
              <div className="progress-stat-value">{totalAll}</div>
              <div className="progress-stat-label">Checks</div>
            </div>
            <div className="progress-stat">
              <div className="progress-stat-value progress-stat-value--green">{totalDone}</div>
              <div className="progress-stat-label">Done</div>
            </div>
          </div>

          <button className="btn-reset" onClick={onResetProgress}>
            ↺ Reset progress
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Category navigation">
        <div className="sidebar-nav-heading">DOMAINS</div>
        {categories.map((cat) => {
          const cc = cat.sections.flatMap((s) => s.checks);
          const cd = cc.filter((c) => progress[c.id]).length;
          const active = activeTab === cat.id;

          return (
            <div key={cat.id} className="nav-item-wrap">
              <button
                className={`nav-item ${active ? "nav-item--active" : "nav-item--inactive"}`}
                onClick={() => setActiveTab(cat.id)}
                aria-current={active ? "page" : undefined}
              >
                <span className="nav-item-icon">{cat.icon}</span>
                <span className={`nav-item-label ${active ? "nav-item-label--active" : "nav-item-label--inactive"}`}>
                  {cat.label}
                </span>
                <span className={`nav-item-badge ${active ? "nav-item-badge--active" : "nav-item-badge--inactive"}`}>
                  {cd}/{cc.length}
                </span>
              </button>
              {isEditMode && cat.custom && (
                <button
                  className="nav-delete-btn"
                  onClick={() => onDeleteCategory(cat.id, cat.label)}
                  aria-label={`Delete ${cat.label} category`}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
        {isEditMode && (
          <button className="btn-new-category" onClick={onAddCategory}>
            + New Category
          </button>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-text">
          Use responsibly and only with explicit authorization
        </div>
      </div>
    </aside>
  );
}
