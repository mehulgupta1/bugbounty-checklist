1. Test for SSRF via webhook URL configuration
Steps:

Find webhook configuration in the app (Integrations, Notifications, Settings, Developer section)
Set webhook URL to: http://169.254.169.254/latest/meta-data/ (AWS IMDSv1)
Also try: http://100.100.100.200/latest/meta-data/ (Alibaba Cloud metadata)
Also try: http://127.0.0.1:80/admin, http://192.168.1.1, http://10.0.0.1
For blind detection: set URL to your Burp Collaborator URL — trigger a test event
Check Collaborator for DNS/HTTP request — if you get a hit, SSRF confirmed
If internal request goes through: try http://169.254.169.254/latest/meta-data/iam/security-credentials/ for AWS keys

Vulnerable When:

Collaborator receives DNS/HTTP request from server's IP (blind SSRF confirmed)
Response to webhook trigger contains ami-id, hostname, iam — AWS metadata returned
Internal service (127.0.0.1:8080) returns response content in webhook delivery logs

Severity: Critical (cloud metadata access = IAM key theft = full AWS account compromise)

2. Test for webhook signature verification bypass
Steps:

Find how webhook signatures are implemented — check docs or look for headers like X-Hub-Signature-256: sha256=<hmac>, X-Signature: <value>
Send a webhook payload without the signature header entirely — check if it's still processed
Send with empty signature: X-Hub-Signature-256: sha256=
Send with signature sha256=0000000000000000000000000000000000000000000000000000000000000000 (64 zeros)
Send a valid signature from a previous webhook delivery with a new/different payload — does it process?
Check if signature validation error returns a different response time or error message (timing/error oracle)

Vulnerable When:

Webhook processed without signature header (no signature requirement)
Empty or all-zero signature accepted — server skips HMAC comparison
Old signature accepted on new payload — no payload-to-signature binding check
You can trigger any webhook action (create user, process payment) by forging requests

Severity: High

3. Test for webhook replay attack prevention
Steps:

Capture a legitimate webhook delivery from the app's delivery logs (most apps show this in settings)
Note the full payload, headers (especially timestamp headers like X-Timestamp, X-Delivery-ID)
Resend the identical webhook payload to your app's webhook endpoint immediately — does it process again?
Resend after 1 hour — still processed?
Try resending after changing only non-critical fields (formatting, whitespace) but keeping the same event_id/delivery_id
If testing payment webhook: replay a payment.succeeded event and check if account is credited twice

Vulnerable When:

Same webhook payload processed multiple times (no delivery_id deduplication)
payment.succeeded event replayed credits the account twice (financial impact)
No timestamp validation — replaying 24-hour-old webhooks still works

Severity: High

4. Test for webhook URL validation and restrictions
Steps:

Set webhook URL to: http://localhost:80, http://127.0.0.1:443, http://0.0.0.0:8080 — various localhost representations
Try: http://127.1/, http://0x7f000001/ (hex IP for 127.0.0.1), http://2130706433/ (decimal for 127.0.0.1)
Try: http://localtest.me/ (domain that resolves to 127.0.0.1)
DNS rebinding: register a domain that resolves to your IP during validation, then re-resolves to 127.0.0.1 when the actual HTTP request is made
Set URL to your server that returns 302 Location: http://169.254.169.254/latest/meta-data/ — check if app follows the redirect
Try: http://[::1]/ (IPv6 localhost), http://①②⑦.⓪.⓪.①/ (Unicode IP)

Vulnerable When:

Localhost/internal IP accepted as webhook URL (SSRF)
Redirect followed to internal IP (SSRF via open redirect)
DNS rebinding defeats validation — request goes to 127.0.0.1 despite passing URL check
Obfuscated IPs (0x7f000001, decimal) bypass regex validation

Severity: High

5. Test for webhook secret exposure in API response
Steps:

Create a new webhook via API: POST /api/webhooks with {"url": "https://your-server.com"}
Inspect the API response body in Burp — does it include "secret": "whsec_..." or "signing_key": "..."?
Call GET /api/webhooks/{id} — does it return the secret in plaintext?
Check the webhooks list endpoint: GET /api/webhooks — does listing expose secrets?
Check browser DevTools Network tab while viewing webhook settings — any response containing the full secret?
Check if secret is visible in webhook delivery logs: GET /api/webhooks/{id}/deliveries

Vulnerable When:

GET /api/webhooks/{id} returns "secret": "whsec_abc123" in plaintext — attacker with read access can forge any webhook
Webhook listing endpoint exposes all secrets
Secret visible in delivery logs — any user who can view logs can forge future webhooks

Severity: High

6. Test for webhook delivery to internal network
Steps:

Set webhook URL to internal service ports:

http://10.0.0.1:6379 (Redis — sends raw HTTP which Redis may interpret as commands)
http://10.0.0.1:27017 (MongoDB)
http://10.0.0.1:5432 (PostgreSQL)
http://10.0.0.1:22 (SSH — response banner shows SSH version)


Trigger a webhook event and observe the delivery response/log — does it show service banners or error messages from internal services?
If gopher:// protocol is accepted: gopher://10.0.0.1:6379/_FLUSHALL%0D%0A sends Redis FLUSHALL command
Try dict://, ftp:// protocols in the webhook URL field

Vulnerable When:

Delivery log shows SSH banner SSH-2.0-OpenSSH_8.4 or Redis inline response (internal service probing confirmed)
gopher:// accepted and Redis command executes (data destruction or code exec)
Internal DB connection error message returned in delivery log (confirms internal network reach)

Severity: Critical

7. Test for webhook timing attack on signature verification
Steps:

Send a webhook with a valid HMAC signature — record response time (run 50 times, take average)
Send with a completely wrong signature (all zeros) — record response time (50 times, average)
Send with a signature that matches only the first byte correctly — record time
Send with first 5 bytes correct, first 10 bytes correct, etc. — build a timing profile
If time increases as more bytes match, the comparison is non-constant-time — secret recoverable byte-by-byte
Use Burp's built-in response time analysis or write a Python script for statistical significance

Vulnerable When:

Statistically significant timing difference between fully wrong signature and partially correct signature
Time increases linearly as more leading bytes of the HMAC match
Secret can be brute-forced byte-by-byte using timing side channel (typically takes ~256 requests per byte × 32 bytes = ~8,192 total requests)

Severity: High

8. Test for webhook URL redirect following behavior
Steps:

Set up your server at https://your-server.com/redirect to return: HTTP 302 Location: http://169.254.169.254/latest/meta-data/
Set webhook URL to https://your-server.com/redirect
Trigger a webhook — your server logs the incoming request (SSRF stage 1), then check delivery log for metadata content (SSRF stage 2)
Also try using an open redirect on the target's own domain: https://target.com/redirect?url=http://169.254.169.254/ — set this as webhook URL
Try chaining multiple redirects: your server → target's open redirect → internal IP

Vulnerable When:

Delivery log contains AWS metadata (ami-id, iam/security-credentials) — app followed your redirect to metadata service
Using target's own open redirect as webhook URL succeeds (validation passes since it's target.com, but redirects to internal)
Chained redirect still reaches internal IP after 2+ hops

Severity: High

9. Test for webhook content-type handling security
Steps:

Webhook app sends Content-Type: application/json — intercept and change to Content-Type: text/plain — does processing still occur?
Change to Content-Type: application/x-www-form-urlencoded with a form-encoded body — does JSON parser break or does form parser take over?
Try Content-Type: application/json; charset=utf-32 — encoding confusion, payload in UTF-32 may bypass UTF-8 filters
Remove Content-Type header entirely — check if server defaults to a parser that skips validation
Send Content-Type: application/json but body that's not valid JSON: this_is_not_json{"key":"value"} — does partial parse occur?
Try polyglot payload valid in both JSON and form encoding: {"key":"value"}&key=value

Vulnerable When:

text/plain body still triggers webhook action (Content-Type not validated)
Encoding confusion (utf-32) bypasses input filter — injection payload gets through
JSON parser partially processes malformed input, causing logic error (e.g., first valid key processed, injected key ignored by filter but used by app)

Severity: Medium

10. Test for webhook event subscription abuse
Steps:

In webhook settings, subscribe to all available event types — check if any are restricted for your role
When creating a subscription via API: POST /api/webhooks with {"url":"...","events":["*"]} — wildcard subscription
Try IDOR in subscription: POST /api/webhooks with {"url":"...","user_id":"victim_id","events":["user.login"]} — subscribe to another user's events
Modify subscription via API: PUT /api/webhooks/{id} — change events array to include admin.* events
Mass-create subscriptions: create 10,000 webhook subscriptions for a single event — trigger that event and see if server sends 10,000 delivery requests (DDoS amplification)
Set subscription URL to an internal IP and subscribe to a high-frequency event (page view, API call) — SSRF triggered repeatedly

Vulnerable When:

user.login events for other users delivered to your webhook (IDOR in subscription — you receive their login notifications)
admin.* events delivered to regular user's webhook (privilege escalation via event subscription)
10,000 subscriptions all fire on one event — server uses its own resources to flood an external target (DDoS amplification, your target or a third party)
High-frequency event + internal SSRF URL = repeated internal service probing via webhook delivery

Severity: High