import { useState, useRef, useMemo } from "react";
import { parseReconData } from "../utils/reconParser";

export default function ReconDiffEngine({ onTrackAsset, state, setState }) {
  // If state is not provided (e.g. testing), fallback to local variables to prevent crash
  const actualState = state || { oldRawText: "", newRawText: "", diffResult: null };
  const { oldRawText, newRawText, diffResult } = actualState;

  const setOldRawText = (text) => setState ? setState(prev => ({ ...prev, oldRawText: text })) : null;
  const setNewRawText = (text) => setState ? setState(prev => ({ ...prev, newRawText: text })) : null;
  const setDiffResult = (res) => setState ? setState(prev => ({ ...prev, diffResult: res })) : null;

  // Local state for fast typing (prevents App.jsx from re-rendering on every keystroke)
  const [localOldText, setLocalOldText] = useState(oldRawText);
  const [localNewText, setLocalNewText] = useState(newRawText);

  const [isDraggingOld, setIsDraggingOld] = useState(false);
  const [isDraggingNew, setIsDraggingNew] = useState(false);

  const syncStateToApp = () => {
    setOldRawText(localOldText);
    setNewRawText(localNewText);
  };

  const oldFileInputRef = useRef(null);
  const newFileInputRef = useRef(null);

  const readFile = (file, isOld) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      if (isOld) {
        setLocalOldText(content);
        setOldRawText(content);
      } else {
        setLocalNewText(content);
        setNewRawText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleFileDrop = (e, isOld) => {
    e.preventDefault();
    if (isOld) setIsDraggingOld(false);
    else setIsDraggingNew(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      readFile(e.dataTransfer.files[0], isOld);
    }
  };

  const calculateDiff = () => {
    syncStateToApp(); // Ensure app state is up to date
    const oldAssets = parseReconData(localOldText);
    const newAssets = parseReconData(localNewText);

    const oldMap = new Map();
    oldAssets.forEach(a => oldMap.set(a.host, a));
    const newMap = new Map();
    newAssets.forEach(a => newMap.set(a.host, a));

    const newHosts = [];
    const missingHosts = [];
    const newPortsMap = new Map();
    const newUrlsMap = new Map();
    const newVulnsMap = new Map();
    const statusChangesMap = new Map();

    // Find missing hosts (Ghost assets)
    oldAssets.forEach(oldAsset => {
      if (!newMap.has(oldAsset.host)) {
        missingHosts.push(oldAsset);
      }
    });

    newAssets.forEach(newAsset => {
      const oldAsset = oldMap.get(newAsset.host);

      if (!oldAsset) {
        // Completely new host
        newHosts.push(newAsset);
      } else {
        // Existed before, let's check for new things
        const oldPorts = new Set(oldAsset.ports);
        const addedPorts = newAsset.ports.filter(p => !oldPorts.has(p));
        if (addedPorts.length > 0) {
          newPortsMap.set(newAsset.host, addedPorts);
        }

        const oldUrls = new Set(oldAsset.urls);
        const addedUrls = newAsset.urls.filter(u => !oldUrls.has(u));
        if (addedUrls.length > 0) {
          newUrlsMap.set(newAsset.host, addedUrls);
        }

        const oldVulnIds = new Set(oldAsset.vulns.map(v => v.id));
        const addedVulns = newAsset.vulns.filter(v => !oldVulnIds.has(v.id));
        if (addedVulns.length > 0) {
          newVulnsMap.set(newAsset.host, addedVulns);
        }

        // Status code diff
        const statusChanges = [];
        const oldEndpoints = new Map();
        if (oldAsset.endpoints) {
            oldAsset.endpoints.forEach(e => oldEndpoints.set(e.url, e.statusCode));
        }
        if (newAsset.endpoints) {
            newAsset.endpoints.forEach(ne => {
                if (oldEndpoints.has(ne.url)) {
                    const oldSc = oldEndpoints.get(ne.url);
                    if (oldSc !== ne.statusCode && oldSc !== null && ne.statusCode !== null) {
                        statusChanges.push({ url: ne.url, oldSc, newSc: ne.statusCode });
                    }
                }
            });
        }
        if (statusChanges.length > 0) {
            statusChangesMap.set(newAsset.host, statusChanges);
        }
      }
    });

    setDiffResult({
      newHosts,
      missingHosts,
      newPortsMap,
      newUrlsMap,
      newVulnsMap,
      statusChangesMap,
      totalOldHosts: oldAssets.length,
      totalNewHosts: newAssets.length
    });
  };

  const generateWordlist = () => {
    if (!diffResult) return;
    const lines = [];
    diffResult.newHosts.forEach(h => {
        h.urls.forEach(u => lines.push(u));
    });
    Array.from(diffResult.newUrlsMap.values()).forEach(urls => {
        urls.forEach(u => lines.push(u));
    });
    
    const paths = new Set();
    lines.forEach(u => {
        try {
            const parsed = new URL(u);
            if (parsed.pathname && parsed.pathname !== "/") paths.add(parsed.pathname);
            if (parsed.search) {
                const params = new URLSearchParams(parsed.search);
                for (const key of params.keys()) {
                    paths.add(key); // Extract parameter names too
                }
            }
        } catch(e){}
    });
    
    const wordlist = Array.from(paths).join('\n');
    navigator.clipboard.writeText(wordlist);
    alert(`Wordlist copied! Extracted ${paths.size} unique paths/parameters.`);
  };

  const getSeverityStyle = (sev) => {
    switch (sev.toLowerCase()) {
      case "critical": return { bg: "#fee2e2", text: "#dc2626", border: "#f87171" };
      case "high": return { bg: "#fef3c7", text: "#d97706", border: "#fbbf24" };
      case "medium": return { bg: "#dcfce7", text: "#16a34a", border: "#4ade80" };
      case "low": return { bg: "#e0e7ff", text: "#4f46e5", border: "#818cf8" };
      default: return { bg: "#f3f4f6", text: "#6b7280", border: "#d1d5db" };
    }
  };

  return (
    <div className="content-area" style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--color-bg)" }}>
      <div style={{ padding: "24px 24px 0 24px", flexShrink: 0 }}>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700", color: "var(--color-text-heading)" }}>
          🔄 Historical Recon Diffing
        </h1>
        <p style={{ margin: "0 0 24px 0", fontSize: "15px", color: "var(--color-text-muted)" }}>
          Compare old recon logs against new logs to instantly highlight new assets, ports, and vulnerabilities that appeared overnight.
        </p>

        {!diffResult ? (
          <div>
            <div style={{ display: "flex", gap: "24px", marginBottom: "24px" }}>
              {/* OLD ZONE */}
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOld(true); }}
                onDragLeave={() => setIsDraggingOld(false)}
                onDrop={(e) => handleFileDrop(e, true)}
                style={{
                  flex: 1, minHeight: "250px", border: `2px dashed ${isDraggingOld ? "var(--color-blue)" : "var(--color-border)"}`,
                  borderRadius: "12px", background: isDraggingOld ? "rgba(59, 130, 246, 0.05)" : "var(--color-bg-secondary)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px",
                  transition: "all 0.2s ease"
                }}
              >
                <h3 style={{ margin: "0 0 8px 0", color: "var(--color-text-heading)" }}>Baseline (Old) Logs</h3>
                <p style={{ color: "var(--color-text-muted)", margin: "0 0 16px 0", fontSize: "13px" }}>Drag & Drop or Paste</p>
                <input type="file" ref={oldFileInputRef} style={{ display: "none" }} accept=".json,.txt,.log" onChange={(e) => e.target.files && readFile(e.target.files[0], true)} />
                <button 
                  onClick={() => oldFileInputRef.current.click()}
                  style={{ background: "var(--color-bg)", color: "var(--color-text-heading)", border: "1px solid var(--color-border)", padding: "6px 12px", borderRadius: "6px", fontWeight: "600", cursor: "pointer", marginBottom: "16px", fontSize: "13px" }}
                >
                  Browse Files
                </button>
                <textarea 
                  value={localOldText}
                  onChange={(e) => setLocalOldText(e.target.value)}
                  onBlur={() => setOldRawText(localOldText)}
                  placeholder="Paste old raw output here..."
                  style={{
                    width: "100%", height: "80px", background: "var(--color-bg)", border: "1px solid var(--color-border)",
                    borderRadius: "8px", padding: "12px", fontSize: "12px", fontFamily: "monospace", color: "var(--color-text)", resize: "none", outline: "none"
                  }}
                  spellCheck="false"
                />
              </div>

              {/* NEW ZONE */}
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDraggingNew(true); }}
                onDragLeave={() => setIsDraggingNew(false)}
                onDrop={(e) => handleFileDrop(e, false)}
                style={{
                  flex: 1, minHeight: "250px", border: `2px dashed ${isDraggingNew ? "var(--color-blue)" : "var(--color-border)"}`,
                  borderRadius: "12px", background: isDraggingNew ? "rgba(59, 130, 246, 0.05)" : "var(--color-bg-secondary)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px",
                  transition: "all 0.2s ease"
                }}
              >
                <h3 style={{ margin: "0 0 8px 0", color: "var(--color-text-heading)" }}>Current (New) Logs</h3>
                <p style={{ color: "var(--color-text-muted)", margin: "0 0 16px 0", fontSize: "13px" }}>Drag & Drop or Paste</p>
                <input type="file" ref={newFileInputRef} style={{ display: "none" }} accept=".json,.txt,.log" onChange={(e) => e.target.files && readFile(e.target.files[0], false)} />
                <button 
                  onClick={() => newFileInputRef.current.click()}
                  style={{ background: "var(--color-bg)", color: "var(--color-text-heading)", border: "1px solid var(--color-border)", padding: "6px 12px", borderRadius: "6px", fontWeight: "600", cursor: "pointer", marginBottom: "16px", fontSize: "13px" }}
                >
                  Browse Files
                </button>
                <textarea 
                  value={localNewText}
                  onChange={(e) => setLocalNewText(e.target.value)}
                  onBlur={() => setNewRawText(localNewText)}
                  placeholder="Paste new raw output here..."
                  style={{
                    width: "100%", height: "80px", background: "var(--color-bg)", border: "1px solid var(--color-border)",
                    borderRadius: "8px", padding: "12px", fontSize: "12px", fontFamily: "monospace", color: "var(--color-text)", resize: "none", outline: "none"
                  }}
                  spellCheck="false"
                />
              </div>
            </div>

            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <button 
                onClick={calculateDiff}
                disabled={!localOldText.trim() || !localNewText.trim()}
                style={{
                  background: "var(--color-blue)", color: "white", border: "none", padding: "12px 32px", borderRadius: "8px", fontWeight: "700", fontSize: "16px", cursor: (!localOldText.trim() || !localNewText.trim()) ? "not-allowed" : "pointer", opacity: (!localOldText.trim() || !localNewText.trim()) ? 0.5 : 1, transition: "all 0.2s ease", boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)"
                }}
              >
                ⚡ Analyze Diff
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", padding: "16px", background: "var(--color-bg-secondary)", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
              <div style={{ display: "flex", gap: "24px" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: "700", marginBottom: "4px" }}>Hosts Tracked</div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--color-text-heading)" }}>{diffResult.totalOldHosts} → {diffResult.totalNewHosts}</div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: "700", marginBottom: "4px" }}>New Assets Found</div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: diffResult.newHosts.length > 0 ? "var(--color-blue)" : "var(--color-text-muted)" }}>{diffResult.newHosts.length}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button 
                  onClick={generateWordlist}
                  style={{ background: "transparent", color: "var(--color-blue)", border: "1px solid var(--color-blue)", padding: "8px 16px", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}
                >
                  📝 Generate Wordlist
                </button>
                <button 
                  onClick={() => setDiffResult(null)}
                  style={{ background: "transparent", color: "var(--color-text-muted)", border: "1px solid var(--color-border)", padding: "8px 16px", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}
                >
                  Start New Diff
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {diffResult && (
        <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px 24px" }}>
          
          {diffResult.newHosts.length === 0 && diffResult.missingHosts.length === 0 && diffResult.newPortsMap.size === 0 && diffResult.newUrlsMap.size === 0 && diffResult.newVulnsMap.size === 0 && diffResult.statusChangesMap.size === 0 ? (
             <div style={{ textAlign: "center", padding: "40px", background: "var(--color-bg-secondary)", borderRadius: "12px", border: "1px solid var(--color-border)" }}>
               <span style={{ fontSize: "32px", display: "block", marginBottom: "16px" }}>😴</span>
               <h3 style={{ margin: "0 0 8px 0", color: "var(--color-text-heading)" }}>No Significant Changes</h3>
               <p style={{ color: "var(--color-text-muted)", margin: 0 }}>The infrastructure seems unchanged since the baseline.</p>
             </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              
              {/* GHOST ASSETS (MISSING HOSTS) SECTION */}
              {diffResult.missingHosts.length > 0 && (
                <div style={{ background: "var(--color-bg-secondary)", borderRadius: "12px", border: "1px solid rgba(139, 92, 246, 0.5)", overflow: "hidden" }}>
                  <div style={{ background: "rgba(139, 92, 246, 0.1)", padding: "12px 16px", borderBottom: "1px solid rgba(139, 92, 246, 0.2)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>👻</span>
                    <h3 style={{ margin: 0, fontSize: "15px", color: "#8b5cf6" }}>Ghost Assets / Missing Hosts ({diffResult.missingHosts.length})</h3>
                  </div>
                  <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 8px 0" }}>These hosts existed in the old scan but disappeared. Check for Subdomain Takeovers.</p>
                    {diffResult.missingHosts.map((host, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "8px" }}>
                        <div>
                          <div style={{ fontWeight: "700", color: "var(--color-text-heading)", fontSize: "15px", textDecoration: "line-through", opacity: 0.7 }}>{host.host}</div>
                          {host.ips.length > 0 && <div style={{ fontSize: "12px", color: "var(--color-text-muted)", fontFamily: "monospace" }}>Last IP: {host.ips[0]}</div>}
                        </div>
                        <span style={{ background: "var(--color-bg-secondary)", color: "var(--color-text-muted)", padding: "4px 8px", borderRadius: "4px", fontSize: "12px" }}>Missing</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* NEW HOSTS SECTION */}
              {diffResult.newHosts.length > 0 && (
                <div style={{ background: "var(--color-bg-secondary)", borderRadius: "12px", border: "1px solid rgba(59, 130, 246, 0.5)", overflow: "hidden" }}>
                  <div style={{ background: "rgba(59, 130, 246, 0.1)", padding: "12px 16px", borderBottom: "1px solid rgba(59, 130, 246, 0.2)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>🔥</span>
                    <h3 style={{ margin: 0, fontSize: "15px", color: "var(--color-blue)" }}>New Hosts Discovered ({diffResult.newHosts.length})</h3>
                  </div>
                  <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {diffResult.newHosts.map((host, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "8px" }}>
                        <div>
                          <div style={{ fontWeight: "700", color: "var(--color-text-heading)", fontSize: "15px", marginBottom: "4px" }}>{host.host}</div>
                          {host.ips.length > 0 && <div style={{ fontSize: "12px", color: "var(--color-text-muted)", fontFamily: "monospace" }}>{host.ips[0]}</div>}
                        </div>
                        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                          {host.ports.length > 0 && (
                            <div style={{ display: "flex", gap: "4px" }}>
                              {host.ports.map(p => <span key={p} style={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontFamily: "monospace" }}>{p}</span>)}
                            </div>
                          )}
                          {onTrackAsset && (
                            <button 
                              onClick={() => onTrackAsset(host.host)}
                              style={{ background: "var(--color-text-heading)", color: "var(--color-bg)", border: "none", padding: "4px 12px", borderRadius: "4px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                            >
                              Track
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* NEW PORTS SECTION */}
              {diffResult.newPortsMap.size > 0 && (
                <div style={{ background: "var(--color-bg-secondary)", borderRadius: "12px", border: "1px solid rgba(245, 158, 11, 0.5)", overflow: "hidden" }}>
                  <div style={{ background: "rgba(245, 158, 11, 0.1)", padding: "12px 16px", borderBottom: "1px solid rgba(245, 158, 11, 0.2)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>🚪</span>
                    <h3 style={{ margin: 0, fontSize: "15px", color: "#d97706" }}>Newly Opened Ports ({diffResult.newPortsMap.size} hosts)</h3>
                  </div>
                  <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {Array.from(diffResult.newPortsMap.entries()).map(([host, ports]) => (
                      <div key={host} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "8px" }}>
                        <div style={{ fontWeight: "600", color: "var(--color-text-heading)", fontSize: "14px" }}>{host}</div>
                        <div style={{ display: "flex", gap: "4px" }}>
                          {ports.map(p => <span key={p} style={{ background: "#fef3c7", color: "#d97706", border: "1px solid #fde68a", padding: "2px 6px", borderRadius: "4px", fontSize: "12px", fontFamily: "monospace", fontWeight: "700" }}>+{p}</span>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STATUS CODE CHANGES */}
              {diffResult.statusChangesMap.size > 0 && (
                <div style={{ background: "var(--color-bg-secondary)", borderRadius: "12px", border: "1px solid rgba(236, 72, 153, 0.5)", overflow: "hidden" }}>
                  <div style={{ background: "rgba(236, 72, 153, 0.1)", padding: "12px 16px", borderBottom: "1px solid rgba(236, 72, 153, 0.2)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>🚦</span>
                    <h3 style={{ margin: 0, fontSize: "15px", color: "#ec4899" }}>Behavior / Status Code Changes ({diffResult.statusChangesMap.size} hosts)</h3>
                  </div>
                  <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {Array.from(diffResult.statusChangesMap.entries()).map(([host, changes]) => (
                      <div key={host} style={{ padding: "12px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "8px" }}>
                        <div style={{ fontWeight: "700", color: "var(--color-text-heading)", fontSize: "14px", marginBottom: "12px" }}>{host}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {changes.map((c, idx) => (
                            <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--color-bg-secondary)", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--color-border)" }}>
                              <span style={{ fontSize: "13px", color: "var(--color-text)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{c.url}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", padding: "2px 6px", borderRadius: "4px", fontSize: "12px", fontWeight: "700", color: "var(--color-text-muted)" }}>{c.oldSc}</span>
                                <span style={{ color: "var(--color-text-faint)" }}>→</span>
                                <span style={{ background: "rgba(236, 72, 153, 0.1)", border: "1px solid rgba(236, 72, 153, 0.3)", padding: "2px 6px", borderRadius: "4px", fontSize: "12px", fontWeight: "700", color: "#ec4899" }}>{c.newSc}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* NEW VULNS SECTION */}
              {diffResult.newVulnsMap.size > 0 && (
                <div style={{ background: "var(--color-bg-secondary)", borderRadius: "12px", border: "1px solid rgba(239, 68, 68, 0.5)", overflow: "hidden" }}>
                  <div style={{ background: "rgba(239, 68, 68, 0.1)", padding: "12px 16px", borderBottom: "1px solid rgba(239, 68, 68, 0.2)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>🚨</span>
                    <h3 style={{ margin: 0, fontSize: "15px", color: "var(--color-red)" }}>New Vulnerabilities ({diffResult.newVulnsMap.size} hosts)</h3>
                  </div>
                  <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {Array.from(diffResult.newVulnsMap.entries()).map(([host, vulns]) => (
                      <div key={host} style={{ padding: "12px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "8px" }}>
                        <div style={{ fontWeight: "700", color: "var(--color-text-heading)", fontSize: "14px", marginBottom: "12px" }}>{host}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {vulns.map((v, vidx) => {
                            const s = getSeverityStyle(v.severity);
                            return (
                              <div key={vidx} style={{ display: "flex", alignItems: "center", gap: "12px", background: "var(--color-bg-secondary)", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--color-border)" }}>
                                <span style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}`, padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", minWidth: "75px", textAlign: "center" }}>{v.severity}</span>
                                <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--color-text)", flex: 1 }}>{v.name}</span>
                                <span style={{ fontSize: "11px", color: "var(--color-text-muted)", fontFamily: "monospace" }}>{v.id}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* NEW URLS SECTION */}
              {diffResult.newUrlsMap.size > 0 && (
                <div style={{ background: "var(--color-bg-secondary)", borderRadius: "12px", border: "1px solid rgba(16, 185, 129, 0.5)", overflow: "hidden" }}>
                  <div style={{ background: "rgba(16, 185, 129, 0.1)", padding: "12px 16px", borderBottom: "1px solid rgba(16, 185, 129, 0.2)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>🔗</span>
                    <h3 style={{ margin: 0, fontSize: "15px", color: "#059669" }}>New Endpoints ({diffResult.newUrlsMap.size} hosts)</h3>
                  </div>
                  <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {Array.from(diffResult.newUrlsMap.entries()).map(([host, urls]) => (
                      <div key={host} style={{ padding: "12px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "8px" }}>
                        <div style={{ fontWeight: "600", color: "var(--color-text-heading)", fontSize: "14px", marginBottom: "8px" }}>{host} <span style={{ fontSize: "12px", color: "var(--color-text-muted)", fontWeight: "normal" }}>({urls.length} new)</span></div>
                        <div style={{ maxHeight: "120px", overflowY: "auto", background: "var(--color-bg-secondary)", padding: "8px", borderRadius: "6px", border: "1px solid var(--color-border)" }}>
                          {urls.map((u, i) => (
                            <div key={i} style={{ fontSize: "12px", fontFamily: "monospace", color: "#059669", marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              + {u}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  );
}
