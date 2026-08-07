import { useState } from "react";
import { REVERSE_SHELLS } from "../data/reverseShells";
import { generateMutations } from "../utils/mutator";

/**
 * Custom Payload Laboratory
 */
export default function PayloadVault({ 
  payloads, 
  settings, 
  updateSettings, 
  addPayload, 
  deletePayload,
  incrementSuccess,
  incrementFail,
  syncCommunityPayloads
}) {
  const [activeTab, setActiveTab] = useState("library"); // library, mutations, generator

  // Shell Generator
  const [ip, setIp] = useState(settings.ip);
  const [port, setPort] = useState(settings.port);
  const [copiedId, setCopiedId] = useState(null);

  // New payload form
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("XSS");
  const [newContent, setNewContent] = useState("");

  // Mutations
  const [baseMutationPayload, setBaseMutationPayload] = useState("");

  const handleSaveSettings = () => {
    updateSettings(ip, port);
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleAddPayload = (e) => {
    e.preventDefault();
    if (newName.trim() && newContent.trim()) {
      addPayload(newName.trim(), newCategory, newContent.trim());
      setNewName("");
      setNewContent("");
    }
  };

  const mutations = generateMutations(baseMutationPayload);

  return (
    <div className="payload-vault">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 className="dashboard-title" style={{ margin: 0 }}>🎭 Custom Payload Laboratory</h1>
        <button className="btn-primary" onClick={syncCommunityPayloads}>
          🔄 Sync Community Payloads
        </button>
      </div>

      <div className="dashboard-tabs">
        <button className={`dashboard-tab ${activeTab === "library" ? "active" : ""}`} onClick={() => setActiveTab("library")}>
          Payload Library
        </button>
        <button className={`dashboard-tab ${activeTab === "mutations" ? "active" : ""}`} onClick={() => setActiveTab("mutations")}>
          Mutation Engine
        </button>
        <button className={`dashboard-tab ${activeTab === "generator" ? "active" : ""}`} onClick={() => setActiveTab("generator")}>
          Reverse Shell Generator
        </button>
      </div>

      {activeTab === "library" && (
        <div className="vault-section">
          <div className="vault-section-header">
            <h2 className="vault-section-title">My Payloads</h2>
            <span className="vault-section-subtitle">Track effectiveness of payloads across your targets</span>
          </div>

          <form className="vault-add-form" onSubmit={handleAddPayload}>
            <div style={{ display: "flex", gap: "12px", width: "100%", flexWrap: "wrap" }}>
              <input
                className="vault-input"
                style={{ flex: 1, minWidth: "150px" }}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name (e.g. Blind SQLi)"
              />
              <select 
                className="vault-input" 
                style={{ width: "120px" }}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              >
                <option value="XSS">XSS</option>
                <option value="SQLi">SQLi</option>
                <option value="SSRF">SSRF</option>
                <option value="LFI">LFI</option>
                <option value="SSTI">SSTI</option>
                <option value="Command Injection">Command Inj.</option>
                <option value="Other">Other</option>
              </select>
              <input
                className="vault-input"
                style={{ flex: 3, minWidth: "200px" }}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Payload String..."
              />
              <button type="submit" className="btn-primary" disabled={!newName.trim() || !newContent.trim()}>
                + Save
              </button>
            </div>
          </form>

          <div className="vault-payloads-list">
            {payloads.length === 0 ? (
              <div className="empty-state">No payloads. Click "Sync Community Payloads" to get started!</div>
            ) : (
              payloads.map((p) => (
                <div key={p.id} className="vault-item" style={{ display: "flex", flexDirection: "column", padding: "16px", gap: "12px" }}>
                  {/* Top Row: Info and Tracker */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span className="vault-badge" style={{ fontSize: "0.75rem", padding: "4px 8px", background: "#3b82f6", color: "white", borderRadius: "6px", fontWeight: 700, letterSpacing: "0.5px" }}>{p.category}</span>
                      <span className="vault-item-name" style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text-heading)" }}>{p.name}</span>
                    </div>
                    
                    {/* Effectiveness Tracker */}
                    <div className="effectiveness-tracker" style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                      <span style={{ fontWeight: 600 }}>🎯 Effectiveness:</span>
                      <button className="tracker-btn tracker-btn--success" onClick={() => incrementSuccess(p.id)} title="Mark as Worked" style={{ padding: "4px 10px", borderRadius: "4px" }}>
                        ✅ {p.successCount || 0} Worked
                      </button>
                      <button className="tracker-btn tracker-btn--fail" onClick={() => incrementFail(p.id)} title="Mark as Failed" style={{ padding: "4px 10px", borderRadius: "4px" }}>
                        ❌ {p.failCount || 0} Failed
                      </button>
                    </div>
                  </div>

                  {/* Bottom Row: Code and Actions */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                    <code className="vault-item-code-inline" style={{ flex: 1, padding: "10px 14px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "6px", overflowX: "auto", whiteSpace: "pre", fontSize: "13px" }}>
                      {p.content}
                    </code>
                    
                    <div className="vault-item-actions" style={{ display: "flex", gap: "8px" }}>
                      <button
                        className={`vault-copy-btn ${copiedId === `payload_${p.id}` ? "vault-copy-btn--copied" : ""}`}
                        onClick={() => handleCopy(`payload_${p.id}`, p.content)}
                        style={{ padding: "6px 12px", fontSize: "12px", fontWeight: 600, borderRadius: "6px" }}
                      >
                        {copiedId === `payload_${p.id}` ? "✅ Copied" : "📋 Copy"}
                      </button>
                      <button
                        className="vault-action-btn"
                        onClick={() => {
                          setBaseMutationPayload(p.content);
                          setActiveTab("mutations");
                        }}
                        title="Send to Mutator"
                        style={{ padding: "6px 12px", fontSize: "12px", fontWeight: 600, borderRadius: "6px", background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                      >
                        🧬 Mutate
                      </button>
                      <button
                        className="vault-delete-btn"
                        onClick={() => deletePayload(p.id)}
                        title="Delete Payload"
                        style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "6px" }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "mutations" && (
        <div className="vault-section">
          <div className="vault-section-header">
            <h2 className="vault-section-title">🧬 Payload Mutation Engine</h2>
            <span className="vault-section-subtitle">Generate bypass variants for your payloads instantly</span>
          </div>

          <div className="vault-input-group" style={{ marginBottom: "24px" }}>
            <label>Base Payload:</label>
            <textarea
              className="vault-input"
              style={{ minHeight: "80px", fontFamily: "monospace", resize: "vertical" }}
              value={baseMutationPayload}
              onChange={(e) => setBaseMutationPayload(e.target.value)}
              placeholder="Paste a payload here to generate mutations..."
            />
          </div>

          {baseMutationPayload && (
            <div className="vault-shells-grid">
              {mutations.map((m, i) => (
                <div key={i} className="vault-item">
                  <div className="vault-item-header">
                    <span className="vault-item-name">{m.name}</span>
                    <button
                      className={`vault-copy-btn ${copiedId === `mut_${i}` ? "vault-copy-btn--copied" : ""}`}
                      onClick={() => handleCopy(`mut_${i}`, m.value)}
                    >
                      {copiedId === `mut_${i}` ? "✅ Copied" : "📋 Copy"}
                    </button>
                  </div>
                  <div className="vault-item-content">
                    <code style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{m.value}</code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "generator" && (
        <div className="vault-section">
          <div className="vault-section-header">
            <h2 className="vault-section-title">Reverse Shell Generator</h2>
            <div className="vault-settings">
              <div className="vault-input-group">
                <label>Your IP / Host:</label>
                <input
                  className="vault-input"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  onBlur={handleSaveSettings}
                  placeholder="10.10.10.10"
                />
              </div>
              <div className="vault-input-group">
                <label>Your Port:</label>
                <input
                  className="vault-input vault-input--short"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  onBlur={handleSaveSettings}
                  placeholder="4444"
                />
              </div>
            </div>
          </div>

          <div className="vault-shells-grid">
            {REVERSE_SHELLS.map((shell, i) => {
              const finalCommand = shell.command
                .replace(/\{\{IP\}\}/g, ip || "10.10.10.10")
                .replace(/\{\{PORT\}\}/g, port || "4444");

              return (
                <div key={i} className="vault-item">
                  <div className="vault-item-header">
                    <span className="vault-item-name">{shell.name}</span>
                    <button
                      className={`vault-copy-btn ${copiedId === `shell_${i}` ? "vault-copy-btn--copied" : ""}`}
                      onClick={() => handleCopy(`shell_${i}`, finalCommand)}
                    >
                      {copiedId === `shell_${i}` ? "✅ Copied" : "📋 Copy"}
                    </button>
                  </div>
                  <div className="vault-item-content">
                    <code>{finalCommand}</code>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
