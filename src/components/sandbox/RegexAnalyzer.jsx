import { useState } from "react";

export default function RegexAnalyzer() {
  const [regexStr, setRegexStr] = useState("<script[^>]*>[\\\\s\\\\S]*?<\\\\/script>");
  const [flags, setFlags] = useState("gi");
  const [testString, setTestString] = useState("<script>alert(1)</script>\n<sCript src=x></SCRIPT>\n<scr<script>ipt>alert(1)</script>");

  let regex = null;
  let error = null;
  let matchResults = [];

  try {
    regex = new RegExp(regexStr, flags);
    const matches = [...testString.matchAll(regex)];
    matchResults = matches.map(m => ({
      match: m[0],
      index: m.index,
      groups: m.groups
    }));
  } catch (e) {
    error = e.message;
  }

  // Highlight matches in the test string safely
  const renderHighlighted = () => {
    if (error || !regex) return <div style={{ whiteSpace: "pre-wrap" }}>{testString}</div>;
    
    try {
      // Split by matches
      const parts = [];
      let lastIndex = 0;
      
      // We must re-run without global flag modifying state unexpectedly, matchAll handles it but we need an array
      const matches = [...testString.matchAll(new RegExp(regexStr, flags.includes('g') ? flags : flags + 'g'))];
      
      matches.forEach((m, i) => {
        parts.push(testString.substring(lastIndex, m.index));
        parts.push(<span key={i} style={{ background: "rgba(239, 68, 68, 0.2)", borderBottom: "2px solid var(--color-red)", borderRadius: "2px" }}>{m[0]}</span>);
        lastIndex = m.index + m[0].length;
      });
      parts.push(testString.substring(lastIndex));
      
      return <div style={{ whiteSpace: "pre-wrap" }}>{parts}</div>;
    } catch {
      return <div style={{ whiteSpace: "pre-wrap" }}>{testString}</div>;
    }
  };

  return (
    <div className="sandbox-tool">
      <h2 className="sandbox-tool-title">Regex Filter Analyzer</h2>
      <p className="sandbox-tool-desc">Test WAF regex filters against your payloads to find bypasses.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "20px" }}>
        <div>
          <div className="vault-input-group">
            <label>Filter Regex (without slashes):</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input 
                className="vault-input"
                style={{ flex: 1, fontFamily: "monospace" }}
                value={regexStr}
                onChange={(e) => setRegexStr(e.target.value)}
              />
              <input 
                className="vault-input"
                style={{ width: "60px", fontFamily: "monospace" }}
                value={flags}
                onChange={(e) => setFlags(e.target.value)}
                placeholder="gi"
                title="Flags (g, i, m, s, u, y)"
              />
            </div>
            {error && <div style={{ color: "var(--color-red)", marginTop: "8px", fontSize: "14px" }}>{error}</div>}
          </div>

          <div className="vault-input-group" style={{ marginTop: "16px" }}>
            <label>Test Payload:</label>
            <textarea 
              className="vault-input"
              style={{ minHeight: "200px", fontFamily: "monospace" }}
              value={testString}
              onChange={(e) => setTestString(e.target.value)}
            />
          </div>
        </div>

        <div>
          <div className="vault-input-group">
            <label>Match Visualization:</label>
            <div style={{ background: "var(--color-bg)", padding: "16px", borderRadius: "8px", border: "1px solid var(--color-border)", minHeight: "200px", fontFamily: "monospace", fontSize: "14px", color: "var(--color-text)", wordBreak: "break-all" }}>
              {renderHighlighted()}
            </div>
          </div>

          <div className="vault-input-group" style={{ marginTop: "16px" }}>
            <label>Results ({matchResults.length} matches):</label>
            <div style={{ background: "var(--color-bg-secondary)", padding: "12px", borderRadius: "8px", border: "1px solid var(--color-border)", minHeight: "100px", maxHeight: "150px", overflowY: "auto", fontFamily: "monospace", fontSize: "12px" }}>
              {matchResults.length === 0 ? <span style={{ color: "var(--color-green)" }}>No matches! Bypass successful?</span> : null}
              {matchResults.map((m, i) => (
                <div key={i} style={{ color: "var(--color-text)", marginBottom: "8px", borderBottom: "1px dashed var(--color-border)", paddingBottom: "8px" }}>
                  <div style={{ color: "var(--color-red)" }}>Match {i+1}: {JSON.stringify(m.match)}</div>
                  <div style={{ color: "var(--color-text-faint)" }}>Index: {m.index}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
