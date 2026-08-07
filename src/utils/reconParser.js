export const parseReconData = (rawText) => {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split('\n');
  const assetMap = new Map();

  const getOrCreateAsset = (host) => {
    if (!host) return null;
    const cleanHost = host.replace(/^https?:\/\//, '').split(':')[0].split('/')[0];
    if (!assetMap.has(cleanHost)) {
      assetMap.set(cleanHost, {
        host: cleanHost,
        ips: new Set(),
        ports: new Set(),
        urls: new Set(),
        endpoints: new Map(),
        tech: new Set(),
        vulns: []
      });
    }
    return assetMap.get(cleanHost);
  };

  // Industry-standard robust URL Regex
  const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()!@:%_\+.~#?&\/\/=]*)/g;

  lines.forEach(line => {
    const t = line.trim();
    if (!t) return;

    try {
      const obj = JSON.parse(t);
      
      // HTTPX Match
      if (obj.url && obj.host && obj.status_code !== undefined) {
        const asset = getOrCreateAsset(obj.host);
        if (asset) {
          asset.urls.add(obj.url);
          asset.endpoints.set(obj.url, { url: obj.url, statusCode: obj.status_code });
          if (obj.port) asset.ports.add(obj.port);
          if (obj.a && obj.a.length) obj.a.forEach(ip => asset.ips.add(ip)); // HTTPX IP
          if (obj.tech && Array.isArray(obj.tech)) obj.tech.forEach(tech => asset.tech.add(tech));
          if (obj.webserver) asset.tech.add(obj.webserver);
        }
      } 
      // Nuclei Match
      else if (obj['template-id'] && obj.info && obj.host) {
        const hostOnly = obj.host.replace(/^https?:\/\//, '').split('/')[0];
        const asset = getOrCreateAsset(hostOnly);
        if (asset) {
          if (obj['matched-at']) asset.urls.add(obj['matched-at']);
          asset.vulns.push({
            id: obj['template-id'],
            name: obj.info.name,
            severity: obj.info.severity || 'info',
            matchedAt: obj['matched-at'] || obj.host
          });
        }
      }
      // Subfinder Match
      else if (obj.host && obj.source) {
        getOrCreateAsset(obj.host);
      }
      // Naabu Match
      else if (obj.host && obj.port) {
        const asset = getOrCreateAsset(obj.host);
        if (asset) {
          asset.ports.add(obj.port);
          if (obj.ip) asset.ips.add(obj.ip);
        }
      }
      // Generic JSON fallback (e.g., Katana or unknown)
      else if (obj.endpoint || obj.url) {
        const u = obj.endpoint || obj.url;
        try {
          const parsed = new URL(u);
          const asset = getOrCreateAsset(parsed.hostname);
          if (asset) {
            asset.urls.add(u);
            const sc = obj.status_code !== undefined ? obj.status_code : (obj.status || null);
            asset.endpoints.set(u, { url: u, statusCode: sc });
          }
        } catch(e) {}
      }

    } catch (e) {
      // Not JSON. Fallback to Regex for generic URL/Host extraction
      const matches = t.match(urlRegex);
      if (matches) {
        matches.forEach(m => {
          try {
            const parsed = new URL(m);
            const asset = getOrCreateAsset(parsed.hostname);
            if (asset) {
              asset.urls.add(m);
              if (!asset.endpoints.has(m)) asset.endpoints.set(m, { url: m, statusCode: null });
            }
          } catch(err) {}
        });
      } else {
        // Just try to see if the entire line looks like a host (e.g. basic amass output)
        if (/^[a-zA-Z0-9.\-_]+\.[a-zA-Z]{2,}$/.test(t)) {
          getOrCreateAsset(t);
        }
      }
    }
  });

  // Convert Sets to Arrays for React Rendering
  const results = [];
  assetMap.forEach(val => {
    results.push({
      host: val.host,
      ips: Array.from(val.ips),
      ports: Array.from(val.ports).sort((a,b) => a-b),
      urls: Array.from(val.urls),
      endpoints: Array.from(val.endpoints.values()),
      tech: Array.from(val.tech),
      vulns: val.vulns
    });
  });

  // Sort by highest severity vulns first, then by host length
  const sevScores = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  results.sort((a, b) => {
    const aMax = Math.max(-1, ...a.vulns.map(v => sevScores[v.severity] || 0));
    const bMax = Math.max(-1, ...b.vulns.map(v => sevScores[v.severity] || 0));
    if (bMax !== aMax) return bMax - aMax;
    return a.host.localeCompare(b.host);
  });

  return results;
};
