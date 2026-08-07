import { useState, useEffect } from "react";
import { SEV } from "../data/constants";
import { DEFAULT_HOW_TO_TEST, DEFAULT_GUIDE } from "../data/defaultGuides";
import CheckItem from "./CheckItem";

/**
 * Collapsible section containing multiple check items.
 */
export default function Section({
  section,
  catId,
  progress,
  onToggle,
  searchQuery,
  expandAll,
  isEditMode,
  onDeleteSection,
  onEditSection,
  onAddCheck,
  onDeleteCheck,
  onEditCheck,
  onEditGuide,
  guides,
}) {
  const [open, setOpen] = useState(expandAll || !!searchQuery);

  useEffect(() => {
    setOpen(expandAll || !!searchQuery);
  }, [expandAll, searchQuery]);

  const total = section.checks.length;
  const done = section.checks.filter((c) => progress[c.id]).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const filtered = searchQuery
    ? section.checks.filter((c) =>
        c.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : section.checks;

  if (searchQuery && filtered.length === 0) return null;

  const getGuide = (check) => {
    if (guides[check.id]) return guides[check.id];
    if (DEFAULT_HOW_TO_TEST[check.text]) return DEFAULT_HOW_TO_TEST[check.text];
    return DEFAULT_GUIDE;
  };

  return (
    <div className="section-card">
      {/* Section Header */}
      <div
        className={`section-header ${open ? "section-header--open" : "section-header--closed"}`}
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${section.name} — ${done} of ${total} done`}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(!open); } }}
      >
        <span className={`section-arrow ${open ? "section-arrow--open" : "section-arrow--closed"}`}>
          ▶
        </span>
        <span className="section-name">{section.name}</span>

        <span className="section-count">
          <span className={`section-count-done ${done > 0 ? "section-count-done--active" : ""}`}>
            {done}
          </span>
          /{total}
        </span>

        <div className="section-minibar">
          <div
            className="section-minibar-fill"
            style={{
              width: `${pct}%`,
              background: pct === 100 ? "#059669" : "#2563eb",
            }}
          />
        </div>

        {isEditMode && (
          <div className="section-edit-btns" onClick={(e) => e.stopPropagation()}>
            <button
              className="btn-section-edit"
              onClick={() => onEditSection(section)}
              aria-label="Edit section"
            >
              ✎
            </button>
            <button
              className="btn-section-delete"
              onClick={() => onDeleteSection(section.id)}
              aria-label="Delete section"
            >
              🗑
            </button>
          </div>
        )}
      </div>

      {/* Check Items */}
      {open && (
        <div role="list">
          {(searchQuery ? filtered : section.checks).map((check) => (
            <CheckItem
              key={check.id}
              check={check}
              checked={!!progress[check.id]}
              onToggle={() => onToggle(check.id)}
              onDelete={onDeleteCheck}
              onEdit={onEditCheck}
              guide={getGuide(check)}
              onEditGuide={onEditGuide}
              searchQuery={searchQuery}
              isEditMode={isEditMode}
            />
          ))}
          {isEditMode && (
            <div className="section-add-check-wrap">
              <button
                className="btn-add-check"
                onClick={() => onAddCheck(catId, section.id)}
              >
                + Add Check
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
