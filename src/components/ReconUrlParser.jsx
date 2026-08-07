import React, { useState, useEffect, useRef, memo, useMemo, useDeferredValue } from 'react';
import localforage from 'localforage';
import { Virtuoso } from 'react-virtuoso';

// --- CONFIGURATION ---

const CATEGORIES = [
  {
    id: 'xss', label: 'XSS', sev: 'critical', pts: 10,
    params: /[?&](q|s|search|query|keyword|lang|v|view|cat|id|page|name|term|val|text|input|data|ref|redirect|next|url|src|dest|img|source|href|content|value|type|callback|jsonp|html|code|style|class|on\w+|message|msg|output|return|path|to|from|subject|body|comment|description|title|note|label|caption|summary|tag|filter|sort|order|display|render|template|layout|theme|format|mode|action|event)=/i,
    valueCheck: /[?&][^=]+=([^&]*(<script|javascript:|data:|vbscript:|onload=|onerror=|onclick=|onmouseover=|onfocus=|<img|<svg|<iframe|<body|<input|<details|<video|<audio|%3C|%3E|%22|%27|%60|%28|%29|%7B|%7D|&#x|&#\d|\\u003|\\u003c|\\x3c|\\x22)[^&]*)/i
  },
  {
    id: 'idor', label: 'IDOR', sev: 'critical', pts: 10,
    params: /[?&](id|user_id|account|uid|userid|pid|profile|num|no|order|item|record|doc|object|target|key|uuid|guid|oid|ref_id|resource|cid|fid|bid|invoice|ticket|token_id|member|account_id|customer_id|org_id|group_id|role_id|post_id|comment_id|message_id|thread_id|project_id|task_id|file_id|report_id|owner|owner_id|parent_id|entity_id)=/i,
    valueCheck: /[?&][^=]+=(\d{1,15}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})([&\s]|$)/i
  },
  {
    id: 'sqli', label: 'SQLi', sev: 'critical', pts: 10,
    params: /[?&](id|select|report|role|update|query|user|name|sort|where|search|params|process|row|view|table|from|sel|results|sleep|fetch|order|keyword|column|field|delete|string|number|filter|account|chr|union|cat|type|category|page|group|limit|offset|start|end|min|max|between|having|like|match|against)=/i,
    valueCheck: /[?&][^=]+=[^&]*(\b(select|union|insert|update|delete|drop|create|alter|exec|execute|xp_|sp_|information_schema|sysobjects|syscolumns)\b|sleep\s*\(|benchmark\s*\(|pg_sleep|waitfor\s+delay|having\s+1=1|order\s+by\s+\d|group\s+by\s+\d|\bor\b\s+['"\d]+\s*=\s*['"\d]+|\band\b\s+['"\d]+\s*=\s*['"\d]+|'--|--\s|#\s*$|%27--|%23|1=1|1%3D1|'\s*or\s*'1'\s*=\s*'1|%27\s*or\s*%27|0x[0-9a-f]{2,}|\bchar\s*\(|\bconcat\s*\(|\bhex\s*\(|\bunhex\s*\(|\bload_file\s*\(|\binto\s+outfile\b|\bversion\s*\(\s*\))/i
  },
  {
    id: 'ssrf', label: 'SSRF', sev: 'critical', pts: 10,
    params: /[?&](url|uri|path|src|dest|redirect|next|data|ref|site|html|target|open|load|endpoint|feed|host|domain|proxy|img|image|link|page|request|return|go|callback|from|window|resource|to|continue|u|fetch|wsdl|service|api|backend|server|forward|webhook|notify|ping|mirror|pull|remote|origin|location|download|transfer|retrieve|import|connect|source|base_url|api_url|return_url|next_url|redirect_url)=/i,
    strict: /[?&][^=]+=[^&]*(https?:\/\/|ftp:\/\/|file:\/\/|dict:\/\/|gopher:\/\/|ldap:\/\/|ldaps:\/\/|tftp:\/\/|sftp:\/\/|netdoc:\/\/|jar:\/\/|\/\/[^/]|%2F%2F|%2f%2f|@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|%40[a-zA-Z0-9.-]+\.[a-zA-Z]|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|0\.0\.0\.0|::1|0x7f[0-9a-f]{6}|0177\.|017[0-7]\.|2130706433|[0-9]{8,10}|localhost|%6c%6f%63%61%6c|%6C%6F%63%61%6C|l%6fcalhost)/i
  },
  {
    id: 'rce', label: 'RCE', sev: 'critical', pts: 10,
    params: /[?&](cmd|exec|command|execute|ping|query|jump|code|reg|do|func|arg|option|load|process|step|read|function|req|feature|exe|module|payload|run|print|sp|js|shell|bash|sh|invoke|call|dispatch|eval|system|passthru|popen|proc|subprocess|action|method|handler|hook|script|expression|formula|calc|operator|pipe|input|stdin|argv|args|param)=/i,
    valueCheck: /[?&][^=]+=[^&]*(;|\||&&|\|\||`|\$\(|\$\{|%3B|%7C|%26%26|%7C%7C|%60|\$%28|\$%7B|\bnslookup\b|\bwhoami\b|\bid\b|\bcat\s+\/|\bls(\s+-|\s*$)|\bpwd\b|\becho\b|\bwget\s+|\bcurl\s+|\bchmod\b|\bchown\b|\brm\s+-[rf]|\buname\b|\bnetstat\b|\bifconfig\b|\bipconfig\b|\benv\b|\bprintenv\b|\/etc\/passwd|\/etc\/shadow|\/etc\/hosts\b|\/bin\/sh|\/bin\/bash|\/usr\/bin\/python|cmd\.exe|powershell\.exe|powershell\s+-|\beval\s*\(|\bassert\s*\(|\bsystem\s*\(|\bpassthru\s*\(|\bexec\s*\(|\bshell_exec\s*\(|\bproc_open\s*\(|\bpopen\s*\(|\bcreate_function\s*\(|\bcall_user_func\s*\(|\bpreg_replace\s*\(\s*['"]\/.+\/e|\barray_map\s*\(\s*['"]|\bobject_id\s*\()/i
  },
  {
    id: 'lfi', label: 'LFI', sev: 'critical', pts: 10,
    params: /[?&](file|document|folder|root|path|pg|style|pdf|template|php_path|doc|page|name|cat|dir|action|board|date|lang|download|include|archive|load|layout|view|theme|inc|read|content|resource|location|src|href|url|open|retrieve|fetch|get|show|display|render|print|base|home|prefix|suffix|extension|module|plugin|component|config|conf|setting|option|param|type|format)=/i,
    strict: /[?&][^=]+=[^&]*(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.%2f|%2e\.\/|\.%2e\/|%252e%252e|%252e%252e%252f|%c0%af|%c1%9c|%ef%bc%8f|\.\.%5c|%2e%2e%5c|%252e%252e%255c|\.\.%255c|\/etc\/|\/proc\/self\/|\/var\/|\/root\/|\/home\/|\/windows\/system32\/|\/winnt\/|c:\\|c:%5c|%2fetc%2f|%5cetc%5c|boot\.ini|win\.ini|system\.ini|system32|passwd\b|shadow\b|\/etc\/hosts\b|authorized_keys|id_rsa|\.php\b|\.asp\b|\.aspx\b|\.jsp\b|\.env\b|\.git\/|\.ssh\/|\.aws\/credentials|\.npmrc|\.dockerenv|proc\/self\/environ|proc\/self\/cmdline)/i
  },
  {
    id: 'redirect', label: 'Open Redirect', sev: 'high', pts: 6,
    params: /[?&](url|redirect|redir|return|r|next|dest|destination|goto|link|to|out|target|exit|q|path|continue|forward|data|ref|go|u|uri|prev|return_url|callback|location|l|jump|returnUrl|returnPath|successUrl|back|fallback|follow|service|auth_redirect|login_redirect|logout_redirect|after_login|post_login|after_logout|final_redirect|cancel_url|error_url|fallback_url)=/i,
    strict: /[?&][^=]+=[^&]*(https?:|ftp:|\/\/|%2F%2F|%2f%2f|\\\\|%5C%5C|\/\/\/|%2F%2F%2F|\/{3,}|\/\\|\\\/|%2F\\|\\%2F|https?%3A|%68%74%74%70|javascript:|data:|vbscript:|%0d|%0a|%0D|%0A|@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/)/i
  },
  {
    id: 'ssti', label: 'SSTI', sev: 'high', pts: 6,
    params: /[?&](template|preview|render|view|content|page|lang|locale|layout|format|style|theme|type|name|label|header|footer|body|include|load|display|print|out|show|output|text|html|markup|expression|value|var|variable|msg|message|subject|title|description|caption|note)=/i,
    valueCheck: /[?&][^=]+=[^&]*(\{\{|\}\}|\{%|%\}|\$\{[^}]+\}|\{\{[^}]+\}\}|<%[=\-]?|[=\-]?%>|#\{[^}]+\}|\[#[^\]]+\]|\[=[^\]]+\]|<#[^>]+>|@\{[^}]+\}|__class__|__mro__|__subclasses__|__import__|__globals__|__builtins__|config\[|self\.|request\.|application\.|session\.|lipsum\b|cycler\b|joiner\b|namespace\b|get_flashed_messages|url_for\b|Jinja2|Twig|Smarty|Velocity|Freemarker|Pebble|Mustache|Handlebars|Nunjucks|\$\{7\*7\}|\{\{7\*7\}\}|#\{7\*7\})/i
  },
  {
    id: 'jwt', label: 'JWT in URL', sev: 'high', pts: 6,
    params: /[?&][^=]+=(ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}(\.[A-Za-z0-9_-]{5,})?)/,
    paths: /[?&\/#](ey[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}(\.[A-Za-z0-9_-]{20,})?)/
  },
  {
    id: 'auth', label: 'Auth/OAuth', sev: 'high', pts: 6,
    params: /[?&](token|access_token|auth|oauth|client_secret|grant_type|api_key|secret|key|pass|password|passwd|authorization|session|sid|jwt|bearer|code|client_id|scope|state|nonce|csrf|_token|auth_token|id_token|refresh_token|x-api-key|appkey|app_secret|app_key|api_secret|private_token|personal_token|device_token|push_token|session_key|session_token|auth_code|verification_code|confirmation_token|magic_link|one_time_token|ott|otp|totp|mfa_token)=/i,
    valueCheck: /[?&][^=]+=[^&]*(Bearer|ey[A-Za-z0-9_-]{15,}|ghp_[A-Za-z0-9]{36,}|glpat-[A-Za-z0-9_\-]{20,}|[A-Za-z0-9_-]{20,})/i,
    paths: /\/(oauth|authorize|callback|sso|saml|login|signout|logout|token|auth|openid|connect|refresh|session|identity|account|profile|me|whoami|credentials|authenticate|verification|validate|verify|confirm|2fa|mfa|webauthn|passkey)(\/|$|\?)/i
  },
  {
    id: 'cors', label: 'CORS/JSONP', sev: 'high', pts: 6,
    params: /[?&](callback|cb|jsonp|origin|cors|referer|access_control|xorigin|cross|format|type|response_type|output|wrap|padding|pad|fn|func|method|handler|on|oncomplete|onload|onsuccess|onerror)=/i,
    valueCheck: /[?&](callback|cb|jsonp|fn|func)=(?!(jQuery|angular|jsonp)\d*)[a-zA-Z_$][a-zA-Z0-9_$.]*|[?&]origin=(https?:\/\/[^&]+)/i
  },
  {
    id: 'upload', label: 'File Upload', sev: 'high', pts: 6,
    params: /[?&](file|upload|attach|img|photo|avatar|image|media|document|doc|logo|icon|thumb|pdf|attachment|blob|data|content|asset|resource|object|binary|multipart|chunk|part|segment|payload|body|stream|buffer|raw|bytes|base64|encoded|file_data|file_content|file_path|file_name|filename|mime|type|ext|extension|format|size|checksum|hash|digest)=/i,
    paths: /\/(upload|attach|import|ingest|media|files|documents|assets|blob|storage|cdn|static|public|private|secure|protected|temp|tmp|cache|upload_chunk|chunked|multipart|resumable|dropzone|filepond)(\/|$|\?)/i
  },
  {
    id: 'endpoints', label: 'Hot Endpoints', sev: 'medium', pts: 3,
    paths: /\/(api|v[0-9]+|admin|dashboard|internal|dev|staging|debug|console|panel|portal|manage|backstage|staff|superadmin|system|config|settings|setup|install|phpinfo|server-status|server-info|wp-admin|wp-login|wp-json|phpmyadmin|adminer|actuator|metrics|health|healthz|ready|readyz|live|livez|swagger|swagger-ui|api-docs|openapi|graphql|graphiql|playground|altair|voyager|__graphql|explorer|redoc|rapidoc|backup|bak|old|test|tmp|temp|trace|heap-dump|thread-dump|dump|info|status|ping|pong|version|build|\.git|\.env|\.htaccess|\.htpasswd|\.svn|\.DS_Store|\.aws|\.ssh|\.bash_history|\.bash_profile|\.zshrc|\.npmrc|\.yarnrc|\.dockerenv|dockerfile|Makefile|web\.config|applicationHost\.config|\.travis\.yml|\.circleci|jenkins|Jenkinsfile|\.github|\.gitlab-ci)(\/|$|\?|\.)/i
  },
  {
    id: 'publicDiscovery', label: 'Public Discovery', sev: 'low', pts: 1,
    paths: /\/(robots\.txt|sitemap\.xml|crossdomain\.xml|security\.txt|\.well-known\/)/i
  },
  {
    id: 'jsfiles', label: 'JS/JSON Files', sev: 'medium', pts: 3,
    paths: /\.(js|jsx|ts|tsx|json|map|env|config\.js|config\.json|settings\.json|swagger\.json|openapi\.json|api-docs\.json|package\.json|composer\.json|Gemfile\.lock|requirements\.txt|yarn\.lock|package-lock\.json|\.babelrc|\.eslintrc|tsconfig\.json|webpack\.config\.js|next\.config\.js|nuxt\.config\.js|vite\.config\.js|angular\.json|manifest\.json|app\.js|bundle\.js|main\.js|index\.js|runtime\.[a-f0-9]+\.js|chunk\.[a-f0-9]+\.js|[a-f0-9]{8,}\.[a-z0-9]+\.js)(\?|$)/i
  },
  {
    id: 's3', label: 'S3/Cloud', sev: 'medium', pts: 3,
    paths: /(s3\.amazonaws\.com|s3-[a-z0-9-]+\.amazonaws\.com|s3\.[a-z0-9-]+\.amazonaws\.com|\.s3\.amazonaws\.com|storage\.googleapis\.com|blob\.core\.windows\.net|digitaloceanspaces\.com|backblazeb2\.com|r2\.cloudflarestorage\.com|objects\.githubusercontent\.com|aliyuncs\.com\/|oss-[a-z0-9-]+\.aliyuncs\.com|cos\.[a-z0-9-]+\.myqcloud\.com|obs\.[a-z0-9-]+\.myhuaweicloud\.com|[a-z0-9-]+\.nyc3\.digitaloceanspaces\.com|[a-z0-9-]+\.sfo2\.digitaloceanspaces\.com|[a-z0-9-]+\.sgp1\.digitaloceanspaces\.com)/i
  },
  {
    id: 'secrets', label: 'Secrets Leak', sev: 'critical', pts: 10,
    params: /[?&](api_key|apikey|api_secret|client_secret|secret_key|private_key|signing_key|access_key|aws_access|aws_secret|password|passwd|pass|token|bearer|authorization|auth_token|session_token|x-api-key|appkey|app_secret|db_pass|db_password|database_password|smtp_pass|smtp_password|ftp_pass|redis_password|mongo_password|mysql_password|postgres_password|encryption_key|decryption_key|hmac_key|jwt_secret|webhook_secret|stripe_key|twilio_token|sendgrid_key|mailchimp_key|slack_token|github_token|gitlab_token|bitbucket_token|heroku_api_key|firebase_token|google_api_key|azure_key|gcp_key|openai_key|anthropic_key|huggingface_token)=/i,
    valueCheck: /[?&][^=]+=[^&]*(AKIA[A-Z0-9]{16}|AIza[A-Za-z0-9_\-]{35}|sk-[A-Za-z0-9]{20,}|sk_live_[A-Za-z0-9]{20,}|pk_live_[A-Za-z0-9]{20,}|sk-proj-[A-Za-z0-9_\-]{20,}|xox[baprs]-[A-Za-z0-9\-]{10,}|gh[pousr]_[A-Za-z0-9]{36,}|glpat-[A-Za-z0-9_\-]{20,}|SG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43}|key-[a-z0-9]{32}|AC[a-z0-9]{32}|AP[a-z0-9]{32}|EAAB[A-Za-z0-9]{100,}|eyJhbGciO[A-Za-z0-9_\-]{20,}|r0\.[A-Za-z0-9_\-]{28}|Bearer\s+[A-Za-z0-9_\-\.]{20,}|[A-Za-z0-9+\/]{40,}={0,2})([&\s]|$)/
  },
  {
    id: 'awsKeys', label: 'AWS Keys', sev: 'critical', pts: 10,
    paths: /(AKIA|AGPA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/,
    params: /[?&](aws_access_key|aws_access_key_id|aws_secret|aws_secret_access_key|aws_token|aws_session_token|x-amz-security-token|X-Amz-Credential|x-amz-date|AWSAccessKeyId|aws_key|aws_id)=/i,
    valueCheck: /[?&](aws_access_key|aws_access_key_id|AWSAccessKeyId)=[^&]*(AKIA|AGPA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/
  },
  {
    id: 'firebase', label: 'Firebase', sev: 'high', pts: 6,
    paths: /(firebaseio\.com|firestore\.googleapis\.com|firebase\.google\.com|appspot\.com\/.*\b(rtdb|firestore|storage)\b|\.firebaseapp\.com|firebasestorage\.googleapis\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com)/i,
    params: /[?&](auth|token|key)=[^&]*(AIza[A-Za-z0-9_\-]{35}|[A-Za-z0-9_\-]{100,})/
  },
  {
    id: 'takeover', label: 'Sub Takeover', sev: 'high', pts: 6,
    paths: /(NoSuchBucket|NoSuchKey|herokucdn\.com|azurewebsites\.net|github\.io|\.s3\.amazonaws\.com|unbouncepages\.com|helpscoutdocs\.com|freshdesk\.com|desk\.com|zendesk\.com|statuspage\.io|uservoice\.com|ghost\.io|strikingly\.com|webflow\.io|cargo\.site|launchrock\.com|tumblr\.com|wordpress\.com|pantheonsite\.io|wpengine\.com|kinstacdn\.com|myshopify\.com|squarespace\.com|fastly\.net\/errors|there-is-no-such-a-user|Invalid\+request|Repository not found|project not found|This UserVoice subdomain is currently available|is not a registered InCloud YouTrack)/i
  },
  {
    id: 'xxe', label: 'XXE', sev: 'critical', pts: 10,
    params: /[?&](xml|data|body|input|payload|content|document|doc|feed|soap|wsdl|request|query|upload|import|load|source|message|packet|envelope|stream|text|raw|schema|dtd|xsl|xslt|transform|svg|rss|atom|opml|sitemap)=/i,
    valueCheck: /[?&][^=]+=[^&]*(<\?xml|<!DOCTYPE|<!ENTITY|SYSTEM\s+["']|PUBLIC\s+["']|%[a-zA-Z][a-zA-Z0-9_-]*;|&#x[0-9a-fA-F]+;|<!\[CDATA\[|%xxe|xxe_test|file:\/\/|expect:\/\/|php:\/\/|jar:\/\/|netdoc:\/\/|%2F%2F[a-zA-Z]|\/etc\/passwd|\/etc\/shadow|\/windows\/win\.ini)/i
  },
  {
    id: 'crlf', label: 'CRLF Injection', sev: 'medium', pts: 3,
    params: /[?&](url|redirect|redir|next|dest|return|location|path|uri|ref|src|href|data|content|text|value|input|name|title|header|subject|body|msg|message|lang|locale|format|output|callback|ref|from|to|host|origin|referer|q|search|query|term|keyword|param|page|view|type|action|id|sort|order|filter|mode|event|tag|label|note|comment|description|summary|caption)=/i,
    valueCheck: /[?&][^=]+=[^&]*(%0d|%0a|%0D|%0A|%0d%0a|%0D%0A|\r\n|\r|\n|%23|%00|\\r|\\n|\\r\\n|%5Cr|%5Cn|%E5%98%8A|%E5%98%8D|U\+000A|U\+000D|\u000a|\u000d)/i
  },
  {
    id: 'protoPollution', label: 'Prototype Pollution', sev: 'medium', pts: 3,
    params: /[?&]([^=]*\[__proto__\]|[^=]*\[constructor\]|[^=]*\[prototype\]|__proto__|constructor\[prototype\]|__proto__\[|prototype\[|constructor\.|__defineGetter__|__defineSetter__|__lookupGetter__|__lookupSetter__|hasOwnProperty|isPrototypeOf|propertyIsEnumerable|__proto__\.constructor)=/i,
    valueCheck: /[?&][^=]*(\[__proto__\]|\[constructor\]|\[prototype\])[^=]*=[^&]*([^&]{1,})/i
  },
  {
    id: 'graphql', label: 'GraphQL Introspect', sev: 'critical', pts: 10,
    params: /[?&]query=/i,
    valueCheck: /[?&]query=[^&]*(\{|%7B)[^&]*(__schema|__type)/i
  },
  {
    id: 'massAssign', label: 'Mass Assignment', sev: 'high', pts: 6,
    params: /[?&](role|is_admin|admin|user\[role\]|user\[is_admin\]|user\[is_active\]|permissions|privilege)=/i
  },
  {
    id: 'headerInject', label: 'Header Inject', sev: 'high', pts: 6,
    params: /[?&](x-forwarded-for|x-original-url|x-rewrite-url|x-forwarded-host|x-host|x-custom-ip-authorization|client-ip|true-client-ip|cluster-client-ip)=/i
  },
  {
    id: 'deserialization', label: 'Deserialization', sev: 'critical', pts: 10,
    params: /[?&](data|obj|object|state|payload|session|token|viewstate)=/i,
    valueCheck: /[?&][^=]+=[^&]*(rO0AB|O:[0-9]+:"|%4f%3a[0-9]+%3a%22|Tzo[0-9]+|AAEAAAD\/\/\/\/\/)/i
  },
  {
    id: 'git', label: 'Git Exposure', sev: 'critical', pts: 10,
    paths: /\/\.git\/(config|HEAD|index|logs\/|objects\/|refs\/)/i,
    valueCheck: /[?&][^=]+=[^&]*(ghp_[A-Za-z0-9]{36,}|glpat-[A-Za-z0-9_\-]{20,})/i
  },
  {
    id: 'sensitivePaths', label: 'Sensitive Paths', sev: 'high', pts: 6,
    paths: /\/(reset\/confirm|password\/reset|invite|payment|unsubscribe|verify\/token|auth\/callback|checkout|billing|invoices|card_update|webhook)(\/|$|\?)/i
  },
  {
    id: 'custom_regex', label: 'Custom Regex', sev: 'custom', pts: 5
  }
];

const SOURCES = ["GAU", "Waymore", "WaybackURLs", "Katana", "GoSpider", "Hakrawler", "Custom"];

// --- UTILS ---

function entropy(s) {
  if (!s || s.length < 2) return 0;
  const freq = {};
  for (const c of s) freq[c] = (freq[c] || 0) + 1;
  return -Object.values(freq).reduce((acc, v) => {
    const p = v / s.length;
    return acc + p * Math.log2(p);
  }, 0);
}

function escapeHtml(unsafe) {
  return (unsafe||"").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

const getSevColor = (sev) => {
  switch (sev) {
    case 'critical': return '#ef4444'; // Tailwind Red 500
    case 'high': return '#f59e0b'; // Tailwind Amber 500
    case 'medium': return '#3b82f6'; // Tailwind Blue 500
    case 'low': return '#9ca3af'; // Tailwind Gray 400
    case 'custom': return '#8b5cf6'; // Tailwind Purple 500
    default: return '#9ca3af';
  }
};

const UrlRow = memo(({ d, i, activeTab, status, isCopied, onToggleStatus, onCopy, highlightUrl }) => (
  <div className="url-row-v4" style={{ 
    background: status === 'vulnerable' ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
    borderLeft: status === 'vulnerable' ? '3px solid #ef4444' : status === 'tested' ? '3px solid #10b981' : '3px solid transparent'
  }}>
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "70px", borderRight: "1px solid var(--color-border-tertiary, #e5e7eb)", paddingRight: "8px", marginRight: "8px" }}>
      <label style={{ fontSize: "10px", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", color: status === 'tested' ? '#10b981' : 'var(--color-text-secondary, #6b7280)' }}>
        <input type="checkbox" checked={status === 'tested'} onChange={() => onToggleStatus(d.url, 'tested')} />
        Tested
      </label>
      <label style={{ fontSize: "10px", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", color: status === 'vulnerable' ? '#ef4444' : 'var(--color-text-secondary, #6b7280)' }}>
        <input type="checkbox" checked={status === 'vulnerable'} onChange={() => onToggleStatus(d.url, 'vulnerable')} />
        Vuln
      </label>
    </div>
    <div style={{ width: "32px", fontSize: "11px", color: "var(--color-text-secondary, #6b7280)", textAlign: "right", paddingRight: "8px" }}>{i+1}.</div>
    
    {activeTab === "topRisk" && (
        <div style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", background: `${getSevColor(d.severity)}20`, color: getSevColor(d.severity), minWidth: "55px", textAlign: "center", border: `1px solid ${getSevColor(d.severity)}40` }}>
          {d.score}pts
        </div>
    )}

    {d.highEntropy && <div title="High Entropy Token Detected" style={{ fontSize: "16px", background: "rgba(245, 158, 11, 0.1)", padding: "2px", borderRadius: "6px" }}>⚡</div>}

    <div 
      className="highlighted-url-v4"
      style={{ flex: 1, textDecoration: status === 'tested' ? 'line-through' : 'none', opacity: status === 'tested' ? 0.6 : 1 }}
      dangerouslySetInnerHTML={highlightUrl(d.url, activeTab, d.categories)}
    />

    <div style={{ display: "flex", gap: "6px" }}>
      {activeTab === "topRisk" && d.categories.map(catId => {
        const cDef = CATEGORIES.find(c => c.id === catId);
        return <span key={catId} style={{ fontSize: "10px", padding: "2px 8px", background: cDef?.sev === 'custom' ? "rgba(139, 92, 246, 0.1)" : "var(--color-background-tertiary, #e5e7eb)", border: cDef?.sev === 'custom' ? "1px solid rgba(139, 92, 246, 0.4)" : "1px solid var(--color-border-tertiary, #d1d5db)", borderRadius: "12px", color: cDef?.sev === 'custom' ? "#8b5cf6" : "var(--color-text-secondary, #6b7280)", fontWeight: cDef?.sev === 'custom' ? "600" : "normal" }}>{cDef?.label}</span>
      })}
    </div>

    <button 
      onClick={() => onCopy(d.original || d.url, `url-${i}`)}
      className="btn-secondary"
      style={{ padding: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}
      title="Copy URL"
    >
      {isCopied ? <span style={{ color: "#10b981", fontWeight: "bold" }}>✓</span> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>}
    </button>
  </div>
));

// --- MAIN COMPONENT ---

const ReconUrlParser = memo(function ReconUrlParser({ activeProjectId = "default" }) {
  // State
  const [source, setSource] = useState("GAU");
  const [rawInput, setRawInput] = useState("");
  const [parsedData, setParsedData] = useState([]);
  const [activeTab, setActiveTab] = useState("topRisk");
  const [filterText, setFilterText] = useState("");
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({});
  const [showSessions, setShowSessions] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(500);
  const [wordlistScope, setWordlistScope] = useState('active');
  const [urlStatuses, setUrlStatuses] = useState({});
  const [isParsing, setIsParsing] = useState(false);
  const [progressInfo, setProgressInfo] = useState({ percent: 0, text: "" });
  const [copiedState, setCopiedState] = useState(null);
  
  const [customRegexes, setCustomRegexes] = useState([]);
  const [newCustomLabel, setNewCustomLabel] = useState("");
  const [newCustomPattern, setNewCustomPattern] = useState("");

  const addCustomRegex = () => {
    if (!newCustomLabel || !newCustomPattern) return;
    try {
      new RegExp(newCustomPattern, 'i');
      setCustomRegexes(prev => [...prev, { label: newCustomLabel, pattern: newCustomPattern, id: `custom_${Date.now()}` }]);
      setNewCustomLabel("");
      setNewCustomPattern("");
    } catch(e) {
      alert("Invalid Regular Expression! " + e.message);
    }
  };

  const removeCustomRegex = (id) => {
    setCustomRegexes(prev => prev.filter(r => r.id !== id));
  };

  const handleCopy = React.useCallback((text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedState(id);
    setTimeout(() => setCopiedState(null), 2000);
  }, []);

  const toggleUrlStatus = React.useCallback((url, type) => {
    setUrlStatuses(prev => {
      const next = { ...prev };
      if (next[url] === type) delete next[url];
      else next[url] = type;
      return next;
    });
  }, []);

  useEffect(() => {
    setDisplayLimit(500);
  }, [activeTab, filterText, parsedData]);
  
  // Pipeline Settings
  const [checks, setChecks] = useState({
    isURL: true, hasHost: true, noLocal: true, noBlank: true, 
    noFrag: true, decodePct: true, noImg: true, uniq: true, 
    entropy: true, noExt: true, normParam: true, minLen: true
  });
  const [minLen, setMinLen] = useState(2);
  const [entThresh, setEntThresh] = useState(2.0);

  const fileInputRef = useRef(null);
  const rawInputRef = useRef(null);

  useEffect(() => {
    const storageKey = `bbSessions_${activeProjectId}`;
    const initStorage = async () => {
      try {
        const s = await localforage.getItem(storageKey);
        if (s) {
          setSessions(s);
        } else {
          // If active project is default, migrate legacy un-scoped data
          if (activeProjectId === "default") {
             const unScopedLocalforage = await localforage.getItem("bbSessions");
             if (unScopedLocalforage) {
                await localforage.setItem(storageKey, unScopedLocalforage);
                setSessions(unScopedLocalforage);
                return;
             }
             const legacy = localStorage.getItem("bbSessions");
             if (legacy) {
               const parsed = JSON.parse(legacy);
               await localforage.setItem(storageKey, parsed);
               setSessions(parsed);
               return;
             }
          }
          setSessions([]); // Clear state for new projects that have no sessions
        }
      } catch (e) { 
        console.error("IndexedDB initialization error:", e); 
      }
    };
    initStorage();
  }, [activeProjectId]);

  const saveSessionsStore = async (data) => {
    const storageKey = `bbSessions_${activeProjectId}`;
    try {
      await localforage.setItem(storageKey, data);
      setSessions(data);
      return true;
    } catch (e) {
      alert("Error saving session: IndexedDB storage failed.");
      console.error(e);
      return false;
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const currentVal = rawInputRef.current ? rawInputRef.current.value : rawInput;
      const newVal = currentVal ? currentVal + "\n" + evt.target.result : evt.target.result;
      setRawInput(newVal);
      if (rawInputRef.current) rawInputRef.current.value = newVal;
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const toggleCheck = (id) => setChecks(p => ({ ...p, [id]: !p[id] }));
  const toggleAll = (bool) => {
    const next = {};
    Object.keys(checks).forEach(k => next[k] = bool);
    setChecks(next);
  };

  const dedupFirst = () => {
    const currentVal = rawInputRef.current ? rawInputRef.current.value : rawInput;
    if (!currentVal) return;
    const lines = currentVal.split('\n').map(l => l.trim()).filter(Boolean);
    const dedup = [...new Set(lines)];
    const newVal = dedup.join('\n');
    setRawInput(newVal);
    if (rawInputRef.current) rawInputRef.current.value = newVal;
  };

  const runParse = async () => {
    if (isParsing) return;
    setIsParsing(true);
    setProgressInfo({ percent: 0, text: "Initializing engine..." });
    await new Promise(r => setTimeout(r, 50));

    const currentVal = rawInputRef.current ? rawInputRef.current.value : rawInput;
    if (currentVal !== rawInput) setRawInput(currentVal);
    if (!currentVal) { setIsParsing(false); return; }
    const lines = currentVal.split('\n').map(l => l.trim()).filter(Boolean);
    
    let processedCount = 0;
    let skippedCount = 0;
    
    // Normalized holding area
    const normalizedMap = new Map();

    // 1. Pipeline execution
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (i % 500 === 0) {
        setProgressInfo({ percent: Math.round((i / lines.length) * 50), text: `Normalizing: ${i.toLocaleString()} / ${lines.length.toLocaleString()}` });
        await new Promise(r => setTimeout(r, 0));
      }
      processedCount++;
      let current = raw;
      let skip = false;

      // decodePct applies FIRST to improve normalization and deduplication
      if (checks.decodePct) {
        try { current = decodeURIComponent(current); } catch(e) {}
      }

      let parsedObj;
      if (checks.isURL || checks.hasHost || checks.noLocal || checks.noBlank || checks.minLen || checks.noFrag || checks.normParam) {
         try {
           parsedObj = new URL(current);
         } catch(e) {
           if (checks.isURL) skip = true;
         }
      }

      if (!skip && parsedObj) {
        if (checks.hasHost && !parsedObj.hostname) skip = true;
        if (checks.noLocal && (parsedObj.hostname === 'localhost' || parsedObj.hostname.startsWith('127.') || parsedObj.hostname === '0.0.0.0' || parsedObj.hostname === '::1')) skip = true;
        if (checks.noFrag) { parsedObj.hash = ''; current = parsedObj.toString(); }
        
        // Param processing
        if (!skip && (checks.noBlank || checks.minLen || checks.normParam || checks.entropy)) {
          const params = new URLSearchParams(parsedObj.search);
          const toDelete = [];
          const paramArr = [];
          
          for (const [key, value] of params.entries()) {
            if (checks.noBlank && value === "") toDelete.push(key);
            else if (checks.minLen && value.length < minLen) toDelete.push(key);
            else {
              paramArr.push([key, value]);
            }
          }
          
          toDelete.forEach(k => params.delete(k));
          
          if (checks.normParam) {
            paramArr.sort((a,b) => a[0].localeCompare(b[0]));
            const newParams = new URLSearchParams();
            paramArr.forEach(([k,v]) => newParams.append(k,v));
            parsedObj.search = newParams.toString();
          } else {
             parsedObj.search = params.toString();
          }
          current = parsedObj.toString();
        }
      }

      if (!skip && checks.noImg && /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp|bmp|mp4|mp3)(\?|$)/i.test(current)) skip = true;
      if (!skip && checks.noExt && /\.(css|map)(\?|$)/i.test(current)) skip = true;

      if (skip) {
        skippedCount++;
        continue;
      }

      if (checks.uniq) {
        if (normalizedMap.has(current)) {
          skippedCount++;
          continue;
        }
      }

      // Check Entropy
      let highEntropy = false;
      if (checks.entropy && parsedObj) {
         const params = new URLSearchParams(parsedObj.search);
         let hasParams = false;
         for (const [_, value] of params.entries()) {
            hasParams = true;
            if (entropy(value) >= entThresh) {
               highEntropy = true;
               break;
            }
         }
         if (hasParams && !highEntropy) {
            skippedCount++;
            continue;
         }
      }

      normalizedMap.set(current, { url: current, highEntropy, original: raw });
    }

    // 2. Scoring & Regex Matching
    const newStats = { total: processedCount, skipped: skippedCount, matched: 0, criticals: 0, domainBreakdown: {} };
    CATEGORIES.forEach(c => newStats[c.id] = 0);
    const results = [];

    // 2. Vulnerability Checks
    const normalizedArr = Array.from(normalizedMap.values());
    for (let i = 0; i < normalizedArr.length; i++) {
      const data = normalizedArr[i];
      if (i % 500 === 0) {
        setProgressInfo({ percent: 50 + Math.round((i / normalizedArr.length) * 50), text: `Scanning for Vulnerabilities: ${i.toLocaleString()} / ${normalizedArr.length.toLocaleString()}` });
        await new Promise(r => setTimeout(r, 0));
      }
      const normUrl = data.url;
      let parsedObj;
      try { parsedObj = new URL(normUrl); } catch(e) {}
      
      if (parsedObj && parsedObj.hostname) {
         newStats.domainBreakdown[parsedObj.hostname] = (newStats.domainBreakdown[parsedObj.hostname] || 0) + 1;
      }

      let score = 0;
      const matchedCats = [];
      let isCritical = false;

      for (const cat of CATEGORIES) {
         if (cat.id === 'topRisk') continue;
         let matched = false;
         
         const urlStr = normUrl;
         let matchUrl = urlStr;
         if (checks.decodePct) {
           try { matchUrl = urlStr + "\n" + decodeURIComponent(urlStr); } catch(e) {}
         }

         const queryIdx = matchUrl.indexOf('?');
         const qString = queryIdx !== -1 ? matchUrl.substring(queryIdx) : '';

         if (cat.strict) {
           matched = cat.params && cat.params.test(qString) && cat.strict.test(matchUrl);
         } else if (cat.valueCheck) {
           matched = cat.params && cat.params.test(qString) && cat.valueCheck.test(qString);
         } else if (cat.params && cat.paths) {
           matched = cat.params.test(qString) || cat.paths.test(matchUrl);
         } else if (cat.params) {
           matched = cat.params.test(qString);
         } else if (cat.paths) {
           matched = cat.paths.test(matchUrl);
         }

         // Specific Overrides for False-Positive Reduction
         if (cat.id === 'auth') {
           matched = (cat.paths.test(matchUrl) && cat.params.test(qString)) || (cat.params && cat.params.test(qString) && cat.valueCheck && cat.valueCheck.test(qString));
         }
         if (cat.id === 'upload') {
           matched = cat.paths.test(matchUrl) && cat.params && cat.params.test(qString);
         }
         if (cat.id === 'git') {
           matched = cat.paths.test(matchUrl) || (cat.valueCheck && cat.valueCheck.test(qString));
         }
         if (cat.id === 'jwt') {
           matched = cat.params.test(matchUrl) || cat.paths.test(matchUrl);
         }
         if (cat.id === 'awsKeys') {
           matched = cat.paths.test(matchUrl) || (cat.params && cat.params.test(qString) && cat.valueCheck && cat.valueCheck.test(qString));
         }
         if (cat.id === 'firebase') {
           matched = cat.paths.test(matchUrl) || (cat.params && cat.params.test(qString));
         }
         if (cat.id === 'protoPollution') {
           matched = cat.params && cat.params.test(qString);
         }

         if (matched) {
            matchedCats.push(cat);
            score += cat.pts;
            newStats[cat.id]++;
            if (cat.sev === 'critical') isCritical = true;
         }
      }

      // CUSTOM REGEX EVALUATION
      let customMatch = false;
      for (const cr of customRegexes) {
         try {
           const regex = new RegExp(cr.pattern, 'i');
           if (regex.test(normUrl)) {
             customMatch = true;
           }
         } catch(e) {}
      }

      if (customMatch) {
         matchedCats.push({ id: 'custom_regex', label: 'Custom Regex', sev: 'custom', pts: 5 });
         score += 5;
         newStats['custom_regex']++;
      }

      if (matchedCats.length > 0) {
        if (isCritical) newStats.criticals++;
        newStats.matched++;
        
        let highestSev = 'low';
        let highestPts = 0;
        matchedCats.forEach(c => {
          if (c.pts > highestPts) {
            highestPts = c.pts;
            highestSev = c.sev;
          }
        });

        results.push({
          url: normUrl,
          original: data.original,
          score,
          severity: highestSev,
          categories: matchedCats.map(c => c.id),
          highEntropy: data.highEntropy
        });
      }
    }

    results.sort((a,b) => b.score - a.score);
    setParsedData(results);
    setStats(newStats);
    setActiveTab("topRisk");
    setIsParsing(false);
  };



  // Rendering Helpers
  const highlightUrl = React.useCallback((urlStr, currentTab, itemCategories) => {
    if (currentTab === "topRisk") {
      let html = escapeHtml(urlStr);
      html = html.replace(/([?&])([^=]+)(=)/g, '$1<span style="color:var(--color-brand-danger, #ef4444);font-weight:600;">$2</span>$3');
      html = html.replace(/(=)([^&]+)(?=&|$)/g, '$1<span style="color:var(--color-brand-warning, #f59e0b);">$2</span>');
      html = html.replace(/(ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,})/g, '<span style="color:var(--color-brand-info, #3b82f6);font-weight:600;background:rgba(59,130,246,0.1);padding:0 2px;border-radius:3px;">$1</span>');
      return { __html: html };
    }

    let cat = CATEGORIES.find(c => c.id === currentTab);
    if (!cat) return { __html: escapeHtml(urlStr) };
    
    if (cat.id === 'custom_regex') {
       const validPatterns = customRegexes.map(cr => {
         try { new RegExp(cr.pattern, 'i'); return cr.pattern; } catch(e) { return null; }
       }).filter(Boolean);
       if (validPatterns.length > 0) {
         cat = { ...cat, paths: new RegExp(`(${validPatterns.join('|')})`, 'i') };
       }
    }

    const intervals = [];
    const addMatches = (regex) => {
      if (!regex) return;
      try {
        const re = new RegExp(regex.source, 'gi');
        let match;
        while ((match = re.exec(urlStr)) !== null) {
          intervals.push([match.index, re.lastIndex]);
          if (re.lastIndex === match.index) re.lastIndex++; // prevent infinite loop
        }
      } catch(e) {}
    };

    addMatches(cat.paths);
    addMatches(cat.params);
    addMatches(cat.strict);
    addMatches(cat.valueCheck);

    if (intervals.length === 0) return { __html: escapeHtml(urlStr) };

    // Merge overlapping intervals
    intervals.sort((a, b) => a[0] - b[0]);
    const merged = [intervals[0]];
    for (let i = 1; i < intervals.length; i++) {
      const last = merged[merged.length - 1];
      const curr = intervals[i];
      if (curr[0] <= last[1]) {
        last[1] = Math.max(last[1], curr[1]);
      } else {
        merged.push(curr);
      }
    }

    // Build the final escaped HTML string
    let result = '';
    let lastIdx = 0;
    for (const [start, end] of merged) {
      result += escapeHtml(urlStr.substring(lastIdx, start));
      result += '<span style="background:rgba(239,68,68,0.2);color:var(--color-brand-danger, #ef4444);font-weight:700;padding:0 2px;border-radius:2px;">';
      result += escapeHtml(urlStr.substring(start, end));
      result += '</span>';
      lastIdx = end;
    }
    result += escapeHtml(urlStr.substring(lastIdx));

    return { __html: result };
  }, [customRegexes]);

  // Filter Data (Memoized and Deferred for Performance)
  const deferredFilterText = useDeferredValue(filterText);
  const activeData = useMemo(() => {
    let data = parsedData;
    if (activeTab !== 'topRisk') {
      data = data.filter(d => d.categories.includes(activeTab));
    }
    if (deferredFilterText) {
      const lower = deferredFilterText.toLowerCase();
      data = data.filter(d => d.url.toLowerCase().includes(lower));
    }
    return data;
  }, [parsedData, activeTab, deferredFilterText]);

  const exportCsv = () => {
    let csv = "URL,Score,Severity,Categories,Source\n";
    activeData.forEach(d => {
      const cats = d.categories.join('|');
      csv += `"${d.url}",${d.score},"${d.severity}","${cats}","${source}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recon_parsed_v4_${activeTab}.csv`;
    a.click();
  };

  const saveCurrentSession = async () => {
    try {
      const currentVal = rawInputRef.current ? rawInputRef.current.value : rawInput;
      if (!currentVal) {
        alert("No data to save! Import some URLs first.");
        return;
      }

      const name = `Target Session - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
      
      const newSession = {
        id: Date.now().toString(),
        name,
        date: new Date().toLocaleString(),
        source,
        summary: {
          topRisk: (parsedData && parsedData.length > 0) ? (parsedData[0]?.score || 0) : 0,
          ...stats
        },
        rawInput: currentVal,
        checks,
        urlStatuses,
        customRegexes
      };
      
      const success = await saveSessionsStore([...sessions, newSession]);
      if (success) {
        alert("Session saved successfully to IndexedDB! No memory limits!");
      }
    } catch (err) {
      alert("FATAL ERROR in saveCurrentSession: " + err.message + "\n\n" + err.stack);
      console.error(err);
    }
  };

  const wordlists = React.useMemo(() => {
    const keys = new Set();
    const vals = new Set();
    const paths = new Set();
    
    const sourceData = wordlistScope === 'active' ? activeData : parsedData;
    
    sourceData.forEach(d => {
      try {
        const url = new URL(d.original || d.url);
        // Extract Keys/Vals
        const params = new URLSearchParams(url.search);
        for (const [k, v] of params.entries()) {
          if (k) keys.add(k);
          if (v) vals.add(v);
        }
        
        // Extract Paths
        const segs = url.pathname.split('/').filter(Boolean);
        segs.forEach(seg => {
           // Skip numeric and very short segments
           if (seg.length > 2 && !/^\d+$/.test(seg)) {
             paths.add(seg);
           }
        });
      } catch (e) {}
    });
    
    return {
      keys: Array.from(keys).sort().join('\n'),
      vals: Array.from(vals).sort().join('\n'),
      paths: Array.from(paths).sort().join('\n')
    };
  }, [parsedData, activeData, wordlistScope]);

  const checkTooltips = {
    isURL: "Ensures the string is a mathematically valid URL struct.",
    hasHost: "Ensures the URL has a domain/hostname attached.",
    noLocal: "Drops localhost, 127.0.0.1, and internal test IPs.",
    noBlank: "Removes parameters that have no value assigned.",
    noFrag: "Removes URL fragments (#) since they are never sent to the backend.",
    decodePct: "URL-decodes the string before regex matching to uncover hidden payloads.",
    noImg: "Drops URLs ending in static image/media extensions.",
    uniq: "Strict deduplication to remove identical URLs.",
    entropy: "Calculates mathematical randomness to flag hidden keys, JWTs, or tokens.",
    noExt: "Drops static file extensions like .css or .map.",
    normParam: "Alphabetizes parameter order to drastically improve deduplication."
  };

  return (
    <div className="url-parser-wrap">
      <style>{`
        .url-parser-wrap {
          font-family: var(--font-sans, "Inter", system-ui, sans-serif);
          color: var(--color-text-primary, #111827);
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .url-parser-wrap strong { font-weight: 600; }
        
        .stat-card-v4 {
          position: relative;
          padding: 16px;
          border-radius: 16px;
          cursor: pointer;
          text-align: center;
          background: var(--color-background-secondary, #f3f4f6);
          border: 1px solid var(--color-border-tertiary, #e5e7eb);
          backdrop-filter: blur(10px);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
          color: var(--color-text-primary);
        }
        .stat-card-v4::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 2px;
          background: transparent;
          transition: all 0.2s;
        }
        .stat-card-v4:hover {
          transform: translateY(-3px);
          background: rgba(31, 41, 55, 0.9);
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
        }
        .stat-card-v4.active {
          background: var(--color-background-primary, #ffffff);
          border-color: var(--color-border-secondary, #d1d5db);
          box-shadow: inset 0 2px 10px rgba(0,0,0,0.05);
        }
        
        .tab-pill {
          padding: 8px 16px;
          border-radius: 20px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--color-text-secondary, #6b7280);
          cursor: pointer;
          font-weight: 500;
          font-size: 13px;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .tab-pill:hover {
          color: var(--color-text-primary, #111827);
          background: var(--color-background-tertiary, #e5e7eb);
        }
        .tab-pill.active {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        
        .btn-premium {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #fff;
          padding: 10px 24px;
          border-radius: 8px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          font-size: 15px;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }
        .btn-premium:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
        }
        
        .btn-secondary {
          background: var(--color-background-secondary, #f3f4f6);
          border: 1px solid var(--color-border-tertiary, #e5e7eb);
          color: var(--color-text-primary, #374151);
          padding: 10px 16px;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-secondary:hover {
          background: var(--color-background-tertiary, #e5e7eb);
          color: var(--color-text-primary, #111827);
        }
        
        .glass-panel {
          background: var(--color-background-secondary, #ffffff);
          border: 1px solid var(--color-border-tertiary, #e5e7eb);
          border-radius: 12px;
          backdrop-filter: blur(10px);
        }
        
        .url-row-v4 {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--color-border-tertiary, #e5e7eb);
          transition: background 0.1s;
        }
        .url-row-v4:hover {
          background: var(--color-background-tertiary, #f3f4f6);
        }
        .url-row-v4:last-child {
          border-bottom: none;
        }
        
        .highlighted-url-v4 {
          font-family: var(--font-mono, "Fira Code", monospace);
          font-size: 13px;
          word-break: break-all;
          line-height: 1.5;
          color: var(--color-text-primary, #111827);
        }
        .highlighted-url-v4 em {
          font-style: normal;
        }
        
        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
      `}</style>
      
      {/* 1. Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)" }}>
            🔗
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "700", letterSpacing: "-0.5px" }}>URL Parser</h1>
            <div style={{ fontSize: "13px", color: "var(--color-text-secondary, #6b7280)" }}>Advanced v4 Multi-Pass Validation Engine</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <div className="glass-panel" style={{ padding: "4px", display: "flex", borderRadius: "8px" }}>
             {SOURCES.map(s => (
               <button 
                 key={s} 
                 onClick={() => setSource(s)}
                 style={{ 
                   padding: "6px 12px", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: "500", cursor: "pointer",
                   background: source === s ? "var(--color-background-tertiary, #e5e7eb)" : "transparent",
                   color: source === s ? "var(--color-text-primary, #111827)" : "var(--color-text-secondary, #6b7280)",
                   transition: "all 0.2s"
                 }}
               >{s}</button>
             ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "24px", marginBottom: "24px" }}>
        
        {/* Left Column: Input */}
        <div className="glass-panel" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border-tertiary, #e5e7eb)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px", fontWeight: "600" }}>Raw URLs</span>
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary, #6b7280)", background: "var(--color-background-tertiary, #e5e7eb)", padding: "2px 8px", borderRadius: "12px" }}>{rawInput ? rawInput.split('\n').filter(Boolean).length : 0} lines</span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => fileInputRef.current.click()} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "12px" }}>📂 Import File</button>
              <input type="file" ref={fileInputRef} style={{ display: "none" }} accept=".txt,.csv" onChange={handleFileUpload} />
              <button onClick={() => { setRawInput(""); if (rawInputRef.current) rawInputRef.current.value = ""; }} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "12px", color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.2)" }}>🗑 Clear</button>
            </div>
          </div>
          <textarea 
            ref={rawInputRef}
            placeholder="Paste raw URLs here or drag & drop a file..." 
            defaultValue={rawInput} 
            onBlur={(e) => setRawInput(e.target.value)}
            spellCheck="false"
            wrap="off"
            style={{ 
              flex: 1, minHeight: "200px", width: "100%", background: "transparent", border: "none", color: "var(--color-text-primary, #111827)", 
              fontFamily: "var(--font-mono, monospace)", fontSize: "13px", padding: "16px", outline: "none", resize: "vertical", whiteSpace: "pre" 
            }}
          />
        </div>

        {/* Right Column: Settings */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="glass-panel" style={{ padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", alignItems: "center" }}>
              <strong style={{ fontSize: "14px" }}>Validation Pipeline</strong>
              <div style={{ display: "flex", gap: "4px" }}>
                <button onClick={() => toggleAll(true)} style={{ fontSize:"11px", background:"rgba(16,185,129,0.1)", border:"none", color:"#10b981", padding: "2px 6px", borderRadius: "4px", cursor:"pointer" }}>All</button>
                <button onClick={() => toggleAll(false)} style={{ fontSize:"11px", background:"rgba(239,68,68,0.1)", border:"none", color:"#ef4444", padding: "2px 6px", borderRadius: "4px", cursor:"pointer" }}>None</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {Object.keys(checks).map(k => (
                <label key={k} title={checkTooltips[k]} style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: checks[k] ? "var(--color-text-primary, #111827)" : "var(--color-text-secondary, #6b7280)" }}>
                  <input type="checkbox" checked={checks[k]} onChange={() => toggleCheck(k)} style={{ accentColor: "#10b981" }} />
                  {k}
                </label>
              ))}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: "16px" }}>
             <strong style={{ fontSize: "14px", display: "block", marginBottom: "16px" }}>Sensitivity Tweaks</strong>
             <div style={{ marginBottom: "16px" }}>
               <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--color-text-secondary, #6b7280)", marginBottom: "8px" }}>
                 <span>Min Param Value Length</span><span style={{ color: "var(--color-text-primary, #111827)", fontWeight: "bold" }}>{minLen}</span>
               </div>
               <input type="range" min="1" max="10" value={minLen} onChange={e => setMinLen(Number(e.target.value))} style={{ width: "100%", accentColor: "#10b981" }} />
             </div>
             <div>
               <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--color-text-secondary, #6b7280)", marginBottom: "8px" }}>
                 <span>Shannon Entropy Threshold</span><span style={{ color: "var(--color-text-primary, #111827)", fontWeight: "bold" }}>{entThresh}</span>
               </div>
               <input type="range" min="0" max="4" step="0.1" value={entThresh} onChange={e => setEntThresh(Number(e.target.value))} style={{ width: "100%", accentColor: "#10b981" }} />
              </div>
           </div>

           <div className="glass-panel" style={{ padding: "16px", marginTop: "16px" }}>
             <strong style={{ fontSize: "14px", display: "block", marginBottom: "16px" }}>Custom Signatures</strong>
             <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
               <input type="text" placeholder="Label (e.g. Internal IP)" value={newCustomLabel} onChange={e => setNewCustomLabel(e.target.value)} style={{ padding: "8px", fontSize: "12px", borderRadius: "6px", border: "1px solid var(--color-border-tertiary, #e5e7eb)", outline: "none", background: "var(--color-background-secondary, #ffffff)", color: "var(--color-text-primary, #111827)" }} />
               <input type="text" placeholder="Regex Pattern (e.g. 10\.\d+)" value={newCustomPattern} onChange={e => setNewCustomPattern(e.target.value)} style={{ padding: "8px", fontSize: "12px", borderRadius: "6px", border: "1px solid var(--color-border-tertiary, #e5e7eb)", outline: "none", fontFamily: "var(--font-mono, monospace)", background: "var(--color-background-secondary, #ffffff)", color: "var(--color-text-primary, #111827)" }} />
               <button onClick={addCustomRegex} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "12px", fontWeight: "600" }}>+ Add Rule (5 pts)</button>
             </div>
             {customRegexes.length > 0 && (
               <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                 {customRegexes.map(r => (
                   <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px", background: "rgba(139, 92, 246, 0.05)", border: "1px solid rgba(139, 92, 246, 0.2)", borderRadius: "6px" }}>
                     <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", paddingRight: "8px" }}>
                       <span style={{ fontSize: "12px", fontWeight: "600", color: "#8b5cf6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span>
                       <span style={{ fontSize: "10px", fontFamily: "var(--font-mono, monospace)", color: "var(--color-text-secondary, #6b7280)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.pattern}</span>
                     </div>
                     <button onClick={() => removeCustomRegex(r.id)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px", color: "#ef4444", flexShrink: 0 }}>🗑️</button>
                   </div>
                 ))}
               </div>
             )}
           </div>

        </div>

      </div>

      {/* Progress Bar & Actions */}
      <div style={{ marginBottom: "32px" }}>
        {isParsing && (
          <div style={{ marginBottom: "16px", background: "var(--color-background-secondary, #f8f9fa)", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--color-border-tertiary, #e5e7eb)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "600", marginBottom: "8px", color: "var(--color-text-secondary, #6b7280)" }}>
              <span>{progressInfo.text}</span>
              <span style={{ color: "#10b981" }}>{progressInfo.percent}%</span>
            </div>
            <div style={{ width: "100%", height: "6px", background: "rgba(16, 185, 129, 0.1)", borderRadius: "4px", overflow: "hidden" }}>
              <div style={{ height: "100%", background: "#10b981", width: `${progressInfo.percent}%`, transition: "width 0.1s linear" }}></div>
            </div>
          </div>
        )}
        
        <div style={{ display: "flex", gap: "12px" }}>
          <button className="btn-premium" onClick={runParse} disabled={isParsing} style={{ opacity: isParsing ? 0.7 : 1 }}>
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {isParsing ? (
                 <>
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="30" strokeDashoffset="10"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" /></circle></svg>
                   Processing...
                 </>
              ) : (
                 <>
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3l14 9-14 9V3z"/></svg>
                   Parse & Analyze Intelligence
                 </>
              )}
            </span>
          </button>
          <button className="btn-secondary" onClick={dedupFirst} disabled={isParsing}>🔗 Dedup First</button>
          <button className="btn-secondary" onClick={exportCsv} disabled={isParsing}>📦 Export CSV</button>
          <button className="btn-secondary" onClick={saveCurrentSession} disabled={isParsing}>💾 Save Session</button>
        </div>
      </div>

      {/* Results Section */}
      {stats.total !== undefined && (
        <div style={{ animation: "fadeIn 0.4s ease" }}>
          
          <div className="glass-panel" style={{ display: "flex", padding: "0", marginBottom: "24px", overflow: "hidden" }}>
            <div style={{ flex: 1, padding: "16px 24px", display: "flex", flexDirection: "column", borderRight: "1px solid var(--color-border-tertiary, #e5e7eb)" }}>
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary, #6b7280)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Processed</span>
              <span style={{ fontSize: "24px", fontWeight: "700" }}>{stats.total.toLocaleString()}</span>
            </div>
            <div style={{ flex: 1, padding: "16px 24px", display: "flex", flexDirection: "column", borderRight: "1px solid var(--color-border-tertiary, #e5e7eb)" }}>
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary, #6b7280)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Skipped</span>
              <span style={{ fontSize: "24px", fontWeight: "700", color: "var(--color-text-secondary, #6b7280)" }}>{stats.skipped.toLocaleString()}</span>
            </div>
            <div style={{ flex: 1, padding: "16px 24px", display: "flex", flexDirection: "column", borderRight: "1px solid var(--color-border-tertiary, #e5e7eb)" }}>
              <span style={{ fontSize: "12px", color: "#10b981", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Matched</span>
              <span style={{ fontSize: "24px", fontWeight: "700", color: "#10b981" }}>{stats.matched.toLocaleString()}</span>
            </div>
            <div style={{ flex: 1, padding: "16px 24px", display: "flex", flexDirection: "column", background: "rgba(239, 68, 68, 0.05)" }}>
              <span style={{ fontSize: "12px", color: "#ef4444", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Criticals</span>
              <span style={{ fontSize: "24px", fontWeight: "700", color: "#ef4444" }}>{stats.criticals.toLocaleString()}</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "16px", marginBottom: "32px" }}>
            {CATEGORIES.map(c => {
              const count = stats[c.id] || 0;
              const isActive = activeTab === c.id;
              const color = getSevColor(c.sev);
              
              return (
                <div 
                  key={c.id} 
                  onClick={() => setActiveTab(c.id)}
                  className={`stat-card-v4 ${isActive ? 'active' : ''}`}
                  style={{ opacity: count === 0 && !isActive ? 0.4 : 1 }}
                >
                  <style>{`
                    .stat-card-v4.active[data-id="${c.id}"]::before { background: ${color}; }
                    .stat-card-v4[data-id="${c.id}"]:hover::before { background: ${color}; opacity: 0.5; }
                  `}</style>
                  <div data-id={c.id} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none" }}></div>
                  <div style={{ fontSize: "32px", fontWeight: "800", color: count > 0 ? color : "var(--color-text-primary, #111827)", marginBottom: "8px", letterSpacing: "-1px" }}>{count.toLocaleString()}</div>
                  <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", color: "var(--color-text-primary, #111827)" }}>{c.label}</div>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: "700", color: color, letterSpacing: "1px" }}>{c.sev}</div>
                </div>
              )
            })}
          </div>

          {/* Domain Breakdown UI */}
          {stats.domainBreakdown && Object.keys(stats.domainBreakdown).length > 0 && (
            <div style={{ marginBottom: "32px" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", color: "#10b981", padding: "6px 12px", borderRadius: "16px", fontSize: "13px", fontWeight: "600", marginBottom: "16px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                Domain Breakdown ({Object.keys(stats.domainBreakdown).length})
              </div>
              <div className="glass-panel" style={{ padding: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
                  {Object.entries(stats.domainBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([domain, count]) => (
                      <div key={domain} style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center", 
                        padding: "12px 16px", 
                        background: "var(--color-background-secondary, #f8f9fa)", 
                        border: "1px solid var(--color-border-tertiary, #e5e7eb)",
                        borderRadius: "8px", 
                        fontSize: "13px",
                        gap: "12px"
                      }}>
                        <span style={{ 
                          color: "#10b981", 
                          fontWeight: "600", 
                          fontFamily: "var(--font-mono, monospace)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }} title={domain}>
                          {domain}
                        </span>
                        <span style={{ 
                          color: "var(--color-text-secondary, #6b7280)",
                          whiteSpace: "nowrap",
                          fontWeight: "500"
                        }}>
                          {count.toLocaleString()} URLs
                        </span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          )}

          <div className="glass-panel" style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--color-border-tertiary, #e5e7eb)", background: "var(--color-background-tertiary, #f9fafb)" }}>
              <div style={{ display: "flex", overflowX: "auto", gap: "8px" }}>
                <button 
                  onClick={() => setActiveTab("topRisk")}
                  className={`tab-pill ${activeTab === 'topRisk' ? 'active' : ''}`}
                >
                  🔥 Top Risk
                </button>
                {CATEGORIES.filter(c => stats[c.id] > 0).map(c => (
                   <button 
                    key={c.id}
                    onClick={() => setActiveTab(c.id)}
                    className={`tab-pill ${activeTab === c.id ? 'active' : ''}`}
                    style={activeTab === c.id ? { color: getSevColor(c.sev), borderColor: getSevColor(c.sev), background: `${getSevColor(c.sev)}15` } : {}}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              
              <div style={{ marginLeft: "16px" }}>
                 <input 
                   type="text" 
                   placeholder="Filter URLs..." 
                   value={filterText}
                   onChange={e => setFilterText(e.target.value)}
                   style={{ 
                     padding: "8px 16px", borderRadius: "20px", background: "var(--color-background-secondary, #ffffff)", color: "var(--color-text-primary, #111827)", 
                     border: "1px solid var(--color-border-tertiary, #e5e7eb)", fontSize: "13px", width: "200px", outline: "none" 
                   }}
                 />
              </div>
            </div>

            <div style={{ height: "600px", overflow: "hidden" }}>
              <Virtuoso
                style={{ height: '100%', width: '100%' }}
                totalCount={activeData.length}
                itemContent={(i) => {
                  const d = activeData[i];
                  return (
                    <UrlRow 
                      d={d}
                      i={i}
                      activeTab={activeTab}
                      status={urlStatuses[d.url]}
                      isCopied={copiedState === `url-${i}`}
                      onToggleStatus={toggleUrlStatus}
                      onCopy={handleCopy}
                      highlightUrl={highlightUrl}
                    />
                  );
                }}
              />
              {activeData.length === 0 && <div style={{ padding: "48px", textAlign: "center", color: "var(--color-text-secondary, #6b7280)", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "32px" }}>🔍</span>
                <span>No URLs matched for this view.</span>
              </div>}
            </div>
          </div>
        </div>
      )}

      {/* Wordlist Generator Section */}
      {parsedData.length > 0 && (
        <div style={{ marginTop: "48px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>Wordlist Generator</h2>
            <div style={{ display: "flex", gap: "8px", background: "var(--color-background-tertiary, #e5e7eb)", padding: "4px", borderRadius: "8px" }}>
              <button 
                onClick={() => setWordlistScope('active')}
                style={{ padding: "6px 16px", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: "600", cursor: "pointer", background: wordlistScope === 'active' ? "var(--color-background-primary, #ffffff)" : "transparent", color: wordlistScope === 'active' ? "#111827" : "#6b7280", boxShadow: wordlistScope === 'active' ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
              >Active Tab Only</button>
              <button 
                onClick={() => setWordlistScope('all')}
                style={{ padding: "6px 16px", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: "600", cursor: "pointer", background: wordlistScope === 'all' ? "var(--color-background-primary, #ffffff)" : "transparent", color: wordlistScope === 'all' ? "#111827" : "#6b7280", boxShadow: wordlistScope === 'all' ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
              >All Parsed URLs</button>
            </div>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
             <div className="glass-panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
               <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border-tertiary, #e5e7eb)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                 <strong style={{ fontSize: "14px" }}>Parameter Keys</strong>
                 <button className="btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleCopy(wordlists.keys, 'wl-keys')}>
                   {copiedState === 'wl-keys' ? <span style={{ color: "#10b981" }}>✓ Copied</span> : "Copy Full List"}
                 </button>
               </div>
               <textarea readOnly value={wordlists.keys.length > 5000 ? wordlists.keys.substring(0, 5000) + "\n\n... [Preview Truncated. Click Copy for Full List]" : wordlists.keys} style={{ width: "100%", height: "200px", border: "none", background: "transparent", padding: "16px", fontSize: "12px", fontFamily: "monospace", resize: "vertical", outline: "none" }} />
             </div>
             <div className="glass-panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
               <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border-tertiary, #e5e7eb)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                 <strong style={{ fontSize: "14px" }}>Parameter Values</strong>
                 <button className="btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleCopy(wordlists.vals, 'wl-vals')}>
                   {copiedState === 'wl-vals' ? <span style={{ color: "#10b981" }}>✓ Copied</span> : "Copy Full List"}
                 </button>
               </div>
               <textarea readOnly value={wordlists.vals.length > 5000 ? wordlists.vals.substring(0, 5000) + "\n\n... [Preview Truncated. Click Copy for Full List]" : wordlists.vals} style={{ width: "100%", height: "200px", border: "none", background: "transparent", padding: "16px", fontSize: "12px", fontFamily: "monospace", resize: "vertical", outline: "none" }} />
             </div>
             <div className="glass-panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
               <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border-tertiary, #e5e7eb)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                 <strong style={{ fontSize: "14px" }}>Path Segments</strong>
                 <button className="btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleCopy(wordlists.paths, 'wl-paths')}>
                   {copiedState === 'wl-paths' ? <span style={{ color: "#10b981" }}>✓ Copied</span> : "Copy Full List"}
                 </button>
               </div>
               <textarea readOnly value={wordlists.paths.length > 5000 ? wordlists.paths.substring(0, 5000) + "\n\n... [Preview Truncated. Click Copy for Full List]" : wordlists.paths} style={{ width: "100%", height: "200px", border: "none", background: "transparent", padding: "16px", fontSize: "12px", fontFamily: "monospace", resize: "vertical", outline: "none" }} />
             </div>
          </div>
        </div>
      )}

      {/* Sessions Section */}
      <div style={{ marginTop: "48px" }}>
        <button onClick={() => setShowSessions(!showSessions)} style={{ background: "transparent", border: "none", color: "var(--color-text-primary, #111827)", fontWeight: "600", fontSize: "18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", padding: "0" }}>
          {showSessions ? "▼" : "▶"} Saved Intelligence Sessions <span style={{ background: "var(--color-background-tertiary, #e5e7eb)", padding: "2px 8px", borderRadius: "12px", fontSize: "12px" }}>{sessions.length}</span>
        </button>
        
        {showSessions && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "16px", marginTop: "24px" }}>
            {sessions.map(s => (
              <div key={s.id} className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div style={{ fontWeight: "600", fontSize: "16px", color: "var(--color-text-primary, #111827)" }}>{s.name}</div>
                    <div style={{ fontSize: "11px", color: "#ef4444", fontWeight: "bold", background: "rgba(239,68,68,0.1)", padding: "2px 8px", borderRadius: "12px" }}>{s.summary?.topRisk || 0} pts</div>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--color-text-secondary, #6b7280)" }}>{s.date} · {s.summary?.total || 0} processed URLs · Source: {s.source}</div>
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
                   <button onClick={() => { 
                     if (s.rawInput) {
                      setRawInput(s.rawInput);
                      if (rawInputRef.current) rawInputRef.current.value = s.rawInput;
                       if (s.checks) setChecks(s.checks);
                       if (s.urlStatuses) setUrlStatuses(s.urlStatuses);
                       if (s.customRegexes) setCustomRegexes(s.customRegexes);
                       setSource(s.source);
                       alert("Session Rehydrated!\n\nThe raw text has been loaded. Click 'Parse & Analyze Intelligence' to instantly reconstruct the dashboard.");
                     } else {
                       alert("Legacy sessions are no longer supported. Please delete this session.");
                     }
                   }} className="btn-secondary" style={{ flex: 1, padding: "8px" }}>Load Session</button>
                   <button onClick={() => { saveSessionsStore(sessions.filter(x => x.id !== s.id)) }} className="btn-secondary" style={{ padding: "8px", color: "#ef4444", borderColor: "rgba(239,68,68,0.2)" }}>Delete</button>
                </div>
              </div>
            ))}
            {sessions.length === 0 && <div style={{ color: "var(--color-text-secondary, #6b7280)", fontSize: "14px", fontStyle: "italic" }}>No saved sessions yet.</div>}
          </div>
        )}
      </div>

    </div>
  );
});

export default ReconUrlParser;
