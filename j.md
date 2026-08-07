1. Test for open redirect in URL redirect parameters (?url=, ?redirect=)Steps:

Crawl the app in Burp. Go to Proxy → HTTP History, filter by ?url=, ?redirect=, ?next=, ?return=, ?goto=, ?redir=, ?destination=, ?target=
Send the request to Repeater
Replace the param value with https://evil.com → send, check Response for Location: https://evil.com header with status 301/302/303/307
Also check response body for window.location = "https://evil.com" or <meta http-equiv="refresh" content="0;url=https://evil.com">
If the app uses a whitelist (only allows target.com), try: https://target.com.evil.com, https://evil.com?target.com, https://evil.com#target.com
Try all redirect param names in combination: ?url=https://evil.com&redirect=https://evil.com
Also test POST body params — some apps accept redirect_url in form body, not query string
Vulnerable When:

Location: https://evil.com appears in response headers with a 3xx status code
Browser (or Burp's follow redirect) lands on evil.com
Whitelist bypass works: https://target.com.evil.com is accepted and redirects to evil.com
Severity: Medium (High if chained with OAuth or session token theft)2. Test for open redirect with protocol-relative URLs (//evil.com)Steps:

Find any redirect param from previous step
Replace value with //evil.com — no http: or https: prefix at all
Send in Repeater. Check Location: response header
If rejected, try: ///evil.com, ////evil.com, //evil.com/%2F..
Try URL-encoded: %2F%2Fevil.com
Try: //evil.com\target.com — some parsers stop at \ and resolve evil.com as host
Check if filter only blocks http:// and https:// but not //
Vulnerable When:

Location: //evil.com in response — browser treats this as same-scheme redirect and loads evil.com
Server's filter blocks https://evil.com but accepts //evil.com
Encoded version %2F%2Fevil.com redirects to evil.com after server decodes
Severity: Medium3. Test for open redirect with URL encoding bypassSteps:

Take payload https://evil.com
URL-encode the colon and slashes: https%3A%2F%2Fevil.com
Send in Repeater as: ?redirect=https%3A%2F%2Fevil.com
If blocked, try encoding only the colon: https%3A//evil.com
Try encoding only slashes: https:%2F%2Fevil.com
Try encoding the dot: https://evil%2Ecom
Try mixed: https%3A%2F%2Fevil%2Ecom
Check Location: header — server decodes then redirects
Vulnerable When:

Filter runs on raw input (sees https%3A%2F%2Fevil.com, doesn't match https://) and passes it
Server decodes the value, then redirects — Location: https://evil.com
Any partial encoding variant lands on evil.com
Severity: Medium4. Test for open redirect with double encoding bypassSteps:

Single-encode: / = %2F
Double-encode: %2F → encode the % → %252F (so %252F decodes to %2F on first pass, then / on second)
Full double-encoded payload: https%253A%252F%252Fevil.com
Send: ?redirect=https%253A%252F%252Fevil.com
If server does two decode passes (web server + app layer), it sees https://evil.com
Also try triple encoding for deeply nested decode chains
Vulnerable When:

WAF/filter decodes once, sees https%3A%2F%2Fevil.com — doesn't flag it (no :// in raw check)
App decodes again, sees https://evil.com — executes redirect
Location: https://evil.com appears in final response
Severity: Medium5. Test for open redirect with URL fragment tricks (#)Steps:

Try: ?redirect=https://evil.com%23.target.com → decoded: https://evil.com#.target.com — host is evil.com, fragment is .target.com
Try: ?redirect=https://target.com#https://evil.com — filter sees target.com, browser goes there, then redirected again?
Try: ?redirect=https://evil.com#@target.com
Also test: ?redirect=%23https://evil.com (fragment-first, some parsers confused)
Check if server strips fragment before redirect validation or after
Vulnerable When:

Validation checks fragment portion (after #) for allowed domain, but actual host is evil.com
Server strips #fragment and redirects to base evil.com
Location: https://evil.com in response despite target.com appearing in the URL
Severity: Low–Medium6. Test for open redirect with @ symbol in URLSteps:

RFC 3986: in https://user:pass@host/path, everything before @ is credentials, everything after is the actual host
Payload: ?redirect=https://target.com@evil.com → browser host = evil.com, credentials = target.com
Try URL-encoded @: ?redirect=https://target.com%40evil.com
Try: ?redirect=https://target.com:password@evil.com/path
Try double @: ?redirect=https://target.com@evil.com@evil2.com
Observe Location: header — which host does it point to?
Vulnerable When:

Server's whitelist check sees target.com before the @ and approves it
Location: https://evil.com in response (server parsed real host correctly but filter didn't)
Browser navigates to evil.com using target.com as credentials (which it discards)
Severity: Medium7. Test for open redirect with backslash in URLSteps:

Try: ?redirect=https://evil.com\target.com
URL-encode backslash: ?redirect=https://evil.com%5Ctarget.com
Try: ?redirect=//evil.com\target.com (combined with protocol-relative)
Try: ?redirect=https:\\evil.com — some parsers treat \\ same as //
Check browser behavior: Chrome/Edge treat \ as / in URLs, so evil.com\target.com resolves to evil.com/target.com
Vulnerable When:

Server-side validation sees evil.com\target.com and considers target.com as the host (parsing after \ as path)
Browser treats \ as /, so user lands on evil.com
Filter allows it because it sees target.com in the URL string
Severity: Medium8. Test for open redirect with subdomain of targetSteps:

Check what domain validation the app uses — inspect JS source or error messages for clues like "must redirect to target.com"
If filter uses url.includes("target.com"): payload https://evil.com?target.com or https://evil.com#target.com
If filter uses url.endsWith("target.com"): payload https://evilXtarget.com or https://evil.target.com.attacker.com
If filter uses url.startsWith("https://target.com"): payload https://target.com.evil.com
Register target.com.evil.com — you control this subdomain, it passes the check
Vulnerable When:

includes("target.com") check bypassed by https://evil.com?q=target.com and redirect goes to evil.com
startsWith bypass: https://target.com.evil.com accepted and redirects to your domain
endsWith bypass: https://attackertarget.com matches and redirects there
Severity: Medium9. Test for open redirect with data: URI schemeSteps:

Payload: ?redirect=data:text/html,<script>alert(1)</script>
URL-encoded: ?redirect=data%3Atext%2Fhtml%2C%3Cscript%3Ealert(1)%3C%2Fscript%3E
If data: is filtered, try: Data:, DATA:, d%61ta:
Try: data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg== (base64 encoded script)
If server only blocks http:// and https://, data: may pass through
Trigger the redirect and observe if browser renders the data URI page
Vulnerable When:

Browser navigates to data:text/html,... and renders/executes JavaScript
This escalates open redirect to XSS — JS runs in the victim's browser
data: not in the server's scheme blocklist
Severity: High (XSS via open redirect)10. Test for open redirect with javascript: URI schemeSteps:

Payload: ?redirect=javascript:alert(document.cookie)
Try case variations: Javascript:, JAVASCRIPT:, jAvAsCrIpT:
Try null bytes: java%00script:alert(1), java%0Ascript:alert(1) (newline between java and script)
Check how redirect is implemented — if it's window.location = userInput, javascript: executes immediately
If app uses <meta refresh> or <a href=>, test if javascript: is accepted there too
URL-encode the whole thing: %6A%61%76%61%73%63%72%69%70%74%3Aalert(1)
Vulnerable When:

Browser executes alert(document.cookie) — JavaScript runs, not a page load
javascript: not blocked by server-side filter
App uses client-side window.location = param without sanitization
Severity: High (direct XSS)11. Test for open redirect via Host header manipulationSteps:

Capture any request in Burp Repeater
Change Host: target.com to Host: evil.com
Send and check if Location: header in response uses evil.com
Also check response body — does any absolute URL contain evil.com?
Now go to password reset flow — trigger a reset, intercept, inject Host: evil.com, forward
Check the email that arrives — does the reset link say https://evil.com/reset?token=...?
Also try: Host: target.com\nevil.com (header injection with CRLF)
Vulnerable When:

Location: https://evil.com/path in response after Host header change
Password reset email contains evil.com in the reset link — token delivered to attacker
App builds absolute URLs using the Host header without validation
Severity: High (password reset link hijacking = account takeover)12. Test for open redirect via X-Forwarded-Host headerSteps:

Add header to any request: X-Forwarded-Host: evil.com
Also try: X-Original-Host: evil.com, X-Host: evil.com, X-Forwarded-Server: evil.com
Send and check response body and Location: header for evil.com
Repeat for password reset, email confirmation, any link-generation flow
Check if adding both Host: target.com and X-Forwarded-Host: evil.com — which takes priority?
Try X-Forwarded-Host: evil.com%0d%0aSet-Cookie: hijacked=1 for CRLF injection
Vulnerable When:

App trusts X-Forwarded-Host over the actual Host header
Response Location: or body links contain evil.com
Password reset email uses evil.com from the injected header
Severity: High13. Test for open redirect in OAuth redirect_uri parameterSteps:

Find OAuth flow — look for GET /oauth/authorize?client_id=...&redirect_uri=https://target.com/callback
In Burp Repeater, change redirect_uri to https://evil.com
Complete the OAuth flow — does the server redirect with ?code=... to evil.com?
If exact match enforced, try: https://target.com.evil.com, https://target.com@evil.com, https://target.com/callback/../../../redirect?url=https://evil.com
Try adding extra params: redirect_uri=https://target.com/callback%3Fextra=https://evil.com
Check Burp Collaborator — if you get ?code=XXXX at your Collaborator URL, it's confirmed
Also try redirect_uri=https://evil.com with URL encoding: https%3A%2F%2Fevil.com
Vulnerable When:

Authorization code (?code=XXXX) delivered to evil.com — attacker can exchange it for an access token
Server accepts partial match on redirect_uri (e.g., just checks that target.com is present in the string)
Any bypass (subdomain, @, path traversal) results in code reaching attacker
Severity: Critical (full account takeover via stolen auth code)14. Test for open redirect in SAML RelayState parameterSteps:

Start SAML SSO login — intercept the SAML AuthnRequest in Burp
Find RelayState in the POST body or URL (e.g., RelayState=https://target.com/dashboard)
Replace with RelayState=https://evil.com
Forward the modified request, complete login normally (enter valid credentials)
After SAML response is processed, observe where browser goes
Also try: RelayState=%2F%2Fevil.com, RelayState=javascript:alert(1)
Test in both IdP-initiated and SP-initiated SSO flows
Vulnerable When:

After successful SAML login, browser is redirected to evil.com
IdP or SP uses RelayState value directly as redirect target without validation
User is phished: they login legitimately but land on attacker's page
Severity: Medium–High15. Test for open redirect in Next/Continue parameter after loginSteps:

Go to login page URL: https://target.com/login
Add ?next=https://evil.com → https://target.com/login?next=https://evil.com
Log in with valid credentials
After login, observe where browser redirects — is it evil.com?
Also try param names: ?continue=, ?returnTo=, ?return_url=, ?successUrl=, ?after_login=
If same-origin check exists, try: ?next=//evil.com, ?next=/\evil.com, ?next=https://target.com@evil.com
Share the crafted login URL with a victim to simulate phishing attack
Vulnerable When:

Post-login redirect goes to evil.com — user lands on attacker's site immediately after authenticating
No origin validation: any absolute URL in next= is followed
Crafted login URL can be sent to victims as phishing vector (looks like real login page)
Severity: Medium (High if combined with credential phishing page on evil.com)