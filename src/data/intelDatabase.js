export const INTEL_CATEGORIES = [
  { id: "recon", label: "🌍 Recon", color: "#3b82f6" },
  { id: "tech", label: "⚙️ Tech Stack", color: "#8b5cf6" },
  { id: "endpoints", label: "🔗 Endpoints", color: "#f59e0b" },
  { id: "auth", label: "🔐 Auth", color: "#ef4444" },
  { id: "features", label: "🧩 Features", color: "#10b981" },
  { id: "files", label: "📁 Files", color: "#6366f1" },
];

export const INTEL_DATABASE = [
  // ==================== RECON ====================
  {
    id: "recon-dev-subdomain",
    category: "recon",
    finding: "Found a dev/staging/uat subdomain",
    why: "Dev and staging environments are almost always less protected — missing WAFs, debug mode enabled, default credentials, and sometimes sharing the same production database.",
    whatToDoNow: [
      "Check for debug endpoints: /debug, /console, /.env, /phpinfo.php, /elmah.axd, /trace.axd",
      "Try default credentials: admin/admin, admin/password, test/test",
      "Re-test ALL payloads that failed on the main domain — the WAF is likely absent here",
      "Check if the database is shared with production by creating test data and checking prod",
      "Look for /swagger, /api-docs, /graphql/playground — API documentation is often exposed",
      "Check response headers — X-Debug-Token, X-Powered-By often leak more info here",
    ],
    decisionTree: {
      question: "Does the dev/staging subdomain have a login page?",
      yes: {
        action: "Try default credentials and brute-force with common dev passwords",
        next: {
          question: "Did you get in?",
          yes: { action: "Check if the DB is shared with production. If yes, this is a CRITICAL finding — you have access to prod data via a dev panel." },
          no: { action: "Check for registration endpoint. Dev environments often allow self-registration without email verification." }
        }
      },
      no: {
        action: "The app is directly accessible. Check for sensitive data exposure, API endpoints, and debug panels.",
        next: {
          question: "Is debug mode enabled (verbose errors, stack traces)?",
          yes: { action: "Extract: framework version, file paths, DB connection strings, internal IPs. Each one unlocks new attacks." },
          no: { action: "Run directory brute-force with a dev-specific wordlist (backup, dump, test, old, debug, admin)." }
        }
      }
    },
    attacksUnlocked: ["Information Disclosure", "Authentication Bypass", "RCE via Debug Console", "SQL Injection (no WAF)"],
    connectsTo: ["Tech stack detection", "Credential stuffing on main domain"],
  },
  {
    id: "recon-subdomain-cname",
    category: "recon",
    finding: "Found a subdomain with dangling CNAME (potential takeover)",
    why: "If a subdomain's CNAME points to a service (S3, Heroku, GitHub Pages) that no longer exists, you can claim that service and serve content on the company's subdomain.",
    whatToDoNow: [
      "Verify the CNAME target is actually unclaimed using `dig` or `nslookup`",
      "Check which service the CNAME points to (S3, Heroku, GitHub Pages, Azure, Shopify, etc.)",
      "If S3: try creating a bucket with the exact same name",
      "If Heroku: create a Heroku app and add the subdomain as a custom domain",
      "If GitHub Pages: create a repo with a CNAME file pointing to that subdomain",
      "Once claimed, host a simple PoC page proving ownership (do NOT host malicious content)",
    ],
    decisionTree: {
      question: "Which service does the CNAME point to?",
      yes: { action: "For S3/Azure Blob: Create the storage bucket with the exact name. For Heroku/Vercel: Register the app and add custom domain. For GitHub Pages: Create repo with CNAME file." },
      no: { action: "If the service is unknown, check if the CNAME resolves to NXDOMAIN. If yes, research how to claim resources on that specific platform." }
    },
    attacksUnlocked: ["Subdomain Takeover", "Cookie Stealing (if parent domain sets cookies)", "Phishing from trusted domain"],
    connectsTo: ["Session hijacking via shared cookies", "Phishing campaigns"],
  },
  {
    id: "recon-api-subdomain",
    category: "recon",
    finding: "Found an API subdomain (api.target.com, api-v2.target.com)",
    why: "API subdomains often expose more functionality than the web UI, have weaker auth, and may have older unpatched versions running alongside the current one.",
    whatToDoNow: [
      "Check for API documentation: /swagger, /swagger-ui, /api-docs, /openapi.json, /graphql",
      "Try accessing without auth — many internal APIs accidentally skip auth middleware",
      "Check for version numbers in the URL — /v1/, /v2/ — and try accessing older versions",
      "Fuzz common API paths: /users, /admin, /config, /health, /status, /metrics",
      "Check CORS headers — send Origin: https://evil.com and see if it's reflected",
      "Test HTTP method switching on every endpoint: GET → POST → PUT → DELETE → PATCH",
    ],
    decisionTree: {
      question: "Does the API return data without authentication?",
      yes: {
        action: "This is already a finding (Broken Access Control). Document it. Now check if you can access OTHER users' data by changing IDs.",
        next: {
          question: "Can you access other users' data by changing the ID?",
          yes: { action: "CRITICAL IDOR found. Document: what data is exposed, how many users affected, and demonstrate with 2 different accounts." },
          no: { action: "Check if you can perform write operations (PUT/POST/DELETE) without auth. Also test horizontal access between different user roles." }
        }
      },
      no: {
        action: "API requires auth. Check if old API versions (/v1/) have weaker or no auth.",
        next: {
          question: "Can you access /v1/ or /v0/ endpoints?",
          yes: { action: "Older API versions often have unpatched vulnerabilities and weaker auth. Test every endpoint from the current version on the old version." },
          no: { action: "Try token manipulation: remove the Bearer token, use an expired token, or try a blank Authorization header." }
        }
      }
    },
    attacksUnlocked: ["IDOR", "Broken Access Control", "API Rate Limiting Bypass", "Mass Data Exposure"],
    connectsTo: ["Auth token analysis", "Parameter fuzzing"],
  },

  // ==================== TECH STACK ====================
  {
    id: "tech-laravel",
    category: "tech",
    finding: "Target is running Laravel (PHP)",
    why: "Laravel has specific attack surfaces: debug mode RCE, exposed .env files with APP_KEY, mass assignment via unguarded models, and Telescope debug panel.",
    whatToDoNow: [
      "Check /.env — contains DB credentials, APP_KEY, mail passwords, API keys",
      "Check /telescope — Laravel's built-in debug panel (often left exposed in staging)",
      "Check /horizon — Laravel's queue dashboard",
      "Check if APP_DEBUG=true by triggering an error (visit /nonexistent-route-12345)",
      "If you find APP_KEY → this enables RCE via PHP deserialization (CVE-2018-15133)",
      "Test all forms for Mass Assignment: add role=admin or is_admin=true to POST body",
      "Check /storage/logs/laravel.log — often publicly accessible with sensitive data",
    ],
    decisionTree: {
      question: "Did you find the .env file or APP_KEY?",
      yes: {
        action: "CRITICAL. The APP_KEY allows crafting malicious serialized payloads for Remote Code Execution. Use tools like phpggc to generate the payload.",
        next: {
          question: "Is APP_DEBUG=true?",
          yes: { action: "Debug mode + APP_KEY = trivial RCE. Use Ignition RCE exploit (CVE-2021-3129). This is a P1 Critical finding." },
          no: { action: "Even without debug, APP_KEY enables deserialization attacks. Craft a payload using phpggc and send it via any cookie/session field." }
        }
      },
      no: {
        action: "Try triggering verbose errors by sending malformed data. Laravel in debug mode shows full stack traces with file paths and DB queries.",
        next: {
          question: "Did the error reveal file paths or framework details?",
          yes: { action: "Use the file paths to find config files. Try path traversal to read /app/config/database.php or /app/.env" },
          no: { action: "Focus on Mass Assignment attacks. Send extra fields like {\"role\":\"admin\"} in every POST/PUT request." }
        }
      }
    },
    attacksUnlocked: ["RCE via Deserialization", "Information Disclosure", "Mass Assignment", "SQL Injection"],
    connectsTo: ["Credential stuffing with leaked DB creds", "Privilege escalation via mass assignment"],
  },
  {
    id: "tech-graphql",
    category: "tech",
    finding: "Target uses GraphQL API",
    why: "GraphQL APIs often expose their entire schema via Introspection, allow deeply nested queries for DoS, and have weaker per-field authorization than REST APIs.",
    whatToDoNow: [
      "Try Introspection query: {__schema{types{name,fields{name}}}} at /graphql",
      "If Introspection is blocked, try: sending it as GET instead of POST, or via /graphiql",
      "Look for sensitive fields in the schema: password, token, secret, ssn, creditCard",
      "Test for IDOR: query other users' data by changing ID arguments",
      "Test for DoS via deeply nested queries (e.g., user→friends→friends→friends→...)",
      "Check for mutations: can you call admin mutations like deleteUser or updateRole?",
      "Test batch queries: [{query: q1}, {query: q2}, ...] for rate limit bypass",
    ],
    decisionTree: {
      question: "Does Introspection return the full schema?",
      yes: {
        action: "Map every query and mutation. Focus on mutations first — check which ones you can call without admin privileges.",
        next: {
          question: "Can you call admin-level mutations (e.g., deleteUser, setRole)?",
          yes: { action: "CRITICAL: Broken Access Control. Document every admin mutation you can access as a regular user." },
          no: { action: "Test every query for IDOR by changing ID arguments. Also check if you can access fields that should be restricted (email, phone, address of other users)." }
        }
      },
      no: {
        action: "Introspection is blocked. Try alternative discovery methods.",
        next: {
          question: "Did you find any query/mutation names from JS source code or error messages?",
          yes: { action: "Use the discovered names to manually construct queries. Errors often reveal argument names and types." },
          no: { action: "Use tools like clairvoyance to brute-force field names. Also try sending malformed queries to trigger error messages that leak schema info." }
        }
      }
    },
    attacksUnlocked: ["IDOR", "Broken Access Control", "DoS via Query Depth", "Information Disclosure"],
    connectsTo: ["Auth bypass on mutations", "Data exfiltration via batching"],
  },
  {
    id: "tech-nodejs",
    category: "tech",
    finding: "Target is running Node.js / Express",
    why: "Node.js apps are vulnerable to Prototype Pollution, Server-Side Template Injection (SSTI), and often use JWT with weak secrets.",
    whatToDoNow: [
      "Test for Prototype Pollution: send {\"__proto__\":{\"isAdmin\":true}} in JSON bodies",
      "Check for SSTI: try {{7*7}} or ${7*7} in user inputs — if you see 49, it's vulnerable",
      "JWT tokens are very common — decode at jwt.io and check for weak secrets",
      "Check for /admin, /api/admin, /graphql (common in Express apps)",
      "Test for NoSQL injection if MongoDB is used: {\"username\":{\"$ne\":\"\"}} in login forms",
      "Check for SSRF in any URL-fetching features (webhooks, image upload by URL)",
    ],
    decisionTree: {
      question: "Is the app using MongoDB (NoSQL)?",
      yes: {
        action: "Test NoSQL injection on every input: {\"$gt\":\"\"}, {\"$ne\":\"\"}, {\"$regex\":\".*\"}. Focus on login forms and search features.",
        next: {
          question: "Did NoSQL injection bypass authentication?",
          yes: { action: "CRITICAL. Document the exact payload. Try to escalate: can you log in as admin? Can you extract all user data?" },
          no: { action: "Try Prototype Pollution in JSON bodies. Send __proto__, constructor.prototype payloads to modify server behavior." }
        }
      },
      no: {
        action: "Likely using PostgreSQL/MySQL. Test standard SQL injection payloads.",
        next: {
          question: "Is the app using a template engine (EJS, Pug, Handlebars)?",
          yes: { action: "Test SSTI: {{7*7}}, #{7*7}, ${7*7}. If reflected as 49, escalate to RCE: {{process.mainModule.require('child_process').execSync('id')}}" },
          no: { action: "Focus on Prototype Pollution and JWT attacks. These are the most common Node.js vulns." }
        }
      }
    },
    attacksUnlocked: ["Prototype Pollution", "NoSQL Injection", "SSTI → RCE", "JWT Manipulation"],
    connectsTo: ["JWT analysis", "Privilege escalation"],
  },
  {
    id: "tech-aws",
    category: "tech",
    finding: "Target is hosted on AWS (S3, Lambda, API Gateway, Cognito)",
    why: "AWS misconfigurations are extremely common: public S3 buckets, overly permissive Cognito pools, exposed Lambda functions, and SSRF to metadata endpoint.",
    whatToDoNow: [
      "Check for S3 bucket access: try listing bucket contents via https://s3.amazonaws.com/BUCKET_NAME",
      "SSRF to metadata: if ANY URL-fetching exists, try http://169.254.169.254/latest/meta-data/",
      "Cognito: try self-registration even if UI doesn't show it — use AWS CLI directly",
      "Check for exposed Lambda function URLs — they often lack auth",
      "Try IMDSv1 metadata endpoint first, then IMDSv2 with token header",
      "Look for AWS access keys in JS files, .env files, and error messages",
    ],
    decisionTree: {
      question: "Did you find any SSRF vector (URL parameter, webhook, image fetcher)?",
      yes: {
        action: "Hit http://169.254.169.254/latest/meta-data/iam/security-credentials/ to steal AWS IAM role credentials.",
        next: {
          question: "Did you get IAM credentials from metadata?",
          yes: { action: "CRITICAL. Use the credentials with AWS CLI: aws configure, then try aws s3 ls, aws iam list-users, aws lambda list-functions. Document what you can access." },
          no: { action: "Try IMDSv2: first GET a token from http://169.254.169.254/latest/api/token with header X-aws-ec2-metadata-token-ttl-seconds:21600, then use it." }
        }
      },
      no: {
        action: "Focus on S3 buckets and Cognito misconfigurations.",
        next: {
          question: "Did you find S3 bucket names in JS files or page source?",
          yes: { action: "Try: aws s3 ls s3://BUCKET --no-sign-request. If it lists, try downloading. If write access, upload a test file as PoC." },
          no: { action: "Check Cognito User Pool: try calling SignUp API directly via AWS CLI even if the web UI doesn't have a registration page." }
        }
      }
    },
    attacksUnlocked: ["SSRF to AWS Metadata", "S3 Bucket Takeover", "IAM Privilege Escalation", "Cognito Misconfiguration"],
    connectsTo: ["Credential theft", "Lateral movement via AWS services"],
  },

  // ==================== ENDPOINTS ====================
  {
    id: "endpoint-id-param",
    category: "endpoints",
    finding: "Found an endpoint with ?id= or ?user_id= parameter",
    why: "ID parameters are the #1 indicator of IDOR vulnerabilities. If the backend doesn't verify ownership, you can access any user's data by simply changing the number.",
    whatToDoNow: [
      "Create 2 accounts. Get the ID for both. Try accessing Account B's data using Account A's session.",
      "Try sequential IDs: if your ID is 1337, try 1336, 1338, 1, 2, 3",
      "Try negative numbers: ?id=-1 (sometimes returns all records)",
      "Try very large numbers: ?id=99999999 (sometimes returns admin data)",
      "If UUID is used: check if UUIDs are leaked anywhere (API responses, URLs, JS files)",
      "Try changing the HTTP method: GET /api/user?id=1 → PUT /api/user?id=1 with modified body",
    ],
    decisionTree: {
      question: "Can you access another user's data by changing the ID?",
      yes: {
        action: "IDOR confirmed! Now escalate the impact.",
        next: {
          question: "Is this a read (GET) or write (PUT/DELETE) endpoint?",
          yes: { action: "Write IDOR is CRITICAL. Demonstrate: account deletion, password change, or data modification of another user." },
          no: { action: "Read IDOR is HIGH. Show what sensitive data is exposed (PII, financial, medical). Enumerate how many users are affected." }
        }
      },
      no: {
        action: "The endpoint validates ownership. Try bypassing the check.",
        next: {
          question: "Does the API use both numeric IDs and UUIDs?",
          yes: { action: "Try mixing them: if the main endpoint uses UUIDs, check if an alternate endpoint accepts numeric IDs without auth checks." },
          no: { action: "Try parameter pollution: ?id=YOUR_ID&id=VICTIM_ID. Try wrapping in array: ?id[]=YOUR_ID&id[]=VICTIM_ID. Try JSON body override." }
        }
      }
    },
    attacksUnlocked: ["IDOR (Read)", "IDOR (Write)", "Mass Data Exposure", "Account Takeover"],
    connectsTo: ["Privilege escalation", "Data exfiltration"],
  },
  {
    id: "endpoint-url-param",
    category: "endpoints",
    finding: "Found an endpoint with ?url=, ?redirect=, ?next=, or ?return= parameter",
    why: "URL parameters that redirect or fetch external content are the entry point for Open Redirect and SSRF, both of which can be chained into Critical findings.",
    whatToDoNow: [
      "Test Open Redirect: ?redirect=https://evil.com — does the server redirect there?",
      "Test SSRF: ?url=http://127.0.0.1 — does the server make a request to localhost?",
      "If basic payloads are blocked, try bypasses:",
      "  → //evil.com (protocol-relative)",
      "  → https://target.com@evil.com (URL auth confusion)",
      "  → https://evil.com#target.com (fragment bypass)",
      "  → https://target.com.evil.com (subdomain confusion)",
      "For SSRF: try http://169.254.169.254 (AWS metadata), http://[::1] (IPv6 localhost)",
    ],
    decisionTree: {
      question: "Does the parameter redirect the browser or fetch content server-side?",
      yes: {
        action: "If it REDIRECTS the browser → Open Redirect. If it FETCHES content server-side → SSRF.",
        next: {
          question: "Is it an Open Redirect?",
          yes: { action: "Chain it: Use the Open Redirect in an OAuth flow to steal authorization codes. This escalates Open Redirect (Low) → Account Takeover (Critical)." },
          no: { action: "It's SSRF. Try accessing: 127.0.0.1 (internal services), 169.254.169.254 (AWS metadata), internal hostnames found during recon." }
        }
      },
      no: {
        action: "The URL parameter might be used in a different way (e.g., displaying content in an iframe).",
        next: {
          question: "Is the URL reflected in the page source (inside iframe src, img src, etc.)?",
          yes: { action: "Try javascript:alert(1) — if the URL is placed in src= without validation, you might get XSS." },
          no: { action: "The URL might be processed server-side without visible output. Try SSRF with Burp Collaborator or webhook.site to detect blind requests." }
        }
      }
    },
    attacksUnlocked: ["Open Redirect", "SSRF", "OAuth Token Theft", "XSS via javascript: URI"],
    connectsTo: ["OAuth flow manipulation", "AWS metadata theft", "Kill-Chain with CSRF"],
  },
  {
    id: "endpoint-api-users",
    category: "endpoints",
    finding: "Found /api/users, /api/v1/users, or similar user-listing endpoint",
    why: "User listing endpoints often leak PII, have broken pagination that exposes all records, or can be accessed by lower-privileged users.",
    whatToDoNow: [
      "Check if it returns data without authentication — remove the auth header",
      "Check pagination: try ?limit=10000 or ?page=1&per_page=99999 to dump all users",
      "Check what fields are returned: email, phone, address, SSN, password hashes?",
      "Try accessing as a regular user vs admin — is there a difference in response?",
      "Try adding ?role=admin or ?filter=admin to see if you can filter by role",
      "Check HTTP methods: can you DELETE /api/users/123 or PUT /api/users/123?",
    ],
    decisionTree: {
      question: "Does the endpoint return a list of users?",
      yes: {
        action: "Check what data is exposed. PII exposure is immediately reportable.",
        next: {
          question: "Does the response include sensitive fields (email, phone, password hash)?",
          yes: { action: "HIGH/CRITICAL: Mass PII Exposure. Calculate how many users are affected by testing pagination. Document exact fields exposed." },
          no: { action: "Even usernames and IDs are useful. Use them to test IDOR on other endpoints like /api/users/{id}/profile." }
        }
      },
      no: {
        action: "Endpoint returns 401/403. Try bypassing.",
        next: {
          question: "Can you bypass with header tricks?",
          yes: { action: "Try: X-Forwarded-For: 127.0.0.1, X-Original-URL: /api/users, X-Rewrite-URL, or switching HTTP method." },
          no: { action: "Try accessing /api/v1/users (version downgrade), /api/Users (case change), /api/users/ (trailing slash), /api/users.json (extension bypass)." }
        }
      }
    },
    attacksUnlocked: ["Mass Data Exposure", "IDOR", "Broken Access Control", "User Enumeration"],
    connectsTo: ["Credential stuffing with leaked emails", "IDOR testing with discovered IDs"],
  },

  // ==================== AUTH ====================
  {
    id: "auth-jwt",
    category: "auth",
    finding: "Target uses JWT (JSON Web Tokens) for authentication",
    why: "JWTs are stateless tokens that can be decoded by anyone. Weak implementations allow algorithm confusion, secret key cracking, and claim manipulation.",
    whatToDoNow: [
      "Decode the JWT at jwt.io — check header (alg) and payload (claims)",
      "Check the 'alg' field: RS256, HS256, ES256, or none?",
      "Check 'exp' claim: does the token ever expire? Far-future expiry is a finding",
      "Check for sensitive data in the payload: passwords, internal IPs, role info",
      "Try setting alg: 'none' — remove the signature entirely",
      "If RS256: try Algorithm Confusion — change to HS256 and sign with the public key",
      "If HS256: try cracking the secret with hashcat or jwt-cracker",
    ],
    decisionTree: {
      question: "What algorithm does the JWT use?",
      yes: {
        action: "Check the 'alg' field in the JWT header after decoding at jwt.io.",
        next: {
          question: "Is it RS256 (asymmetric)?",
          yes: { action: "Try Algorithm Confusion: change 'alg' to 'HS256', find the public key (often at /.well-known/jwks.json), and use it as the HMAC secret to sign a forged token with role=admin." },
          no: { action: "If HS256: the secret might be weak. Run: hashcat -m 16500 jwt.txt wordlist.txt. Common secrets: 'secret', 'password', the company name, 'jwt_secret'." }
        }
      },
      no: { action: "Try setting alg to 'none' and removing the signature. Send: header.payload. (with trailing dot, no signature)" }
    },
    attacksUnlocked: ["Authentication Bypass", "Privilege Escalation", "Account Takeover"],
    connectsTo: ["Forging admin tokens", "Accessing protected API endpoints"],
  },
  {
    id: "auth-oauth",
    category: "auth",
    finding: "Target uses OAuth / Social Login (Google, Facebook, GitHub)",
    why: "OAuth flows are complex and developers frequently misconfigure redirect_uri validation, state parameter checking, and token exchange.",
    whatToDoNow: [
      "Check the redirect_uri parameter — can you change it to your server?",
      "Try redirect_uri bypasses: add subdirectory (/callback/evil), fragment (#@evil.com), etc.",
      "Check if the 'state' parameter exists — missing state = CSRF on login",
      "Check if authorization codes are single-use — try replaying a used code",
      "Check if tokens are bound to the client — try using Token A in Client B",
      "Look for Open Redirect on the target domain to chain with OAuth",
    ],
    decisionTree: {
      question: "Can you modify the redirect_uri to point to your server?",
      yes: {
        action: "CRITICAL: You can steal OAuth authorization codes. Set up a listener, craft the malicious OAuth URL, and the victim's auth code will be sent to your server.",
        next: {
          question: "Can you exchange the stolen code for an access token?",
          yes: { action: "Full Account Takeover confirmed. Document the entire flow as a P1 Critical report." },
          no: { action: "The code might be bound to redirect_uri. Try: use the code with the original redirect_uri from your server." }
        }
      },
      no: {
        action: "redirect_uri is strictly validated. Try alternative bypasses.",
        next: {
          question: "Is there an Open Redirect anywhere on the target domain?",
          yes: { action: "Chain it: set redirect_uri to the Open Redirect endpoint, which forwards the code to your server. This is a classic OAuth chain!" },
          no: { action: "Check if the state parameter is present and validated. Missing state = Login CSRF. Also check if tokens can be reused across different OAuth clients." }
        }
      }
    },
    attacksUnlocked: ["Account Takeover via OAuth", "Login CSRF", "Token Theft"],
    connectsTo: ["Open Redirect chaining", "CSRF exploitation"],
  },
  {
    id: "auth-password-reset",
    category: "auth",
    finding: "Target has a password reset / forgot password feature",
    why: "Password reset flows are one of the most common sources of Account Takeover bugs. Token generation, delivery, and validation all have attack surfaces.",
    whatToDoNow: [
      "Request a reset and intercept the email — analyze the reset token/link",
      "Is the token predictable? (sequential, timestamp-based, short length)",
      "Does the token expire? Request one, wait 24 hours, and try to use it",
      "Can you reuse the token after the password is changed?",
      "Try Host header injection: change Host to your server — does the reset link use your domain?",
      "Try HTTP Parameter Pollution: email=victim@a.com&email=attacker@a.com",
      "Check if changing the email in the POST body sends the reset to YOUR email for THEIR account",
    ],
    decisionTree: {
      question: "Does the reset token appear in the URL (GET parameter)?",
      yes: {
        action: "Check if the Referer header leaks the token to third-party scripts on the reset page.",
        next: {
          question: "Are there any third-party scripts (analytics, ads) on the password reset page?",
          yes: { action: "The reset token is likely leaked via Referer header to those third parties. This is a HIGH finding (token leakage)." },
          no: { action: "Try Host header manipulation: change Host to evil.com. If the reset link uses Host header value, the victim gets a link pointing to your server with their token." }
        }
      },
      no: {
        action: "Token is in POST body or email. Focus on token manipulation.",
        next: {
          question: "Is the token short or predictable?",
          yes: { action: "Brute-force the token space. If it's 4-6 digits, you can crack it in minutes. Document the weakness as Insecure Token Generation." },
          no: { action: "Try: request reset for victim, then immediately for yourself. Compare tokens — if they're sequential or time-based, you can predict the victim's token." }
        }
      }
    },
    attacksUnlocked: ["Account Takeover", "Token Prediction", "Host Header Injection"],
    connectsTo: ["Email parameter pollution", "Referer-based token leakage"],
  },

  // ==================== FEATURES ====================
  {
    id: "feature-file-upload",
    category: "features",
    finding: "Target has a file upload feature",
    why: "File uploads are one of the most dangerous features. Improper validation can lead to RCE (uploading web shells), XSS (uploading SVG/HTML), or storage attacks.",
    whatToDoNow: [
      "Try uploading a PHP/JSP/ASPX web shell with the correct extension",
      "If blocked: try double extensions: shell.php.jpg, shell.php%00.jpg",
      "Try content-type bypass: upload .php but set Content-Type: image/jpeg",
      "Try uploading an SVG with embedded XSS: <svg onload=alert(1)>",
      "Try uploading .html file with JavaScript",
      "Check if the upload path is predictable — can you access other users' uploads?",
      "Try path traversal in filename: ../../../etc/passwd or ..\\..\\..\\shell.php",
      "Check file size limits — can you upload a massive file for DoS?",
    ],
    decisionTree: {
      question: "What file types are accepted?",
      yes: {
        action: "Test the boundaries of what's accepted.",
        next: {
          question: "Can you upload executable files (.php, .jsp, .aspx)?",
          yes: { action: "CRITICAL: Upload a web shell and try to execute it by visiting the uploaded file URL. This is RCE." },
          no: { action: "Try SVG with <svg onload=alert(document.cookie)> for Stored XSS. Also try HTML files. Check if EXIF data in images is rendered (XSS via EXIF)." }
        }
      },
      no: {
        action: "All uploads are rejected. Try bypassing.",
        next: {
          question: "Is the validation client-side or server-side?",
          yes: { action: "If client-side: simply intercept the request in Burp and change the extension back to .php after the browser validates." },
          no: { action: "Try null byte injection: shell.php%00.jpg. Try case variation: shell.pHp. Try alternative extensions: .phtml, .phar, .php5, .shtml." }
        }
      }
    },
    attacksUnlocked: ["Remote Code Execution", "Stored XSS", "Path Traversal", "DoS"],
    connectsTo: ["Web shell access", "Lateral movement"],
  },
  {
    id: "feature-admin-panel",
    category: "features",
    finding: "Found an admin panel (/admin, /dashboard, /manage)",
    why: "Admin panels contain the most powerful functionality. Even partial access or information leakage from admin panels can be Critical.",
    whatToDoNow: [
      "Try default credentials: admin/admin, admin/password, administrator/admin, root/root",
      "Check for registration — some admin panels allow self-registration",
      "Try SQL injection on the login form: admin' OR '1'='1' --",
      "Check for authentication bypass: remove cookies/tokens and see if any page loads",
      "Try accessing admin API endpoints directly: /admin/api/users, /admin/api/config",
      "Check for verbose errors on failed login — does it say 'wrong password' vs 'user not found'?",
      "Try brute-forcing with company-specific passwords (company name, founding year, etc.)",
    ],
    decisionTree: {
      question: "Can you access the admin panel login page?",
      yes: {
        action: "The login page is exposed. Try bypassing authentication.",
        next: {
          question: "Did default credentials work?",
          yes: { action: "CRITICAL. Document everything you can access. Take screenshots of sensitive data. Do NOT modify anything." },
          no: { action: "Try SQLi in username field: admin'-- and password field. Try CSRF to force an admin to create your account. Check if there's a password reset for admin." }
        }
      },
      no: {
        action: "Admin panel returns 403/404. Try bypass techniques.",
        next: {
          question: "Is it returning 403 (forbidden) or 404 (not found)?",
          yes: { action: "403 means it exists but you're blocked. Try: X-Forwarded-For: 127.0.0.1, X-Original-URL: /admin, accessing /Admin or /ADMIN (case), /admin/ (trailing slash), /admin;/ (semicolon)" },
          no: { action: "If 404: try other paths: /administrator, /manage, /portal, /backend, /cp, /wp-admin, /admin.php" }
        }
      }
    },
    attacksUnlocked: ["Authentication Bypass", "Privilege Escalation", "Data Exposure", "RCE via Admin Features"],
    connectsTo: ["Post-auth exploitation", "User management manipulation"],
  },

  // ==================== FILES ====================
  {
    id: "files-env",
    category: "files",
    finding: "Found an exposed .env file or configuration file",
    why: ".env files contain the crown jewels: database credentials, API keys, encryption secrets, mail passwords, and cloud provider keys. A single .env exposure can cascade into full system compromise.",
    whatToDoNow: [
      "Download and read the entire file — document every credential found",
      "Check for: DB_PASSWORD, APP_KEY, AWS_ACCESS_KEY, MAIL_PASSWORD, STRIPE_SECRET",
      "Try connecting to the database if credentials are present",
      "Use any AWS keys with AWS CLI: aws sts get-caller-identity to verify",
      "Check if API keys (Stripe, Twilio, SendGrid) are still active",
      "Try the DB credentials on other services — password reuse is common",
    ],
    decisionTree: {
      question: "Does the .env file contain database credentials?",
      yes: {
        action: "CRITICAL. Can you connect to the database remotely?",
        next: {
          question: "Is the database port (3306, 5432) accessible from the internet?",
          yes: { action: "Connect directly. Extract user data as PoC. This is a P1 Critical — full database access." },
          no: { action: "Database is internal. Look for SSRF vectors to connect from inside the network. Also try the credentials on the application login." }
        }
      },
      no: {
        action: "Check for other valuable secrets: APP_KEY, API keys, cloud credentials.",
        next: {
          question: "Did you find AWS_ACCESS_KEY or cloud credentials?",
          yes: { action: "CRITICAL. Use AWS CLI to enumerate: S3 buckets, IAM users, Lambda functions, EC2 instances. Document your access level." },
          no: { action: "Even mail credentials or APP_KEY are valuable findings. APP_KEY in Laravel = RCE. Mail creds = ability to send phishing emails from the company's domain." }
        }
      }
    },
    attacksUnlocked: ["Full Database Access", "Cloud Account Takeover", "RCE via APP_KEY", "Phishing via Mail Creds"],
    connectsTo: ["Privilege escalation", "Lateral movement across services"],
  },
  {
    id: "files-js-source",
    category: "files",
    finding: "Found JavaScript source files or source maps",
    why: "JS bundles contain the entire client-side logic: hidden API routes, hardcoded API keys, admin-only endpoints, internal comments, and business logic that reveals backend assumptions.",
    whatToDoNow: [
      "Download all .js files: curl -s URL | grep -oP 'src=\"[^\"]+\\.js' | sort -u",
      "Check for source maps: try adding .map to any JS file URL (bundle.js.map)",
      "Run LinkFinder or JSLuice to extract all URLs, paths, and API endpoints",
      "Search for: apiKey, api_key, secret, token, password, admin, internal, private",
      "Look for hidden routes: /admin, /debug, /internal, /api/v2, /graphql",
      "Check for hardcoded credentials or test accounts in comments",
    ],
    decisionTree: {
      question: "Did you find source maps (.map files)?",
      yes: {
        action: "Source maps reveal the ORIGINAL source code (React/Vue/Angular components, services, utils). This is a goldmine.",
        next: {
          question: "Did the source code reveal hidden API endpoints or admin routes?",
          yes: { action: "Test every hidden endpoint immediately. Admin routes often exist in the frontend code but are hidden by UI — the backend may not check permissions." },
          no: { action: "Search the source for business logic: how are prices calculated? How are roles checked? Look for client-side-only auth checks you can bypass." }
        }
      },
      no: {
        action: "No source maps. Work with the minified JS directly.",
        next: {
          question: "Did LinkFinder/grep find API keys or secrets?",
          yes: { action: "Verify each key: try using it in API calls. Google/AWS/Stripe keys can be validated directly. Report active keys as Information Disclosure." },
          no: { action: "Focus on extracting API endpoints. Every path found is a new attack surface to test for IDOR, broken auth, and injection." }
        }
      }
    },
    attacksUnlocked: ["Information Disclosure", "Hidden Endpoint Discovery", "API Key Exposure", "Business Logic Bypass"],
    connectsTo: ["API endpoint testing", "Authentication bypass on hidden routes"],
  },
  {
    id: "files-directory-listing",
    category: "files",
    finding: "Found directory listing enabled on a path",
    why: "Directory listing exposes the entire file structure of that path. Backup files, config files, SQL dumps, and old code can all be downloaded directly.",
    whatToDoNow: [
      "Download ALL files listed — especially .sql, .zip, .tar.gz, .bak, .old, .conf",
      "Look for config files: web.config, .htaccess, wp-config.php, settings.py",
      "Check file timestamps — older files are more likely to contain outdated (weaker) security",
      "Try navigating to parent directories: /backup/ → /backup/../",
      "Try common backup directory names: /backup/, /backups/, /old/, /dump/, /export/",
      "Check for Git repository: /.git/ — if exposed, use git-dumper to clone the entire repo",
    ],
    decisionTree: {
      question: "Did you find database dumps (.sql files)?",
      yes: {
        action: "CRITICAL. Download and examine for: user credentials (hashes), API keys, internal IP addresses, table structures.",
        next: {
          question: "Do the SQL dumps contain password hashes?",
          yes: { action: "Crack them with hashcat. Try the cracked passwords on the live application. If any work → Account Takeover." },
          no: { action: "Look for: email addresses (phishing list), internal IPs (SSRF targets), table schema (helps craft SQL injection)." }
        }
      },
      no: {
        action: "No SQL dumps, but other files might be valuable.",
        next: {
          question: "Did you find config files or source code?",
          yes: { action: "Config files may contain credentials. Source code may reveal vulnerabilities. Review everything carefully." },
          no: { action: "The directory listing itself is an Information Disclosure finding (Medium). Document the path and what types of files are accessible." }
        }
      }
    },
    attacksUnlocked: ["Information Disclosure", "Credential Exposure", "Source Code Disclosure"],
    connectsTo: ["Credential stuffing", "SQL injection via schema knowledge"],
  },
  {
    id: "feature-search",
    category: "features",
    finding: "Target has a search functionality",
    why: "Search features reflect user input in the response, interact with databases, and often have caching — making them prime targets for XSS, SQLi, and cache poisoning.",
    whatToDoNow: [
      "Test for Reflected XSS: search for <img src=x onerror=alert(1)>",
      "Test for SQL injection: search for ' OR 1=1-- or ' UNION SELECT null--",
      "Test for SSTI: search for {{7*7}} or ${7*7} — if 49 appears, it's vulnerable",
      "Test for LDAP injection if Active Directory is used: *)(&",
      "Check if search results are cached — Web Cache Poisoning potential",
      "Test wildcard/regex: search for * or .* to see if all records are returned",
    ],
    decisionTree: {
      question: "Is your search input reflected in the HTML response?",
      yes: {
        action: "Test for XSS. Check what context your input lands in (inside tags, attributes, script blocks).",
        next: {
          question: "Did the XSS payload execute?",
          yes: { action: "Reflected XSS confirmed. Escalate: craft a payload that steals cookies or session tokens. If HttpOnly is set on cookies, demonstrate CSRF via XSS instead." },
          no: { action: "Input is filtered. Try bypass: <svg/onload=alert(1)>, <details open ontoggle=alert(1)>, or encoding payloads." }
        }
      },
      no: {
        action: "Input is not directly reflected. Focus on backend injection.",
        next: {
          question: "Does the search query interact with a database?",
          yes: { action: "Test SQL injection with time-based payloads: ' AND SLEEP(5)--. If response is delayed by 5 seconds, Blind SQLi confirmed." },
          no: { action: "Check if the search interacts with external systems. Test for SSRF if URL-like inputs are processed." }
        }
      }
    },
    attacksUnlocked: ["Reflected XSS", "SQL Injection", "SSTI → RCE", "Web Cache Poisoning"],
    connectsTo: ["Cookie theft", "Database extraction"],
  },
  {
    id: "auth-session-cookie",
    category: "auth",
    finding: "Target uses traditional Session Cookies",
    why: "Session management is often overlooked. Missing flags, predictable IDs, or improper invalidation on logout are common bugs.",
    whatToDoNow: [
      "Check cookie flags: HttpOnly, Secure, SameSite",
      "Check if session token changes after login/logout (Session Fixation)",
      "Test concurrent logins — can you log in from 2 browsers simultaneously?",
      "Test session expiration: log in, capture token, log out, try using token again",
      "Decode the cookie (Base64, URL decode) to see if it contains user data",
      "Check cookie scope: Path and Domain attributes"
    ],
    decisionTree: {
      question: "Are HttpOnly and Secure flags set on the session cookie?",
      yes: {
        action: "Good. Focus on session lifecycle and logic flaws.",
        next: {
          question: "Can you still use the session token after explicitly logging out?",
          yes: { action: "Improper Session Invalidation. (Medium). Document that tokens live forever on the server." },
          no: { action: "Check for Session Fixation: set a fake cookie before login and see if the app accepts and uses it post-login." }
        }
      },
      no: {
        action: "Missing HttpOnly means XSS can steal the cookie. Missing Secure means it can be intercepted over HTTP.",
        next: {
          question: "Is SameSite set to None or missing?",
          yes: { action: "Missing SameSite + Missing CSRF tokens = CRITICAL CSRF vulnerability. Test state-changing actions via a test HTML page." },
          no: { action: "Document missing flags as Low/Medium severity depending on context." }
        }
      }
    },
    attacksUnlocked: ["Session Hijacking", "CSRF", "Session Fixation", "Insecure Direct Object Reference"],
    connectsTo: ["XSS exploitation", "Account Takeover"]
  },
  {
    id: "endpoint-graphql-mutations",
    category: "endpoints",
    finding: "Found GraphQL Mutations",
    why: "Mutations change state on the server. Developers often secure queries but forget to properly authorize mutations, or leave administrative mutations exposed.",
    whatToDoNow: [
      "Enumerate all mutations via Introspection or field guessing",
      "Test each mutation without an auth token",
      "Test each mutation with a low-privileged user token",
      "Look for mutations like: updateRole, setAdmin, deleteUser, createApiToken",
      "Test for mass assignment: if an update mutation takes a complex input object, try adding fields like { id: 1, role: 'admin' }",
    ],
    decisionTree: {
      question: "Are administrative mutations exposed in the schema?",
      yes: {
        action: "Try executing them with your standard user token.",
        next: {
          question: "Did the mutation succeed?",
          yes: { action: "CRITICAL. Broken Access Control on GraphQL mutation. You just escalated privileges." },
          no: { action: "Check if the mutation expects a specific object ID. Try modifying IDs to affect other users (IDOR on mutation)." }
        }
      },
      no: {
        action: "Focus on standard user mutations (e.g., updateProfile).",
        next: {
          question: "Can you modify fields that aren't in the UI?",
          yes: { action: "GraphQL Mass Assignment. You modified backend state using undocumented input fields." },
          no: { action: "Check rate limiting on mutations like createComment or sendEmail." }
        }
      }
    },
    attacksUnlocked: ["Privilege Escalation", "Mass Assignment", "IDOR on Mutation", "Broken Access Control"],
    connectsTo: ["Data destruction", "Account Takeover"]
  },
  {
    id: "recon-github-repo",
    category: "recon",
    finding: "Found an exposed GitHub Repository",
    why: "Source code repositories often contain hardcoded credentials, API keys, internal endpoints, and historical vulnerabilities in the commit history.",
    whatToDoNow: [
      "Search the repository for secrets: password, secret, token, key, credentials",
      "Review the commit history for 'removed password' or 'fixed typo' messages",
      "Analyze the application's configuration files (e.g., config.yml, application.properties)",
      "Look for hardcoded test accounts or backdoor accounts",
      "Check for outdated dependencies with known CVEs in package.json or pom.xml",
    ],
    decisionTree: {
      question: "Did you find any hardcoded credentials or API keys?",
      yes: {
        action: "Verify if the credentials are still valid on the live application.",
        next: {
          question: "Are the credentials valid?",
          yes: { action: "CRITICAL. You have compromised active credentials. Document the access and stop." },
          no: { action: "The credentials might be for a staging environment or revoked. Still reportable as Information Disclosure." }
        }
      },
      no: {
        action: "Focus on understanding the application's internal workings.",
        next: {
          question: "Does the code reveal internal API endpoints or administrative routes?",
          yes: { action: "Test those endpoints on the live target. They might lack proper authentication." },
          no: { action: "Look for business logic flaws by analyzing how the application processes data and handles permissions." }
        }
      }
    },
    attacksUnlocked: ["Information Disclosure", "Credential Compromise", "Business Logic Flaws", "Hidden Endpoint Discovery"],
    connectsTo: ["Authentication bypass", "API testing"]
  },
  {
    id: "tech-wordpress",
    category: "tech",
    finding: "Target is running WordPress",
    why: "WordPress is a huge attack surface due to its plugin ecosystem, theme vulnerabilities, and default behaviors like user enumeration.",
    whatToDoNow: [
      "Run WPScan to enumerate plugins, themes, and users",
      "Check for user enumeration: /?author=1 or via WP-JSON API (/wp-json/wp/v2/users)",
      "Check /wp-admin/ and /wp-login.php for default access or brute-force potential",
      "Verify if XML-RPC is enabled (/xmlrpc.php) - allows brute-forcing and pingback SSRF",
      "Review the version of installed plugins and search for known CVEs",
    ],
    decisionTree: {
      question: "Is XML-RPC enabled and accessible?",
      yes: {
        action: "Test for Pingback SSRF and Brute-force amplification.",
        next: {
          question: "Can you perform an internal port scan using the pingback feature?",
          yes: { action: "SSRF via XML-RPC. Document the exposed internal ports." },
          no: { action: "Test brute-forcing using the system.multicall method to send thousands of login attempts in one request." }
        }
      },
      no: {
        action: "Focus on plugins and REST API.",
        next: {
          question: "Did WPScan find any outdated plugins with known CVEs?",
          yes: { action: "Verify the vulnerability exists and attempt exploitation using public PoCs." },
          no: { action: "Check the WP-JSON API for exposed data or custom endpoints added by plugins." }
        }
      }
    },
    attacksUnlocked: ["User Enumeration", "SSRF", "Brute-force", "RCE (via vulnerable plugins)"],
    connectsTo: ["Account Takeover", "Server Compromise"]
  },
  {
    id: "endpoint-export-feature",
    category: "endpoints",
    finding: "Found an Export feature (CSV, PDF, Excel)",
    why: "Export features process user-controlled data and convert it to formats interpreted by other software, leading to CSV Injection or SSRF.",
    whatToDoNow: [
      "Test for CSV Injection: inject formulas like =cmd|' /C calc'!A0 into input fields that get exported",
      "Test for SSRF (if PDF export): inject HTML/iframes pointing to internal IPs if the PDF is generated from HTML",
      "Check for IDOR: can you export another user's data? (e.g., /export?userId=2)",
      "Check for massive data dumping (broken pagination in export)",
    ],
    decisionTree: {
      question: "Is the export format CSV or Excel?",
      yes: {
        action: "Test CSV Injection (Formula Injection).",
        next: {
          question: "Does the exported file execute the injected formula when opened in Excel?",
          yes: { action: "CSV Injection confirmed. This is client-side RCE. Note: many programs consider this out-of-scope unless it causes server-side impact, but still worth reporting." },
          no: { action: "Check if the server processes the data during export (e.g., template injection)." }
        }
      },
      no: {
        action: "If it's PDF generation, test for Server-Side XSS (Dynamic PDF Generation).",
        next: {
          question: "Can you inject HTML or JavaScript into the PDF output?",
          yes: { action: "Try injecting <iframe src='http://169.254.169.254/latest/meta-data/'> to achieve SSRF via the PDF generator." },
          no: { action: "Focus on IDOR and mass data exposure through the export functionality." }
        }
      }
    },
    attacksUnlocked: ["CSV Injection", "SSRF via PDF", "IDOR", "Data Exfiltration"],
    connectsTo: ["Client-side RCE", "Cloud Metadata Theft"]
  },
  {
    id: "recon-cors-misconfig",
    category: "recon",
    finding: "Found CORS Misconfiguration",
    why: "Cross-Origin Resource Sharing (CORS) misconfigurations can allow attackers to steal sensitive data or perform actions on behalf of the user.",
    whatToDoNow: [
      "Check if Access-Control-Allow-Origin is set to '*' or reflects arbitrary origins",
      "Verify if Access-Control-Allow-Credentials is set to 'true'",
      "Test bypasses: prefix/suffix matching (e.g., https://target.com.evil.com), null origin",
      "Check if sensitive actions or data can be accessed cross-origin",
    ],
    decisionTree: {
      question: "Does the server reflect arbitrary origins and allow credentials?",
      yes: {
        action: "CRITICAL if sensitive data is returned. Craft an HTML page that makes an XHR request to steal user data.",
        next: {
          question: "Does the endpoint return sensitive PII, API keys, or session tokens?",
          yes: { action: "CORS Data Theft. Host the exploit, log in as victim, and demonstrate data exfiltration." },
          no: { action: "If the endpoint performs state changes (like updating email), it's effectively a CSRF vulnerability via CORS bypass." }
        }
      },
      no: {
        action: "Check for bypasses if specific origins are allowed.",
        next: {
          question: "Does it trust the 'null' origin?",
          yes: { action: "Create an exploit using an iframe with a data: URI or a sandboxed iframe to trigger a request from the 'null' origin." },
          no: { action: "Check if it trusts subdomains. If so, look for an XSS vulnerability on ANY subdomain to exploit this." }
        }
      }
    },
    attacksUnlocked: ["Cross-Origin Data Theft", "CSRF Bypass"],
    connectsTo: ["Account Takeover", "Data Exfiltration"]
  },
  {
    id: "tech-springboot-actuator",
    category: "tech",
    finding: "Found exposed Spring Boot Actuator (/actuator or /env)",
    why: "Actuators expose deep internal application metrics, environment variables, and memory dumps. If misconfigured, they allow full Remote Code Execution.",
    whatToDoNow: [
      "Navigate to /actuator/env and look for AWS keys, DB passwords, or API tokens",
      "Check /actuator/heapdump to download the JVM memory — extract passwords using OQL (Eclipse Memory Analyzer)",
      "Check /actuator/gateway/routes for hidden internal endpoints",
      "Look for /actuator/jolokia — if present, it often leads to RCE via JNDI injection or MBean manipulation"
    ],
    decisionTree: {
      question: "Are environment variables in /actuator/env redacted (showing as ******)?",
      yes: {
        action: "Download the /actuator/heapdump instead.",
        next: {
          question: "Did the heapdump download successfully?",
          yes: { action: "Load it into Eclipse MAT, run OQL queries to find java.lang.String objects containing 'password' or 'key'." },
          no: { action: "If heapdump is blocked, try spring Cloud env injection to achieve RCE (e.g. spring.cloud.bootstrap.location)." }
        }
      },
      no: {
        action: "Extract the cleartext credentials and attempt to log into databases or AWS accounts directly."
      }
    },
    attacksUnlocked: ["Information Disclosure", "Remote Code Execution (RCE)"],
    connectsTo: ["Cloud Account Takeover", "Database Access"]
  },
  {
    id: "recon-s3-bucket",
    category: "recon",
    finding: "Found an Amazon S3 Bucket URL",
    why: "S3 buckets are notoriously misconfigured. They might allow public read access (leaking PII/source code) or public write access (allowing you to overwrite scripts or host malware).",
    whatToDoNow: [
      "Access the bucket URL directly in the browser to see if Directory Listing is enabled",
      "Use AWS CLI: `aws s3 ls s3://bucket-name --no-sign-request`",
      "Check for write access: `aws s3 cp test.txt s3://bucket-name/test.txt --no-sign-request`",
      "If the bucket hosts the main website's assets, check if you can overwrite a .js file"
    ],
    decisionTree: {
      question: "Do you have Write access to the bucket?",
      yes: {
        action: "Check what the bucket is used for.",
        next: {
          question: "Does the bucket host JavaScript files for the main web application?",
          yes: { action: "CRITICAL: You can overwrite the JS file with a malicious payload (Stored XSS / Supply Chain Attack), compromising all users." },
          no: { action: "You can host phishing pages or malware on the company's official domain/bucket (Subdomain Takeover / Defacement)." }
        }
      },
      no: {
        action: "Read access only. Download the contents and grep for credentials, PII, or internal source code."
      }
    },
    attacksUnlocked: ["Stored XSS via Asset Overwrite", "Subdomain Takeover", "Data Breach"],
    connectsTo: ["Supply Chain Attack"]
  },
  {
    id: "endpoints-hidden-api-versions",
    category: "endpoints",
    finding: "Found multiple API versions (e.g., /api/v2/ used, but /api/v1/ exists)",
    why: "Older API versions (v1, v0, beta) are often deprecated but left running. They usually lack the modern security controls, rate limiting, and authorization checks present in the new versions.",
    whatToDoNow: [
      "Change /v2/ to /v1/ or /v3/ on all endpoints you test",
      "Look for endpoints that were removed in v2 (e.g. /v1/users/export) and test them",
      "Test BOLA/IDOR on v1. The ID checks might be missing there.",
      "Check if v1 accepts mass assignment parameters that v2 patches"
    ],
    decisionTree: {
      question: "Does the /v1/ endpoint respond to requests?",
      yes: {
        action: "Test for IDOR and Mass Assignment.",
        next: {
          question: "Are authorization checks bypassed in v1?",
          yes: { action: "Use v1 to perform unauthorized actions (e.g., deleting other users, accessing admin data)." },
          no: { action: "Check if v1 returns MORE data than v2 (Excessive Data Exposure)." }
        }
      },
      no: {
        action: "The API routing might still accept weird headers like 'Accept: application/vnd.api.v1+json'."
      }
    },
    attacksUnlocked: ["BOLA / IDOR", "Mass Assignment", "Bypass Security Controls"],
    connectsTo: ["Privilege Escalation"]
  },
  {
    id: "features-xml-parsing",
    category: "features",
    finding: "Target parses XML data (SOAP, SAML, SVG uploads, or explicit XML)",
    why: "XML parsers often blindly process external entities (XXE). This allows you to read local files on the server or force the server to make internal network requests (SSRF).",
    whatToDoNow: [
      "Inject a classic XXE payload to read /etc/passwd: `<!DOCTYPE foo [<!ENTITY xxe SYSTEM \"file:///etc/passwd\">]>`",
      "If the app expects JSON, change the Content-Type to application/xml and send XML anyway",
      "If you can upload images, upload an SVG file containing an XXE payload",
      "If it's a blind XXE, use an Out-Of-Band (OOB) payload to ping your Burp Collaborator"
    ],
    decisionTree: {
      question: "Is the parsed entity reflected in the server's response?",
      yes: {
        action: "Classic XXE. Read internal files like /etc/passwd, C:/windows/win.ini, or the app's config files.",
        next: null
      },
      no: {
        action: "Blind XXE. The entity is not reflected.",
        next: {
          question: "Can you trigger an error message?",
          yes: { action: "Error-Based XXE. Use an invalid file path in the DTD to force the parser to leak file contents in the error trace." },
          no: { action: "OOB XXE. Force the server to send the file contents to your external server via HTTP/DNS requests." }
        }
      }
    },
    attacksUnlocked: ["XML External Entity (XXE)", "SSRF via XXE", "Local File Read"],
    connectsTo: ["Internal Network Scanning"]
  },
  {
    id: "tech-firebase-db",
    category: "tech",
    finding: "Found a Firebase Database URL (e.g. project.firebaseio.com)",
    why: "Firebase databases often have misconfigured security rules, allowing unauthenticated users to read or write the entire JSON tree.",
    whatToDoNow: [
      "Append /.json to the end of the URL (e.g. https://project.firebaseio.com/.json)",
      "If it says 'Permission Denied', try accessing specific nodes like /users.json or /config.json",
      "Attempt to send a PUT or POST request to /test.json to see if write access is allowed",
      "Decompile the mobile app (APK) to find the exact database paths if the root is protected"
    ],
    decisionTree: {
      question: "Can you read the root directory (/.json)?",
      yes: {
        action: "CRITICAL: You just downloaded the entire database. Look for admin credentials, user PII, and API keys.",
        next: null
      },
      no: {
        action: "Root is protected. Try specific paths.",
        next: {
          question: "Can you WRITE to any path?",
          yes: { action: "You can corrupt data, overwrite admin roles, or inject malicious payloads into data consumed by the frontend (Stored XSS)." },
          no: { action: "Look for the firebase API key and try to use the REST API to bypass client-side restrictions." }
        }
      }
    },
    attacksUnlocked: ["Data Breach", "Unauthorized Data Modification", "Privilege Escalation"],
    connectsTo: ["Full Application Compromise"]
  },
  {
    id: "features-websocket",
    category: "features",
    finding: "Target uses WebSockets (wss://)",
    why: "WebSockets often lack traditional CSRF protection and HTTP authorization headers. They maintain a stateful connection where inputs are often not sanitized properly.",
    whatToDoNow: [
      "Intercept the WS connection in Burp Suite and capture the messages",
      "Check for Cross-Site WebSocket Hijacking (CSWSH) by connecting from a different origin",
      "Inject XSS payloads into the WS messages. If it's a chat app, it will trigger on other clients instantly",
      "Inject SQLi into WS JSON parameters — developers often forget to parameterize WS inputs"
    ],
    decisionTree: {
      question: "Does the WebSocket connection rely solely on Cookies for authentication?",
      yes: {
        action: "Test for Cross-Site WebSocket Hijacking (CSWSH).",
        next: {
          question: "Can you initiate a connection from an attacker-controlled origin?",
          yes: { action: "CRITICAL: You can hijack the victim's session, read their incoming messages, and send messages on their behalf." },
          no: { action: "Origin header is validated. Look for XSS or SQLi in the message payloads." }
        }
      },
      no: {
        action: "Authentication is passed in the initial WS handshake or first message (e.g. JWT). Test for injection vulnerabilities in the data frames."
      }
    },
    attacksUnlocked: ["Cross-Site WebSocket Hijacking", "Blind SQLi", "Stored XSS"],
    connectsTo: ["Session Hijacking"]
  },
  {
    id: "endpoints-graphql-introspection",
    category: "endpoints",
    finding: "GraphQL Introspection is Enabled",
    why: "Introspection allows you to query the GraphQL server for its entire schema. This reveals all queries, mutations, types, and hidden internal fields.",
    whatToDoNow: [
      "Send a full introspection query using a tool like GraphQL Voyager or InQL",
      "Look for mutations ending in 'Admin', 'Internal', 'UpdateRole', or 'Delete'",
      "Look for deprecated fields or hidden queries that aren't exposed in the UI",
      "Map out the exact arguments required for sensitive mutations"
    ],
    decisionTree: {
      question: "Did the introspection reveal sensitive mutations (e.g., updateRole, deleteUser)?",
      yes: {
        action: "Attempt to execute the mutation.",
        next: {
          question: "Are authorization checks enforced on the mutation?",
          yes: { action: "Access denied. Try to find IDOR vulnerabilities by passing other users' IDs into standard queries." },
          no: { action: "CRITICAL: Privilege Escalation or Unauthorized Action achieved. You can modify the system state." }
        }
      },
      no: {
        action: "Look for Information Disclosure. Check if queries can return hidden fields like 'passwordHash', 'ssn', or 'internalNotes'."
      }
    },
    attacksUnlocked: ["Information Disclosure", "Broken Object Level Authorization (BOLA)", "Privilege Escalation"],
    connectsTo: ["API Mapping"]
  }
];
