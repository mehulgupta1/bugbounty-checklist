import { useState, useMemo } from "react";
import { WEB_SURFACES, inSurface, sectionStats } from "../data/webSurfaces";
import { SEV, CHECK_STATUS } from "../data/constants";
import "../styles/webFocus.css";

const GROUP_ORDER = [
  "🔍 Information Gathering", "⚙️ Config & Deploy Management", "🆔 Identity Management",
  "🔑 Authentication", "🛡️ Authorization", "🍪 Session Management", "💉 Input Validation",
  "⚠️ Error Handling & Logging", "🔐 Cryptography", "🧠 Business Logic", "🖥️ Client-Side",
  "🧩 Technology & Feature-Specific",
];
const SEV_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3, Info: 4 };
const sevColor = (s) => (SEV[s] || SEV.Medium).text;

// status colours for the segmented coverage strip
const C = {
  vuln: CHECK_STATUS.vulnerable.color,
  retest: CHECK_STATUS.needs_retest.color,
  clear: CHECK_STATUS.not_vulnerable.color,
  prog: CHECK_STATUS.in_progress.color,
  untested: "var(--color-text-ghost)",
};

function SegBar({ counts, total, lg }) {
  const seg = (v, color, label) =>
    v > 0 ? <span key={label} title={`${label}: ${v}`} style={{ width: `${(v / total * 100).toFixed(2)}%`, background: color }} /> : null;
  return (
    <div className={`wf-seg${lg ? " wf-lg" : ""}`}>
      {seg(counts.vuln, C.vuln, "Vulnerable")}
      {seg(counts.retest, C.retest, "Needs retest")}
      {seg(counts.clear, C.clear, "Cleared")}
      {seg(counts.prog, C.prog, "In progress")}
      {seg(counts.untested, C.untested, "Not tested")}
    </div>
  );
}

const LEGEND = [
  ["Vulnerable", C.vuln], ["Retest", C.retest], ["Cleared", C.clear],
  ["In progress", C.prog], ["Not tested", C.untested],
];

/**
 * Focus-Mode + Category-Cards navigation for the Web section.
 * Reuses the app's <Section> (via renderDetail) for the full check list, so
 * status/notes/guides all keep working.
 */
export default function WebFocusView({ category, progress, searchQuery, sevFilter, renderDetail }) {
  const [surfaceId, setSurfaceId] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [collapsed, setCollapsed] = useState({});

  const sections = category.sections || [];
  const surface = WEB_SURFACES.find((s) => s.id === surfaceId) || WEB_SURFACES[0];
  const q = (searchQuery || "").toLowerCase();

  // per-surface coverage for the chips
  const surfaceStats = useMemo(() => {
    const out = {};
    for (const s of WEB_SURFACES) {
      let total = 0, vuln = 0, retest = 0, clear = 0, prog = 0, tested = 0, cats = 0;
      for (const sec of sections) {
        if (!inSurface(s, sec.name)) continue;
        const st = sectionStats(sec, progress);
        total += st.total; vuln += st.vuln; retest += st.retest; clear += st.clear; prog += st.prog; tested += st.tested; cats++;
      }
      out[s.id] = { total, cats, counts: { vuln, retest, clear, prog, untested: Math.max(0, total - vuln - retest - clear - prog) }, pct: total ? Math.round(tested / total * 100) : 0 };
    }
    return out;
  }, [sections, progress]);

  const matches = (sec) =>
    !q || sec.name.toLowerCase().includes(q) || sec.checks.some((c) => c.text.toLowerCase().includes(q));
  const sevOk = (sec) => sevFilter === "All" || sec.severity === sevFilter;

  const visible = sections.filter((sec) => inSurface(surface, sec.name) && matches(sec) && sevOk(sec));

  // ---- detail view ----
  if (openId) {
    const idx = sections.findIndex((s) => s.id === openId);
    const sec = sections[idx];
    if (!sec) { setOpenId(null); return null; }
    const st = sectionStats(sec, progress);
    return (
      <div className="web-focus">
        <button className="wf-back" onClick={() => setOpenId(null)}>
          ←  Back to {surface.all ? "all categories" : surface.label}
        </button>
        <div className="wf-detail-head">
          <span className="wf-detail-edge" style={{ background: sevColor(sec.severity) }} />
          <h2>{sec.name}</h2>
        </div>
        <div className="wf-detail-meta">
          <span className="wf-sev" style={{ color: sevColor(sec.severity) }}>{sec.severity}</span>
          <span>{sec.checks.length} checks</span>
          <span style={{ color: C.clear }}>✓ {st.clear} cleared</span>
          {st.vuln > 0 && <span style={{ color: C.vuln }}>● {st.vuln} vulnerable</span>}
          <span>{st.pct}% coverage</span>
        </div>
        <div style={{ maxWidth: 900, marginBottom: 18 }}><SegBar counts={st} total={st.total} lg /></div>
        {renderDetail(sec, idx)}
      </div>
    );
  }

  // ---- card grid ----
  const overall = surfaceStats.all;
  const Card = (sec) => {
    const st = sectionStats(sec, progress);
    return (
      <div key={sec.id} className="wf-card" onClick={() => setOpenId(sec.id)}>
        <span className="wf-edge" style={{ background: sevColor(sec.severity) }} />
        <div className="wf-card-top">
          <div>
            {!surface.all && <div className="wf-ptag">{(sec.group || "").replace(/^\S+\s/, "")}</div>}
            <div className="wf-card-name">{sec.name}</div>
          </div>
          <span className="wf-mono wf-tnum" style={{ fontSize: 15, fontWeight: 700, color: st.pct === 100 ? C.clear : "var(--wf-accent)" }}>{st.pct}%</span>
        </div>
        <ul className="wf-preview">
          {sec.checks.slice(0, 2).map((c) => <li key={c.id}>{c.text}</li>)}
        </ul>
        <SegBar counts={st} total={st.total} />
        <div className="wf-card-foot">
          <span className="wf-sev" style={{ color: sevColor(sec.severity) }}>{sec.severity} · {sec.checks.length} checks</span>
          <span>
            {st.vuln > 0
              ? <span className="wf-pill" style={{ color: C.vuln, borderColor: C.vuln }}>● {st.vuln} vuln</span>
              : <span style={{ color: C.clear }}>✓ {st.clear}</span>}
          </span>
        </div>
      </div>
    );
  };

  let body;
  if (visible.length === 0) {
    body = <div className="wf-empty">No categories match your filters.</div>;
  } else if (surface.all) {
    // grouped by phase, collapsible
    body = GROUP_ORDER.map((g) => {
      const inGroup = visible.filter((s) => s.group === g);
      if (inGroup.length === 0) return null;
      const isCol = !!collapsed[g];
      const total = inGroup.reduce((a, s) => a + s.checks.length, 0);
      const tested = inGroup.reduce((a, s) => a + sectionStats(s, progress).tested, 0);
      const pct = total ? Math.round(tested / total * 100) : 0;
      return (
        <div key={g}>
          <div className={`wf-band${isCol ? " wf-collapsed" : ""}`} onClick={() => setCollapsed((p) => ({ ...p, [g]: !p[g] }))}>
            <span className="wf-caret">▾</span>
            <span className="wf-b-name">{g}</span>
            <span className="wf-b-meta">{inGroup.length} cats · {total} checks · {pct}%</span>
            <span className="wf-b-line" />
          </div>
          {!isCol && <div className="wf-cards">{inGroup.map(Card)}</div>}
        </div>
      );
    });
  } else {
    // focused: flat, severity-sorted
    const sorted = [...visible].sort((a, b) =>
      (SEV_ORDER[a.severity] - SEV_ORDER[b.severity]) || (sectionStats(a, progress).pct - sectionStats(b, progress).pct));
    body = <div className="wf-cards">{sorted.map(Card)}</div>;
  }

  return (
    <div className="web-focus">
      {/* overall coverage */}
      <div className="wf-overview">
        <span className="wf-ov-num"><b className="wf-tnum">{overall.pct}%</b> tested</span>
        <span className="wf-ov-bar"><SegBar counts={overall.counts} total={overall.total || 1} lg /></span>
        <span className="wf-key">
          {LEGEND.map(([label, color]) => (
            <span key={label}><span className="wf-dot" style={{ background: color }} />{label}</span>
          ))}
        </span>
      </div>

      {/* focus bar */}
      <div className="wf-focusbar">
        <div className="wf-fb-label">◎ Focus — what are you testing right now?</div>
        <div className="wf-chips">
          {WEB_SURFACES.map((s) => {
            const st = surfaceStats[s.id];
            return (
              <button key={s.id} className={`wf-surf${s.id === surfaceId ? " wf-on" : ""}`}
                onClick={() => { setSurfaceId(s.id); setOpenId(null); }}>
                <span className="wf-surf-head"><span className="wf-ico">{s.ico}</span><span className="wf-sl">{s.label}</span></span>
                <span className="wf-surf-cov"><SegBar counts={st.counts} total={st.total || 1} /><span className="wf-surf-pct">{st.pct}%</span></span>
                <span className="wf-surf-hint">{st.cats} categories · {s.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {body}
    </div>
  );
}
