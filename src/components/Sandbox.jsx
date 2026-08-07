import { useState } from "react";
import JwtManipulator from "./sandbox/JwtManipulator";
import XssTester from "./sandbox/XssTester";
import RegexAnalyzer from "./sandbox/RegexAnalyzer";

export default function Sandbox() {
  const [activeTab, setActiveTab] = useState("jwt");

  return (
    <div className="sandbox-container content-area">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 className="dashboard-title" style={{ margin: 0 }}>🧪 PoC Sandbox</h1>
      </div>
      
      <p style={{ color: "var(--color-text-muted)", marginBottom: "24px" }}>
        A safe, built-in environment to craft, mutate, and test attack payloads locally.
      </p>

      <div className="dashboard-tabs">
        <button className={`dashboard-tab ${activeTab === "jwt" ? "active" : ""}`} onClick={() => setActiveTab("jwt")}>
          JWT Manipulator
        </button>
        <button className={`dashboard-tab ${activeTab === "xss" ? "active" : ""}`} onClick={() => setActiveTab("xss")}>
          XSS Tester
        </button>
        <button className={`dashboard-tab ${activeTab === "regex" ? "active" : ""}`} onClick={() => setActiveTab("regex")}>
          Regex Analyzer
        </button>
      </div>

      <div className="sandbox-content">
        {activeTab === "jwt" && <JwtManipulator />}
        {activeTab === "xss" && <XssTester />}
        {activeTab === "regex" && <RegexAnalyzer />}
      </div>
    </div>
  );
}
