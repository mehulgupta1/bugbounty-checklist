export const analyzeResponse = (rawHttp) => {
  if (!rawHttp || typeof rawHttp !== "string") return [];

  const findings = [];
  const lines = rawHttp.split('\n');
  
  // Separate headers from body
  let headerBlock = "";
  let bodyBlock = "";
  let inBody = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "" && !inBody) {
      inBody = true;
      continue;
    }
    if (inBody) {
      bodyBlock += line + "\n";
    } else {
      headerBlock += line + "\n";
    }
  }

  // If there are no clear headers, maybe the whole thing is just text/json.
  // We'll search across both just in case, but target specifically.
  const fullText = rawHttp;

  // 1. JWT Tokens
  if (/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/.test(fullText)) {
    findings.push({
      title: "JWT Token Found",
      severity: "critical",
      description: "A JSON Web Token was found in the response. Decode it at jwt.io. Test if the server accepts 'alg:none', 'alg:none' (case variations), or brute-force the HS256 secret using Hashcat."
    });
  }

  // 2. Missing Cookie Flags
  const setCookieMatches = headerBlock.match(/Set-Cookie:.*?(?=\n|$)/gi);
  if (setCookieMatches) {
    setCookieMatches.forEach(cookieLine => {
      const isMissingHttpOnly = !/HttpOnly/i.test(cookieLine);
      const isMissingSecure = !/Secure/i.test(cookieLine);
      const isMissingSameSite = !/SameSite/i.test(cookieLine);

      if (isMissingHttpOnly || isMissingSecure || isMissingSameSite) {
        let missing = [];
        if (isMissingHttpOnly) missing.push("HttpOnly");
        if (isMissingSecure) missing.push("Secure");
        if (isMissingSameSite) missing.push("SameSite");
        
        findings.push({
          title: "Insecure Cookie Configuration",
          severity: "medium",
          description: `Set-Cookie header is missing flags: ${missing.join(", ")}. If HttpOnly is missing, XSS can steal the session. If SameSite is missing, test for CSRF.`
        });
      }
    });
  }

  // 3. Vulnerable Server Versions
  const serverHeader = headerBlock.match(/Server:\s*(.*)/i);
  if (serverHeader) {
    const serverVal = serverHeader[1].trim();
    if (/Apache\/2\.4\.(49|50)/i.test(serverVal)) {
      findings.push({
        title: "Vulnerable Apache Version",
        severity: "critical",
        description: `Server is running ${serverVal}. This version is vulnerable to unauthenticated Path Traversal and RCE (CVE-2021-41773). Test payload: /cgi-bin/.%2e/%2e%2e/%2e%2e/%2e%2e/etc/passwd`
      });
    } else if (/(nginx|apache|iis)\/[0-9]+\.[0-9]+/i.test(serverVal)) {
      findings.push({
        title: "Server Version Leakage",
        severity: "low",
        description: `Server header leaks exact version: ${serverVal}. Search Exploit-DB for known CVEs for this specific version.`
      });
    }
  }

  // 4. X-Powered-By
  const poweredByHeader = headerBlock.match(/X-Powered-By:\s*(.*)/i);
  if (poweredByHeader) {
    findings.push({
      title: "Technology Stack Leakage",
      severity: "low",
      description: `X-Powered-By header reveals: ${poweredByHeader[1].trim()}. Use this to tailor your attacks (e.g. PHP object injection if PHP, Deserialization if Java/ASP.NET).`
    });
  }

  // 5. CORS Wildcard
  if (/Access-Control-Allow-Origin:\s*\*/i.test(headerBlock)) {
    // Only high severity if credentials are also allowed
    const allowCreds = /Access-Control-Allow-Credentials:\s*true/i.test(headerBlock);
    if (allowCreds) {
      findings.push({
        title: "Critical CORS Misconfiguration",
        severity: "critical",
        description: "ACAO is * AND Allow-Credentials is true (Wait, technically browsers block this combo, but if dynamically reflected as Origin, it's vulnerable). Test reflecting the Origin header exactly."
      });
    } else {
      findings.push({
        title: "Overly Permissive CORS",
        severity: "medium",
        description: "Access-Control-Allow-Origin is set to *. Any domain can read this response. Check if sensitive data is returned in the body."
      });
    }
  }

  // 6. SQL Errors
  const sqlPatterns = [
    /SQL syntax.*MySQL/i,
    /Warning.*(?:mssql|mysql|pg)_/i,
    /PostgreSQL.*ERROR/i,
    /ORA-[0-9][0-9][0-9][0-9]/i,
    /SQLite\/JDBCDriver/i,
    /System\.Data\.SqlClient\.SqlException/i,
    /Unclosed quotation mark after the character string/i
  ];
  for (let pattern of sqlPatterns) {
    if (pattern.test(bodyBlock)) {
      findings.push({
        title: "Database Error Detected",
        severity: "high",
        description: "A database error was leaked in the response. This strongly indicates SQL Injection. Inject ' or \" or time-based payloads like SLEEP(5) to confirm execution."
      });
      break;
    }
  }

  // 7. Internal IPs
  const internalIpRegex = /(^|\s|["':])((10\.\d{1,3}\.\d{1,3}\.\d{1,3})|(192\.168\.\d{1,3}\.\d{1,3})|(172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}))($|\s|["':])/g;
  if (internalIpRegex.test(fullText)) {
    findings.push({
      title: "Internal IP Address Leak",
      severity: "medium",
      description: "An internal IP address (10.x, 192.168.x, 172.x) was found. Use this for SSRF targeting or internal network mapping."
    });
  }

  // 8. Sensitive JSON fields
  const sensitiveRegex = /"(password|passwd|secret|api_key|apikey|private_key|aws_access_key_id)"\s*:\s*".+?"/i;
  if (sensitiveRegex.test(bodyBlock)) {
    findings.push({
      title: "Sensitive Data in JSON",
      severity: "critical",
      description: "Potential passwords, secrets, or API keys found in the response body. Verify if they are dummy values or actual leaked credentials."
    });
  }

  // 9. Stack Traces / Debug Mode
  if (/at [a-zA-Z0-9_\.]+\((.+):(\d+):(\d+)\)/.test(bodyBlock) || /Traceback \(most recent call last\)/.test(bodyBlock) || /java\.lang\.[A-Za-z]+Exception/.test(bodyBlock)) {
    findings.push({
      title: "Verbose Stack Trace",
      severity: "high",
      description: "Application crashed and leaked a stack trace. This exposes file paths, internal logic, and component versions. Great starting point for LFI or RCE."
    });
  }

  // 10. Graphql Introspection
  if (/"__schema"\s*:\s*{/i.test(bodyBlock)) {
    findings.push({
      title: "GraphQL Introspection Leak",
      severity: "high",
      description: "GraphQL introspection data found. Load this response into GraphQL Voyager to visually map the entire API schema. Look for hidden mutations."
    });
  }

  return findings;
};
