import { useState, useEffect } from "react";
import { generateWordlist } from "../utils/wordlistEngine";

export default function SmartWordlistBuilder() {
  const [companyName, setCompanyName] = useState("");
  const [techStack, setTechStack] = useState("generic");
  const [customWords, setCustomWords] = useState("");
  const [wordlistOutput, setWordlistOutput] = useState("");
  const [copied, setCopied] = useState(false);

  // --- VAULT STATE ---
  const [customStacks, setCustomStacks] = useState(() => {
    const saved = localStorage.getItem("bbcl_custom_stacks");
    return saved ? JSON.parse(saved) : [];
  });
  
  const [newStackName, setNewStackName] = useState("");
  const [newStackExts, setNewStackExts] = useState("");
  const [newStackWords, setNewStackWords] = useState("");
  const [showVault, setShowVault] = useState(false);

  useEffect(() => {
    localStorage.setItem("bbcl_custom_stacks", JSON.stringify(customStacks));
  }, [customStacks]);

  const handleGenerate = () => {
    const list = generateWordlist(companyName, techStack, customWords, customStacks);
    setWordlistOutput(list);
    setCopied(false);
  };

  const handleReset = () => {
    setCompanyName("");
    setTechStack("generic");
    setCustomWords("");
    setWordlistOutput("");
    setCopied(false);
  };

  const handleCopy = () => {
    if (!wordlistOutput) return;
    navigator.clipboard.writeText(wordlistOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveStack = () => {
    if (!newStackName.trim()) return;
    const newStack = {
      id: `custom_${Date.now()}`,
      name: newStackName,
      extensions: newStackExts,
      baseWords: newStackWords
    };
    setCustomStacks([...customStacks, newStack]);
    setNewStackName("");
    setNewStackExts("");
    setNewStackWords("");
    setTechStack(newStack.id); // Auto-select it
  };

  const handleDeleteStack = (id) => {
    setCustomStacks(customStacks.filter(s => s.id !== id));
    if (techStack === id) setTechStack("generic");
  };

  return (
    <div className="content-area" style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--color-bg)" }}>
      {/* HEADER */}
      <div style={{ padding: "24px 24px 0 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
          <h1 style={{ margin: "0", fontSize: "24px", fontWeight: "700", color: "var(--color-text-heading)" }}>
            Smart wordlist builder
          </h1>
          <button 
            onClick={() => setShowVault(!showVault)}
            style={{
              background: showVault ? "var(--color-text-heading)" : "transparent",
              color: showVault ? "var(--color-bg)" : "var(--color-text)",
              border: `1px solid ${showVault ? "var(--color-text-heading)" : "var(--color-border)"}`,
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            🗄️ Wordlist Vault
          </button>
        </div>
        <p style={{ margin: "0 0 24px 0", fontSize: "15px", color: "var(--color-text-muted)" }}>
          Target-aware wordlist from company + tech stack. Paste your own words to mutate them.
        </p>

        {/* VAULT SECTION (Conditional) */}
        {showVault && (
          <div style={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: "8px", padding: "16px", marginBottom: "24px" }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "700", color: "var(--color-text-heading)" }}>
              Create Custom Stack Preset
            </h3>
            <div style={{ display: "flex", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
              <input 
                type="text" 
                placeholder="Stack Name (e.g. My Go API)" 
                value={newStackName}
                onChange={(e) => setNewStackName(e.target.value)}
                style={{ flex: 1, minWidth: "150px", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", outline: "none", fontSize: "13px" }}
              />
              <input 
                type="text" 
                placeholder="Extensions (e.g. .go, .tmpl)" 
                value={newStackExts}
                onChange={(e) => setNewStackExts(e.target.value)}
                style={{ flex: 1, minWidth: "150px", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", outline: "none", fontSize: "13px" }}
              />
            </div>
            <textarea
              placeholder="Paste your massive base wordlist here... (It will be saved permanently)"
              value={newStackWords}
              onChange={(e) => setNewStackWords(e.target.value)}
              style={{ width: "100%", height: "80px", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", outline: "none", fontSize: "13px", resize: "vertical", fontFamily: "monospace", marginBottom: "12px" }}
            />
            <button onClick={handleSaveStack} style={{ background: "var(--color-blue)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "13px", fontWeight: "600", cursor: "pointer", marginBottom: "16px" }}>
              Save Custom Stack
            </button>

            {customStacks.length > 0 && (
              <div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "12px", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Your Saved Stacks</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {customStacks.map(stack => (
                    <div key={stack.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--color-bg)", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--color-border)" }}>
                      <div>
                        <span style={{ fontWeight: "600", fontSize: "13px", marginRight: "8px" }}>{stack.name}</span>
                        <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>({stack.baseWords.split('\n').filter(w=>w).length} words, exts: {stack.extensions || "none"})</span>
                      </div>
                      <button onClick={() => handleDeleteStack(stack.id)} style={{ background: "none", border: "none", color: "var(--color-red)", cursor: "pointer", fontSize: "12px" }}>Delete</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* INPUTS ROW */}
        <h3 style={{ margin: "0 0 12px 0", fontSize: "12px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
          Target-Aware Wordlist Generator
        </h3>
        
        <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Company name (e.g. tesla)"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            style={{
              flex: "1",
              minWidth: "200px",
              background: "var(--color-bg-secondary)",
              border: "1px solid var(--color-border)",
              borderRadius: "6px",
              padding: "10px 16px",
              fontSize: "14px",
              color: "var(--color-text)",
              outline: "none"
            }}
          />
          <select
            value={techStack}
            onChange={(e) => setTechStack(e.target.value)}
            style={{
              flex: "1",
              minWidth: "200px",
              background: "var(--color-bg-secondary)",
              border: "1px solid var(--color-border)",
              borderRadius: "6px",
              padding: "10px 16px",
              fontSize: "14px",
              color: "var(--color-text)",
              outline: "none",
              cursor: "pointer"
            }}
          >
            <option value="generic">Generic Stack</option>
            <option value="php">PHP</option>
            <option value="spring">Java / Spring Boot</option>
            <option value="aspnet">ASP.NET / IIS</option>
            <option value="node">Node.js</option>
            <option value="python">Python / Django / Flask</option>
            {customStacks.length > 0 && <optgroup label="Vault Custom Stacks">
              {customStacks.map(s => (
                <option key={s.id} value={s.id}>Vault: {s.name}</option>
              ))}
            </optgroup>}
          </select>
          <button 
            onClick={handleGenerate}
            style={{
              background: "var(--color-bg)",
              color: "var(--color-text-heading)",
              border: "1px solid var(--color-text-muted)",
              padding: "8px 24px",
              borderRadius: "99px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            Generate
          </button>
        </div>

        <textarea
          value={customWords}
          onChange={(e) => setCustomWords(e.target.value)}
          placeholder="Enter one-off base words here (or use the Vault above to save them permanently)..."
          style={{
            width: "100%",
            height: "80px",
            background: "var(--color-bg-secondary)",
            border: "1px solid var(--color-border)",
            borderRadius: "6px",
            padding: "12px 16px",
            fontSize: "13px",
            fontFamily: "monospace",
            color: "var(--color-text)",
            resize: "vertical",
            outline: "none",
            marginBottom: "16px"
          }}
          spellCheck="false"
        />

        {/* CONTROLS */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
          <button 
            onClick={handleCopy}
            style={{
              background: "transparent",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
              padding: "8px 16px",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <span>{copied ? "✓ Copied" : "📋 Copy wordlist"}</span>
          </button>
          
          <button 
            onClick={handleReset}
            style={{
              background: "transparent",
              color: "var(--color-text-muted)",
              border: "1px solid transparent",
              padding: "8px 16px",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "color 0.2s"
            }}
            onMouseOver={(e) => e.target.style.color = "var(--color-red)"}
            onMouseOut={(e) => e.target.style.color = "var(--color-text-muted)"}
          >
            <span>🗑️ Reset</span>
          </button>
        </div>
      </div>

      {/* RESULTS AREA */}
      <div style={{ flex: 1, padding: "0 24px 24px 24px", display: "flex", flexDirection: "column" }}>
        {wordlistOutput && (
          <div style={{ marginBottom: "8px", fontSize: "13px", color: "var(--color-text-muted)", fontWeight: "600" }}>
            Generated {wordlistOutput.split('\n').length} words
          </div>
        )}
        <textarea
          readOnly
          value={wordlistOutput}
          placeholder="Wordlist output will appear here..."
          style={{
            flex: 1,
            width: "100%",
            background: "var(--color-bg-secondary)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "16px",
            fontSize: "13px",
            fontFamily: "monospace",
            color: "var(--color-text)",
            resize: "none",
            outline: "none",
            whiteSpace: "pre"
          }}
        />
      </div>
    </div>
  );
}
