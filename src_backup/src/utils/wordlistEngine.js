export const generateWordlist = (companyName, techStackId, customWords, customStacksConfig = []) => {
  const wordlist = new Set();
  const cName = companyName.trim().toLowerCase();

  // Check if it's a custom stack
  const customStack = customStacksConfig.find(s => s.id === techStackId);

  // 1. Base universally critical files (Only add if NOT using a strict custom stack)
  if (!customStack) {
    const baseFiles = [
      ".env", ".env.backup", ".env.old", ".env.dev", ".env.prod", ".env.stage", ".env.local", ".env.test",
      ".git/config", ".git/HEAD", ".git/index", ".git/logs/HEAD", ".gitignore", ".gitmodules",
      ".svn/entries", ".svn/wc.db", ".bzr", ".hg",
      ".DS_Store", "Thumbs.db", "desktop.ini",
      "backup.zip", "backup.tar.gz", "backup.sql", "backup.bak", "backup.rar", "backup.7z",
      "db.sql", "db.sqlite", "database.sql", "database.sqlite", "dump.sql",
      "server-status", "server-info", "admin", "administrator", "login", "auth", "dashboard",
      "api", "api/v1", "api/v2", "api/v3", "v1", "v2", "v3",
      "swagger.json", "swagger-ui.html", "openapi.json", "api-docs", "docs",
      "graphql", "graphiql", "altair", "playground",
      "robots.txt", "sitemap.xml", "crossdomain.xml", "clientaccesspolicy.xml",
      "test", "testing", "dev", "development", "stage", "staging", "uat", "prod", "production",
      "old", "old_files", "old-site", "new", "new-site", "beta", "alpha",
      "config", "configuration", "settings", "setup", "install", "installer",
      "logs", "log", "error.log", "access.log", "debug.log",
      "cache", "tmp", "temp", "public", "private", "secret", "secrets",
      "users", "user", "profile", "account", "register", "signup", "forgot", "reset", "password",
      "mail", "email", "webmail", "web", "www", "root", "src", "dist", "build",
      "docs", "doc", "manual", "help", "support", "faq", "contact", "about", "terms", "privacy",
      "rss", "atom", "feed", "xml", "json", "csv", "pdf", "download", "downloads",
      "release", "releases", "update", "updates", "version",
      "ping", "health", "check", "status", "metrics", "monitor", "monitoring",
      "prometheus", "grafana", "kibana", "elasticsearch", "redis", "memcached",
      "rabbitmq", "kafka", "zookeeper", "etcd", "consul", "vault",
      "adminer", "pma", "phpmyadmin", "mysql", "sql", "sqlite", "postgres",
      "assets", "css", "js", "images", "img", "uploads", "upload", "files", "media", "static",
      "wp-admin", "wp-login.php", "wp-config.php", "wp-content", "wp-includes",
      "joomla", "drupal", "magento", "moodle", "typo3",
      "manager", "host-manager", "jmx-console", "web-console",
      "server", "app", "main", "index", "home", "default",
      "docker-compose.yml", "Dockerfile", "Vagrantfile", "Makefile", "build.xml", "pom.xml",
      "package.json", "package-lock.json", "yarn.lock", "composer.json", "composer.lock",
      "requirements.txt", "Pipfile", "Pipfile.lock", "Gemfile", "Gemfile.lock",
      "id_rsa", "id_rsa.pub", "authorized_keys", "known_hosts", "ssh", ".ssh",
      "aws", ".aws", "credentials", "config.json", "settings.json",
      "test.php", "test.html", "test.txt", "test.json", "test.xml"
    ];
    baseFiles.forEach(w => wordlist.add(w));
  }

  // 2. Company Name Permutations (Only if company name provided)
  if (cName) {
    const companyPerms = [
      cName,
      `${cName}admin`, `${cName}-admin`, `${cName}_admin`, `admin-${cName}`, `admin_${cName}`,
      `${cName}-dev`, `${cName}_dev`, `dev-${cName}`, `dev_${cName}`,
      `${cName}-stage`, `${cName}_stage`, `stage-${cName}`, `stage_${cName}`,
      `${cName}-staging`, `${cName}_staging`, `staging-${cName}`, `staging_${cName}`,
      `${cName}-uat`, `${cName}_uat`, `uat-${cName}`, `uat_${cName}`,
      `${cName}-prod`, `${cName}_prod`, `prod-${cName}`, `prod_${cName}`,
      `${cName}-api`, `${cName}_api`, `api-${cName}`, `api_${cName}`,
      `${cName}-test`, `${cName}_test`, `test-${cName}`, `test_${cName}`,
      `${cName}-beta`, `${cName}_beta`, `beta-${cName}`, `beta_${cName}`,
      `${cName}-corp`, `${cName}_corp`, `corp-${cName}`, `corp_${cName}`,
      `${cName}-internal`, `${cName}_internal`, `internal-${cName}`, `internal_${cName}`,
      `${cName}-portal`, `${cName}_portal`, `portal-${cName}`, `portal_${cName}`,
      `${cName}-login`, `${cName}_login`, `login-${cName}`, `login_${cName}`,
      `${cName}-auth`, `${cName}_auth`, `auth-${cName}`, `auth_${cName}`,
      `${cName}-app`, `${cName}_app`, `app-${cName}`, `app_${cName}`,
      `${cName}-web`, `${cName}_web`, `web-${cName}`, `web_${cName}`,
      `${cName}-v1`, `${cName}_v1`, `v1-${cName}`, `v1_${cName}`,
      `${cName}-v2`, `${cName}_v2`, `v2-${cName}`, `v2_${cName}`,
      `${cName}1`, `${cName}2`, `${cName}3`, `${cName}2023`, `${cName}2024`, `${cName}2025`,
      `old-${cName}`, `new-${cName}`, `backup-${cName}`
    ];
    companyPerms.forEach(w => wordlist.add(w));
  }

  // 3. Tech Stack Specific
  const techFiles = [];
  let extensions = [];

  if (customStack) {
    // Custom Stack
    if (customStack.extensions) {
      extensions = customStack.extensions.split(',').map(e => e.trim()).filter(e => e);
    }
  } else {
    // Built-in Stacks
    switch (techStackId) {
      case "php":
        const phpFiles = [
          "config.php", "info.php", "phpinfo.php", "test.php", "upload.php", "db.php", "database.php",
          "index.php", "login.php", "admin.php", "dashboard.php", "home.php", "main.php", "app.php",
          "wp-config.php", "wp-config.php.bak", "wp-config.php.old", "wp-config.php.save",
          "xmlrpc.php", "wp-login.php", "wp-admin", "phpmyadmin", "pma",
          ".htaccess", ".htpasswd", ".user.ini", "php.ini",
          "composer.json", "composer.lock", "vendor", "vendor/autoload.php",
          "phpunit.xml", "artisan", "server.php", "public/index.php",
          "debug.php", "setup.php", "install.php", "upgrade.php", "update.php",
          "api.php", "ajax.php", "cron.php", "mail.php", "search.php", "register.php", "profile.php",
          "password.php", "reset.php", "forgot.php", "logout.php", "auth.php", "session.php",
          "info.php.bak", "config.php.bak", "db.php.bak", "database.php.bak"
        ];
        techFiles.push(...phpFiles);
        extensions = [".php", ".php.bak", ".php.old", ".php~", ".php.save", ".php.swp", ".phtml", ".php5", ".php7", ".php8"];
        break;
      case "spring":
        const springFiles = [
          "actuator", "actuator/env", "actuator/heapdump", "actuator/health", "actuator/prometheus",
          "actuator/mappings", "actuator/threaddump", "actuator/metrics", "actuator/info", "actuator/loggers",
          "actuator/httptrace", "actuator/sessions", "actuator/beans", "actuator/conditions", "actuator/configprops",
          "swagger-ui.html", "swagger-ui/index.html", "v2/api-docs", "v3/api-docs", "api-docs",
          "WEB-INF/web.xml", "WEB-INF/classes/", "WEB-INF/lib/", "WEB-INF/spring-servlet.xml",
          "META-INF/MANIFEST.MF", "META-INF/context.xml",
          "manager/html", "host-manager/html", "jmx-console", "web-console",
          "index.jsp", "login.jsp", "admin.jsp", "error.jsp", "index.action", "login.action", "admin.action",
          "index.do", "login.do", "admin.do"
        ];
        techFiles.push(...springFiles);
        extensions = [".jsp", ".jspx", ".do", ".action", ".jspf", ".jsp.bak"];
        break;
      case "aspnet":
        const aspnetFiles = [
          "web.config", "Web.config", "web.config.bak", "web.config.old", "web.config.save",
          "trace.axd", "elmah.axd", "WebResource.axd", "ScriptResource.axd",
          "Default.aspx", "Login.aspx", "Admin.aspx", "Dashboard.aspx", "Home.aspx", "Main.aspx",
          "Global.asax", "App_Data", "App_Code", "App_Browsers", "App_GlobalResources",
          "api", "api/values", "swagger/v1/swagger.json",
          "Test.aspx", "Upload.aspx", "Register.aspx", "Profile.aspx", "Password.aspx",
          "appsettings.json", "appsettings.Development.json", "appsettings.Production.json",
          "web.config.txt"
        ];
        techFiles.push(...aspnetFiles);
        extensions = [".aspx", ".ashx", ".asmx", ".svc", ".aspx.bak", ".aspx.cs", ".aspx.vb", ".dll", ".pdb"];
        break;
      case "node":
        const nodeFiles = [
          "package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
          "server.js", "app.js", "index.js", "main.js", "ecosystem.config.js", "pm2.config.js",
          "node_modules", ".npmrc", ".yarnrc",
          "webpack.config.js", "babel.config.js", "gulpfile.js", "Gruntfile.js",
          "tsconfig.json", "tslint.json", "eslintrc.json", "prettierrc.json",
          "api/index.js", "src/index.js", "dist/index.js", "build/index.js",
          "routes.js", "config.js", "database.js", "db.js", "settings.js"
        ];
        techFiles.push(...nodeFiles);
        extensions = [".js", ".json", ".ts", ".jsx", ".tsx", ".js.map"];
        break;
      case "python":
        const pyFiles = [
          "requirements.txt", "Pipfile", "Pipfile.lock", "setup.py", "tox.ini",
          "manage.py", "wsgi.py", "app.py", "main.py", "server.py", "run.py",
          "__init__.py", "__pycache__", ".venv", "venv", "env",
          "settings.py", "config.py", "database.py", "models.py", "views.py", "urls.py",
          "flask_app.py", "django_app.py", "fastapi_app.py",
          "celeryconfig.py", "celery.py", "tasks.py",
          "pyproject.toml", "poetry.lock"
        ];
        techFiles.push(...pyFiles);
        extensions = [".py", ".pyc", ".pyo", ".pyd"];
        break;
      default:
        extensions = [".html", ".json", ".txt", ".xml", ".csv"];
        break;
    }
  }

  techFiles.forEach(w => wordlist.add(w));

  // 4. Custom Words & Mutations (Includes Vault Base Words passed via techFiles + the one-off textarea)
  let allWordsToMutate = [];
  if (customWords && customWords.trim()) {
    allWordsToMutate = [...allWordsToMutate, ...customWords.split(/\r?\n/).map(w => w.trim()).filter(w => w !== "")];
  }
  
  if (customStack && customStack.baseWords) {
    allWordsToMutate = [...allWordsToMutate, ...customStack.baseWords.split(/\r?\n/).map(w => w.trim()).filter(w => w !== "")];
  }

  // Deduplicate words to mutate
  const uniqueMutations = new Set(allWordsToMutate);

  uniqueMutations.forEach(w => {
    wordlist.add(w); // Original word
    
    // Apply tech stack extensions
    extensions.forEach(ext => {
      wordlist.add(`${w}${ext.startsWith('.') ? ext : '.' + ext}`);
    });

    // Apply common backup mutations
    wordlist.add(`${w}.bak`);
    wordlist.add(`${w}.old`);
    wordlist.add(`${w}.zip`);
    wordlist.add(`${w}.tar.gz`);
    wordlist.add(`_${w}`);
    wordlist.add(`${w}_`);
    wordlist.add(`${w}.backup`);
    wordlist.add(`${w}.save`);
    wordlist.add(`${w}~`);
    wordlist.add(`.${w}`);
    wordlist.add(`copy_of_${w}`);
    wordlist.add(`${w}_copy`);
    wordlist.add(`${w}_1`);
    wordlist.add(`${w}_2`);
    wordlist.add(`${w}1`);
    wordlist.add(`${w}2`);
    wordlist.add(`${w}test`);
    wordlist.add(`${w}dev`);
  });

  return Array.from(wordlist).sort().join('\n');
};
