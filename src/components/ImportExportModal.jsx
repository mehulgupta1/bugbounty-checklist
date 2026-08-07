import { useState } from "react";
import Modal from "./Modal";

/**
 * Import/Export modal for sharing checklists as JSON.
 */
export default function ImportExportModal({ categories, guides, notes, onImport, onImportAsProject, onClose }) {
  const [tab, setTab] = useState("export"); // "export" or "import"
  const [importText, setImportText] = useState("");
  const [importMode, setImportMode] = useState("new_project");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Export data
  const exportData = {
    exportedAt: new Date().toISOString(),
    version: 2,
    categories,
    guides,
    notes,
  };
  const exportJson = JSON.stringify(exportData, null, 2);

  const totalChecks = categories.flatMap((c) => c.sections.flatMap((s) => s.checks)).length;
  const totalSections = categories.flatMap((c) => c.sections).length;

  const handleCopy = () => {
    navigator.clipboard.writeText(exportJson);
    setSuccess("Copied to clipboard!");
    setTimeout(() => setSuccess(""), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([exportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bugbounty-checklist-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImportText(ev.target.result);
    reader.readAsText(file);
  };

  const handleImport = () => {
    setError("");
    setSuccess("");
    try {
      const data = JSON.parse(importText);
      if (!data || !data.categories || !Array.isArray(data.categories)) {
        setError("Invalid format: missing 'categories' array");
        return;
      }

      if (importMode === "new_project") {
        onImportAsProject("Imported Checklist", data);
        setSuccess("Imported as new project!");
        setTimeout(() => onClose(), 1000);
      } else if (importMode === "replace") {
        const result = onImport(importText);
        if (result?.success) {
          setSuccess("Replaced current project data!");
          setTimeout(() => onClose(), 1000);
        } else {
          setError(result?.error || "Import failed");
        }
      }
    } catch (err) {
      setError(`JSON parse error: ${err.message}`);
    }
  };

  // Preview the import data
  let previewData = null;
  try {
    if (importText) previewData = JSON.parse(importText);
  } catch {}

  return (
    <Modal title="↔ Import / Export Checklist" onClose={onClose}>
      <div className="modal-form modal-form--wide">
        {/* Tabs */}
        <div className="share-tabs">
          <button
            className={`share-tab ${tab === "export" ? "share-tab--active" : ""}`}
            onClick={() => setTab("export")}
          >
            📤 Export
          </button>
          <button
            className={`share-tab ${tab === "import" ? "share-tab--active" : ""}`}
            onClick={() => setTab("import")}
          >
            📥 Import
          </button>
        </div>

        {tab === "export" ? (
          <>
            <div className="share-preview">
              <div className="share-preview-stat">
                {categories.length} categories · {totalSections} sections · {totalChecks.toLocaleString()} checks
              </div>
              {categories.map((c) => (
                <div key={c.id} className="share-preview-item">
                  {c.icon} {c.label} — {c.sections.length} sections, {c.sections.flatMap((s) => s.checks).length} checks
                </div>
              ))}
            </div>

            <div className="form-actions">
              <button className="btn-primary" onClick={handleCopy}>
                📋 Copy JSON
              </button>
              <button className="btn-secondary" onClick={handleDownload}>
                📥 Download .json
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="form-label">Upload File or Paste JSON</label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                style={{ marginBottom: 8, fontSize: 12 }}
              />
              <textarea
                className="share-json-box"
                value={importText}
                onChange={(e) => { setImportText(e.target.value); setError(""); }}
                placeholder='Paste JSON here or upload a .json file...'
              />
            </div>

            {previewData && previewData.categories && (
              <div className="share-preview">
                <div className="share-preview-stat">
                  Preview: {previewData.categories.length} categories · {previewData.categories.flatMap((c) => c.sections || []).length} sections · {previewData.categories.flatMap((c) => (c.sections || []).flatMap((s) => s.checks || [])).length.toLocaleString()} checks
                </div>
                {previewData.categories.map((c, i) => (
                  <div key={i} className="share-preview-item">
                    {c.icon} {c.label} — {(c.sections || []).length} sections
                  </div>
                ))}
              </div>
            )}

            <div className="share-import-mode">
              <label className="form-label">Import As</label>
              <label>
                <input type="radio" name="importMode" value="new_project" checked={importMode === "new_project"} onChange={() => setImportMode("new_project")} />
                New project (keeps existing data)
              </label>
              <label>
                <input type="radio" name="importMode" value="replace" checked={importMode === "replace"} onChange={() => setImportMode("replace")} />
                Replace current project
              </label>
            </div>

            <div className="form-actions">
              <button className="btn-primary" disabled={!importText.trim()} onClick={handleImport}>
                📥 Import
              </button>
              <button className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}

        {error && <div className="share-error">❌ {error}</div>}
        {success && <div className="share-success">✅ {success}</div>}
      </div>
    </Modal>
  );
}
