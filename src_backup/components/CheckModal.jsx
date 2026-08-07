import { useState } from "react";
import Modal from "./Modal";
import { SEV } from "../data/constants";

/**
 * Modal form for creating or editing a single check.
 */
export default function CheckModal({ title, initial, onSave, onClose }) {
  const [text, setText] = useState(initial?.text || "");
  const [severity, setSeverity] = useState(initial?.severity || "Info");

  const canSave = text.trim().length > 0;

  return (
    <Modal title={title} onClose={onClose}>
      <div className="modal-form">
        <div>
          <label className="form-label">Check description</label>
          <textarea
            className="form-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Test for reflected XSS in search parameter"
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
            onClick={() => canSave && onSave({ text: text.trim(), severity })}
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
