import { SEV } from "../data/constants";

/**
 * Top toolbar with search, severity filter, expand/collapse, edit mode, and bulk add.
 */
export default function TopBar({
  searchQuery,
  setSearchQuery,
  sevFilter,
  setSevFilter,
  expandAll,
  setExpandAll,
  isEditMode,
  setIsEditMode,
  onBulkAdd,
}) {
  return (
    <div className="top-bar" role="toolbar" aria-label="Checklist toolbar">
      {/* Search */}
      <div className="search-wrap">
        <span className="search-icon" aria-hidden="true">🔍</span>
        <input
          type="text"
          className="search-input"
          placeholder="Search checks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search checks"
        />
      </div>

      {/* Severity Filter */}
      <select
        className="severity-select"
        value={sevFilter}
        onChange={(e) => setSevFilter(e.target.value)}
        aria-label="Filter by severity"
      >
        <option value="All">All Severities</option>
        {Object.keys(SEV).map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {/* Bulk Add */}
      <button className="btn-toolbar btn-toolbar--bulk" onClick={onBulkAdd}>
        ⚡ Bulk Add
      </button>

      {/* Expand / Collapse All */}
      <button
        className={`btn-toolbar ${expandAll ? "btn-toolbar--expand-on" : "btn-toolbar--expand-off"}`}
        onClick={() => setExpandAll((v) => !v)}
        aria-pressed={expandAll}
      >
        {expandAll ? "⊟ Collapse All" : "⊞ Expand All"}
      </button>

      {/* Edit Mode */}
      <button
        className={`btn-toolbar ${isEditMode ? "btn-toolbar--edit-on" : "btn-toolbar--edit-off"}`}
        onClick={() => setIsEditMode(!isEditMode)}
        aria-pressed={isEditMode}
      >
        {isEditMode ? "✓ Done Editing" : "✎ Edit Mode"}
      </button>
    </div>
  );
}
