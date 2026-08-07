export const FLOWS_DATA = [
  {
    id: "new_target",
    title: "New target",
    subtitle: "Where do I start?",
    icon: "🌐",
    steps: [
      { id: "nt_1", title: "Identify tech stack", description: "Determine the backend languages, frameworks, web servers, and WAFs in use.", tools: ["Wappalyzer", "WhatWeb", "Burp Suite"], severity: "low" },
      { id: "nt_2", title: "Subdomain enumeration", description: "Discover all subdomains associated with the target domain. Look for dev, staging, or forgotten instances.", tools: ["Subfinder", "Amass", "crt.sh"], severity: "medium" },
      { id: "nt_3", title: "Port scan", description: "Scan the discovered infrastructure for open ports and running services beyond 80/443.", tools: ["Nmap", "Naabu", "Masscan"], severity: "medium" },
      { id: "nt_4", title: "Crawl endpoints", description: "Spider the application to map out the attack surface, hidden routes, and expected parameters.", tools: ["Katana", "Hakrawler", "Gau"], severity: "high" },
      { id: "nt_5", title: "Extract JS endpoints", description: "Parse all JavaScript files to extract hidden API routes, endpoints, and sometimes hardcoded secrets.", tools: ["LinkFinder", "SecretFinder"], severity: "high" },
      { id: "nt_6", title: "Screenshot subdomains", description: "Take automated screenshots of all discovered web servers to quickly visually identify interesting targets.", tools: ["Aquatone", "Gowitness", "EyeWitness"], severity: "low" },
      { id: "nt_7", title: "Check exposed files", description: "Run a quick brute-force for common sensitive files like .git, .env, and /backup.zip.", tools: ["ffuf", "Dirsearch", "Nuclei"], severity: "critical" },
      { id: "nt_8", title: "Map auth flows", description: "Document login, registration, password reset, and OAuth flows for the main application.", tools: ["Burp Suite", "Browser"], severity: "high" }
    ]
  },
  {
    id: "found_param",
    title: "Found a parameter",
    subtitle: "What do I test on it?",
    icon: "🎛️",
    steps: [
      { id: "fp_1", title: "Identify the parameter type", description: "Is it an ID? A filename? A URL? A search query? A flag/boolean? Each type has its own attack class.", tools: [], severity: null },
      { id: "fp_2", title: "Note where it appears in the response", description: "Is the value reflected back? Does it change what data is returned? Does it affect behavior silently?", tools: [], severity: null },
      { id: "fp_3", title: "Test for IDOR (if ID)", description: "Change integer values ±1. Try another user's known IDs. Test on GET, POST, PUT, DELETE separately.", tools: [], severity: "high" },
      { id: "fp_4", title: "Test for path traversal (if filename)", description: "Try ../../../etc/passwd. Try URL-encoded variants. Try null bytes if older stack.", tools: [], severity: "critical" },
      { id: "fp_5", title: "Test for SSRF (if URL/domain)", description: "Try http://169.254.169.254/latest/meta-data/ for cloud metadata. Try internal IPs.", tools: [], severity: "critical" },
      { id: "fp_6", title: "Test for injection (if string query)", description: "Try SQLi payloads on search/filter/sort. Try XSS if reflected. Try SSTI if appears in template.", tools: [], severity: "critical" },
      { id: "fp_7", title: "Test for open redirect (if redirect param)", description: "Try https://evil.com as value. Test URL encoding, double encoding, path confusion.", tools: [], severity: "medium" },
      { id: "fp_8", title: "Document and rate the finding", description: "If confirmed, calculate CVSS, write PoC with two accounts, and report immediately.", tools: [], severity: null }
    ]
  },
  {
    id: "auth_token",
    title: "Got an auth token",
    subtitle: "How do I attack it?",
    icon: "🔑",
    steps: [
      { id: "at_1", title: "Decode token", description: "Base64 decode the token to inspect its header and payload claims (e.g., user_id, role, alg).", tools: ["jwt.io", "Burp Inspector"], severity: null },
      { id: "at_2", title: "Try alg: none", description: "Modify the header algorithm to 'none', remove the signature, and try to access privileged endpoints.", tools: ["JSON Web Token Attacker"], severity: "critical" },
      { id: "at_3", title: "Try RS256→HS256 confusion", description: "Change the algorithm from asymmetric to symmetric and sign it with the public key of the server.", tools: ["jwt_tool"], severity: "critical" },
      { id: "at_4", title: "Crack weak HS256 secret", description: "If the token uses HS256, attempt offline brute-forcing of the secret key using a wordlist.", tools: ["Hashcat", "John the Ripper"], severity: "critical" },
      { id: "at_5", title: "Tamper with claims", description: "Without breaking the signature (if possible), try changing claims like 'role':'user' to 'role':'admin'.", tools: ["Burp Repeater"], severity: "high" },
      { id: "at_6", title: "Check expiry", description: "Wait for the token's 'exp' time to pass, then attempt to use it. Many backends fail to validate the expiration.", tools: ["Burp Repeater"], severity: "medium" },
      { id: "at_7", title: "Test token after logout", description: "Log out of the application, then try to use the same token again to check for improper token invalidation.", tools: ["Burp Repeater"], severity: "medium" }
    ]
  },
  {
    id: "file_upload",
    title: "Found a file upload",
    subtitle: "What's the risk?",
    icon: "📄",
    steps: [
      { id: "fu_1", title: "Test file extension bypass", description: "Try uploading .php5, .phtml, .php%00.jpg, or .jspx instead of the blocked extensions.", tools: ["Burp Intruder"], severity: "critical" },
      { id: "fu_2", title: "Test content-type spoofing", description: "Change the Content-Type header to image/jpeg while uploading a .php file.", tools: ["Burp Repeater"], severity: "high" },
      { id: "fu_3", title: "Test magic bytes manipulation", description: "Add GIF89a; to the very beginning of your malicious PHP script to fool file signature checks.", tools: ["Hex Editor"], severity: "critical" },
      { id: "fu_4", title: "Test path injection", description: "Modify the filename parameter to upload to a different directory: filename=\"../../var/www/html/shell.php\".", tools: ["Burp Repeater"], severity: "critical" },
      { id: "fu_5", title: "Test XXE (if SVG/XML allowed)", description: "Upload a malicious SVG image containing an XXE payload to read internal files.", tools: ["Burp Suite"], severity: "high" },
      { id: "fu_6", title: "Test XSS via filename", description: "Set the filename to '\"><img src=x onerror=alert(1)>.jpg and see if it executes in the admin panel.", tools: ["Browser"], severity: "medium" }
    ]
  },
  {
    id: "bypass_403",
    title: "Got a 403 / 401",
    subtitle: "How do I bypass it?",
    icon: "🛡️",
    steps: [
      { id: "b403_1", title: "Header manipulation", description: "Add headers like X-Forwarded-For: 127.0.0.1, X-Originating-IP: 127.0.0.1, or Client-IP: 127.0.0.1.", tools: ["Burp Intruder"], severity: "high" },
      { id: "b403_2", title: "Path normalization bypass", description: "Try /admin/., /admin/./, /admin/..;/, /%2e/admin, or /admin%20.", tools: ["ffuf"], severity: "high" },
      { id: "b403_3", title: "Case switching", description: "Change the case of the endpoint: /Admin, /aDmin, /ADMIN.", tools: ["Burp Repeater"], severity: "medium" },
      { id: "b403_4", title: "Method overriding", description: "Use POST but add X-HTTP-Method-Override: GET or use an obscure method like INVENTED.", tools: ["Burp Repeater"], severity: "medium" },
      { id: "b403_5", title: "URL prefix/suffix", description: "Try adding .json, .html, or / to the end of the URL. Or prefix with /api/v1/.", tools: ["Burp Suite"], severity: "low" }
    ]
  },
  {
    id: "found_api",
    title: "Found an API",
    subtitle: "Full API test flow",
    icon: "🖧",
    steps: [
      { id: "api_1", title: "Find documentation", description: "Look for /swagger.json, /api-docs, /graphql, or WSDL files to map the entire API structure.", tools: ["Dirsearch"], severity: "low" },
      { id: "api_2", title: "Test Mass Assignment", description: "Add unprompted fields like 'is_admin': true or 'role': 'admin' to POST/PUT JSON requests.", tools: ["Burp Repeater"], severity: "critical" },
      { id: "api_3", title: "Test Broken Object Level Auth (IDOR)", description: "Iterate through user IDs or resource UUIDs to access data belonging to other accounts.", tools: ["Autorize"], severity: "high" },
      { id: "api_4", title: "Test HTTP method switching", description: "If GET /api/user fails, try POST /api/user, PUT /api/user, or DELETE /api/user.", tools: ["Burp Intruder"], severity: "medium" },
      { id: "api_5", title: "Test old API versions", description: "If /v2/ requires strict auth, check if /v1/ or /v0/ endpoints still exist and have weaker checks.", tools: ["Burp Suite"], severity: "high" }
    ]
  },
  {
    id: "password_reset",
    title: "Password reset flow",
    subtitle: "Find auth weaknesses",
    icon: "✉️",
    steps: [
      { id: "pr_1", title: "Test Host Header Poisoning", description: "Intercept the reset request and change the Host header to evil.com. See if the emailed link points to your server.", tools: ["Burp Suite"], severity: "critical" },
      { id: "pr_2", title: "Test Token Predictability", description: "Generate 10 password reset tokens and look for patterns (e.g., base64 encoded timestamps, weak RNG).", tools: ["Burp Sequencer"], severity: "critical" },
      { id: "pr_3", title: "Test Token Expiry", description: "Wait 24 hours and see if an old password reset token still works.", tools: ["Browser"], severity: "medium" },
      { id: "pr_4", title: "Test Parameter Pollution", description: "Send email=victim@a.com&email=attacker@a.com. The backend might use the first to generate the token and the second to email it.", tools: ["Burp Repeater"], severity: "high" },
      { id: "pr_5", title: "Test Session Fixation", description: "Does changing the password invalidate active sessions? If not, it's a vulnerability.", tools: ["Browser"], severity: "high" }
    ]
  },
  {
    id: "odd_response",
    title: "Response looks odd",
    subtitle: "What does it mean?",
    icon: "🔄",
    steps: [
      { id: "or_1", title: "Check for SQL Errors", description: "If you see 'SQL syntax', 'ORA-', or 'PostgreSQL', you have SQL injection. Use sleep() to confirm.", tools: ["SQLMap"], severity: "high" },
      { id: "or_2", title: "Check for Stack Traces", description: "If you see Java/Python/Node stack traces, look for leaked internal file paths and software versions.", tools: [], severity: "medium" },
      { id: "or_3", title: "Check for Reflected Input", description: "If your input was returned in the HTML unescaped, it's XSS. If it was returned in JSON, it might be client-side XSS.", tools: ["XSStrike"], severity: "high" },
      { id: "or_4", title: "Check for Time Delays", description: "If the response took 10 seconds longer than usual, you might have triggered a blind SQLi, command injection, or SSRF.", tools: ["Burp Suite"], severity: "critical" }
    ]
  },
  {
    id: "graphql_found",
    title: "GraphQL Endpoint",
    subtitle: "Advanced introspection",
    icon: "⚛️",
    steps: [
      { id: "gq_1", title: "Enable Introspection", description: "Send a standard Introspection query. If it works, load the result into GraphQL Voyager to map the API.", tools: ["InQL", "GraphQL Voyager"], severity: "high" },
      { id: "gq_2", title: "Test Field Suggestions", description: "If introspection is disabled, type a wrong field name. If it says 'Did you mean...', you can brute force the schema.", tools: ["Clairvoyance"], severity: "medium" },
      { id: "gq_3", title: "Test Aliases for Rate Limit Bypass", description: "Use GraphQL aliases to request the same login mutation 100 times in a single HTTP request to bypass rate limiting.", tools: ["Burp Suite"], severity: "high" },
      { id: "gq_4", title: "Find Hidden Mutations", description: "Look for administrative mutations like 'deleteUser' or 'updateRole' that shouldn't be exposed.", tools: [], severity: "critical" }
    ]
  },
  {
    id: "exposed_git",
    title: "Exposed .git",
    subtitle: "Source code leak",
    icon: "📂",
    steps: [
      { id: "eg_1", title: "Confirm .git accessible", description: "Access /.git/HEAD in the browser to ensure the directory is actually readable and not a false positive.", tools: ["Browser", "Curl"], severity: "medium" },
      { id: "eg_2", title: "Dump repo with git-dumper", description: "Recursively download the entire .git directory structure to rebuild the repository locally.", tools: ["git-dumper"], severity: "critical" },
      { id: "eg_3", title: "Search hardcoded secrets", description: "Scan the recovered source code for hardcoded API keys, database passwords, and AWS credentials.", tools: ["TruffleHog", "Gitleaks"], severity: "critical" },
      { id: "eg_4", title: "Check commit history", description: "Run 'git log -p' to find sensitive information that was committed and later removed.", tools: ["Git"], severity: "high" },
      { id: "eg_5", title: "Find .env and config files", description: "Look for .env, config.php, or settings.py files that might have been accidentally committed.", tools: ["Grep"], severity: "critical" },
      { id: "eg_6", title: "Map hidden API endpoints", description: "Review the routing controllers to find administrative endpoints that aren't exposed in the frontend.", tools: ["VS Code", "Grep"], severity: "high" },
      { id: "eg_7", title: "Check for private keys", description: "Look for id_rsa or .pem files that could grant SSH access to production servers.", tools: ["Grep"], severity: "critical" }
    ]
  },
  {
    id: "idor_found",
    title: "IDOR found",
    subtitle: "Cross-account access",
    icon: "🎭",
    steps: [
      { id: "if_1", title: "Set up two accounts", description: "Create Account A (attacker) and Account B (victim) to properly test cross-account authorization.", tools: ["Browser", "Burp Suite"], severity: null },
      { id: "if_2", title: "Confirm read IDOR GET", description: "From Account A's session, attempt to access Account B's private resources using B's IDs.", tools: ["Burp Repeater", "Autorize"], severity: "high" },
      { id: "if_3", title: "Test write IDOR PUT/PATCH", description: "Attempt to modify Account B's data (e.g., updating their email or profile) from Account A's session.", tools: ["Burp Repeater"], severity: "critical" },
      { id: "if_4", title: "Test delete IDOR", description: "Attempt to delete objects belonging to Account B using DELETE requests with their IDs.", tools: ["Burp Repeater"], severity: "critical" },
      { id: "if_5", title: "Test indirect IDOR", description: "If direct IDs are protected, check if the ID is leaked or referenced in other API calls, or try parameter pollution (id=A&id=B).", tools: ["Burp Repeater"], severity: "high" },
      { id: "if_6", title: "Enumerate ID range", description: "Automate requests across a large ID range (e.g., 1 to 1000) to prove the blast radius of the vulnerability.", tools: ["Burp Intruder", "ffuf"], severity: "high" },
      { id: "if_7", title: "Write safe PoC report", description: "Document the exact steps to reproduce without causing destruction to actual user data.", tools: ["Markdown"], severity: null }
    ]
  },
  {
    id: "dev_subdomain",
    title: "Dev/Staging Subdomain Found",
    subtitle: "Internal infrastructure",
    icon: "🚧",
    steps: [
      { id: "ds_1", title: "Check for debug endpoints", description: "Try accessing /debug, /console, /.env, /phpinfo.php, /elmah.axd to find sensitive configuration.", tools: ["ffuf", "Dirsearch"], severity: "high" },
      { id: "ds_2", title: "Try default credentials", description: "Test admin/admin, admin/password, test/test. Dev environments often skip strong password requirements.", tools: ["Burp Intruder"], severity: "critical" },
      { id: "ds_3", title: "Re-test WAF-blocked payloads", description: "Re-test all payloads (SQLi, XSS) that failed on the main domain. The WAF is likely disabled here.", tools: ["SQLMap", "XSStrike"], severity: "high" },
      { id: "ds_4", title: "Check for shared Database", description: "Create test data (e.g., register an account) on the staging site, and check if it appears on production.", tools: ["Browser"], severity: "critical" },
      { id: "ds_5", title: "Look for API Documentation", description: "Access /swagger, /api-docs, /graphql/playground. Dev environments usually expose internal APIs.", tools: ["Browser"], severity: "medium" },
      { id: "ds_6", title: "Analyze Response Headers", description: "Look for X-Debug-Token, X-Powered-By, or detailed stack traces that leak framework versions.", tools: ["Burp Suite"], severity: "low" }
    ]
  }
];
