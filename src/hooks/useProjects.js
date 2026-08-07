import { useState, useCallback } from "react";
import {
  uid,
  loadProjects,
  saveProjects,
  loadActiveProjectId,
  saveActiveProjectId,
  loadProjectData,
  saveProjectData,
  deleteProjectData,
  migrateLegacyData,
  removeLegacyData,
} from "../utils/storage";
import { DEFAULT_CATEGORIES } from "../data/defaultCategories";

/**
 * Initialize projects: migrate from legacy or create fresh.
 */
function initProjects() {
  let projects = loadProjects();
  let activeId = loadActiveProjectId();

  if (!projects) {
    // Try migrating from old storage
    const migrated = migrateLegacyData();
    if (migrated) {
      projects = migrated.projects;
      activeId = migrated.activeId;
      saveProjects(projects);
      saveActiveProjectId(activeId);
      saveProjectData(activeId, migrated.projectData);
      removeLegacyData();
    } else {
      // Fresh install — create default project
      const id = uid();
      projects = [{
        id,
        name: "Default Project",
        createdAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString(),
      }];
      activeId = id;
      saveProjects(projects);
      saveActiveProjectId(activeId);
      saveProjectData(id, {
        categories: DEFAULT_CATEGORIES,
        progress: {},
        guides: {},
        notes: {},
        scope: {},
        timers: {},
      });
    }
  }

  // Ensure activeId is valid
  if (!activeId || !projects.some((p) => p.id === activeId)) {
    activeId = projects[0]?.id;
    if (activeId) saveActiveProjectId(activeId);
  }

  return { projects, activeId };
}

/**
 * Manages the project list (CRUD).
 * Does NOT manage project data (categories, progress) — that's useChecklist's job.
 */
export default function useProjects() {
  const [state, setState] = useState(() => initProjects());

  const { projects, activeId } = state;

  const switchProject = useCallback((id) => {
    setState((s) => {
      const updated = s.projects.map((p) =>
        p.id === id ? { ...p, lastOpenedAt: new Date().toISOString() } : p
      );
      saveProjects(updated);
      saveActiveProjectId(id);
      return { projects: updated, activeId: id };
    });
  }, []);

  const createProject = useCallback((name) => {
    const id = uid();
    const newProject = {
      id,
      name: name || "New Project",
      createdAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
    };
    saveProjectData(id, {
      categories: DEFAULT_CATEGORIES,
      progress: {},
      guides: {},
      notes: {},
      scope: {},
      timers: {},
    });
    setState((s) => {
      const updated = [...s.projects, newProject];
      saveProjects(updated);
      saveActiveProjectId(id);
      return { projects: updated, activeId: id };
    });
    return id;
  }, []);

  const deleteProject = useCallback((id) => {
    setState((s) => {
      const updated = s.projects.filter((p) => p.id !== id);
      if (updated.length === 0) {
        // Don't allow deleting last project
        return s;
      }
      deleteProjectData(id);
      saveProjects(updated);
      const newActive = s.activeId === id ? updated[0].id : s.activeId;
      saveActiveProjectId(newActive);
      return { projects: updated, activeId: newActive };
    });
  }, []);

  const renameProject = useCallback((id, newName) => {
    setState((s) => {
      const updated = s.projects.map((p) =>
        p.id === id ? { ...p, name: newName } : p
      );
      saveProjects(updated);
      return { ...s, projects: updated };
    });
  }, []);

  const duplicateProject = useCallback((id) => {
    const source = projects.find((p) => p.id === id);
    if (!source) return;
    const newId = uid();
    const data = loadProjectData(id);
    if (data) {
      saveProjectData(newId, { ...data, progress: {}, timers: {} });
    }
    const newProject = {
      id: newId,
      name: `${source.name} (Copy)`,
      createdAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
    };
    setState((s) => {
      const updated = [...s.projects, newProject];
      saveProjects(updated);
      saveActiveProjectId(newId);
      return { projects: updated, activeId: newId };
    });
  }, [projects]);

  const importAsNewProject = useCallback((name, projectData) => {
    const id = uid();
    const newProject = {
      id,
      name: name || "Imported Project",
      createdAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
    };
    saveProjectData(id, {
      categories: projectData.categories || DEFAULT_CATEGORIES,
      progress: projectData.progress || {},
      guides: projectData.guides || {},
      notes: projectData.notes || {},
      scope: projectData.scope || {},
      timers: {},
    });
    setState((s) => {
      const updated = [...s.projects, newProject];
      saveProjects(updated);
      saveActiveProjectId(id);
      return { projects: updated, activeId: id };
    });
    return id;
  }, []);

  return {
    projects,
    activeProjectId: activeId,
    activeProject: projects.find((p) => p.id === activeId),
    switchProject,
    createProject,
    deleteProject,
    renameProject,
    duplicateProject,
    importAsNewProject,
  };
}
