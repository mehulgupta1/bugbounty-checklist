export const RECON_CLUES = [
  // Auth & Sessions
  { id: "jwt", label: "JWT token", type: "auth" },
  { id: "oauth", label: "OAuth login flow", type: "auth" },
  { id: "no_httponly", label: "No HttpOnly cookie", type: "auth" },
  { id: "no_samesite", label: "No SameSite cookie", type: "auth" },
  
  // Infrastructure & Exposed Files
  { id: "swagger", label: "Swagger UI exposed", type: "infra" },
  { id: "git", label: "/.git exposed", type: "infra" },
  { id: "env", label: "/.env exposed", type: "infra" },
  { id: "actuator", label: "/actuator exposed", type: "infra" },
  { id: "cname", label: "Orphan CNAME subdomain", type: "infra" },
  { id: "outdated", label: "Outdated service version", type: "infra" },
  
  // Input & Parameters
  { id: "numeric_id", label: "Numeric ID in URL", type: "input" },
  { id: "file_path", label: "File/path parameter", type: "input" },
  { id: "redirect", label: "Redirect param", type: "input" },
  { id: "search_param", label: "Search/filter/sort param", type: "input" },
  { id: "input_reflected", label: "Input reflected in response", type: "input" },
  { id: "xml_parsing", label: "XML body accepted", type: "input" }
];

export const ATTACK_MAPPINGS = [
  // JWT
  {
    requires: ["jwt"],
    severity: "critical",
    title: "JWT Signature Bypass (alg: none)",
    description: "Change the JWT header algorithm to 'none', remove the signature, and change the payload to admin. Check if the server accepts it."
  },
  {
    requires: ["jwt"],
    severity: "high",
    title: "JWT Secret Brute-forcing",
    description: "Use hashcat to offline brute-force the JWT secret if it was signed with HS256. If you find the secret, you can forge admin tokens."
  },

  // OAuth
  {
    requires: ["oauth"],
    severity: "critical",
    title: "OAuth Account Takeover via State Parameter",
    description: "Remove or change the 'state' parameter in the OAuth flow. If the server doesn't validate it, link your social account to a victim's account via CSRF."
  },

  // Cookies
  {
    requires: ["no_httponly"],
    severity: "high",
    title: "Session Hijacking via XSS",
    description: "Because HttpOnly is missing, any XSS vulnerability found on this domain will allow you to steal the session token using document.cookie."
  },
  {
    requires: ["no_samesite"],
    severity: "high",
    title: "Cross-Site Request Forgery (CSRF)",
    description: "The session cookie lacks SameSite protection. Host an HTML form on your server and force an authenticated victim to execute state-changing actions."
  },

  // IDOR / Numeric IDs
  {
    requires: ["numeric_id"],
    severity: "critical",
    title: "IDOR — access other users' data",
    description: "Change id=123 to id=124, 125... automate with Burp Intruder. Look for PII leaks first."
  },
  {
    requires: ["numeric_id"],
    severity: "high",
    title: "IDOR on write endpoints",
    description: "PUT /api/user/123 — can you change another user's data? Test POST and DELETE as well."
  },
  {
    requires: ["numeric_id"],
    severity: "high",
    title: "IDOR Privilege Escalation",
    description: "Access admin objects: /api/admin/report/1 — does it return data for your low-priv account?"
  },

  // LFI / File paths
  {
    requires: ["file_path"],
    severity: "critical",
    title: "Local File Inclusion (LFI)",
    description: "Change the file parameter to ../../../../etc/passwd or C:\\windows\\win.ini to read internal server files."
  },
  {
    requires: ["file_path"],
    severity: "high",
    title: "Server-Side Request Forgery (SSRF)",
    description: "Change the file parameter to http://169.254.169.254/latest/meta-data/ to access AWS cloud metadata."
  },

  // Redirects
  {
    requires: ["redirect"],
    severity: "medium",
    title: "Open Redirect",
    description: "Change the redirect parameter to https://evil.com. Can be chained with OAuth or SSRF for critical impact."
  },
  {
    requires: ["redirect", "oauth"],
    severity: "critical",
    title: "OAuth Token Theft via Open Redirect",
    description: "Chain the open redirect in the redirect_uri of the OAuth flow to steal the victim's authorization code."
  },

  // Reflections / XSS
  {
    requires: ["input_reflected"],
    severity: "high",
    title: "Reflected Cross-Site Scripting (XSS)",
    description: "Inject <script>alert(1)</script> or \"><img src=x onerror=prompt()>. Check context breaking (inside JS, HTML tags, attributes)."
  },
  
  // Search / SQLi / SSTI
  {
    requires: ["search_param"],
    severity: "critical",
    title: "SQL Injection (SQLi)",
    description: "Inject ' OR 1=1-- or ' OR SLEEP(5)-- into the search/filter parameter to dump the database."
  },
  {
    requires: ["search_param"],
    severity: "high",
    title: "Server-Side Template Injection (SSTI)",
    description: "Inject {{7*7}} or ${7*7}. If it evaluates to 49, you have RCE on the backend."
  },

  // Exposed Infra
  {
    requires: ["env"],
    severity: "critical",
    title: "Credential Leak via .env",
    description: "Extract AWS keys, database passwords, and JWT secrets. Attempt to connect directly to the exposed infrastructure."
  },
  {
    requires: ["git"],
    severity: "critical",
    title: "Source Code Leak via .git",
    description: "Use GitTools (Dumper/Extractor) to rebuild the entire repository and perform whitebox code review."
  },
  {
    requires: ["actuator"],
    severity: "critical",
    title: "RCE via Spring Boot Actuator",
    description: "Check /actuator/env for secrets, or /actuator/heapdump to dump memory. Look for jolokia endpoints to exploit JNDI."
  },
  {
    requires: ["swagger"],
    severity: "high",
    title: "Mass Assignment / Hidden API Endpoints",
    description: "Use the Swagger UI to discover undocumented endpoints (like /api/v1/admin/users) or hidden object parameters (is_admin: true)."
  },
  {
    requires: ["cname"],
    severity: "high",
    title: "Subdomain Takeover",
    description: "The subdomain points to an unclaimed third-party service (AWS S3, GitHub Pages, Heroku). Register the bucket/app to take full control."
  },
  {
    requires: ["outdated"],
    severity: "high",
    title: "Exploit Public CVE",
    description: "Search exploit-db or GitHub for public exploits targeting this specific service version."
  },

  // XML
  {
    requires: ["xml_parsing"],
    severity: "critical",
    title: "XML External Entity (XXE)",
    description: "Inject a SYSTEM entity in the DTD to read local files (/etc/passwd) or perform SSRF."
  }
];
