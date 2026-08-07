import { useState } from "react";
import Modal from "./Modal";
import { EMOJI_OPTIONS, COLOR_OPTIONS } from "../data/constants";

/**
 * Modal form for creating or editing a category.
 */
export default function CategoryModal({ title, initial, onSave, onClose }) {
  const [label, setLabel] = useState(initial?.label || "");
  const [icon, setIcon] = useState(initial?.icon || "🛡️");
  const [color, setColor] = useState(initial?.color || "#dc2626");

  const canSave = label.trim().length > 0;

  return (
    <Modal title={title} onClose={onClose}>
      <div className="modal-form">
        <div>
          <label className="form-label">Category name</label>
          <input
            className="form-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Web3 / Smart Contracts"
            autoFocus
          />
        </div>

        <div>
          <label className="form-label">Icon</label>
          <div className="emoji-grid">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                className={`emoji-btn ${icon === e ? "emoji-btn--selected" : "emoji-btn--unselected"}`}
                onClick={() => setIcon(e)}
                aria-label={`Select icon ${e}`}
                aria-pressed={icon === e}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="form-label">Color</label>
          <div className="color-grid">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                className={`color-swatch ${color === c ? "color-swatch--selected" : "color-swatch--unselected"}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`Select color ${c}`}
                aria-pressed={color === c}
              />
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button
            className="btn-primary"
            disabled={!canSave}
            onClick={() => canSave && onSave({ label: label.trim(), icon, color })}
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
