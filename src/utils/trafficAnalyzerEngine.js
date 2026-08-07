export const analyzeTraffic = (requestText, responseText) => {
  const findings = [];
  
  const reqLines = requestText ? requestText.split('\n').map(l => l.trim()) : [];
  const resLines = responseText ? responseText.split('\n').map(l => l.trim()) : [];

  let reqMethod = "";
  let reqPath = "";
  let reqHeaders = {};
  let reqBody = "";
  let reqParams = new Map();

  let resStatus = "";
  let resHeaders = {};
  let resBody = "";

  if (reqLines.length > 0) {
    const firstLine = reqLines[0].split(' ');
    if (firstLine.length >= 2) {
      reqMethod = firstLine[0];
      reqPath = firstLine[1];
    }
    
    let i = 1;
    for (; i < reqLines.length; i++) {
      if (reqLines[i] === "") break;
      const [key, ...rest] = reqLines[i].split(':');
      if (key && rest.length) reqHeaders[key.toLowerCase().trim()] = rest.join(':').trim();
    }
    reqBody = reqLines.slice(i + 1).join('\n');

    if (reqPath.includes('?')) {
      const qs = reqPath.split('?')[1];
      const pairs = qs.split('&');
      pairs.forEach(p => {
        const [k, v] = p.split('=');
        if (k && v) reqParams.set(k, decodeURIComponent(v));
      });
    }

    if (reqHeaders['content-type'] && reqHeaders['content-type'].includes('application/json')) {
      try {
        const jsonBody = JSON.parse(reqBody);
        Object.keys(jsonBody).forEach(k => {
          if (typeof jsonBody[k] === 'string' || typeof jsonBody[k] === 'number') {
            reqParams.set(k, String(jsonBody[k]));
          }
        });
      } catch (e) {}
    }
  }

  if (resLines.length > 0) {
    resStatus = resLines[0];
    
    let i = 1;
    for (; i < resLines.length; i++) {
      if (resLines[i] === "") break;
      const [key, ...rest] = resLines[i].split(':');
      if (key && rest.length) resHeaders[key.toLowerCase().trim()] = rest.join(':').trim();
    }
    resBody = resLines.slice(i + 1).join('\n');
  }

  if (reqTextProvided(requestText)) {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(reqMethod)) {
      if (!reqHeaders['x-csrf-token'] && !reqHeaders['csrf-token'] && !reqBody.includes('csrf')) {
        findings.push({
          severity: "high",
          title: "Missing CSRF Token in Request",
          description: `This ${reqMethod} request modifies state but doesn't appear to include an anti-CSRF token in the headers or body.`
        });
      }
    }

    if (reqHeaders['authorization'] && reqHeaders['authorization'].startsWith('Basic ')) {
      findings.push({
        severity: "medium",
        title: "Basic Authentication Detected",
        description: "Request uses Basic Auth. Ensure this is transmitted over HTTPS, otherwise the credentials (base64) are easily intercepted."
      });
    }

    if (reqHeaders['content-type'] === 'application/json' && reqBody && !reqBody.trim().startsWith('{') && !reqBody.trim().startsWith('[')) {
      findings.push({
        severity: "low",
        title: "Content-Type Mismatch",
        description: "Header claims application/json, but the body does not appear to be valid JSON."
      });
    }
  }

  if (resTextProvided(responseText)) {
    if (!resHeaders['strict-transport-security']) {
      findings.push({ severity: "low", title: "Missing HSTS Header", description: "Strict-Transport-Security header is missing, allowing downgrade attacks." });
    }
    if (!resHeaders['x-frame-options'] && !resHeaders['content-security-policy']) {
      findings.push({ severity: "medium", title: "Missing Clickjacking Protection", description: "No X-Frame-Options or CSP frame-ancestors. The page can be embedded in an iframe." });
    }

    if (resHeaders['server']) {
      findings.push({ severity: "low", title: "Server Header Leak", description: `Server identifies as: ${resHeaders['server']}` });
    }
    if (resHeaders['x-powered-by']) {
      findings.push({ severity: "low", title: "X-Powered-By Leak", description: `Technology stack leaked: ${resHeaders['x-powered-by']}` });
    }

    if (resBody.includes('BEGIN RSA PRIVATE KEY')) {
      findings.push({ severity: "critical", title: "Exposed Private Key", description: "RSA Private Key found in response body!" });
    }
    if (resBody.includes('aws_access_key_id')) {
      findings.push({ severity: "critical", title: "Exposed AWS Keys", description: "AWS Access Key found in response body!" });
    }
    if (resBody.includes('sql syntax') || resBody.includes('mysql_fetch_array')) {
      findings.push({ severity: "high", title: "SQL Error Dump", description: "Verbose SQL error found. Highly indicative of SQL Injection." });
    }
  }

  if (reqTextProvided(requestText) && resTextProvided(responseText)) {
    reqParams.forEach((value, key) => {
      if (value.length > 3 && resBody.includes(value)) {
        if (resHeaders['content-type'] && resHeaders['content-type'].includes('text/html')) {
          findings.push({
            severity: "high",
            title: "Unescaped Reflected Input (XSS)",
            description: `The request parameter "${key}=${value}" is reflected in the HTML response. If unescaped, this is Reflected XSS. Try setting ${key}="><script>alert(1)</script>`
          });
        } else {
          findings.push({
            severity: "medium",
            title: "Input Reflection",
            description: `The request parameter "${key}=${value}" is reflected in the response body. Check if you can inject JSON or Headers.`
          });
        }
      }
    });

    if (reqHeaders['cookie'] && resHeaders['set-cookie']) {
      findings.push({
        severity: "low",
        title: "Cookie Modification",
        description: "The server is setting or modifying cookies that were sent in the request. Check if session IDs are rotating properly."
      });
    }
  }

  return findings;
};

const reqTextProvided = (txt) => txt && txt.trim().length > 0;
const resTextProvided = (txt) => txt && txt.trim().length > 0;
