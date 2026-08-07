import { useState, useEffect } from "react";
import { generateMutations } from "../utils/mutator";

export default function WafSuggester({ categoryHint }) {
  const [payloads, setPayloads] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("bbcl_payloads");
      if (saved) {
        setPayloads(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Filter payloads based on category hint (e.g. if the check text contains "SQLi" or "XSS")
  const suggested = payloads.filter(p => {
    if (!categoryHint) return true;
    const hint = categoryHint.toLowerCase();
    const cat = (p.category || "").toLowerCase();
    const name = (p.name || "").toLowerCase();
    return cat.includes(hint) || name.includes(hint) || hint.includes(cat);
  }).slice(0, 5); // top 5

  if (suggested.length === 0) {
    return (
      <div className="waf-suggester">
        <div className="waf-suggester-header">🛡️ WAF Bypass Suggester</div>
        <div className="waf-suggester-empty">
          No payloads found for this vulnerability type. Check your Custom Payload Laboratory!
        </div>
      </div>
    );
  }

  return (
    <div className="waf-suggester">
      <div className="waf-suggester-header">🛡️ WAF Bypass Suggester</div>
      <div className="waf-suggester-text">
        Try these advanced mutated payloads from your Laboratory:
      </div>
      <div className="waf-suggester-list">
        {suggested.map(p => {
          // Suggest the base payload and maybe a mutation
          const mutations = generateMutations(p.content);
          const encoded = mutations.find(m => m.name === "URL Encoded") || mutations[0];

          return (
            <div key={p.id} className="waf-suggester-item">
              <div className="waf-suggester-item-header">
                <span className="waf-badge">{p.category}</span>
                <span className="waf-name">{p.name}</span>
                <span className="waf-stats">({p.successCount || 0} worked)</span>
              </div>
              
              <div className="waf-payload-row">
                <code className="waf-code">{p.content}</code>
                <button 
                  className={`vault-copy-btn ${copiedId === `base_${p.id}` ? "vault-copy-btn--copied" : ""}`}
                  onClick={() => handleCopy(`base_${p.id}`, p.content)}
                  title="Copy Original"
                >
                  {copiedId === `base_${p.id}` ? "✅" : "📋 Base"}
                </button>
              </div>

              <div className="waf-payload-row waf-payload-row--mutated">
                <code className="waf-code">{encoded.value}</code>
                <button 
                  className={`vault-copy-btn ${copiedId === `enc_${p.id}` ? "vault-copy-btn--copied" : ""}`}
                  onClick={() => handleCopy(`enc_${p.id}`, encoded.value)}
                  title="Copy URL Encoded"
                >
                  {copiedId === `enc_${p.id}` ? "✅" : "📋 URL Enc"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
