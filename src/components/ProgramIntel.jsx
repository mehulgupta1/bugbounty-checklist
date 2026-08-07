import { useState, useEffect } from "react";
import { PROGRAMS } from "../data/programs";

export default function ProgramIntel() {
  const [activeTab, setActiveTab] = useState("browser"); // browser, parser, hof
  const [search, setSearch] = useState("");
  const [lessHuntedOnly, setLessHuntedOnly] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(new Date().toLocaleTimeString());
  
  // Scope Parser State
  const [rawScope, setRawScope] = useState("*.example.com\napi.example.com\nNot in scope: out.example.com");
  const [parsedScope, setParsedScope] = useState([]);

  // Hall of Fame State
  const [hof, setHof] = useState(() => {
    const saved = localStorage.getItem("bugbounty_hof");
    return saved ? JSON.parse(saved) : [];
  });
  const [newBug, setNewBug] = useState({ target: "", type: "", severity: "High", bounty: "$0" });

  const [programsList, setProgramsList] = useState(PROGRAMS);

  useEffect(() => {
    localStorage.setItem("bugbounty_hof", JSON.stringify(hof));
  }, [hof]);

  const [expandedProgramId, setExpandedProgramId] = useState(null);

  const handleParseScope = () => {
    // Basic regex to extract domains/subdomains and ignore text
    // Matches something like *.example.com or api.domain.co.uk
    const domainRegex = /([a-zA-Z0-9*_-]+\.)+[a-zA-Z0-9_-]+/g;
    const matches = rawScope.match(domainRegex) || [];
    // remove duplicates
    setParsedScope(Array.from(new Set(matches)));
  };

  const handleAddBug = (e) => {
    e.preventDefault();
    if (!newBug.target || !newBug.type) return;
    setHof([{ ...newBug, id: Date.now() }, ...hof]);
    setNewBug({ target: "", type: "", severity: "High", bounty: "$0" });
    setActiveTab("hof");
  };

  const deleteBug = (id) => {
    setHof(hof.filter(b => b.id !== id));
  };

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      const newUniqueVDPs = [
        {
          id: `p_new_${Date.now()}_1`,
          name: "Obscure University EdTech",
          platform: "Self-Hosted",
          type: "VDP",
          payouts: { critical: "Hall of Fame", high: "Swag", medium: "Swag", low: "None" },
          responseRate: "45%",
          difficulty: "Easy",
          competition: "Low",
          tags: ["EdTech", "VDP", "Hidden Gem"],
          scope: ["*.studentportal.edu", "alumni.edu"]
        },
        {
          id: `p_new_${Date.now()}_2`,
          name: "Regional Shipping & Logistics",
          platform: "Intigriti",
          type: "Public",
          payouts: { critical: "€1,500", high: "€800", medium: "€300", low: "€50" },
          responseRate: "90%",
          difficulty: "Easy",
          competition: "Low",
          tags: ["Logistics", "B2B", "Hidden Gem"],
          scope: ["tracking.shipping-reg.com", "api.shipping-reg.com", "partner.shipping-reg.com"]
        },
        {
          id: `p_new_${Date.now()}_3`,
          name: "Niche Medical Hardware API",
          platform: "Bugcrowd",
          type: "Private (Leaked)",
          payouts: { critical: "$8,000", high: "$3,000", medium: "$1,000", low: "$200" },
          responseRate: "100%",
          difficulty: "Medium",
          competition: "Low",
          tags: ["Hardware", "API", "Hidden Gem"],
          scope: ["api.meddevice.com", "telemetry.meddevice.com"]
        }
      ];
      
      // Add new unique VDPs but prevent infinite dupes if they click it multiple times
      setProgramsList(prev => {
        const existingNames = new Set(prev.map(p => p.name));
        const filteredNew = newUniqueVDPs.filter(p => !existingNames.has(p.name));
        return [...filteredNew, ...prev];
      });
      
      setLastSync(new Date().toLocaleTimeString());
      setIsSyncing(false);
    }, 1500);
  };

  const filteredPrograms = programsList.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchesHunted = lessHuntedOnly ? p.competition === "Low" : true;
    return matchesSearch && matchesHunted;
  });

  return (
    <div className="sandbox-container content-area">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 className="dashboard-title" style={{ margin: 0 }}>🤝 Program Intelligence</h1>
      </div>
      
      <p style={{ color: "var(--color-text-muted)", marginBottom: "24px" }}>
        Discover top programs, parse complex scope definitions, and track your Hall of Fame submissions!
      </p>

      <div className="dashboard-tabs">
        <button className={`dashboard-tab ${activeTab === "browser" ? "active" : ""}`} onClick={() => setActiveTab("browser")}>
          Program Browser
        </button>
        <button className={`dashboard-tab ${activeTab === "parser" ? "active" : ""}`} onClick={() => setActiveTab("parser")}>
          Scope Parser
        </button>
        <button className={`dashboard-tab ${activeTab === "hof" ? "active" : ""}`} onClick={() => setActiveTab("hof")}>
          Hall of Fame
        </button>
      </div>

      <div className="sandbox-content">
        
        {/* PROGRAM BROWSER */}
        {activeTab === "browser" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <button className="btn-primary" onClick={handleSync} disabled={isSyncing}>
                  {isSyncing ? "Syncing..." : "Sync Latest Programs 🔄"}
                </button>
                <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Last updated: {lastSync}</span>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", cursor: "pointer" }}>
                <input 
                  type="checkbox" 
                  checked={lessHuntedOnly} 
                  onChange={(e) => setLessHuntedOnly(e.target.checked)} 
                />
                Show "Less Hunted" Only (Low Competition)
              </label>
            </div>
            <div className="vault-input-group" style={{ marginBottom: "20px" }}>
              <input 
                className="vault-input"
                placeholder="Search programs or tags (e.g., 'Web', 'B2B')..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {filteredPrograms.map(prog => {
                const isExpanded = expandedProgramId === prog.id;
                return (
                  <div key={prog.id} style={{ background: "var(--color-bg-secondary)", borderRadius: "8px", border: "1px solid var(--color-border)", overflow: "hidden" }}>
                    <div 
                      style={{ padding: "16px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "12px" }}
                      onClick={() => setExpandedProgramId(isExpanded ? null : prog.id)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ fontWeight: 700, fontSize: "18px" }}>{prog.name}</div>
                          {prog.competition === "Low" && <span style={{ fontSize: "16px" }} title="Less Hunted / Hidden Gem">💎</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span className="waf-badge" style={{ background: prog.platform === "HackerOne" ? "#333" : prog.platform === "Bugcrowd" ? "#e05320" : "#2563eb" }}>{prog.platform}</span>
                          <span style={{ fontSize: "12px", color: "var(--color-text-faint)" }}>{isExpanded ? "▲" : "▼"}</span>
                        </div>
                      </div>
                      
                      <div style={{ display: "flex", gap: "8px" }}>
                        {prog.tags.map(t => <span key={t} style={{ fontSize: "11px", background: "var(--color-bg)", padding: "2px 6px", borderRadius: "4px", border: "1px solid var(--color-border)" }}>{t}</span>)}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ borderTop: "1px solid var(--color-border)", padding: "16px", background: "var(--color-bg)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", fontSize: "13px" }}>
                            <div><span style={{ color: "var(--color-text-faint)", display: "block", marginBottom: "4px" }}>Difficulty</span> <span style={{ fontWeight: 600 }}>{prog.difficulty}</span></div>
                            <div><span style={{ color: "var(--color-text-faint)", display: "block", marginBottom: "4px" }}>Competition</span> <span style={{ fontWeight: 600, color: prog.competition === "Low" ? "var(--color-green)" : prog.competition === "High" ? "var(--color-red)" : "var(--color-amber)" }}>{prog.competition}</span></div>
                            <div><span style={{ color: "var(--color-text-faint)", display: "block", marginBottom: "4px" }}>Response</span> <span style={{ fontWeight: 600 }}>{prog.responseRate}</span></div>
                          </div>
                          <div style={{ background: "var(--color-bg-secondary)", padding: "8px", borderRadius: "4px", fontSize: "12px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", textAlign: "center" }}>
                            <div><div style={{ color: "var(--color-text-faint)" }}>Critical</div><div style={{ color: "var(--color-red)", fontWeight: 600 }}>{prog.payouts.critical}</div></div>
                            <div><div style={{ color: "var(--color-text-faint)" }}>High</div><div style={{ color: "var(--color-amber)", fontWeight: 600 }}>{prog.payouts.high}</div></div>
                            <div><div style={{ color: "var(--color-text-faint)" }}>Medium</div><div style={{ color: "var(--color-green)" }}>{prog.payouts.medium}</div></div>
                          </div>
                        </div>

                        <div style={{ marginBottom: "16px" }}>
                          <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                            🎯 In-Scope Targets
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {prog.scope.map(s => (
                              <span key={s} style={{ fontFamily: "monospace", fontSize: "12px", background: "rgba(37,99,235,0.1)", color: "var(--color-blue)", padding: "4px 8px", borderRadius: "4px", border: "1px solid rgba(37,99,235,0.2)" }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "12px", marginTop: "16px", paddingTop: "16px", borderTop: "1px dashed var(--color-border)" }}>
                          <button 
                            className="btn-primary" 
                            style={{ padding: "6px 12px", fontSize: "13px" }}
                            onClick={() => {
                              setNewBug({...newBug, target: prog.name});
                              setActiveTab("hof");
                            }}
                          >
                            🏆 Log Bug for {prog.name}
                          </button>
                          <a 
                            href={`https://google.com/search?q=${prog.name}+bug+bounty`} 
                            target="_blank" rel="noreferrer"
                            className="tracker-btn"
                            style={{ padding: "6px 12px", fontSize: "13px", display: "flex", alignItems: "center" }}
                          >
                            View Program Policy ↗
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredPrograms.length === 0 && <div style={{ color: "var(--color-text-muted)" }}>No programs found matching '{search}'.</div>}
            </div>
          </div>
        )}

        {/* SCOPE PARSER */}
        {activeTab === "parser" && (
          <div>
            <p style={{ fontSize: "14px", color: "var(--color-text-muted)", marginBottom: "16px" }}>
              Paste a messy wildcard scope document from a program's policy page. The parser will extract all valid domains and subdomains automatically using regular expressions.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <label style={{ fontWeight: 600, display: "block", marginBottom: "8px" }}>Raw Scope Definition</label>
                <textarea 
                  className="vault-input"
                  style={{ minHeight: "300px", fontFamily: "monospace", fontSize: "13px" }}
                  value={rawScope}
                  onChange={(e) => setRawScope(e.target.value)}
                />
                <button className="btn-primary" style={{ marginTop: "12px", width: "100%" }} onClick={handleParseScope}>
                  Extract Domains
                </button>
              </div>
              <div>
                <label style={{ fontWeight: 600, display: "block", marginBottom: "8px" }}>Parsed Extracted Domains ({parsedScope.length})</label>
                <div style={{ background: "var(--color-bg-secondary)", padding: "16px", borderRadius: "8px", border: "1px solid var(--color-border)", minHeight: "300px" }}>
                  {parsedScope.length === 0 ? <div style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>No domains extracted yet. Click 'Extract Domains'.</div> : null}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {parsedScope.map((domain, i) => (
                      <div key={i} style={{ fontFamily: "monospace", fontSize: "13px", padding: "4px 8px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "4px" }}>
                        {domain}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HALL OF FAME */}
        {activeTab === "hof" && (
          <div>
            <form className="vault-add-form" onSubmit={handleAddBug} style={{ marginBottom: "24px" }}>
              <div style={{ fontWeight: 600, marginBottom: "12px" }}>Log a New Submission</div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <input required className="vault-input" style={{ flex: 1 }} placeholder="Target (e.g. Yahoo)" value={newBug.target} onChange={e => setNewBug({...newBug, target: e.target.value})} />
                <input required className="vault-input" style={{ flex: 1 }} placeholder="Bug Type (e.g. SQLi)" value={newBug.type} onChange={e => setNewBug({...newBug, type: e.target.value})} />
                <select className="vault-input" style={{ width: "120px" }} value={newBug.severity} onChange={e => setNewBug({...newBug, severity: e.target.value})}>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <input className="vault-input" style={{ width: "120px" }} placeholder="Bounty ($)" value={newBug.bounty} onChange={e => setNewBug({...newBug, bounty: e.target.value})} />
                <button type="submit" className="btn-primary">Log Bug 🏆</button>
              </div>
            </form>

            <div style={{ background: "var(--color-bg-secondary)", borderRadius: "8px", border: "1px solid var(--color-border)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead style={{ background: "var(--color-bg)", borderBottom: "1px solid var(--color-border)" }}>
                  <tr>
                    <th style={{ padding: "12px 16px", fontWeight: 600 }}>Target</th>
                    <th style={{ padding: "12px 16px", fontWeight: 600 }}>Bug Type</th>
                    <th style={{ padding: "12px 16px", fontWeight: 600 }}>Severity</th>
                    <th style={{ padding: "12px 16px", fontWeight: 600 }}>Bounty</th>
                    <th style={{ padding: "12px 16px", fontWeight: 600 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {hof.length === 0 && (
                    <tr><td colSpan="5" style={{ padding: "16px", textAlign: "center", color: "var(--color-text-muted)" }}>No bugs logged yet. Go find some!</td></tr>
                  )}
                  {hof.map(b => (
                    <tr key={b.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>{b.target}</td>
                      <td style={{ padding: "12px 16px" }}>{b.type}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span className="waf-badge" style={{ background: b.severity === "Critical" ? "var(--color-red)" : b.severity === "High" ? "var(--color-amber)" : b.severity === "Medium" ? "var(--color-green)" : "var(--color-blue)" }}>
                          {b.severity}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--color-green)" }}>{b.bounty}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <button className="nav-delete-btn" onClick={() => deleteBug(b.id)} title="Delete Log">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
