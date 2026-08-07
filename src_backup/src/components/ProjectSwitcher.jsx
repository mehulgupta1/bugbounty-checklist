import { useState } from "react";

/**
 * Project switcher dropdown in the sidebar.
 */
export default function ProjectSwitcher({
  projects,
  activeProjectId,
  onSwitch,
  onCreate,
  onDelete,
  onRename,
  onDuplicate,
}) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const startRename = (e, project) => {
    e.stopPropagation();
    setRenaming(project.id);
    setRenameValue(project.name);
  };

  const submitRename = () => {
    if (renameValue.trim() && renaming) {
      onRename(renaming, renameValue.trim());
    }
    setRenaming(null);
  };

  return (
    <div className="project-switcher">
      <button
        className="project-switcher-current"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="project-switcher-dot" />
        <span className="project-switcher-name">
          {activeProject?.name || "Select Project"}
        </span>
        <span className={`project-switcher-arrow ${open ? "project-switcher-arrow--open" : ""}`}>
          ▼
        </span>
      </button>

      {open && (
        <div className="project-dropdown">
          {projects.map((p) => (
            <div
              key={p.id}
              className={`project-dropdown-item ${p.id === activeProjectId ? "project-dropdown-item--active" : ""}`}
              onClick={() => { onSwitch(p.id); setOpen(false); }}
            >
              {renaming === p.id ? (
                <input
                  className="form-input"
                  style={{ fontSize: 12, padding: "4px 8px", flex: 1 }}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={submitRename}
                  onKeyDown={(e) => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRenaming(null); }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.id === activeProjectId ? "🟢" : "⚪"} {p.name}
                  </span>
                  <span className="project-dropdown-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="project-dropdown-action-btn" onClick={(e) => startRename(e, p)} title="Rename">✎</button>
                    <button className="project-dropdown-action-btn" onClick={() => onDuplicate(p.id)} title="Duplicate">📋</button>
                    {projects.length > 1 && (
                      <button className="project-dropdown-action-btn project-dropdown-action-btn--delete" onClick={() => onDelete(p.id)} title="Delete">🗑</button>
                    )}
                  </span>
                </>
              )}
            </div>
          ))}
          <button
            className="project-dropdown-new"
            onClick={() => { onCreate("New Project"); setOpen(false); }}
          >
            + New Project
          </button>
        </div>
      )}
    </div>
  );
}
