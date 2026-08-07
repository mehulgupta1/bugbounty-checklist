// Focus-Mode surface map for the Web section.
// Each surface answers "what part of the app am I testing?" and lists the exact
// categories that apply. Curated from the real 88 Web categories — overlap is
// deliberate (e.g. XXE is reachable via both Search & Inputs and Files).
export const WEB_SURFACES = [
  { id: "all", ico: "🗂", label: "All categories", hint: "browse everything", all: true },
  { id: "recon", ico: "🔍", label: "Recon & Discovery", hint: "map the target first", cats: [
    "Subdomain Enumeration","Port Scanning & Service Enumeration","Technology Fingerprinting",
    "Content & URL Discovery","Link & Parameter Discovery","Google Dorking & OSINT",
    "JavaScript Analysis","DNS Security Testing","Subdomain Takeover","Subdomain Takeover Deep",
  ]},
  { id: "auth", ico: "🔐", label: "Login & Auth", hint: "sign-in, SSO, sessions", cats: [
    "Password & Credential Attacks","OAuth & SSO Testing","Login & Registration Bypass",
    "JWT Security Deep Testing","Auth Bypass Techniques","Login Page Security Deep",
    "Authentication Bypass Deep","Password Reset Security","Registration Security Deep",
    "Session Management","CSRF (Cross-Site Request Forgery)","Cookie Security Basic","Cookie Security Advanced",
  ]},
  { id: "access", ico: "🆔", label: "Access Control & IDs", hint: "IDOR, roles, accounts", cats: [
    "IDOR (Insecure Direct Object Reference)","Privilege Escalation","Admin Panel Security Deep",
    "Account Takeover","Account Takeover Techniques","Profile & Account Security",
  ]},
  { id: "inputs", ico: "🔎", label: "Search & Inputs", hint: "reflected / injected input", cats: [
    "SQL Injection","Cross-Site Scripting (XSS)","Server-Side Template Injection (SSTI)",
    "OS Command Injection","NoSQL Injection","LDAP Injection","XML Injection & XXE","CRLF Injection",
    "Server-Side Include (SSI) Injection","Input Validation Deep","GraphQL Deep Testing",
    "Search Function Security","Prototype Pollution",
  ]},
  { id: "files", ico: "📤", label: "Files & Uploads", hint: "uploads, paths, exports", cats: [
    "Path Traversal & File Access","File Upload Vulnerabilities","File Download & Access",
    "File Handler Security Deep","Deserialization Attacks","Export & Report Security","XML Injection & XXE",
  ]},
  { id: "urls", ico: "🔗", label: "URLs, SSRF & Requests", hint: "SSRF, redirects, pipeline", cats: [
    "Server-Side Request Forgery (SSRF)","Cloud SSRF Deep","Open Redirect",
    "HTTP Request Smuggling","Web Cache Poisoning & Deception","HTTP/2 Security",
  ]},
  { id: "logic", ico: "💳", label: "Business Logic & Payments", hint: "checkout, limits, race", cats: [
    "Business Logic Vulnerabilities","Race Conditions","Payment & Checkout Security","Rate Limit Bypass Deep",
  ]},
  { id: "client", ico: "🖥️", label: "Browser & Client-Side", hint: "CORS, CSP, sockets", cats: [
    "CORS Misconfiguration","CORS Bypass Techniques Deep","Clickjacking","PostMessage Security",
    "WebSocket Deep Testing","WebSocket Security Deep","Service Worker Security","Web Storage Security",
    "CSP Testing","CSP Bypass Deep",
  ]},
  { id: "server", ico: "⚙️", label: "Server, Config & Headers", hint: "TLS, headers, cloud, errors", cats: [
    "TLS/SSL Configuration","Server Misconfiguration","Cloud & Container Security","Data Exposure",
    "WAF Bypass Techniques","Security Headers","HTTP Header Security Deep","Server Configuration Deep",
    "Security Misconfiguration Deep","Cloud Security Deep","Microservices & API Gateway",
    "Cryptographic Implementation","Error Handling",
  ]},
  { id: "framework", ico: "🧩", label: "Framework-Specific", hint: "WordPress, Laravel, email…", cats: [
    "WordPress Security","Laravel Security","Django Security","Spring Boot Security","Next.js Security",
    "Email Security Testing","Email Template Security",
  ]},
];

export function inSurface(surface, sectionName) {
  return surface.all || surface.cats.includes(sectionName);
}

import { TESTED_STATUSES } from "./constants.js";

// Coverage breakdown for one category, from the per-check progress map.
// Segments always partition the total: vuln+retest+clear+prog+untested === total.
export function sectionStats(section, progress) {
  const total = section.checks.length;
  let vuln = 0, retest = 0, clear = 0, prog = 0, tested = 0;
  for (const ch of section.checks) {
    const st = progress[ch.id];
    if (st === "vulnerable") vuln++;
    else if (st === "needs_retest") retest++;
    else if (st === "not_vulnerable" || st === "waf_blocked") clear++;
    else if (st === "in_progress") prog++;
    if (TESTED_STATUSES.includes(st)) tested++;
  }
  const untested = Math.max(0, total - vuln - retest - clear - prog);
  return { total, vuln, retest, clear, prog, untested, tested, pct: total ? Math.round(tested / total * 100) : 0 };
}
