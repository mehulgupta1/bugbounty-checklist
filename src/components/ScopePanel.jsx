import { useState, useEffect } from "react";

/**
 * Scope/Target info panel for the active project.
 */
export default function ScopePanel({ scope, onUpdate }) {
  const [draft, setDraft] = useState({
    programName: "",
    platform: "HackerOne",
    inScope: "",
    outOfScope: "",
    bountyCritical: "",
    bountyHigh: "",
    bountyMedium: "",
    bountyLow: "",
    rules: "",
    importantUrls: "",
    ...scope,
  });

  useEffect(() => {
    setDraft((d) => ({ ...d, ...scope }));
  }, [scope]);

  const handleChange = (field, value) => {
    setDraft((d) => ({ ...d, [field]: value }));
  };

  const handleSave = () => {
    onUpdate(draft);
  };

  return (
    <div className="scope-panel">
      <div className="scope-panel-header">
        <h1 className="scope-panel-title">🎯 Scope & Target Info</h1>
      </div>

      <div className="scope-section">
        <div className="scope-section-title">📋 Program Details</div>
        <div className="form-grid">
          <div>
            <label className="form-label">Program Name</label>
            <input
              className="scope-input"
              value={draft.programName}
              onChange={(e) => handleChange("programName", e.target.value)}
              placeholder="e.g. Uber Bug Bounty"
            />
          </div>
          <div>
            <label className="form-label">Platform</label>
            <select
              className="scope-input"
              value={draft.platform}
              onChange={(e) => handleChange("platform", e.target.value)}
            >
              <option value="HackerOne">HackerOne</option>
              <option value="Bugcrowd">Bugcrowd</option>
              <option value="Intigriti">Intigriti</option>
              <option value="YesWeHack">YesWeHack</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div className="scope-section">
        <div className="scope-section-title">✅ In-Scope (one per line)</div>
        <textarea
          className="scope-textarea"
          value={draft.inScope}
          onChange={(e) => handleChange("inScope", e.target.value)}
          placeholder={"*.uber.com\nriders.uber.com\npartners.uber.com/api/*"}
        />
      </div>

      <div className="scope-section">
        <div className="scope-section-title">❌ Out-of-Scope (one per line)</div>
        <textarea
          className="scope-textarea"
          value={draft.outOfScope}
          onChange={(e) => handleChange("outOfScope", e.target.value)}
          placeholder={"*.uberinternal.com\nPhysical attacks\nSocial engineering"}
        />
      </div>

      <div className="scope-section">
        <div className="scope-section-title">💰 Bounty Table</div>
        <div className="scope-bounty-grid">
          <div className="scope-bounty-item">
            <span className="scope-bounty-label" style={{ color: "#dc2626" }}>Critical</span>
            <input className="scope-bounty-input" value={draft.bountyCritical} onChange={(e) => handleChange("bountyCritical", e.target.value)} placeholder="$10,000" />
          </div>
          <div className="scope-bounty-item">
            <span className="scope-bounty-label" style={{ color: "#c2410c" }}>High</span>
            <input className="scope-bounty-input" value={draft.bountyHigh} onChange={(e) => handleChange("bountyHigh", e.target.value)} placeholder="$5,000" />
          </div>
          <div className="scope-bounty-item">
            <span className="scope-bounty-label" style={{ color: "#1d4ed8" }}>Medium</span>
            <input className="scope-bounty-input" value={draft.bountyMedium} onChange={(e) => handleChange("bountyMedium", e.target.value)} placeholder="$2,000" />
          </div>
          <div className="scope-bounty-item">
            <span className="scope-bounty-label" style={{ color: "#15803d" }}>Low</span>
            <input className="scope-bounty-input" value={draft.bountyLow} onChange={(e) => handleChange("bountyLow", e.target.value)} placeholder="$500" />
          </div>
        </div>
      </div>

      <div className="scope-section">
        <div className="scope-section-title">📜 Rules & Notes</div>
        <textarea
          className="scope-textarea"
          value={draft.rules}
          onChange={(e) => handleChange("rules", e.target.value)}
          placeholder={"No automated scanning\nNo DoS/DDoS testing\nReport within 24 hours"}
        />
      </div>

      <div className="scope-section">
        <div className="scope-section-title">🔗 Important URLs</div>
        <textarea
          className="scope-textarea"
          value={draft.importantUrls}
          onChange={(e) => handleChange("importantUrls", e.target.value)}
          placeholder={"https://hackerone.com/uber\nhttps://uber.com/login\nhttps://api.uber.com/docs"}
        />
      </div>

      <div className="scope-save-bar">
        <button className="btn-primary" onClick={handleSave}>
          💾 Save Scope Info
        </button>
      </div>
    </div>
  );
}
