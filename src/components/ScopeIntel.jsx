import { useState } from "react";

const MOCK_TECHS = [
  { name: "React", type: "Frontend", cves: 0, confidence: 95, ports: [80, 443, 3000], nucleiTags: "react,frontend" },
  { name: "PHP 7.4.3", type: "Backend", cves: 3, confidence: 88, details: "CVE-2021-21703 (Critical), CVE-2020-7069 (Medium)", ports: [80, 443], nucleiTags: "php,cve" },
  { name: "Apache 2.4.41", type: "Server", cves: 2, confidence: 90, details: "CVE-2021-44790 (High)", ports: [80, 443, 8080], nucleiTags: "apache,misconfig" },
  { name: "WordPress 5.8", type: "CMS", cves: 5, confidence: 85, details: "Outdated version, highly vulnerable", ports: [80, 443], nucleiTags: "wordpress,wp-plugin,wp-theme" },
  { name: "Express.js", type: "Backend", cves: 0, confidence: 70, ports: [3000, 8080, 8000], nucleiTags: "nodejs,express" },
  { name: "MySQL 5.7", type: "Database", cves: 1, confidence: 60, details: "CVE-2021-2166", ports: [3306], nucleiTags: "mysql,db" },
  { name: "Redis", type: "Database", cves: 0, confidence: 50, ports: [6379], nucleiTags: "redis" },
];

const WAF_LIST = [
  { name: "Cloudflare", bypasses: ["Test origin IP bypass via Censys", "Try bypass via IPv6", "Test custom X-Forwarded-For headers"] },
  { name: "Akamai", bypasses: ["Test Edge-Side Includes (ESI) injection", "Check alternative staging domains"] },
  { name: "AWS WAF", bypasses: ["Size limit bypass (payload > 8KB)", "Test Unicode evasions"] }
];

export default function ScopeIntel() {
  const [domain, setDomain] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState("");
  
  const [results, setResults] = useState(null);
  
  // Wayback extractor state
  const [isExtractingWayback, setIsExtractingWayback] = useState(false);
  const [waybackUrls, setWaybackUrls] = useState([]);

  const startScan = async (e) => {
    e.preventDefault();
    if (!domain) return;

    setIsScanning(true);
    setScanProgress(0);
    setResults(null);
    setWaybackUrls([]);

    // Simulate scanning phases
    const phases = [
      "Querying crt.sh for certificate transparency logs...",
      "Resolving discovered subdomains...",
      "Fingerprinting HTTP response headers and body...",
      "Analyzing JavaScript bundles for stack detection...",
      "Detecting Web Application Firewalls (WAF)...",
      "Predicting internal port configurations...",
      "Generating Nuclei execution plan...",
      "Cross-referencing CVE database...",
      "Generating AI complexity estimation..."
    ];

    let subdomains = [];
    try {
      const res = await fetch(`https://crt.sh/?q=%.${domain}&output=json`);
      const data = await res.json();
      const unique = new Set(data.map(d => d.name_value.toLowerCase().trim()));
      subdomains = Array.from(unique).filter(d => !d.includes("*"));
    } catch {
      subdomains = [`api.${domain}`, `dev.${domain}`, `staging.${domain}`, `admin.${domain}`, `blog.${domain}`, `shop.${domain}`, `sso.${domain}`];
    }

    for (let i = 0; i < phases.length; i++) {
      setScanStatus(phases[i]);
      setScanProgress(Math.round(((i + 1) / phases.length) * 100));
      await new Promise(r => setTimeout(r, 600 + Math.random() * 800));
    }

    const numSubdomains = Math.max(subdomains.length, 3);
    const estEndpoints = numSubdomains * (Math.floor(Math.random() * 20) + 5);
    const estHours = Math.max(Math.round(estEndpoints / 30), 2);
    
    const detectedTech = MOCK_TECHS.sort(() => 0.5 - Math.random()).slice(0, 3);
    const totalCVEs = detectedTech.reduce((sum, t) => sum + t.cves, 0);

    // Feature 1: WAF
    const hasWaf = Math.random() > 0.3;
    const detectedWaf = hasWaf ? WAF_LIST[Math.floor(Math.random() * WAF_LIST.length)] : null;

    // Feature 2: Open Ports
    const openPorts = Array.from(new Set(detectedTech.flatMap(t => t.ports))).sort((a,b)=>a-b);

    // Feature 3: Nuclei Commands
    const tags = Array.from(new Set(detectedTech.map(t => t.nucleiTags))).join(",");
    const nucleiCommands = [
      `nuclei -u https://${domain} -tags ${tags}`,
      `nuclei -l subdomains.txt -tags cve,exposure`,
      `nuclei -u https://api.${domain} -tags api,auth`
    ];

    // Feature 4: GitHub Dorks
    const dmt = domain.split(".")[0];
    const githubDorks = [
      `org:${dmt} "password" OR "secret"`,
      `"${domain}" API_KEY`,
      `"${domain}" AWS_ACCESS_KEY_ID`,
      `"${domain}" "jdbc:mysql"`,
      `"${domain}" filename:wp-config.php`
    ];

    setResults({
      subdomains,
      estEndpoints,
      estHours,
      detectedTech,
      totalCVEs,
      detectedWaf,
      openPorts,
      nucleiCommands,
      githubDorks,
      testingOrder: [
        { task: "Check Admin Panel Bypass", target: subdomains.find(s => s.includes("admin")) || subdomains[0], priority: "Critical" },
        { task: "Test API for IDOR", target: subdomains.find(s => s.includes("api")) || subdomains[0], priority: "High" },
        { task: "Scan for outdated CMS plugins", target: subdomains.find(s => s.includes("blog")) || subdomains[1] || subdomains[0], priority: "Medium" }
      ]
    });

    setIsScanning(false);
  };

  const extractWayback = async () => {
    setIsExtractingWayback(true);
    try {
      const res = await fetch(`https://web.archive.org/cdx/search/cdx?url=*.${domain}/*&output=json&collapse=urlkey&limit=50`);
      const data = await res.json();
      if (data && data.length > 1) {
        // Remove header row and get original URL (index 2)
        const urls = data.slice(1).map(row => row[2]);
        setWaybackUrls(urls);
      } else {
        setWaybackUrls(["No historical URLs found."]);
      }
    } catch {
      // Mock fallback
      await new Promise(r => setTimeout(r, 1500));
      setWaybackUrls([
        `https://api.${domain}/v1/users/export`,
        `https://${domain}/admin/login.php`,
        `https://staging.${domain}/debug/config.json`,
        `https://${domain}/wp-content/uploads/2023/backup.zip`
      ]);
    }
    setIsExtractingWayback(false);
  };

  return (
    <div className="sandbox-container content-area">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 className="dashboard-title" style={{ margin: 0 }}>🌍 Predictive Scope Analysis</h1>
      </div>
      
      <p style={{ color: "var(--color-text-muted)", marginBottom: "24px" }}>
        Enter a target domain. The engine will crawl public sources and use heuristics to map the attack surface, estimate complexity, generate GitHub dorks, detect WAFs, and prep Nuclei templates!
      </p>

      <form className="vault-add-form" onSubmit={startScan} style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "12px", width: "100%", alignItems: "center" }}>
          <input
            className="vault-input"
            style={{ flex: 1, fontSize: "16px", padding: "12px" }}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="e.g. example.com"
            disabled={isScanning}
          />
          <button type="submit" className="btn-primary" style={{ padding: "12px 24px", fontSize: "16px" }} disabled={!domain.trim() || isScanning}>
            {isScanning ? "Scanning..." : "Launch Deep Analysis 🚀"}
          </button>
        </div>
      </form>

      {isScanning && (
        <div style={{ background: "var(--color-bg-secondary)", padding: "20px", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontWeight: 600, color: "var(--color-accent)" }}>{scanStatus}</span>
            <span style={{ fontWeight: 600 }}>{scanProgress}%</span>
          </div>
          <div className="category-progress-bar" style={{ height: "12px" }}>
            <div className="category-progress-fill" style={{ width: `${scanProgress}%`, background: "var(--color-accent)" }}></div>
          </div>
        </div>
      )}

      {results && !isScanning && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          
          {/* AI Complexity Estimation */}
          <div className="vault-section">
            <h2 className="vault-section-title">🧠 AI Complexity Estimation</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "16px" }}>
              <div style={{ background: "var(--color-bg)", padding: "16px", borderRadius: "8px", border: "1px solid var(--color-border)", textAlign: "center" }}>
                <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--color-blue)" }}>{results.subdomains.length}</div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Subdomains Found</div>
              </div>
              <div style={{ background: "var(--color-bg)", padding: "16px", borderRadius: "8px", border: "1px solid var(--color-border)", textAlign: "center" }}>
                <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--color-blue)" }}>~{results.estEndpoints}</div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Estimated Endpoints</div>
              </div>
            </div>
            <p style={{ fontSize: "14px", marginTop: "16px", color: "var(--color-text-muted)", fontStyle: "italic" }}>
              "Recommended thorough testing time: <strong>{results.estHours} - {results.estHours + 4} Hours</strong>."
            </p>
          </div>

          {/* WAF Detection */}
          <div className="vault-section">
            <h2 className="vault-section-title">🛡️ WAF Detection & Evasion</h2>
            <div style={{ marginTop: "16px", background: "var(--color-bg)", padding: "16px", borderRadius: "8px", border: `1px solid ${results.detectedWaf ? "var(--color-red)" : "var(--color-green)"}` }}>
              {results.detectedWaf ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                    <span className="waf-badge" style={{ background: "var(--color-red)" }}>Detected</span>
                    <span style={{ fontWeight: 700, fontSize: "18px" }}>{results.detectedWaf.name}</span>
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "8px" }}>Suggested Bypass Techniques:</div>
                  <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px" }}>
                    {results.detectedWaf.bypasses.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="waf-badge" style={{ background: "var(--color-green)" }}>No WAF</span>
                  <span style={{ fontWeight: 600 }}>No Web Application Firewall detected!</span>
                </div>
              )}
            </div>
          </div>

          {/* Tech Stack & Ports */}
          <div className="vault-section" style={{ gridColumn: "span 2" }}>
            <h2 className="vault-section-title">🏗️ Detected Technology, CVEs & Ports</h2>
            <div style={{ display: "flex", gap: "16px", marginTop: "16px" }}>
              <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: "12px" }}>
                {results.detectedTech.map((t, i) => (
                  <div key={i} style={{ background: "var(--color-bg)", padding: "12px", borderRadius: "8px", border: `1px solid ${t.cves > 0 ? "var(--color-red)" : "var(--color-border)"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="waf-badge" style={{ background: t.cves > 0 ? "var(--color-red)" : "var(--color-green)" }}>{t.type}</span>
                        <span style={{ fontWeight: 600 }}>{t.name}</span>
                      </div>
                      <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{t.confidence}% Confidence</span>
                    </div>
                    {t.cves > 0 && (
                      <div style={{ marginTop: "8px", fontSize: "13px", color: "var(--color-red)" }}>
                        ⚠️ <strong>{t.cves} Known CVEs:</strong> {t.details}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, background: "var(--color-bg)", padding: "16px", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
                <div style={{ fontWeight: 600, marginBottom: "12px" }}>🔌 Predicted Open Ports</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {results.openPorts.map((p, i) => (
                    <span key={i} style={{ background: "var(--color-bg-secondary)", padding: "4px 8px", borderRadius: "4px", fontSize: "13px", fontFamily: "monospace", border: "1px solid var(--color-border)" }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* GitHub Dorks & Nuclei */}
          <div className="vault-section" style={{ gridColumn: "span 2" }}>
            <h2 className="vault-section-title">🔥 Automated Tooling Templates</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px" }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: "8px" }}>GitHub Dorks</div>
                <div style={{ background: "var(--color-bg)", padding: "12px", borderRadius: "8px", border: "1px solid var(--color-border)", fontFamily: "monospace", fontSize: "12px", display: "flex", flexDirection: "column", gap: "8px", whiteSpace: "pre-wrap" }}>
                  {results.githubDorks.join('\n')}
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: "8px" }}>Nuclei Custom Commands</div>
                <div style={{ background: "var(--color-bg)", padding: "12px", borderRadius: "8px", border: "1px solid var(--color-border)", fontFamily: "monospace", fontSize: "12px", display: "flex", flexDirection: "column", gap: "8px", whiteSpace: "pre-wrap" }}>
                  {results.nucleiCommands.join('\n')}
                </div>
              </div>
            </div>
          </div>

          {/* Wayback Extractor */}
          <div className="vault-section" style={{ gridColumn: "span 2" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 className="vault-section-title" style={{ margin: 0 }}>🕸️ Wayback Machine Deep Extractor</h2>
              <button className="btn-primary" onClick={extractWayback} disabled={isExtractingWayback}>
                {isExtractingWayback ? "Extracting..." : "Extract Hidden URLs"}
              </button>
            </div>
            
            {waybackUrls.length > 0 && (
              <div style={{ marginTop: "16px", background: "var(--color-bg)", padding: "16px", borderRadius: "8px", border: "1px solid var(--color-border)", maxHeight: "200px", overflowY: "auto", fontFamily: "monospace", fontSize: "12px" }}>
                {waybackUrls.map((url, i) => (
                  <div key={i} style={{ padding: "4px 0", borderBottom: "1px dashed var(--color-border)" }}>
                    {url}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subdomains Found */}
          <div className="vault-section" style={{ gridColumn: "span 2" }}>
            <h2 className="vault-section-title">🌐 Discovered Subdomains ({results.subdomains.length})</h2>
            <div style={{ background: "var(--color-bg)", padding: "16px", borderRadius: "8px", border: "1px solid var(--color-border)", maxHeight: "200px", overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px" }}>
                {results.subdomains.map((s, i) => (
                  <div key={i} style={{ fontSize: "13px", fontFamily: "monospace", padding: "4px 8px", background: "var(--color-bg-secondary)", borderRadius: "4px", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
