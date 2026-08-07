import { useState, useRef, useMemo } from "react";
import { parseReconData } from "../utils/reconParser";

export default function ReconIngestor({ onTrackAsset }) {
  const [rawText, setRawText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [assets, setAssets] = useState([]);
  const [expandedHost, setExpandedHost] = useState(null);
  
  // Advanced Features State
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("list"); // list or graph

  const fileInputRef = useRef(null);

  const handleIngest = (text) => {
    if (!text.trim()) return;
    const parsed = parseReconData(text);
    setAssets(parsed);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      readFile(e.dataTransfer.files[0]);
    }
  };

  const readFile = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      setRawText(content);
      handleIngest(content);
    };
    reader.readAsText(file);
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

  // Mini-SIEM Query Engine
  const filteredAssets = useMemo(() => {
    if (!searchQuery.trim()) return assets;
    
    const queries = searchQuery.toLowerCase().split(' ').map(q => q.trim()).filter(Boolean);
    
    return assets.filter(asset => {
      return queries.every(q => {
        if (q.startsWith('tech:')) {
          const t = q.replace('tech:', '');
          return asset.tech.some(x => x.toLowerCase().includes(t));
        }
        if (q.startsWith('port:')) {
          const p = q.replace('port:', '');
          return asset.ports.includes(parseInt(p));
        }
        if (q.startsWith('severity:')) {
          const s = q.replace('severity:', '');
          return asset.vulns.some(v => v.severity.toLowerCase() === s);
        }
        if (q === 'has:vuln') {
          return asset.vulns.length > 0;
        }
        // Generic search
        return asset.host.toLowerCase().includes(q) || 
               asset.ips.some(ip => ip.includes(q)) || 
               asset.vulns.some(v => v.name.toLowerCase().includes(q));
      });
    });
  }, [assets, searchQuery]);

  const totalVulns = filteredAssets.reduce((sum, a) => sum + a.vulns.length, 0);
  const totalUrls = filteredAssets.reduce((sum, a) => sum + a.urls.length, 0);

  return (
    <div className="content-area" style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--color-bg)" }}>
      <div style={{ padding: "24px 24px 0 24px", flexShrink: 0 }}>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700", color: "var(--color-text-heading)" }}>
          📡 Advanced Recon Ingestor
        </h1>
        <p style={{ margin: "0 0 24px 0", fontSize: "15px", color: "var(--color-text-muted)" }}>
          Drag and drop raw logs (Nuclei, HTTPX, Subfinder). Use queries like <code>tech:java</code>, <code>port:80</code>, or <code>severity:high</code> to filter.
        </p>

        {assets.length === 0 ? (
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            style={{
              width: "100%", minHeight: "300px", border: `2px dashed ${isDragging ? "var(--color-blue)" : "var(--color-border)"}`,
              borderRadius: "12px", background: isDragging ? "rgba(59, 130, 246, 0.05)" : "var(--color-bg-secondary)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px",
              transition: "all 0.2s ease"
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📥</div>
            <h3 style={{ margin: "0 0 8px 0", color: "var(--color-text-heading)" }}>Drag & Drop Log Files Here</h3>
            <p style={{ color: "var(--color-text-muted)", margin: "0 0 24px 0" }}>or paste the raw text below</p>
            
            <input type="file" ref={fileInputRef} style={{ display: "none" }} accept=".json,.txt,.log" onChange={(e) => e.target.files && readFile(e.target.files[0])} />
            <button 
              onClick={() => fileInputRef.current.click()}
              style={{ background: "var(--color-text-heading)", color: "var(--color-bg)", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "600", cursor: "pointer", marginBottom: "24px" }}
            >
              Browse Files
            </button>

            <textarea 
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste raw output here..."
              style={{
                width: "100%", height: "100px", background: "var(--color-bg)", border: "1px solid var(--color-border)",
                borderRadius: "8px", padding: "12px", fontSize: "13px", fontFamily: "monospace", color: "var(--color-text)", resize: "vertical", outline: "none"
              }}
              spellCheck="false"
            />
            <button 
              onClick={() => handleIngest(rawText)}
              style={{ background: "transparent", color: "var(--color-text-muted)", border: "1px solid var(--color-border)", padding: "6px 12px", borderRadius: "6px", fontWeight: "600", cursor: "pointer", marginTop: "12px" }}
            >
              Parse Pasted Text
            </button>
          </div>
        ) : (
          <div>
            {/* Stats Row */}
            <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
              <div style={{ flex: 1, background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: "8px", padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "var(--color-text-heading)" }}>{filteredAssets.length}</div>
                <div style={{ fontSize: "13px", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: "600" }}>Hosts Found</div>
              </div>
              <div style={{ flex: 1, background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: "8px", padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "var(--color-blue)" }}>{totalUrls}</div>
                <div style={{ fontSize: "13px", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: "600" }}>URLs</div>
              </div>
              <div style={{ flex: 1, background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: "8px", padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "var(--color-red)" }}>{totalVulns}</div>
                <div style={{ fontSize: "13px", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: "600" }}>Vulnerabilities</div>
              </div>
            </div>

            {/* Toolbar (Query Engine & View Toggles) */}
            <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <span style={{ position: "absolute", left: "12px", top: "10px", opacity: 0.5 }}>🔎</span>
                <input 
                  type="text" 
                  className="vault-input" 
                  placeholder="Search assets or use filters like tech:express port:8443 has:vuln" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: "100%", padding: "10px 10px 10px 36px" }}
                />
              </div>
              <div style={{ display: "flex", background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: "8px", padding: "4px" }}>
                <button 
                  onClick={() => setViewMode("list")}
                  style={{ background: viewMode === "list" ? "var(--color-blue)" : "transparent", color: viewMode === "list" ? "white" : "var(--color-text-muted)", border: "none", padding: "6px 16px", borderRadius: "4px", fontWeight: "600", cursor: "pointer" }}
                >
                  List
                </button>
                <button 
                  onClick={() => setViewMode("graph")}
                  style={{ background: viewMode === "graph" ? "var(--color-blue)" : "transparent", color: viewMode === "graph" ? "white" : "var(--color-text-muted)", border: "none", padding: "6px 16px", borderRadius: "4px", fontWeight: "600", cursor: "pointer" }}
                >
                  Visual Graph
                </button>
              </div>
              <button 
                onClick={() => { setAssets([]); setRawText(""); setSearchQuery(""); }}
                style={{ background: "transparent", color: "var(--color-red)", border: "1px solid rgba(239, 68, 68, 0.5)", padding: "0 16px", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {assets.length > 0 && (
        <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px 24px" }}>
          
          {viewMode === "list" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {filteredAssets.map((asset, i) => {
                const isExpanded = expandedHost === asset.host;
                const hasCriticalOrHigh = asset.vulns.some(v => ['critical', 'high'].includes(v.severity));

                return (
                  <div key={i} style={{ background: "var(--color-bg-secondary)", border: `1px solid ${hasCriticalOrHigh ? "rgba(239, 68, 68, 0.5)" : "var(--color-border)"}`, borderRadius: "8px", overflow: "hidden", transition: "all 0.2s ease" }}>
                    <div 
                      onClick={() => setExpandedHost(isExpanded ? null : asset.host)}
                      style={{ padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", background: hasCriticalOrHigh ? "rgba(239, 68, 68, 0.05)" : "transparent" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "var(--color-text-heading)" }}>{asset.host}</h3>
                        {asset.ips.length > 0 && <span style={{ fontSize: "13px", color: "var(--color-text-muted)", fontFamily: "monospace" }}>{asset.ips[0]}</span>}
                        {asset.vulns.length > 0 && (
                          <span style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--color-red)", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "700" }}>
                            {asset.vulns.length} VULNS
                          </span>
                        )}
                        {asset.tech.length > 0 && (
                          <div style={{ display: "flex", gap: "4px" }}>
                            {asset.tech.slice(0, 3).map(t => <span key={t} style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", color: "var(--color-text-muted)" }}>{t}</span>)}
                            {asset.tech.length > 3 && <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>+{asset.tech.length - 3}</span>}
                          </div>
                        )}
                      </div>
                      
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        {onTrackAsset && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); onTrackAsset(asset.host); }}
                            style={{ background: "var(--color-text-heading)", color: "var(--color-bg)", border: "none", padding: "4px 12px", borderRadius: "4px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                          >
                            🎯 Track Asset
                          </button>
                        )}
                        <span style={{ color: "var(--color-text-faint)" }}>{isExpanded ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: "0 16px 16px 16px", display: "flex", flexDirection: "column", gap: "16px", borderTop: `1px solid ${hasCriticalOrHigh ? "rgba(239, 68, 68, 0.1)" : "var(--color-border)"}` }}>
                        {/* Details row */}
                        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginTop: "16px" }}>
                          {asset.ports.length > 0 && (
                            <div>
                              <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--color-text-faint)", textTransform: "uppercase", marginBottom: "6px" }}>Open Ports</div>
                              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                {asset.ports.map(p => <span key={p} style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", padding: "2px 6px", borderRadius: "4px", fontSize: "12px", fontFamily: "monospace" }}>{p}</span>)}
                              </div>
                            </div>
                          )}
                          {asset.tech.length > 0 && (
                            <div>
                              <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--color-text-faint)", textTransform: "uppercase", marginBottom: "6px" }}>Tech Stack</div>
                              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                {asset.tech.map(t => <span key={t} style={{ background: "rgba(59, 130, 246, 0.1)", color: "var(--color-blue)", padding: "2px 6px", borderRadius: "4px", fontSize: "12px", fontWeight: "600" }}>{t}</span>)}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Vulnerabilities */}
                        {asset.vulns.length > 0 && (
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--color-text-faint)", textTransform: "uppercase", marginBottom: "8px" }}>Detected Vulnerabilities</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {asset.vulns.map((v, vidx) => {
                                const s = getSeverityStyle(v.severity);
                                return (
                                  <div key={vidx} style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "6px", padding: "10px 12px", display: "flex", gap: "12px", alignItems: "center" }}>
                                    <span style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}`, padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", minWidth: "75px", textAlign: "center" }}>{v.severity}</span>
                                    <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--color-text-heading)", flex: 1 }}>{v.name}</span>
                                    <span style={{ fontSize: "12px", color: "var(--color-text-muted)", fontFamily: "monospace" }}>{v.id}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* URLs */}
                        {asset.urls.length > 0 && (
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--color-text-faint)", textTransform: "uppercase", marginBottom: "8px" }}>Discovered Endpoints ({asset.urls.length})</div>
                            <div style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "6px", padding: "12px", maxHeight: "150px", overflowY: "auto" }}>
                              {asset.urls.map((u, uidx) => (
                                <div key={uidx} style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--color-text)", marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  <a href={u} target="_blank" rel="noreferrer" style={{ color: "var(--color-blue)", textDecoration: "none" }}>{u}</a>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {viewMode === "graph" && (
            <div style={{ padding: "40px", background: "var(--color-bg-secondary)", borderRadius: "12px", border: "1px solid var(--color-border)", overflowX: "auto" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
                <div style={{ padding: "16px", background: "var(--color-bg)", border: "2px solid var(--color-text-heading)", borderRadius: "8px", width: "max-content", margin: "0 auto", fontWeight: "700", fontSize: "18px" }}>
                  🌐 Target Infrastructure
                </div>
                
                <div style={{ display: "flex", gap: "32px", justifyContent: "center" }}>
                  {filteredAssets.map((asset, i) => {
                    const hasVulns = asset.vulns.length > 0;
                    return (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
                        <div style={{ width: "2px", height: "40px", background: "var(--color-border)", position: "absolute", top: "-40px" }}></div>
                        
                        <div style={{ 
                          background: hasVulns ? "rgba(239, 68, 68, 0.1)" : "var(--color-bg)", 
                          border: `2px solid ${hasVulns ? "var(--color-red)" : "var(--color-border)"}`, 
                          borderRadius: "8px", padding: "16px", width: "220px", textAlign: "center",
                          boxShadow: hasVulns ? "0 0 15px rgba(239, 68, 68, 0.2)" : "none"
                        }}>
                          <div style={{ fontWeight: "700", fontSize: "14px", wordBreak: "break-all", marginBottom: "8px", color: hasVulns ? "var(--color-red)" : "var(--color-text-heading)" }}>
                            {asset.host}
                          </div>
                          
                          {asset.ips.length > 0 && <div style={{ fontSize: "12px", color: "var(--color-text-muted)", fontFamily: "monospace", marginBottom: "12px" }}>{asset.ips[0]}</div>}
                          
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: "center", marginBottom: "8px" }}>
                            {asset.ports.slice(0,4).map(p => <span key={p} style={{ fontSize: "10px", background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", padding: "2px 4px", borderRadius: "4px" }}>{p}</span>)}
                          </div>
                          
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: "center" }}>
                            {asset.tech.slice(0,3).map(t => <span key={t} style={{ fontSize: "10px", background: "rgba(59, 130, 246, 0.1)", color: "var(--color-blue)", padding: "2px 4px", borderRadius: "4px", fontWeight: "600" }}>{t}</span>)}
                          </div>
                          
                          {hasVulns && (
                            <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px dashed rgba(239, 68, 68, 0.3)" }}>
                              <span style={{ background: "var(--color-red)", color: "white", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700" }}>
                                {asset.vulns.length} VULNERABILITIES
                              </span>
                            </div>
                          )}

                          {onTrackAsset && (
                            <div style={{ marginTop: "12px" }}>
                              <button 
                                onClick={() => onTrackAsset(asset.host)}
                                style={{ background: "var(--color-text-heading)", color: "var(--color-bg)", border: "none", padding: "4px 12px", borderRadius: "4px", fontSize: "11px", fontWeight: "600", cursor: "pointer", width: "100%" }}
                              >
                                🎯 Track
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
