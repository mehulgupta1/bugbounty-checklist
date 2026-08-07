import { useEffect } from "react";

/**
 * Confirmation dialog for destructive actions.
 */
export default function DeleteConfirmModal({ item, onConfirm, onCancel }) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  return (
    <div
      className="delete-modal-overlay"
      onClick={onCancel}
      role="alertdialog"
      aria-modal="true"
      aria-label="Confirm deletion"
    >
      <div className="delete-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="delete-modal-icon">⚠️</div>
        <div className="delete-modal-title">Delete {item.type}?</div>
        <div className="delete-modal-name">{item.name}</div>
        {item.detail && (
          <div className="delete-modal-detail">{item.detail}</div>
        )}
        <div className="delete-modal-actions">
          <button className="btn-primary" onClick={onConfirm}>
            🗑 Delete
          </button>
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
