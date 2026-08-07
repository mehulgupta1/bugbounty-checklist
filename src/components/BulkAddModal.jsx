import { useState } from "react";
import Modal from "./Modal";
import { SEV } from "../data/constants";

/**
 * Modal for adding multiple checks at once (one per line).
 */
export default function BulkAddModal({ categories, onSave, onClose }) {
  const [selectedCatId, setSelectedCatId] = useState(categories[0]?.id || "");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [severity, setSeverity] = useState("Medium");

  const selectedCat = categories.find((c) => c.id === selectedCatId);
  const sections = selectedCat?.sections || [];

  const handleCatChange = (catId) => {
    setSelectedCatId(catId);
    const cat = categories.find((c) => c.id === catId);
    setSelectedSectionId(cat?.sections[0]?.id || "");
  };

  const lines = bulkText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const canSave = selectedCatId && selectedSectionId && lines.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({ catId: selectedCatId, sectionId: selectedSectionId, lines, severity });
  };

  return (
    <Modal title="⚡ Bulk Add Checks" onClose={onClose}>
      <div className="modal-form modal-form--wide">
        <div className="form-grid">
          <div>
            <label className="form-label">Category</label>
            <select
              className="form-input"
              value={selectedCatId}
              onChange={(e) => handleCatChange(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Severity</label>
            <select
              className="form-input"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              {Object.keys(SEV).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="form-label">Section</label>
          <select
            className="form-input"
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
          >
            {sections.length === 0 ? (
              <option value="">— No sections yet —</option>
            ) : (
              sections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="form-label form-label--flex">
            <span>Checks (one per line)</span>
            {lines.length > 0 && (
              <span style={{ color: "#059669", fontWeight: 600 }}>
                {lines.length} checks ready
              </span>
            )}
          </label>
          <textarea
            className="form-textarea form-textarea--bulk"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"Test for SQL injection in all input fields\nTest for XSS in URL parameters\nCheck for CSRF token on all forms\n..."}
          />
          <div className="form-hint">
            Each non-empty line becomes a separate check.
          </div>
        </div>

        <div className="form-actions">
          <button
            className="btn-primary"
            disabled={!canSave}
            onClick={handleSave}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            ⚡ Add {lines.length > 0 ? lines.length : ""} Checks
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
