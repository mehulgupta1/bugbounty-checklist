import { useState, useEffect, useCallback, useRef } from "react";
import { DEFAULT_HOW_TO_TEST, DEFAULT_GUIDE } from "../data/defaultGuides";
import { CHECK_STATUS, STATUS_ORDER } from "../data/constants";
import WafSuggester from "./WafSuggester";

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
 * Parse guide text to separate commands from description.
 */
function parseGuideContent(text) {
  if (!text) return [];
  const lines = text.split("\n");
  const blocks = [];
  let currentText = [];

  const isCommand = (line) => {
    const trimmed = line.trim();
    return (
      trimmed.startsWith("Run:") ||
      trimmed.startsWith("$") ||
      trimmed.startsWith("sudo ") ||
      trimmed.startsWith("curl ") ||
      trimmed.startsWith("nmap ") ||
      trimmed.startsWith("dig ") ||
      trimmed.startsWith("sqlmap ") ||
      trimmed.startsWith("nuclei ") ||
      trimmed.startsWith("amass ") ||
      trimmed.startsWith("subfinder ") ||
      trimmed.startsWith("gobuster ") ||
      trimmed.startsWith("ffuf ") ||
      trimmed.startsWith("wfuzz ") ||
      trimmed.startsWith("python ") ||
      trimmed.startsWith("go install")
    );
  };

  lines.forEach((line) => {
    if (isCommand(line)) {
      if (currentText.length > 0) {
        blocks.push({ type: "text", content: currentText.join("\n") });
        currentText = [];
      }
      // Strip "Run: " prefix for cleaner command
      const cmd = line.trim().startsWith("Run: ") ? line.trim().slice(5) : line.trim();
      blocks.push({ type: "command", content: cmd });
    } else {
      currentText.push(line);
    }
  });

  if (currentText.length > 0) {
    blocks.push({ type: "text", content: currentText.join("\n") });
  }

  return blocks;
}

/**
 * A command block with copy-to-clipboard.
 */
function CommandBlock({ command, targetDomain }) {
  const [copied, setCopied] = useState(false);

  const processedCommand = targetDomain
    ? command.replace(/\{\{TARGET\}\}|<target>|\[TARGET\]/gi, targetDomain)
    : command;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(processedCommand).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="command-block">
      {processedCommand}
      <button
        className={`command-copy-btn ${copied ? "command-copy-btn--copied" : ""}`}
        onClick={handleCopy}
        title="Copy command"
      >
        {copied ? "✅ Copied" : "📋 Copy"}
      </button>
    </div>
  );
}

/**
 * A single check item with multi-status, guide panel, notes, and edit/delete actions.
 */
export default function CheckItem({
  check,
  status,
  onCycleStatus,
  onSetStatus,
  onDelete,
  onEdit,
  guide,
  onEditGuide,
  note,
  onUpdateNote,
  searchQuery,
  isEditMode,
  isDraggable,
  dragHandleProps,
  scope,
}) {
  const [expanded, setExpanded] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [editingGuide, setEditingGuide] = useState(false);
  const [draftGuide, setDraftGuide] = useState(guide);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Parse scope domains
  const rawDomains = (scope?.inScope || "").split("\n").map(d => d.trim()).filter(Boolean);
  const domains = [...new Set(rawDomains.map(d => d.startsWith("*.") ? d.slice(2) : d))];
  const [selectedTarget, setSelectedTarget] = useState(domains[0] || "");

  // Update selected target if domains change
  useEffect(() => {
    if (domains.length > 0 && !domains.includes(selectedTarget)) {
      setSelectedTarget(domains[0]);
    } else if (domains.length === 0 && selectedTarget !== "") {
      setSelectedTarget("");
    }
  }, [scope?.inScope]);

  const statusInfo = CHECK_STATUS[status] || CHECK_STATUS.not_tested;
  const hasNotes = note?.text?.trim();

  const handleCycleStatus = useCallback(() => {
    if (!isEditMode) onCycleStatus();
  }, [isEditMode, onCycleStatus]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    if (!isEditMode) setShowStatusDropdown((v) => !v);
  }, [isEditMode]);

  const handleSetStatus = useCallback((newStatus) => {
    onSetStatus(newStatus);
    setShowStatusDropdown(false);
  }, [onSetStatus]);

  // Close dropdown on outside click
  const handleBlur = useCallback(() => {
    setTimeout(() => setShowStatusDropdown(false), 200);
  }, []);

  const fileInputRef = useRef(null);

  const handleScreenshot = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const screenshots = [...(note?.screenshots || []), ev.target.result];
      onUpdateNote({ ...note, text: note?.text || "", screenshots });
    };
    reader.readAsDataURL(file);
  };

  const removeScreenshot = (index) => {
    const screenshots = [...(note?.screenshots || [])];
    screenshots.splice(index, 1);
    onUpdateNote({ ...note, screenshots });
  };

  const guideBlocks = expanded ? parseGuideContent(guide) : [];

  return (
    <div className={`check-item check-item--${status}`}>
      <div className="check-item-row">
        {/* Drag handle */}
        {isDraggable && (
          <span className="drag-handle" {...dragHandleProps}>⠿</span>
        )}

        {/* Status Dot */}
        {!isEditMode && (
          <div className="status-dot-wrap">
            <button
              className={`status-dot ${statusInfo.dotClass}`}
              onClick={handleCycleStatus}
              onContextMenu={handleContextMenu}
              onBlur={handleBlur}
              title={`${statusInfo.label} — Click to cycle, right-click for options`}
              aria-label={`Status: ${statusInfo.label}`}
            >
              {status === "not_vulnerable" && "✓"}
              {status === "vulnerable" && "!"}
              {status === "needs_retest" && "?"}
              {status === "in_progress" && "◐"}
            </button>

            {showStatusDropdown && (
              <div className="status-dropdown" ref={dropdownRef}>
                {STATUS_ORDER.map((s) => {
                  const info = CHECK_STATUS[s];
                  return (
                    <button
                      key={s}
                      className={`status-dropdown-item ${s === status ? "status-dropdown-item--active" : ""}`}
                      onClick={() => handleSetStatus(s)}
                    >
                      <span className="status-dropdown-dot" style={{ background: info.color }} />
                      {info.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="check-content">
          <div className="check-text-row">
            <span
              className={`check-text check-text--${status} ${isEditMode ? "check-text--readonly" : ""}`}
              onClick={!isEditMode ? handleCycleStatus : undefined}
            >
              {highlightAll(check.text, searchQuery)}
            </span>

            <div className="check-actions">
              {/* Notes button */}
              <button
                className={`btn-notes ${notesOpen ? "btn-notes--open" : ""} ${hasNotes ? "btn-notes--has-notes" : ""}`}
                onClick={() => setNotesOpen(!notesOpen)}
                title="Notes & evidence"
              >
                📝{hasNotes ? " •" : ""}
              </button>

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

          {/* Notes Panel */}
          {notesOpen && (
            <div className="notes-panel">
              <div className="notes-panel-header">
                <span className="notes-panel-title">📝 Notes & Evidence</span>
              </div>
              <textarea
                className="notes-textarea"
                value={note?.text || ""}
                onChange={(e) => onUpdateNote({ ...(note || {}), text: e.target.value, screenshots: note?.screenshots || [] })}
                placeholder="Add your findings, payloads, observations..."
              />
              {/* Screenshots */}
              {(note?.screenshots || []).length > 0 && (
                <div className="notes-screenshots">
                  {note.screenshots.map((src, i) => (
                    <div key={i} className="notes-screenshot-thumb">
                      <img src={src} alt={`Screenshot ${i + 1}`} />
                      <button className="notes-screenshot-delete" onClick={() => removeScreenshot(i)}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleScreenshot} style={{ display: "none" }} />
              <button className="notes-add-screenshot" onClick={() => fileInputRef.current?.click()}>
                📎 Add Screenshot
              </button>
            </div>
          )}

          {/* Guide Panel with Command Snippets */}
          {expanded && (
            <div className="guide-panel">
              <div className="guide-header">
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span className="guide-title">⌨ Testing Guide</span>
                  {domains.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: 10, color: "var(--color-text-faint)", fontWeight: 600 }}>TARGET:</span>
                      <select 
                        value={selectedTarget} 
                        onChange={(e) => setSelectedTarget(e.target.value)}
                        style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text)", cursor: "pointer", outline: "none" }}
                      >
                        {domains.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  )}
                </div>
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
                <div>
                  {guideBlocks.map((block, i) =>
                    block.type === "command" ? (
                      <CommandBlock key={i} command={block.content} targetDomain={selectedTarget} />
                    ) : (
                      <span key={i} className="guide-text-line" style={{ fontFamily: "var(--font-mono)", fontSize: 12, whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
                        {block.content}
                      </span>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {/* WAF Suggester - only show if status is waf_blocked */}
          {status === "waf_blocked" && (
            <WafSuggester categoryHint={check.text} />
          )}
        </div>
      </div>
    </div>
  );
}
