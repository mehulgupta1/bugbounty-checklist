import { useState, useCallback } from "react";
import { DEFAULT_HOW_TO_TEST, DEFAULT_GUIDE } from "../data/defaultGuides";

/**
 * Highlight all occurrences of the search query in text.
 */
function highlightAll(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="search-highlight">{part}</mark>
    ) : (
      part
    )
  );
}

/**
 * A single check item with toggle, guide panel, and edit/delete actions.
 */
export default function CheckItem({
  check,
  checked,
  onToggle,
  onDelete,
  onEdit,
  guide,
  onEditGuide,
  searchQuery,
  isEditMode,
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingGuide, setEditingGuide] = useState(false);
  const [draftGuide, setDraftGuide] = useState(guide);

  const handleToggle = useCallback(() => {
    if (!isEditMode) onToggle();
  }, [isEditMode, onToggle]);

  return (
    <div className={`check-item ${checked ? "check-item--done" : "check-item--undone"}`}>
      <div className="check-item-row">
        {/* Checkbox */}
        {!isEditMode && (
          <input
            type="checkbox"
            checked={checked}
            onChange={handleToggle}
            className={`check-checkbox ${checked ? "check-checkbox--done" : "check-checkbox--undone"}`}
            aria-label={check.text}
          />
        )}

        <div className="check-content">
          <div className="check-text-row">
            <span
              className={`check-text ${checked ? "check-text--done" : "check-text--undone"} ${isEditMode ? "check-text--readonly" : ""}`}
              onClick={!isEditMode ? handleToggle : undefined}
            >
              {highlightAll(check.text, searchQuery)}
            </span>

            <div className="check-actions">
              <button
                className={`btn-guide ${expanded ? "btn-guide--open" : "btn-guide--closed"}`}
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
                aria-label={expanded ? "Hide testing guide" : "Show testing guide"}
              >
                <span style={{ fontSize: 9 }}>{expanded ? "▲" : "▼"}</span>
                {expanded ? "Hide" : "How to test"}
              </button>

              {isEditMode && (
                <>
                  <button
                    className="btn-inline-edit"
                    onClick={() => onEdit(check)}
                    aria-label="Edit check"
                  >
                    ✎
                  </button>
                  <button
                    className="btn-inline-delete"
                    onClick={() => onDelete(check.id)}
                    aria-label="Delete check"
                  >
                    🗑
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Guide Panel */}
          {expanded && (
            <div className="guide-panel">
              <div className="guide-header">
                <span className="guide-title">⌨ Testing Guide</span>
                {!editingGuide && (
                  <button
                    className="btn-guide-edit"
                    onClick={() => { setEditingGuide(true); setDraftGuide(guide); }}
                  >
                    ✎ Edit guide
                  </button>
                )}
              </div>

              {editingGuide ? (
                <div>
                  <textarea
                    className="guide-textarea"
                    value={draftGuide}
                    onChange={(e) => setDraftGuide(e.target.value)}
                  />
                  <div className="guide-edit-actions">
                    <button
                      className="btn-guide-save"
                      onClick={() => { onEditGuide(check.id, draftGuide); setEditingGuide(false); }}
                    >
                      Save
                    </button>
                    <button
                      className="btn-guide-cancel"
                      onClick={() => setEditingGuide(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <pre className="guide-content">{guide}</pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
