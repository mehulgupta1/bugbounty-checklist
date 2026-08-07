import { useState } from "react";
import { uid } from "../utils/storage";

const QUESTIONS = [
  {
    id: "q1",
    question: "Does the application use sequential numeric IDs in URLs? (e.g. /user/1234)",
    type: "IDOR",
    checksToInject: [
      { id: uid(), text: "Test IDOR by changing user ID to another user's ID", severity: "High" },
      { id: uid(), text: "Test IDOR by wrapping ID in an array (e.g. ?id[]=1234)", severity: "Medium" },
      { id: uid(), text: "Test IDOR using negative IDs or large numbers", severity: "Low" },
      { id: uid(), text: "Test IDOR by appending .json to the endpoint", severity: "High" }
    ]
  },
  {
    id: "q2",
    question: "Can users have different roles or permissions? (e.g. Admin, Manager, User)",
    type: "Privilege Escalation",
    checksToInject: [
      { id: uid(), text: "Attempt to access Admin endpoints with a standard User session", severity: "Critical" },
      { id: uid(), text: "Test Parameter Pollution by submitting role=admin in POST requests", severity: "High" },
      { id: uid(), text: "Check if the application uses JWTs to store roles (decode and modify)", severity: "Critical" },
      { id: uid(), text: "Test vertical privilege escalation by swapping cookies on state-changing actions", severity: "High" }
    ]
  },
  {
    id: "q3",
    question: "Does the application allow file uploads? (e.g. Profile pictures, PDFs)",
    type: "File Upload",
    checksToInject: [
      { id: uid(), text: "Upload a file with double extensions (e.g. shell.php.jpg)", severity: "Critical" },
      { id: uid(), text: "Test XSS by uploading an SVG file containing a malicious script", severity: "High" },
      { id: uid(), text: "Test SSRF by uploading an HTML file that fetches internal metadata", severity: "High" },
      { id: uid(), text: "Check if uploaded files are executed by the server rather than just served", severity: "Critical" }
    ]
  },
  {
    id: "q4",
    question: "Is there a search bar or any input that reflects back on the page?",
    type: "XSS",
    checksToInject: [
      { id: uid(), text: "Test XSS using standard alert payloads in search inputs", severity: "High" },
      { id: uid(), text: "Check for DOM-based XSS in search query parameters", severity: "High" },
      { id: uid(), text: "Test if input sanitization can be bypassed with URL encoding", severity: "Medium" }
    ]
  },
  {
    id: "q5",
    question: "Does the application support 'Sign in with Google/Apple/Facebook'?",
    type: "OAuth & SSO",
    checksToInject: [
      { id: uid(), text: "Test OAuth redirect_uri for Open Redirect & Token Leakage", severity: "High" },
      { id: uid(), text: "Check if state parameter is missing or predictable (CSRF)", severity: "Medium" },
      { id: uid(), text: "Attempt Account Takeover by signing up with victim's email via password then linking OAuth", severity: "Critical" },
      { id: uid(), text: "Test if OAuth access token can be reused across different clients", severity: "High" }
    ]
  },
  {
    id: "q6",
    question: "Does the application have a Shopping Cart or Payment Gateway?",
    type: "Business Logic",
    checksToInject: [
      { id: uid(), text: "Test Race Conditions by applying the same discount code multiple times simultaneously", severity: "High" },
      { id: uid(), text: "Intercept checkout request and change item price to negative or 0", severity: "Critical" },
      { id: uid(), text: "Try changing the currency parameter to bypass conversion rates", severity: "Medium" },
      { id: uid(), text: "Attempt IDOR on invoice generation to view other users' billing details", severity: "High" }
    ]
  },
  {
    id: "q7",
    question: "Is there a feature to Export to PDF, CSV, or generate reports?",
    type: "Export Injection",
    checksToInject: [
      { id: uid(), text: "Test CSV Injection (Formula Injection) by entering '=cmd|'/'C calc.exe'!A0' in profile fields", severity: "High" },
      { id: uid(), text: "Test Server-Side XSS by inserting XSS payloads in data that gets rendered to PDF", severity: "Critical" },
      { id: uid(), text: "Test SSRF via PDF generator (e.g. inject <iframe src='http://169.254.169.254/latest/meta-data'>)", severity: "Critical" }
    ]
  },
  {
    id: "q8",
    question: "Does the application use a GraphQL API endpoint (/graphql)?",
    type: "GraphQL",
    checksToInject: [
      { id: uid(), text: "Check if Introspection query is enabled", severity: "Medium" },
      { id: uid(), text: "Test for nested query DoS (Resource Exhaustion)", severity: "High" },
      { id: uid(), text: "Test IDOR by changing IDs in GraphQL mutation arguments", severity: "High" },
      { id: uid(), text: "Attempt to query hidden or internal schemas discovered via introspection", severity: "Medium" }
    ]
  },
  {
    id: "q9",
    question: "Does the application process XML input or use SOAP APIs?",
    type: "XXE",
    checksToInject: [
      { id: uid(), text: "Test for classic XXE by injecting external entity calling /etc/passwd", severity: "Critical" },
      { id: uid(), text: "Test for Blind XXE using out-of-band (OOB) interactions via Burp Collaborator", severity: "Critical" },
      { id: uid(), text: "Attempt Billion Laughs attack to test for XML DoS", severity: "High" }
    ]
  },
  {
    id: "q10",
    question: "Is there a password reset or forgot password functionality?",
    type: "Password Reset",
    checksToInject: [
      { id: uid(), text: "Test Host Header Injection for Password Reset Poisoning", severity: "Critical" },
      { id: uid(), text: "Check if password reset tokens are predictable or lack entropy", severity: "Critical" },
      { id: uid(), text: "Test for token leakage in Referer headers to external domains", severity: "High" },
      { id: uid(), text: "Check if password reset functionality is vulnerable to user enumeration (timing or response differences)", severity: "Medium" }
    ]
  },
  {
    id: "q11",
    question: "Does the application allow changing account email addresses?",
    type: "Account Management",
    checksToInject: [
      { id: uid(), text: "Check if email change requires current password confirmation (CSRF/ATO risk)", severity: "High" },
      { id: uid(), text: "Test if the verification link is sent to the old email or just the new one", severity: "Medium" },
      { id: uid(), text: "Attempt to change email to an existing user's email to test uniqueness validation", severity: "Low" }
    ]
  },
  {
    id: "q12",
    question: "Are there API endpoints with explicit versioning (e.g. /v1/, /v2/)?",
    type: "API Versioning",
    checksToInject: [
      { id: uid(), text: "Test if older API versions (e.g. /v1/) still exist and lack recent security patches", severity: "High" },
      { id: uid(), text: "Check if BOLA/IDOR vulnerabilities present in /v1/ were only patched in /v2/", severity: "Critical" },
      { id: uid(), text: "Test parameter pollution across different API versions", severity: "Medium" }
    ]
  }
];

export default function FingerprintEngine({ onInjectChecks, onClearChecks }) {
  const [answers, setAnswers] = useState({});
  const [injectedCount, setInjectedCount] = useState(0);

  const handleAnswer = (qId, answer) => {
    setAnswers(prev => ({ ...prev, [qId]: answer }));
  };

  const handleGenerate = () => {
    let count = 0;
    QUESTIONS.forEach(q => {
      if (answers[q.id] === "Yes") {
        // Generate new IDs for checks to avoid duplicates if run multiple times
        const checks = q.checksToInject.map(c => ({ ...c, id: uid() }));
        onInjectChecks("🧠 Dynamic Behavioral Tests", q.type + " Workflow", checks);
        count += checks.length;
      }
    });
    setInjectedCount(count);
    
    // Reset answers after generating
    setAnswers({});
    
    // Clear success message after 4s
    setTimeout(() => setInjectedCount(0), 4000);
  };

  const handleReset = () => {
    onClearChecks();
    setAnswers({});
    setInjectedCount(0);
  };

  const allAnswered = QUESTIONS.every(q => answers[q.id] !== undefined);

  return (
    <div className="sandbox-container content-area">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <h1 className="dashboard-title" style={{ margin: 0 }}>🧠 Behavioral Fingerprint Engine</h1>
        <button 
          className="btn-primary" 
          style={{ padding: "8px 16px", fontSize: "14px", background: "var(--color-bg)", border: "1px solid var(--color-red)", color: "var(--color-red)", borderRadius: "6px", whiteSpace: "nowrap" }}
          onClick={handleReset}
          title="Delete the 'Dynamic Behavioral Tests' category and start over"
        >
          Reset Engine & Clear Injections 🗑️
        </button>
      </div>
      
      <p style={{ color: "var(--color-text-muted)", marginBottom: "24px", lineHeight: "1.6" }}>
        Instead of a generic checklist, answer these highly specific behavioral questions about your target application. 
        If you answer <strong>Yes</strong> to a behavior, the engine will dynamically construct a custom workflow of highly-tailored test cases 
        and permanently inject them directly into your main checklist!
      </p>

      {injectedCount > 0 && (
        <div style={{ background: "rgba(34, 197, 94, 0.1)", color: "var(--color-green)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(34, 197, 94, 0.3)", marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px", fontWeight: 600 }}>
          <span>✅</span> Successfully injected {injectedCount} custom test cases into your checklist under the "Dynamic Behavioral Tests" category!
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
        {QUESTIONS.map((q, idx) => (
          <div key={q.id} style={{ background: "var(--color-bg-secondary)", padding: "20px", borderRadius: "8px", border: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "12px", color: "var(--color-accent)", fontWeight: 700, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Target Behavior: {q.type}
              </div>
              <div style={{ fontSize: "16px", fontWeight: 600 }}>{idx + 1}. {q.question}</div>
            </div>
            
            <div style={{ display: "flex", gap: "8px", marginLeft: "20px" }}>
              <button 
                className="btn-primary" 
                style={{ background: answers[q.id] === "Yes" ? "var(--color-green)" : "var(--color-bg)", color: answers[q.id] === "Yes" ? "white" : "var(--color-text)", border: `1px solid ${answers[q.id] === "Yes" ? "var(--color-green)" : "var(--color-border)"}` }}
                onClick={() => handleAnswer(q.id, "Yes")}
              >
                Yes
              </button>
              <button 
                className="btn-primary" 
                style={{ background: answers[q.id] === "No" ? "var(--color-red)" : "var(--color-bg)", color: answers[q.id] === "No" ? "white" : "var(--color-text)", border: `1px solid ${answers[q.id] === "No" ? "var(--color-red)" : "var(--color-border)"}` }}
                onClick={() => handleAnswer(q.id, "No")}
              >
                No
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button 
          className="btn-primary" 
          style={{ padding: "12px 24px", fontSize: "16px" }} 
          disabled={!allAnswered}
          onClick={handleGenerate}
        >
          Inject Custom Workflows 🚀
        </button>
      </div>
    </div>
  );
}
