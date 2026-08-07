import { useState, useMemo, useEffect } from "react";
import { FLOWS_DATA } from "../data/testFlowData";

export default function TestFlowEngine() {
  const [activeFlowId, setActiveFlowId] = useState(FLOWS_DATA[0].id);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Track completed steps by their unique ID
  const [completedSteps, setCompletedSteps] = useState(() => {
    const saved = localStorage.getItem("bbcl_flow_progress");
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem("bbcl_flow_progress", JSON.stringify(completedSteps));
  }, [completedSteps]);

  const activeFlow = useMemo(() => FLOWS_DATA.find(f => f.id === activeFlowId), [activeFlowId]);

  const toggleStep = (stepId) => {
    setCompletedSteps(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }));
  };

  const resetActiveFlow = () => {
    if (window.confirm("Reset all progress for this flow?")) {
      const activeStepIds = activeFlow.steps.map(s => s.id);
      setCompletedSteps(prev => {
        const next = { ...prev };
        activeStepIds.forEach(id => delete next[id]);
        return next;
      });
    }
  };

  const filteredSteps = useMemo(() => {
    if (!searchQuery) return activeFlow.steps;
    const lowerQuery = searchQuery.toLowerCase();
    return activeFlow.steps.filter(s => 
      s.title.toLowerCase().includes(lowerQuery) || 
      s.description.toLowerCase().includes(lowerQuery) ||
      s.tools.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }, [activeFlow, searchQuery]);

  // Calculations for progress
  const activeFlowProgress = useMemo(() => {
    const total = activeFlow.steps.length;
    const done = activeFlow.steps.filter(s => completedSteps[s.id]).length;
    return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
  }, [activeFlow, completedSteps]);

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
      {/* HEADER SECTION */}
      <div style={{ padding: "24px 24px 0 24px" }}>
        <h1 style={{ margin: "0 0 16px 0", fontSize: "24px", fontWeight: "700", color: "var(--color-text-heading)" }}>
          Test Flow Playbooks
        </h1>
        
        <h3 style={{ margin: "0 0 16px 0", fontSize: "15px", fontWeight: "600", color: "var(--color-text-muted)" }}>
          Select your situation
        </h3>
        
        {/* Grid Switcher */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px", marginBottom: "32px" }}>
          {FLOWS_DATA.map(flow => {
            const flowDoneCount = flow.steps.filter(s => completedSteps[s.id]).length;
            const flowTotal = flow.steps.length;
            const isActive = activeFlowId === flow.id;
            
            return (
              <div
                key={flow.id}
                onClick={() => {
                  setActiveFlowId(flow.id);
                  setSearchQuery("");
                }}
                style={{
                  background: isActive ? "rgba(59, 130, 246, 0.1)" : "var(--color-bg)",
                  border: isActive ? "1px solid #3b82f6" : "1px solid var(--color-border)",
                  borderRadius: "12px",
                  padding: "16px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  position: "relative",
                  boxShadow: isActive ? "0 0 0 1px #3b82f6" : "none"
                }}
              >
                <div style={{ fontSize: "20px", marginBottom: "8px", color: "var(--color-text-muted)" }}>
                  {flow.icon}
                </div>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "600", color: "var(--color-text-heading)" }}>
                  {flow.title}
                </h4>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-muted)" }}>
                  {flow.subtitle}
                </p>

                {flowDoneCount > 0 && (
                  <div style={{ 
                    position: "absolute", 
                    top: "16px", 
                    right: "16px", 
                    fontSize: "12px", 
                    color: isActive ? "#3b82f6" : "var(--color-text-muted)",
                    fontWeight: "600"
                  }}>
                    {flowDoneCount}/{flowTotal}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Controls Row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "16px" }}>
          <input 
            type="text"
            placeholder="Filter steps or tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              maxWidth: "400px",
              background: "var(--color-bg-secondary)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              padding: "10px 16px",
              borderRadius: "6px",
              fontSize: "14px",
              outline: "none"
            }}
          />
          <button 
            onClick={resetActiveFlow}
            style={{
              background: "transparent",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-muted)",
              padding: "8px 16px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            Reset Flow
          </button>
        </div>

        {/* Slim Progress Bar */}
        <div style={{ width: "100%", height: "4px", background: "var(--color-border)", borderRadius: "2px", overflow: "hidden", marginBottom: "24px" }}>
          <div style={{ 
            height: "100%", 
            width: `${activeFlowProgress.percent}%`, 
            background: "var(--color-blue)",
            transition: "width 0.3s ease" 
          }}></div>
        </div>
      </div>

      {/* STEPS LIST */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px 24px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {filteredSteps.map((step, index) => {
          const isDone = completedSteps[step.id];
          const sevStyle = getSeverityStyle(step.severity);
          
          return (
            <div 
              key={step.id}
              onClick={() => toggleStep(step.id)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "24px",
                padding: "8px 0 24px 0",
                cursor: "pointer",
                opacity: isDone ? 0.4 : 1,
                transition: "all 0.2s ease",
                position: "relative"
              }}
            >
              {/* Vertical Line Connector */}
              {index < filteredSteps.length - 1 && (
                <div style={{
                  position: "absolute",
                  left: "15px",
                  top: "36px",
                  bottom: "-8px",
                  width: "1px",
                  background: "var(--color-border)",
                  zIndex: 0
                }} />
              )}

              {/* Left: Number / Check */}
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: isDone ? "var(--color-text-muted)" : "var(--color-bg)",
                border: isDone ? "none" : "1px solid var(--color-border)",
                color: isDone ? "#fff" : "var(--color-text)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontSize: "14px",
                fontWeight: "600",
                flexShrink: 0,
                position: "relative",
                zIndex: 1
              }}>
                {isDone ? "✓" : index + 1}
              </div>

              {/* Middle: Content */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <h3 style={{ 
                  margin: "0 0 6px 0", 
                  fontSize: "15px", 
                  fontWeight: "600", 
                  color: "var(--color-text-heading)",
                  textDecoration: isDone ? "line-through" : "none"
                }}>
                  {step.title}
                </h3>
                <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "var(--color-text-muted)", lineHeight: "1.4" }}>
                  {step.description}
                </p>
                
                {/* Tool Badges */}
                {step.tools && step.tools.length > 0 && (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {step.tools.map((tool, i) => (
                      <span key={i} style={{
                        background: "rgba(59, 130, 246, 0.1)",
                        color: "var(--color-blue)",
                        border: "1px solid rgba(59, 130, 246, 0.2)",
                        padding: "2px 8px",
                        borderRadius: "99px",
                        fontSize: "11px",
                        fontWeight: "600"
                      }}>
                        {tool}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Severity */}
              {step.severity && (
                <div style={{ display: "flex", alignItems: "flex-start", flexShrink: 0 }}>
                  <span style={{
                    background: sevStyle.bg,
                    color: sevStyle.text,
                    border: `1px solid ${sevStyle.border}`,
                    padding: "4px 10px",
                    borderRadius: "99px",
                    fontSize: "11px",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>
                    {step.severity}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {filteredSteps.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "32px", border: "1px dashed var(--color-border)", borderRadius: "8px" }}>
            No steps match your search query.
          </div>
        )}
      </div>
    </div>
  );
}
