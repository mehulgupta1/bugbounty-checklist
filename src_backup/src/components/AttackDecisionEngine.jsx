import { useState, useMemo } from "react";
import { RECON_CLUES, ATTACK_MAPPINGS } from "../data/decisionEngineData";

export default function AttackDecisionEngine({ 
  checklist, 
  onCheckoffItem 
}) {
  const [selectedClues, setSelectedClues] = useState([]);

  const toggleClue = (clueId) => {
    setSelectedClues((prev) =>
      prev.includes(clueId)
        ? prev.filter((id) => id !== clueId)
        : [...prev, clueId]
    );
  };

  const synthesizedAttacks = useMemo(() => {
    if (selectedClues.length === 0) return [];

    // Filter attacks that have at least one required clue selected
    // Note: If an attack requires multiple, we check if ALL requires are met
    const matched = ATTACK_MAPPINGS.filter((attack) =>
      attack.requires.every((req) => selectedClues.includes(req))
    );

    // Sort by severity (critical > high > medium > low)
    const severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
    
    return matched.sort(
      (a, b) => severityWeight[b.severity] - severityWeight[a.severity]
    );
  }, [selectedClues]);

  // UI Theme helpers
  const getSeverityColor = (sev) => {
    switch (sev) {
      case "critical": return { bg: "rgba(239, 68, 68, 0.1)", text: "var(--color-red)", border: "rgba(239, 68, 68, 0.2)" };
      case "high": return { bg: "rgba(245, 158, 11, 0.1)", text: "var(--color-orange)", border: "rgba(245, 158, 11, 0.2)" };
      case "medium": return { bg: "rgba(59, 130, 246, 0.1)", text: "var(--color-blue)", border: "rgba(59, 130, 246, 0.2)" };
      default: return { bg: "rgba(156, 163, 175, 0.1)", text: "var(--color-text-muted)", border: "rgba(156, 163, 175, 0.2)" };
    }
  };

  const getClueColor = (type, isSelected) => {
    const activeAlpha = isSelected ? "1" : "0.15";
    const borderAlpha = isSelected ? "1" : "0.3";
    const textColor = isSelected ? "#ffffff" : "var(--color-text)";

    switch (type) {
      case "auth": return { bg: `rgba(59, 130, 246, ${activeAlpha})`, border: `rgba(59, 130, 246, ${borderAlpha})`, color: textColor };
      case "infra": return { bg: `rgba(139, 92, 246, ${activeAlpha})`, border: `rgba(139, 92, 246, ${borderAlpha})`, color: textColor };
      case "input": return { bg: `rgba(245, 158, 11, ${activeAlpha})`, border: `rgba(245, 158, 11, ${borderAlpha})`, color: textColor };
      default: return { bg: `rgba(156, 163, 175, ${activeAlpha})`, border: `rgba(156, 163, 175, ${borderAlpha})`, color: textColor };
    }
  };

  return (
    <div className="decision-engine-container">
      <div className="decision-engine-header">
        <h2 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0, fontSize: "16px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          WHAT DID YOU FIND? SELECT ALL THAT APPLY
        </h2>
      </div>

      <div className="recon-tag-cloud" style={{ display: "flex", flexWrap: "wrap", gap: "10px", padding: "16px 0 32px 0" }}>
        {RECON_CLUES.map((clue) => {
          const isSelected = selectedClues.includes(clue.id);
          const style = getClueColor(clue.type, isSelected);
          
          return (
            <button
              key={clue.id}
              onClick={() => toggleClue(clue.id)}
              className="recon-tag-btn"
              style={{
                background: style.bg,
                borderColor: style.border,
                color: style.color,
                borderWidth: "1px",
                borderStyle: "solid",
                padding: "8px 16px",
                borderRadius: "20px",
                fontSize: "14px",
                fontWeight: isSelected ? "600" : "500",
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              {isSelected ? "⊙" : "○"} {clue.label}
            </button>
          );
        })}
      </div>

      <div className="attack-synthesis-section" style={{ background: "var(--color-bg-secondary)", borderRadius: "12px", padding: "24px" }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 20px 0", fontSize: "16px" }}>
          ⚡ Prioritized attack list ({synthesizedAttacks.length} vectors)
        </h3>

        {synthesizedAttacks.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--color-text-muted)", border: "1px dashed var(--color-border)", borderRadius: "8px" }}>
            Select recon clues above to synthesize attack vectors.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {synthesizedAttacks.map((attack, i) => {
              const sevStyle = getSeverityColor(attack.severity);
              
              return (
                <div key={i} className="attack-card" style={{ 
                  background: "var(--color-bg)", 
                  border: "1px solid var(--color-border)", 
                  borderRadius: "8px", 
                  padding: "16px",
                  display: "flex",
                  gap: "16px",
                  alignItems: "flex-start",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  cursor: "default"
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
                    minWidth: "60px",
                    textAlign: "center"
                  }}>
                    {attack.severity}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "600" }}>{attack.title}</h4>
                    <p style={{ margin: 0, fontSize: "14px", color: "var(--color-text-muted)", lineHeight: "1.5" }}>
                      {attack.description}
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
