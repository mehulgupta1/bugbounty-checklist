export const DEFAULT_HOW_TO_TEST = {
  "Use subfinder for passive subdomain enumeration": "Run: subfinder -d target.com -o subdomains.txt\nInstall: go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest",
  "Use amass for deep subdomain discovery with OSINT integration": "Run: amass enum -passive -d target.com -o amass_out.txt\nFor active: amass enum -active -d target.com",
  "Query crt.sh certificate transparency logs for subdomain enumeration": "Visit: https://crt.sh/?q=%25.target.com\nOr via curl: curl -s 'https://crt.sh/?q=%.target.com&output=json' | jq '.[].name_value' | sort -u",
  "Attempt DNS zone transfer (AXFR) on all authoritative nameservers": "1. Find nameservers: dig NS target.com\n2. Attempt transfer: dig axfr @ns1.target.com target.com\nIf successful, all DNS records are returned — critical finding.",
  "Check for subdomain takeover vulnerability on all discovered subdomains": "Run: subjack -w subdomains.txt -t 100 -timeout 30 -o results.txt -ssl\nOr: nuclei -l subdomains.txt -t takeovers/\nLook for CNAME pointing to unclaimed services (GitHub Pages, S3, Heroku, etc.)",
  "Run nmap TCP SYN scan on all 65535 ports for complete coverage": "sudo nmap -sS -p- --min-rate 5000 -oA full_scan target.com\nThen version scan on open ports:\nsudo nmap -sV -sC -p [open_ports] target.com",
  "Test for SQL injection in all input fields with single quote (')": "1. Insert ' in each input field, observe error\n2. Use sqlmap: sqlmap -u 'https://target.com/page?id=1' --batch\n3. For POST: sqlmap -u 'https://target.com/api' --data 'param=value' --level 3",
  "Test for reflected XSS in all URL parameters with basic payloads": "1. Start with: ?param=<script>alert(1)</script>\n2. If filtered, try: ?param=<img src=x onerror=alert(1)>\n3. Check if input is reflected in HTML source",
  "Test for SSRF in URL parameters that fetch remote resources": "1. Find URL parameters (url=, src=, fetch=, import=, redirect=)\n2. Test with Burp Collaborator URL\n3. Try internal: url=http://127.0.0.1:80\n4. AWS metadata: url=http://169.254.169.254/latest/meta-data/",
};

export const DEFAULT_GUIDE = "No specific testing guide available.\n\nGeneral approach:\n1. Intercept the request in Burp Suite\n2. Identify the relevant parameters\n3. Apply appropriate payload\n4. Observe response for anomalies\n5. Document and report findings";
