import { useState } from "react";
import { analyzeTraffic } from "../utils/trafficAnalyzerEngine";

export default function TrafficAnalyzer() {
  const [reqText, setReqText] = useState("");
  const [resText, setResText] = useState("");
  const [findings, setFindings] = useState(null);

  const handleAnalyze = () => {
    if (!reqText.trim() && !resText.trim()) return;
    const results = analyzeTraffic(reqText, resText);
    setFindings(results);
  };

  const handleClear = () => {
    setReqText("");
    setResText("");
    setFindings(null);
  };

  const getSeverityStyle = (sev) => {
    switch (sev) {
      case "critical": return { bg: "#fee2e2", text: "#dc2626", border: "#f87171" };
      case "high": return { bg: "#fef3c7", text: "#d97706", border: "#fbbf24" };
      case "medium": return { bg: "#dcfce7", text: "#16a34a", border: "#4ade80" };
      default: return { bg: "#f3f4f6", text: "#6b7280", border: "#d1d5db" };
    }
  };

  return (
    <div className="content-area" style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--color-bg)" }}>
      <div style={{ padding: "24px 24px 0 24px" }}>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700", color: "var(--color-text-heading)" }}>
          🚦 Traffic Analyzer
        </h1>
        <p style={{ margin: "0 0 24px 0", fontSize: "15px", color: "var(--color-text-muted)" }}>
          Paste raw HTTP Requests and Responses. The engine will analyze both simultaneously to find reflected inputs, missing security headers, and authentication flaws.
        </p>

        <div style={{ display: "flex", gap: "24px", marginBottom: "16px", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "300px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: "var(--color-text-heading)" }}>
              Raw HTTP Request
            </label>
            <textarea
              value={reqText}
              onChange={(e) => setReqText(e.target.value)}
              placeholder="POST /api/login HTTP/1.1&#10;Host: target.com&#10;..."
              style={{
                width: "100%", height: "200px", background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)",
                borderRadius: "8px", padding: "16px", fontSize: "13px", fontFamily: "monospace", color: "var(--color-text)",
                resize: "vertical", outline: "none", whiteSpace: "pre"
              }}
              spellCheck="false"
            />
          </div>
          <div style={{ flex: 1, minWidth: "300px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: "var(--color-text-heading)" }}>
              Raw HTTP Response
            </label>
            <textarea
              value={resText}
              onChange={(e) => setResText(e.target.value)}
              placeholder="HTTP/1.1 200 OK&#10;Server: nginx&#10;..."
              style={{
                width: "100%", height: "200px", background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)",
                borderRadius: "8px", padding: "16px", fontSize: "13px", fontFamily: "monospace", color: "var(--color-text)",
                resize: "vertical", outline: "none", whiteSpace: "pre"
              }}
              spellCheck="false"
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", marginBottom: "32px" }}>
          <button 
            onClick={handleAnalyze}
            style={{
              background: "var(--color-text-heading)", color: "var(--color-bg)", border: "1px solid var(--color-text-heading)",
              padding: "8px 16px", borderRadius: "6px", fontSize: "14px", fontWeight: "600", cursor: "pointer"
            }}
          >
            Analyze Traffic
          </button>
          <button 
            onClick={handleClear}
            style={{
              background: "transparent", color: "var(--color-text-muted)", border: "1px solid var(--color-border)",
              padding: "8px 16px", borderRadius: "6px", fontSize: "14px", fontWeight: "600", cursor: "pointer"
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px 24px" }}>
        {findings && findings.length === 0 && (
          <div style={{ padding: "32px", textAlign: "center", border: "1px dashed var(--color-border)", borderRadius: "8px", color: "var(--color-text-muted)" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>✅</div>
            No major red flags detected in this traffic.
          </div>
        )}

        {findings && findings.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "var(--color-text-heading)" }}>
              Detected Findings ({findings.length})
            </h3>
            
            {findings.map((f, i) => {
              const sevStyle = getSeverityStyle(f.severity);
              return (
                <div key={i} style={{
                  background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "8px",
                  padding: "16px", display: "flex", gap: "16px", alignItems: "flex-start"
                }}>
                  <div style={{ 
                    background: sevStyle.bg, color: sevStyle.text, border: `1px solid ${sevStyle.border}`,
                    padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "700",
                    textTransform: "lowercase", minWidth: "65px", textAlign: "center"
                  }}>
                    {f.severity}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: "0 0 6px 0", fontSize: "15px", fontWeight: "600", color: "var(--color-text-heading)" }}>
                      {f.title}
                    </h4>
                    <p style={{ margin: 0, fontSize: "14px", color: "var(--color-text-muted)", lineHeight: "1.5" }}>
                      {f.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
