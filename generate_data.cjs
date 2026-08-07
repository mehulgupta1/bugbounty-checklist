const fs = require('fs');

const domains = Array.from({length: 60}, (_, i) => `service-${i}.target-corp.com`);
const techs = ["React", "Express", "Node.js", "Java", "Tomcat", "Nginx", "Apache", "PHP", "Django", "Python", "Ruby on Rails", "GitLab", "Jenkins", "IIS", "SharePoint", "MySQL", "Redis", "MongoDB"];
const severities = ["info", "low", "medium", "high", "critical"];
const templates = ["cve-2021-44228", "exposed-env", "xss-reflected", "sqli-error-based", "aws-keys-exposed", "dir-listing", "tech-detect", "cors-misconfig"];

let output = "";

// Subfinder
domains.forEach(d => {
  output += JSON.stringify({ host: d, source: "subfinder" }) + "\n";
});

// HTTPX
domains.slice(0, 45).forEach((d, i) => {
  const port = [80, 443, 8080, 8443, 3000, 5000, 9200, 6379, 27017][i % 9];
  const scheme = port === 443 || port === 8443 ? "https" : "http";
  const numTech = (i % 3) + 1;
  const t = [];
  for(let j=0; j<numTech; j++) t.push(techs[(i+j) % techs.length]);
  
  output += JSON.stringify({
    url: `${scheme}://${d}:${port}`,
    host: d,
    port: port,
    status_code: [200, 301, 403, 404, 500][i % 5],
    tech: t,
    webserver: t[0],
    a: [`10.10.0.${(i%255)}`]
  }) + "\n";
});

// Nuclei
domains.slice(0, 30).forEach((d, i) => {
  const sev = severities[i % severities.length];
  const tmp = templates[i % templates.length];
  output += JSON.stringify({
    "template-id": tmp,
    info: { name: `Vulnerability ${tmp}`, severity: sev },
    host: `https://${d}`,
    "matched-at": `https://${d}/path/to/vuln`
  }) + "\n";
});

// Raw URLs
domains.slice(40, 60).forEach((d, i) => {
  output += `https://${d}/api/v1/users?id=${i}\n`;
  output += `http://${d}/dashboard/stats\n`;
});

fs.writeFileSync('massive_recon_dump.json', output);
console.log('Done generating massive_recon_dump.json');
