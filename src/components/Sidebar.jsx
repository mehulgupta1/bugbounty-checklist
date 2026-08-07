import ProjectSwitcher from "./ProjectSwitcher";
import { TESTED_STATUSES } from "../data/constants";
import { formatTimeCompact } from "../hooks/useTimer";

/**
 * Sidebar with project switcher, branding, progress ring, and category navigation.
 */
export default function Sidebar({
  categories,
  activeTab,
  setActiveTab,
  progress,
  globalPct,
  totalTested,
  totalAll,
  totalVulns,
  isEditMode,
  onResetProgress,
  onAddCategory,
  onDeleteCategory,
  // Projects
  projects,
  activeProjectId,
  onSwitchProject,
  onCreateProject,
  onDeleteProject,
  onRenameProject,
  onDuplicateProject,
  // Views
  currentView,
  onSetView,
  // Timers
  timers,
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

      {/* Project Switcher */}
      <ProjectSwitcher
        projects={projects}
        activeProjectId={activeProjectId}
        onSwitch={onSwitchProject}
        onCreate={onCreateProject}
        onDelete={onDeleteProject}
        onRename={onRenameProject}
        onDuplicate={onDuplicateProject}
      />

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
              <span className="progress-ring-count">{totalTested}/{totalAll}</span>
            </div>
          </div>

          <div className="progress-stats">
            <div className="progress-stat">
              <div className="progress-stat-value">{totalAll}</div>
              <div className="progress-stat-label">Checks</div>
            </div>
            <div className="progress-stat">
              <div className="progress-stat-value progress-stat-value--green">{totalTested}</div>
              <div className="progress-stat-label">Tested</div>
            </div>
            <div className="progress-stat">
              <div className="progress-stat-value progress-stat-value--red">{totalVulns}</div>
              <div className="progress-stat-label">Vulns</div>
            </div>
          </div>

          <button className="btn-reset" onClick={onResetProgress}>
            ↺ Reset progress
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="sidebar-actions">
        <button
          className={`sidebar-action-btn ${currentView === "dashboard" ? "sidebar-action-btn--active" : ""}`}
          onClick={() => onSetView(currentView === "dashboard" ? "checklist" : "dashboard")}
        >
          <span className="sidebar-action-icon">📊</span>
          Dashboard
        </button>
        <button
          className={`sidebar-action-btn ${currentView === "payloads" ? "sidebar-action-btn--active" : ""}`}
          onClick={() => onSetView(currentView === "payloads" ? "checklist" : "payloads")}
        >
          <span className="sidebar-action-icon">💣</span>
          Payload Vault
        </button>
        <button
          className={`sidebar-action-btn ${currentView === "sandbox" ? "sidebar-action-btn--active" : ""}`}
          onClick={() => onSetView(currentView === "sandbox" ? "checklist" : "sandbox")}
        >
          <span className="sidebar-action-icon">🧪</span>
          PoC Sandbox
        </button>
        <button
          className={`sidebar-action-btn ${currentView === "fingerprint" ? "sidebar-action-btn--active" : ""}`}
          onClick={() => onSetView(currentView === "fingerprint" ? "checklist" : "fingerprint")}
        >
          <span className="sidebar-action-icon">🧠</span>
          Fingerprint
        </button>
      </div>


      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Category navigation">
        <div className="sidebar-nav-heading">DOMAINS</div>
        {categories.map((cat) => {
          const cc = cat.sections.flatMap((s) => s.checks);
          const cd = cc.filter((c) => TESTED_STATUSES.includes(progress[c.id])).length;
          const active = activeTab === cat.id && currentView === "checklist";
          const elapsed = timers?.[cat.id]?.elapsed || 0;

          return (
            <div key={cat.id} className="nav-item-wrap">
              <button
                className={`nav-item ${active ? "nav-item--active" : "nav-item--inactive"}`}
                onClick={() => { setActiveTab(cat.id); onSetView("checklist"); }}
                aria-current={active ? "page" : undefined}
              >
                <span className="nav-item-icon">{cat.icon}</span>
                <span className={`nav-item-label ${active ? "nav-item-label--active" : "nav-item-label--inactive"}`}>
                  {cat.label}
                </span>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                  <span className={`nav-item-badge ${active ? "nav-item-badge--active" : "nav-item-badge--inactive"}`}>
                    {cd}/{cc.length}
                  </span>
                  {elapsed > 0 && (
                    <span className="nav-item-timer">⏱ {formatTimeCompact(elapsed)}</span>
                  )}
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
