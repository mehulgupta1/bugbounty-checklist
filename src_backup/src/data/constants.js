export const SEV = {
  Critical: { bg: "#fef2f2", text: "#dc2626", border: "#fca5a5" },
  High:     { bg: "#fff7ed", text: "#c2410c", border: "#fdba74" },
  Medium:   { bg: "#eff6ff", text: "#1d4ed8", border: "#93c5fd" },
  Low:      { bg: "#f0fdf4", text: "#15803d", border: "#86efac" },
  Info:     { bg: "#f5f3ff", text: "#6d28d9", border: "#c4b5fd" },
};

export const CHECK_STATUS = {
  not_tested:       { label: "Not Tested",       icon: "⚪", color: "#9ca3af", dotClass: "status-dot--not_tested" },
  in_progress:      { label: "In Progress",      icon: "🔵", color: "#2563eb", dotClass: "status-dot--in_progress" },
  not_vulnerable:   { label: "Not Vulnerable",    icon: "🟢", color: "#059669", dotClass: "status-dot--not_vulnerable" },
  vulnerable:       { label: "Vulnerable",        icon: "🔴", color: "#dc2626", dotClass: "status-dot--vulnerable" },
  waf_blocked:      { label: "WAF Blocked",       icon: "🧱", color: "#9333ea", dotClass: "status-dot--waf_blocked" },
  needs_retest:     { label: "Needs Retest",      icon: "🟡", color: "#d97706", dotClass: "status-dot--needs_retest" },
};

export const STATUS_ORDER = ["not_tested", "in_progress", "not_vulnerable", "vulnerable", "waf_blocked", "needs_retest"];

/** Statuses that count as "tested/completed" */
export const TESTED_STATUSES = ["not_vulnerable", "vulnerable", "waf_blocked", "needs_retest"];

export const EMOJI_OPTIONS = [
  "🌐","🔌","🤖","🍏","🛡️","🔐","💉","🕵️","🔥","⚡",
  "🧪","🗄️","📡","🐞","🔍","🪝","☁️","📱","💻","🧠",
];

export const COLOR_OPTIONS = [
  "#dc2626","#7c3aed","#059669","#d97706","#2563eb",
  "#ea580c","#db2777","#16a34a","#4f46e5","#0891b2",
];
