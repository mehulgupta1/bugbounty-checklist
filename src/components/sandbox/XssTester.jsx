import { useState, useEffect } from "react";

export default function XssTester() {
  const [payload, setPayload] = useState("<h1>Hello</h1><script>alert('XSS')</script>");
  const [context, setContext] = useState("html"); // html, attribute, script

  const renderSandbox = () => {
    let rawHtml = "";
    if (context === "html") {
      rawHtml = payload;
    } else if (context === "attribute") {
      rawHtml = `<input type="text" name="test" value="${payload.replace(/"/g, '&quot;')}" />`;
    } else if (context === "script") {
      rawHtml = `<script>var a = "${payload.replace(/"/g, '\\"')}";</script>`;
    }

    const srcDoc = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>body { font-family: sans-serif; }</style>
        <script>
          // Intercept alerts inside the iframe to avoid real popups breaking the app
          window.alert = function(msg) {
            window.parent.postMessage({ type: 'XSS_ALERT', msg: msg }, '*');
          };
          window.prompt = function(msg) {
            window.parent.postMessage({ type: 'XSS_PROMPT', msg: msg }, '*');
            return "test";
          };
          window.confirm = function(msg) {
            window.parent.postMessage({ type: 'XSS_CONFIRM', msg: msg }, '*');
            return true;
          };
        </script>
      </head>
      <body>
        <h3>Safe Sandbox Preview:</h3>
        <hr/>
        ${rawHtml}
      </body>
      </html>
    `;
    return srcDoc;
  };

  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data && e.data.type && e.data.type.startsWith('XSS_')) {
        setAlerts(prev => [...prev, `${e.data.type.replace('XSS_', '')}: ${e.data.msg}`]);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div className="sandbox-tool">
      <h2 className="sandbox-tool-title">XSS Payload Tester</h2>
      <p className="sandbox-tool-desc">Test your XSS payloads in an isolated iframe. JavaScript alerts are intercepted and logged below.</p>
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "20px" }}>
        <div>
          <div className="vault-input-group">
            <label>Context:</label>
            <select className="vault-input" value={context} onChange={e => setContext(e.target.value)}>
              <option value="html">Raw HTML</option>
              <option value="attribute">Inside Attribute (value="X")</option>
              <option value="script">Inside Script String (var a = "X")</option>
            </select>
          </div>

          <div className="vault-input-group" style={{ marginTop: "16px" }}>
            <label>Payload:</label>
            <textarea 
              className="vault-input"
              style={{ minHeight: "150px", fontFamily: "monospace" }}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
            />
          </div>

          <div className="vault-input-group" style={{ marginTop: "16px" }}>
            <label>Alert Logs ({alerts.length}):</label>
            <div style={{ background: "var(--color-bg-secondary)", padding: "12px", borderRadius: "8px", border: "1px solid var(--color-border)", minHeight: "100px", maxHeight: "150px", overflowY: "auto", fontFamily: "monospace", fontSize: "12px" }}>
              {alerts.length === 0 ? <span style={{ color: "var(--color-text-muted)" }}>No alerts triggered yet...</span> : null}
              {alerts.map((a, i) => (
                <div key={i} style={{ color: "var(--color-red)", marginBottom: "4px" }}>&gt; {a}</div>
              ))}
            </div>
            {alerts.length > 0 && (
              <button className="tracker-btn" style={{ marginTop: "8px" }} onClick={() => setAlerts([])}>Clear Logs</button>
            )}
          </div>
        </div>

        <div>
          <div className="vault-input-group">
            <label>Live Preview (Isolated IFrame):</label>
            <iframe 
              title="XSS Sandbox"
              sandbox="allow-scripts" // Safe because alerts are intercepted and it can't reach parent DOM
              srcDoc={renderSandbox()}
              style={{ width: "100%", height: "400px", border: "1px solid var(--color-border)", borderRadius: "8px", background: "white" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
