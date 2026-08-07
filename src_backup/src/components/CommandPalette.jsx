import { useState, useEffect, useRef } from "react";

export default function CommandPalette({ 
  isOpen, 
  onClose, 
  projects, 
  switchProject, 
  setCurrentView, 
  setActiveTab 
}) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  // Command definitions
  const commands = [
    { id: "view-dashboard", label: "View Dashboard", group: "Navigation", action: () => setCurrentView("dashboard") },
    { id: "view-checklist", label: "View Checklist", group: "Navigation", action: () => setCurrentView("checklist") },
    { id: "view-scope", label: "View Scope & Assets", group: "Navigation", action: () => setCurrentView("scope") },
    { id: "tab-intel", label: "Open Program Intel", group: "Tools", action: () => { setCurrentView("checklist"); setActiveTab("intel"); } },
    { id: "tab-fingerprint", label: "Open Fingerprint Engine", group: "Tools", action: () => { setCurrentView("checklist"); setActiveTab("fingerprint"); } },
    { id: "tab-methodology", label: "Open Methodology & AI", group: "Tools", action: () => { setCurrentView("checklist"); setActiveTab("methodology"); } },
    { id: "tab-payloads", label: "Open Payload Vault", group: "Tools", action: () => { setCurrentView("checklist"); setActiveTab("payloads"); } },
    { id: "tab-sandbox", label: "Open Scratchpad Sandbox", group: "Tools", action: () => { setCurrentView("checklist"); setActiveTab("sandbox"); } },
  ];

  // Add project switching commands dynamically
  projects.forEach(p => {
    commands.push({
      id: `switch-project-${p.id}`,
      label: `Switch to Project: ${p.name}`,
      group: "Projects",
      action: () => switchProject(p.id)
    });
  });

  const filteredCommands = commands.filter(c => 
    c.label.toLowerCase().includes(search.toLowerCase()) || 
    c.group.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
        onClose();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex", justifyContent: "center", alignItems: "flex-start",
        paddingTop: "15vh"
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: "100%", maxWidth: "600px",
          backgroundColor: "var(--color-bg-secondary)",
          borderRadius: "12px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          border: "1px solid var(--color-border)",
          overflow: "hidden",
          display: "flex", flexDirection: "column"
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: "16px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "20px", color: "var(--color-blue)" }}>⚡</span>
          <input 
            ref={inputRef}
            type="text" 
            placeholder="Type a command or search..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: "100%", background: "transparent", border: "none", outline: "none",
              color: "var(--color-text)", fontSize: "18px", fontWeight: "500"
            }}
          />
        </div>

        <div style={{ maxHeight: "400px", overflowY: "auto", padding: "8px" }}>
          {filteredCommands.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--color-text-faint)" }}>No commands found</div>
          ) : (
            filteredCommands.map((cmd, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div 
                  key={cmd.id}
                  onClick={() => { cmd.action(); onClose(); }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    padding: "12px 16px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    backgroundColor: isSelected ? "var(--color-blue)" : "transparent",
                    color: isSelected ? "white" : "var(--color-text)",
                    borderRadius: "8px", cursor: "pointer",
                    transition: "all 0.1s ease"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontWeight: isSelected ? 600 : 500 }}>{cmd.label}</span>
                  </div>
                  <span style={{ fontSize: "12px", padding: "2px 8px", borderRadius: "12px", backgroundColor: isSelected ? "rgba(255,255,255,0.2)" : "var(--color-bg)", color: isSelected ? "white" : "var(--color-text-faint)" }}>
                    {cmd.group}
                  </span>
                </div>
              );
            })
          )}
        </div>
        <div style={{ padding: "8px 16px", borderTop: "1px solid var(--color-border)", fontSize: "12px", color: "var(--color-text-faint)", display: "flex", justifyContent: "space-between" }}>
          <span><kbd style={{ background: "var(--color-bg)", padding: "2px 6px", borderRadius: "4px" }}>↑</kbd> <kbd style={{ background: "var(--color-bg)", padding: "2px 6px", borderRadius: "4px" }}>↓</kbd> to navigate</span>
          <span><kbd style={{ background: "var(--color-bg)", padding: "2px 6px", borderRadius: "4px" }}>Enter</kbd> to select</span>
          <span><kbd style={{ background: "var(--color-bg)", padding: "2px 6px", borderRadius: "4px" }}>Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}
