const LEGACY_KEY = "bbcl_v4";
const PROJECTS_KEY = "bbcl_projects";
const ACTIVE_KEY = "bbcl_active_project";

/**
 * Generate a unique ID using crypto.randomUUID (falls back to Math.random).
 */
export function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 10);
}

/* ── Project List ─────────────────────────────────────────── */

/**
 * Load the list of projects (metadata only).
 * Returns array of { id, name, createdAt, lastOpenedAt }.
 */
export function loadProjects() {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

/**
 * Save the project list (metadata only).
 */
export function saveProjects(projects) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch (err) {
    console.warn("Failed to save project list:", err);
  }
}

/**
 * Load/save the active project ID.
 */
export function loadActiveProjectId() {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {}
  return null;
}

export function saveActiveProjectId(id) {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {}
}

/* ── Project Data ─────────────────────────────────────────── */

function projectKey(id) {
  return `bbcl_project_${id}`;
}

/**
 * Load a specific project's data.
 * Returns { categories, progress, guides, notes, scope, timers } or null.
 */
export function loadProjectData(id) {
  try {
    const raw = localStorage.getItem(projectKey(id));
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

/**
 * Save a specific project's data.
 */
export function saveProjectData(id, data) {
  try {
    localStorage.setItem(projectKey(id), JSON.stringify(data));
  } catch (err) {
    console.warn("Failed to save project data:", err);
  }
}

/**
 * Delete a project's data from storage.
 */
export function deleteProjectData(id) {
  try {
    localStorage.removeItem(projectKey(id));
  } catch {}
}

/* ── Migration ────────────────────────────────────────────── */

/**
 * Migrate old single-checklist data (bbcl_v4) to a default project.
 * Returns { projects, activeId, projectData } or null if no legacy data.
 */
export function migrateLegacyData() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.categories) return null;

    const id = uid();
    const project = {
      id,
      name: "Default Project",
      createdAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
    };

    // Migrate progress: convert old boolean values to new status strings
    const migratedProgress = {};
    if (data.progress) {
      for (const [key, value] of Object.entries(data.progress)) {
        if (typeof value === "string") {
          migratedProgress[key] = value; // Already migrated
        } else if (value === true) {
          migratedProgress[key] = "not_vulnerable";
        }
        // false/undefined = not_tested (default, no need to store)
      }
    }

    const projectData = {
      categories: data.categories,
      progress: migratedProgress,
      guides: data.guides || {},
      notes: {},
      scope: {},
      timers: {},
    };

    return { projects: [project], activeId: id, projectData };
  } catch (err) {
    console.warn("Failed to migrate legacy data:", err);
    return null;
  }
}

/**
 * Remove the old legacy storage key after migration.
 */
export function removeLegacyData() {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
}

/* ── Legacy compat (kept for backward compat if needed) ──── */

export function loadData() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn("Failed to load checklist data from localStorage:", err);
  }
  return null;
}

export function saveData(categories, progress, guides) {
  try {
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({ categories, progress, guides })
    );
  } catch (err) {
    console.warn("Failed to save checklist data to localStorage:", err);
  }
}
