import { TESTED_STATUSES, CHECK_STATUS, SEV } from "../data/constants";
import { formatTimeCompact } from "../hooks/useTimer";

/**
 * Statistics dashboard with overview cards, progress bars, and vulnerability summary.
 */
export default function Dashboard({ categories, progress, timers }) {
  const allChecks = categories.flatMap((c) => c.sections.flatMap((s) => s.checks));
  const totalChecks = allChecks.length;

  // Count by status
  const statusCounts = { not_tested: 0, in_progress: 0, not_vulnerable: 0, vulnerable: 0, needs_retest: 0 };
  allChecks.forEach((ch) => {
    const status = progress[ch.id] || "not_tested";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const totalTested = TESTED_STATUSES.reduce((sum, s) => sum + (statusCounts[s] || 0), 0);
  const testedPct = totalChecks > 0 ? Math.round((totalTested / totalChecks) * 100) : 0;

  // Count by severity
  const sevCounts = {};
  Object.keys(SEV).forEach((s) => { sevCounts[s] = 0; });
  allChecks.forEach((ch) => { sevCounts[ch.severity] = (sevCounts[ch.severity] || 0) + 1; });

  // Total timer
  const totalTime = Object.values(timers || {}).reduce((sum, t) => sum + (t?.elapsed || 0), 0);

  // Per-category stats
  const catStats = categories.map((cat) => {
    const checks = cat.sections.flatMap((s) => s.checks);
    const tested = checks.filter((ch) => TESTED_STATUSES.includes(progress[ch.id])).length;
    const vulns = checks.filter((ch) => progress[ch.id] === "vulnerable").length;
    const elapsed = timers?.[cat.id]?.elapsed || 0;
    return { ...cat, total: checks.length, tested, vulns, elapsed };
  });

  // Vulnerable checks list
  const vulnChecks = [];
  categories.forEach((cat) => {
    cat.sections.forEach((sec) => {
      sec.checks.forEach((ch) => {
        if (progress[ch.id] === "vulnerable") {
          vulnChecks.push({ text: ch.text, severity: ch.severity, category: cat.label, section: sec.name });
        }
      });
    });
  });

  return (
    <div className="dashboard">
      <h1 className="dashboard-title">📊 Statistics Dashboard</h1>

      {/* Overview Cards */}
      <div className="dashboard-cards">
        <div className="dashboard-card">
          <div className="dashboard-card-value">{totalChecks.toLocaleString()}</div>
          <div className="dashboard-card-label">Total Checks</div>
        </div>
        <div className="dashboard-card">
          <div className="dashboard-card-value dashboard-card-value--green">{totalTested.toLocaleString()}</div>
          <div className="dashboard-card-label">Tested ({testedPct}%)</div>
        </div>
        <div className="dashboard-card">
          <div className="dashboard-card-value dashboard-card-value--red">{statusCounts.vulnerable}</div>
          <div className="dashboard-card-label">Vulnerabilities</div>
        </div>
        <div className="dashboard-card">
          <div className="dashboard-card-value dashboard-card-value--blue">{formatTimeCompact(totalTime)}</div>
          <div className="dashboard-card-label">Time Spent</div>
        </div>
      </div>

      <div className="dashboard-charts">
        {/* Status Distribution */}
        <div className="dashboard-chart-box">
          <div className="dashboard-chart-title">Status Distribution</div>
          {Object.entries(CHECK_STATUS).map(([key, info]) => {
            const count = statusCounts[key] || 0;
            const pct = totalChecks > 0 ? Math.round((count / totalChecks) * 100) : 0;
            return (
              <div key={key} className="dashboard-progress-row">
                <span className="dashboard-progress-label">{info.icon} {info.label}</span>
                <div className="dashboard-progress-bar">
                  <div className="dashboard-progress-fill" style={{ width: `${pct}%`, background: info.color }} />
                </div>
                <span className="dashboard-progress-value">{count}</span>
              </div>
            );
          })}
        </div>

        {/* Severity Breakdown */}
        <div className="dashboard-chart-box">
          <div className="dashboard-chart-title">Checks by Severity</div>
          {Object.entries(SEV).map(([sev, colors]) => {
            const count = sevCounts[sev] || 0;
            const pct = totalChecks > 0 ? Math.round((count / totalChecks) * 100) : 0;
            return (
              <div key={sev} className="dashboard-progress-row">
                <span className="dashboard-progress-label" style={{ color: colors.text }}>{sev}</span>
                <div className="dashboard-progress-bar">
                  <div className="dashboard-progress-fill" style={{ width: `${pct}%`, background: colors.text }} />
                </div>
                <span className="dashboard-progress-value">{count}</span>
              </div>
            );
          })}
        </div>

        {/* Progress by Category */}
        <div className="dashboard-chart-box">
          <div className="dashboard-chart-title">Progress by Category</div>
          {catStats.map((cat) => {
            const pct = cat.total > 0 ? Math.round((cat.tested / cat.total) * 100) : 0;
            return (
              <div key={cat.id} className="dashboard-progress-row">
                <span className="dashboard-progress-label">{cat.icon} {cat.label}</span>
                <div className="dashboard-progress-bar">
                  <div className="dashboard-progress-fill" style={{ width: `${pct}%`, background: cat.color || "#2563eb" }} />
                </div>
                <span className="dashboard-progress-value">{pct}%</span>
              </div>
            );
          })}
        </div>

        {/* Time by Category */}
        <div className="dashboard-chart-box">
          <div className="dashboard-chart-title">⏱ Time by Category</div>
          {catStats.filter((c) => c.elapsed > 0).length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--color-text-faint)", padding: "16px 0", textAlign: "center" }}>
              No time tracked yet. Use the timer on each category.
            </div>
          ) : (
            catStats.map((cat) => {
              const maxTime = Math.max(...catStats.map((c) => c.elapsed), 1);
              const pct = Math.round((cat.elapsed / maxTime) * 100);
              return (
                <div key={cat.id} className="dashboard-progress-row">
                  <span className="dashboard-progress-label">{cat.icon} {cat.label}</span>
                  <div className="dashboard-progress-bar">
                    <div className="dashboard-progress-fill" style={{ width: `${pct}%`, background: "#7c3aed" }} />
                  </div>
                  <span className="dashboard-progress-value">{formatTimeCompact(cat.elapsed)}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Vulnerability Table */}
      {vulnChecks.length > 0 && (
        <div className="dashboard-chart-box" style={{ marginBottom: 24 }}>
          <div className="dashboard-chart-title">🔴 Vulnerabilities Found ({vulnChecks.length})</div>
          <table className="dashboard-vuln-table">
            <thead>
              <tr>
                <th>Check</th>
                <th>Severity</th>
                <th>Category</th>
                <th>Section</th>
              </tr>
            </thead>
            <tbody>
              {vulnChecks.map((v, i) => (
                <tr key={i}>
                  <td>{v.text}</td>
                  <td style={{ color: SEV[v.severity]?.text }}>{v.severity}</td>
                  <td>{v.category}</td>
                  <td>{v.section}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
