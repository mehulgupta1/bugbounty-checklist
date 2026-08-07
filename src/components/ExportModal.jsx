import { useState } from "react";
import Modal from "./Modal";
import { TESTED_STATUSES, CHECK_STATUS } from "../data/constants";

/**
 * Export report as Markdown or trigger print-to-PDF.
 */
export default function ExportModal({ categories, progress, notes, guides, scope, onClose }) {
  const [format, setFormat] = useState("markdown");
  const [includeCompleted, setIncludeCompleted] = useState(true);
  const [includeRemaining, setIncludeRemaining] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeGuides, setIncludeGuides] = useState(false);
  const [exportScope, setExportScope] = useState("all"); // "all" or "current"

  const generateMarkdown = () => {
    const lines = [];
    lines.push(`# Bug Bounty Report`);
    lines.push(`Generated: ${new Date().toLocaleDateString()}\n`);

    if (scope?.programName) {
      lines.push(`**Program:** ${scope.programName}`);
      if (scope.platform) lines.push(`**Platform:** ${scope.platform}`);
      lines.push("");
    }

    // Summary
    const allChecks = categories.flatMap((c) => c.sections.flatMap((s) => s.checks));
    const statusCounts = { not_tested: 0, in_progress: 0, not_vulnerable: 0, vulnerable: 0, needs_retest: 0 };
    allChecks.forEach((ch) => {
      const s = progress[ch.id] || "not_tested";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    const totalTested = TESTED_STATUSES.reduce((sum, s) => sum + statusCounts[s], 0);

    lines.push(`## Summary`);
    lines.push(`- Total Checks: ${allChecks.length}`);
    lines.push(`- Tested: ${totalTested} (${allChecks.length > 0 ? Math.round((totalTested / allChecks.length) * 100) : 0}%)`);
    lines.push(`- Vulnerable: ${statusCounts.vulnerable}`);
    lines.push(`- Needs Retest: ${statusCounts.needs_retest}`);
    lines.push("");

    categories.forEach((cat) => {
      const catChecks = cat.sections.flatMap((s) => s.checks);
      const catTested = catChecks.filter((ch) => TESTED_STATUSES.includes(progress[ch.id])).length;
      lines.push(`## ${cat.icon} ${cat.label} (${catTested}/${catChecks.length})\n`);

      cat.sections.forEach((sec) => {
        if (sec.checks.length === 0) return;
        const secTested = sec.checks.filter((ch) => TESTED_STATUSES.includes(progress[ch.id])).length;
        lines.push(`### ${sec.name} (${secTested}/${sec.checks.length})\n`);
        lines.push(`| # | Check | Status | Severity |`);
        lines.push(`|---|-------|--------|----------|`);

        sec.checks.forEach((ch, i) => {
          const status = progress[ch.id] || "not_tested";
          const isTested = TESTED_STATUSES.includes(status);

          if (!includeCompleted && isTested) return;
          if (!includeRemaining && !isTested) return;

          const statusInfo = CHECK_STATUS[status];
          lines.push(`| ${i + 1} | ${ch.text} | ${statusInfo.icon} ${statusInfo.label} | ${ch.severity} |`);

          if (includeNotes && notes[ch.id]?.text) {
            lines.push(`\n> **Notes:** ${notes[ch.id].text}\n`);
          }
        });
        lines.push("");
      });
    });

    return lines.join("\n");
  };

  const handleExport = () => {
    const md = generateMarkdown();

    if (format === "markdown") {
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bugbounty-report-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // PDF: open in new window for print
      const printWindow = window.open("", "_blank");
      const html = `
        <html><head><title>Bug Bounty Report</title>
        <style>
          body { font-family: -apple-system, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #1f2937; }
          h1 { color: #111827; border-bottom: 2px solid #dc2626; padding-bottom: 8px; }
          h2 { color: #374151; margin-top: 24px; }
          h3 { color: #6b7280; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
          th { background: #f3f4f6; text-align: left; padding: 8px; border: 1px solid #e5e7eb; }
          td { padding: 8px; border: 1px solid #e5e7eb; }
          blockquote { background: #f5f3ff; border-left: 3px solid #7c3aed; padding: 8px 12px; margin: 8px 0; font-size: 12px; }
        </style></head><body>
        ${md.replace(/^# (.+)$/gm, '<h1>$1</h1>')
             .replace(/^## (.+)$/gm, '<h2>$1</h2>')
             .replace(/^### (.+)$/gm, '<h3>$1</h3>')
             .replace(/^\*\*(.+?):\*\* (.+)$/gm, '<p><strong>$1:</strong> $2</p>')
             .replace(/^- (.+)$/gm, '<li>$1</li>')
             .replace(/^> \*\*(.+?)\*\* (.+)$/gm, '<blockquote><strong>$1</strong> $2</blockquote>')
             .replace(/\|(.+)\|/gm, (match) => {
               const cells = match.split('|').filter(Boolean).map(c => c.trim());
               if (cells.every(c => c.match(/^-+$/))) return '';
               const tag = cells[0].match(/^#$|^Check$|^Status$|^Severity$/) ? 'th' : 'td';
               return `<tr>${cells.map(c => `<${tag}>${c}</${tag}>`).join('')}</tr>`;
             })
             .replace(/(<tr>.*<\/tr>\n?)+/g, (m) => `<table>${m}</table>`)
             .replace(/\n/g, '<br>')}
        </body></html>`;
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
    onClose();
  };

  return (
    <Modal title="📄 Export Report" onClose={onClose}>
      <div className="modal-form">
        <div>
          <label className="form-label">Format</label>
          <div className="export-format-group">
            <button
              className={`export-format-btn ${format === "markdown" ? "export-format-btn--active" : ""}`}
              onClick={() => setFormat("markdown")}
            >
              📝 Markdown
            </button>
            <button
              className={`export-format-btn ${format === "pdf" ? "export-format-btn--active" : ""}`}
              onClick={() => setFormat("pdf")}
            >
              📄 PDF (Print)
            </button>
          </div>
        </div>

        <div>
          <label className="form-label">Include</label>
          <div className="export-checkboxes">
            <label className="export-checkbox-row">
              <input type="checkbox" checked={includeCompleted} onChange={(e) => setIncludeCompleted(e.target.checked)} />
              Tested checks
            </label>
            <label className="export-checkbox-row">
              <input type="checkbox" checked={includeRemaining} onChange={(e) => setIncludeRemaining(e.target.checked)} />
              Remaining checks
            </label>
            <label className="export-checkbox-row">
              <input type="checkbox" checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} />
              Notes & evidence
            </label>
            <label className="export-checkbox-row">
              <input type="checkbox" checked={includeGuides} onChange={(e) => setIncludeGuides(e.target.checked)} />
              How-to-test guides
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn-primary" onClick={handleExport}>
            📥 Export
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
