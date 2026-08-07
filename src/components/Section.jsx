import { useState, useEffect, useRef } from "react";
import { SEV, TESTED_STATUSES } from "../data/constants";
import { getDefaultGuide } from "../data/guideLookup";
import CheckItem from "./CheckItem";

/**
 * Collapsible section containing multiple check items.
 * Supports drag & drop reordering in edit mode.
 */
export default function Section({
  section,
  sectionIndex,
  catId,
  progress,
  onCycleStatus,
  onSetStatus,
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
  notes,
  onUpdateNote,
  onReorderChecks,
  onReorderSections,
  totalSections,
  scope,
}) {
  const [open, setOpen] = useState(expandAll || !!searchQuery);

  useEffect(() => {
    setOpen(expandAll || !!searchQuery);
  }, [expandAll, searchQuery]);

  const total = section.checks.length;
  const tested = section.checks.filter((c) => TESTED_STATUSES.includes(progress[c.id])).length;
  const vulns = section.checks.filter((c) => progress[c.id] === "vulnerable").length;
  const pct = total > 0 ? Math.round((tested / total) * 100) : 0;

  const filtered = searchQuery
    ? section.checks.filter((c) =>
        c.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : section.checks;

  if (searchQuery && filtered.length === 0) return null;

  const getGuide = (check) => {
    if (guides[check.id]) return guides[check.id];
    return getDefaultGuide(check);
  };

  // Drag state for checks
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const handleDragStart = (index) => {
    dragItem.current = index;
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    dragOverItem.current = index;
  };

  const handleDrop = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      onReorderChecks(catId, section.id, dragItem.current, dragOverItem.current);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // Section drag
  const sectionRef = useRef(null);

  const handleSectionDragStart = (e) => {
    e.dataTransfer.setData("sectionIndex", sectionIndex.toString());
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => sectionRef.current?.classList.add("dragging"), 0);
  };

  const handleSectionDragEnd = () => {
    sectionRef.current?.classList.remove("dragging");
  };

  const handleSectionDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleSectionDrop = (e) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData("sectionIndex"));
    if (!isNaN(fromIndex) && fromIndex !== sectionIndex) {
      onReorderSections(catId, fromIndex, sectionIndex);
    }
  };

  return (
    <div
      className="section-card"
      ref={sectionRef}
      onDragOver={isEditMode ? handleSectionDragOver : undefined}
      onDrop={isEditMode ? handleSectionDrop : undefined}
    >
      {/* Section Header */}
      <div
        className={`section-header ${open ? "section-header--open" : "section-header--closed"}`}
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${section.name} — ${tested} of ${total} tested`}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(!open); } }}
      >
        {isEditMode && (
          <span
            className="drag-handle"
            draggable
            onDragStart={handleSectionDragStart}
            onDragEnd={handleSectionDragEnd}
            onClick={(e) => e.stopPropagation()}
          >
            ⠿
          </span>
        )}

        <span className={`section-arrow ${open ? "section-arrow--open" : "section-arrow--closed"}`}>
          ▶
        </span>
        <span className="section-name">{section.name}</span>

        <span className="section-count">
          <span className={`section-count-done ${tested > 0 ? "section-count-done--active" : ""}`}>
            {tested}
          </span>
          /{total}
        </span>

        {vulns > 0 && (
          <span style={{ fontSize: 10, color: "#dc2626", fontWeight: 700, flexShrink: 0 }}>
            🔴 {vulns}
          </span>
        )}

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
          {(searchQuery ? filtered : section.checks).map((check, idx) => (
            <div
              key={check.id}
              draggable={isEditMode}
              onDragStart={isEditMode ? () => handleDragStart(idx) : undefined}
              onDragOver={isEditMode ? (e) => handleDragOver(e, idx) : undefined}
              onDrop={isEditMode ? handleDrop : undefined}
            >
              <CheckItem
                check={check}
                status={progress[check.id] || "not_tested"}
                onCycleStatus={() => onCycleStatus(check.id)}
                onSetStatus={(s) => onSetStatus(check.id, s)}
                onDelete={onDeleteCheck}
                onEdit={onEditCheck}
                guide={getGuide(check)}
                onEditGuide={onEditGuide}
                note={notes[check.id]}
                onUpdateNote={(noteData) => onUpdateNote(check.id, noteData)}
                searchQuery={searchQuery}
                isEditMode={isEditMode}
                isDraggable={isEditMode}
                scope={scope}
              />
            </div>
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
