import { useEffect, useRef } from "react";

/**
 * Generic modal with backdrop, focus trap, and Escape-to-close.
 */
export default function Modal({ title, onClose, children }) {
  const boxRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);

    // Focus the modal box on open
    boxRef.current?.focus();

    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        ref={boxRef}
        tabIndex={-1}
      >
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
