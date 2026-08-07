import assert from "node:assert";
import { DEFAULT_CATEGORIES } from "./defaultCategories.js";
import { WEB_SURFACES, inSurface, sectionStats } from "./webSurfaces.js";

const web = DEFAULT_CATEGORIES.find((c) => c.id === "web");
const names = web.sections.map((s) => s.name);
const surfaces = WEB_SURFACES.filter((s) => !s.all);

// 1. every real category is reachable from at least one surface (no dead ends)
const orphans = names.filter((n) => !surfaces.some((s) => inSurface(s, n)));
assert.equal(orphans.length, 0, "orphan categories: " + orphans.join(", "));

// 2. no surface references a category that doesn't exist (no typos)
const mapped = [...new Set(surfaces.flatMap((s) => s.cats))];
const typos = mapped.filter((n) => !names.includes(n));
assert.equal(typos.length, 0, "typo mappings: " + typos.join(", "));

// 3. sectionStats segments always partition the total
const sec = web.sections.find((s) => s.name === "SQL Injection");
const [a, b, c, d] = sec.checks.map((x) => x.id);
const progress = { [a]: "vulnerable", [b]: "not_vulnerable", [c]: "in_progress", [d]: "needs_retest" };
const st = sectionStats(sec, progress);
assert.equal(st.vuln + st.retest + st.clear + st.prog + st.untested, st.total, "segments must sum to total");
assert.equal(st.vuln, 1);
assert.equal(st.clear, 1);          // not_vulnerable
assert.equal(st.prog, 1);           // in_progress is NOT counted as tested
assert.equal(st.retest, 1);
assert.equal(st.tested, 3);         // vuln + not_vuln + retest (prog excluded)
assert.equal(st.untested, st.total - 4);
assert.ok(st.pct >= 0 && st.pct <= 100);

// 4. empty progress → 0% and everything untested
const empty = sectionStats(sec, {});
assert.equal(empty.pct, 0);
assert.equal(empty.untested, empty.total);

console.log("ok — coverage complete, no orphans/typos, stats partition correctly");
