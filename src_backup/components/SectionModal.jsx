import { useState } from "react";
import Modal from "./Modal";
import { SEV } from "../data/constants";

/**
 * Modal form for creating or editing a section.
 */
export default function SectionModal({ title, initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || "");
  const [severity, setSeverity] = useState(initial?.severity || "Info");

  const canSave = name.trim().length > 0;

  return (
    <Modal title={title} onClose={onClose}>
      <div className="modal-form">
        <div>
          <label className="form-label">Section name</label>
          <input
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Reflected XSS Testing"
            autoFocus
          />
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

        <div className="form-actions">
          <button
            className="btn-primary"
            disabled={!canSave}
            onClick={() => canSave && onSave({ name: name.trim(), severity })}
          >
            Save
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
