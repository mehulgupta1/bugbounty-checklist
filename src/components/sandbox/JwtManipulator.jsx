import { useState, useEffect } from "react";

function base64UrlDecode(str) {
  try {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return decodeURIComponent(escape(atob(base64)));
  } catch (e) {
    return "Invalid Base64Url string";
  }
}

function base64UrlEncode(str) {
  try {
    const base64 = btoa(unescape(encodeURIComponent(str)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (e) {
    return "";
  }
}

export default function JwtManipulator() {
  const [jwt, setJwt] = useState("");
  const [headerStr, setHeaderStr] = useState("");
  const [payloadStr, setPayloadStr] = useState("");
  const [signature, setSignature] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!jwt) {
      setHeaderStr("");
      setPayloadStr("");
      setSignature("");
      setError(null);
      return;
    }

    const parts = jwt.split(".");
    if (parts.length !== 3) {
      setError("Invalid JWT format. Must contain 3 parts separated by dots.");
      return;
    }

    setError(null);
    setHeaderStr(base64UrlDecode(parts[0]));
    setPayloadStr(base64UrlDecode(parts[1]));
    setSignature(parts[2]);
  }, [jwt]);

  const handleHeaderChange = (e) => {
    setHeaderStr(e.target.value);
    rebuildJwt(e.target.value, payloadStr, signature);
  };

  const handlePayloadChange = (e) => {
    setPayloadStr(e.target.value);
    rebuildJwt(headerStr, e.target.value, signature);
  };

  const handleSignatureChange = (e) => {
    setSignature(e.target.value);
    rebuildJwt(headerStr, payloadStr, e.target.value);
  };

  const rebuildJwt = (h, p, s) => {
    const encodedHeader = base64UrlEncode(h);
    const encodedPayload = base64UrlEncode(p);
    setJwt(`${encodedHeader}.${encodedPayload}.${s}`);
  };

  const applyNoneAlgorithm = () => {
    try {
      let hObj = JSON.parse(headerStr);
      hObj.alg = "none";
      const newHeaderStr = JSON.stringify(hObj, null, 2);
      setHeaderStr(newHeaderStr);
      rebuildJwt(newHeaderStr, payloadStr, "");
      setSignature("");
    } catch {
      alert("Header must be valid JSON to auto-apply 'none' algorithm");
    }
  };

  return (
    <div className="sandbox-tool">
      <h2 className="sandbox-tool-title">JWT Manipulator</h2>
      <p className="sandbox-tool-desc">Decode, modify, and re-encode JSON Web Tokens. Test for the 'None' algorithm vulnerability.</p>
      
      <div className="vault-input-group">
        <label>Encoded JWT:</label>
        <textarea 
          className="vault-input"
          style={{ minHeight: "100px", fontFamily: "monospace", wordBreak: "break-all" }}
          value={jwt}
          onChange={(e) => setJwt(e.target.value)}
          placeholder="eyJhbGciOi..."
        />
        {error && <div style={{ color: "var(--color-red)", marginTop: "8px", fontSize: "14px" }}>{error}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "20px" }}>
        <div className="vault-input-group">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ color: "var(--color-red)" }}>Header (JSON):</label>
            <button className="tracker-btn" onClick={applyNoneAlgorithm} title="Change alg to 'none' and strip signature">
              Inject alg="none"
            </button>
          </div>
          <textarea 
            className="vault-input"
            style={{ minHeight: "150px", fontFamily: "monospace", color: "var(--color-red)" }}
            value={headerStr}
            onChange={handleHeaderChange}
          />
        </div>

        <div className="vault-input-group">
          <label style={{ color: "var(--color-blue)" }}>Payload (JSON):</label>
          <textarea 
            className="vault-input"
            style={{ minHeight: "150px", fontFamily: "monospace", color: "var(--color-blue)" }}
            value={payloadStr}
            onChange={handlePayloadChange}
          />
        </div>
      </div>

      <div className="vault-input-group" style={{ marginTop: "20px" }}>
        <label style={{ color: "var(--color-green)" }}>Signature (Base64Url):</label>
        <textarea 
          className="vault-input"
          style={{ minHeight: "60px", fontFamily: "monospace", color: "var(--color-green)" }}
          value={signature}
          onChange={handleSignatureChange}
        />
      </div>
    </div>
  );
}
