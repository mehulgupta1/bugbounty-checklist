import { DEFAULT_CATEGORIES } from "./defaultCategories.js";
import { DEFAULT_HOW_TO_TEST, DEFAULT_GUIDE } from "./defaultGuides.js";

// Guides ship keyed by check TEXT, which breaks the moment a check is renamed.
// Join them to the stable check id once, using the shipped defaults where the
// text still matches. Lookups then key on id, so renaming a check keeps its guide.
// ponytail: derived at import from existing data — no regeneration of the 5.6MB guides file.
export function buildGuideById(categories, howToTest) {
  const byId = {};
  for (const cat of categories) {
    for (const sec of cat.sections || []) {
      for (const ch of sec.checks || []) {
        const g = howToTest[ch.text];
        if (g) byId[ch.id] = g;
      }
    }
  }
  return byId;
}

const BY_ID = buildGuideById(DEFAULT_CATEGORIES, DEFAULT_HOW_TO_TEST);

// id first (survives renames) → text (custom checks) → generic fallback.
export function getDefaultGuide(check) {
  return BY_ID[check.id] || DEFAULT_HOW_TO_TEST[check.text] || DEFAULT_GUIDE;
}

export { DEFAULT_GUIDE };
