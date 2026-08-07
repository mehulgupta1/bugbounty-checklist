import { useState } from "react";
import { analyzeResponse } from "../utils/responseAnalyzerEngine";

export default function ResponseAnalyzer() {
  const [inputText, setInputText] = useState("");
  const [findings, setFindings] = useState(null);

  const handleAnalyze = () => {
    if (!inputText.trim()) return;
    const results = analyzeResponse(inputText);
    setFindings(results);
  };

  const handleClear = () => {
    setInputText("");
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
      {/* HEADER */}
      <div style={{ padding: "24px 24px 0 24px" }}>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700", color: "var(--color-text-heading)" }}>
          Response analyzer
        </h1>
        <p style={{ margin: "0 0 24px 0", fontSize: "15px", color: "var(--color-text-muted)" }}>
          Paste any HTTP response — get instant analysis of what's interesting, what's vulnerable, and what to test next.
        </p>

        {/* INPUT AREA */}
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="HTTP/1.1 200 OK&#10;Server: Apache/2.4.49&#10;..."
          style={{
            width: "100%",
            height: "200px",
            background: "var(--color-bg-secondary)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "16px",
            fontSize: "13px",
            fontFamily: "monospace",
            color: "var(--color-text)",
            resize: "vertical",
            outline: "none",
            marginBottom: "16px",
            whiteSpace: "pre"
          }}
          spellCheck="false"
        />

        {/* CONTROLS */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "32px" }}>
          <button 
            onClick={handleAnalyze}
            style={{
              background: "var(--color-text-heading)",
              color: "var(--color-bg)",
              border: "1px solid var(--color-text-heading)",
              padding: "8px 16px",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            Analyze response
          </button>
          <button 
            onClick={handleClear}
            style={{
              background: "transparent",
              color: "var(--color-text-muted)",
              border: "1px solid var(--color-border)",
              padding: "8px 16px",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* RESULTS AREA */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px 24px" }}>
        {findings && findings.length === 0 && (
          <div style={{ padding: "32px", textAlign: "center", border: "1px dashed var(--color-border)", borderRadius: "8px", color: "var(--color-text-muted)" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>✅</div>
            No major red flags detected in this response.
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
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  padding: "16px",
                  display: "flex",
                  gap: "16px",
                  alignItems: "flex-start"
                }}>
                  <div style={{ 
                    background: sevStyle.bg, 
                    color: sevStyle.text, 
                    border: `1px solid ${sevStyle.border}`,
                    padding: "4px 8px", 
                    borderRadius: "4px", 
                    fontSize: "12px", 
                    fontWeight: "700",
                    textTransform: "lowercase",
                    minWidth: "65px",
                    textAlign: "center"
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
