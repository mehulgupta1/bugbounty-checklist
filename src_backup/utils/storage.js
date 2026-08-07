const STORAGE_KEY = "bbcl_v4";

/**
 * Generate a unique ID using crypto.randomUUID (falls back to Math.random).
 */
export function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Load checklist data from localStorage.
 * Returns null if no data exists or data is corrupt.
 */
export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn("Failed to load checklist data from localStorage:", err);
  }
  return null;
}

/**
 * Save checklist data to localStorage.
 */
export function saveData(categories, progress, guides) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ categories, progress, guides })
    );
  } catch (err) {
    console.warn("Failed to save checklist data to localStorage:", err);
  }
}
