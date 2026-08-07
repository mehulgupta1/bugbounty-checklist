import { useState, useEffect, useCallback } from "react";
import { DEFAULT_CATEGORIES } from "../data/defaultCategories";
import { loadProjectData, saveProjectData, uid } from "../utils/storage";
import { STATUS_ORDER, TESTED_STATUSES } from "../data/constants";

/**
 * Manages checklist data (categories, progress, guides, notes, scope, timers)
 * scoped to the active project.
 */
export default function useChecklist(projectId) {
  const [categories, setCategories] = useState([]);
  const [progress, setProgress] = useState({});
  const [guides, setGuides] = useState({});
  const [notes, setNotes] = useState({});
  const [scope, setScope] = useState({});
  const [timers, setTimers] = useState({});
  const [activeTab, setActiveTab] = useState("");

  // Load data when project changes
  useEffect(() => {
    if (!projectId) return;
    const data = loadProjectData(projectId);
    if (data) {
      // Migrate old boolean progress
      const migratedProgress = {};
      if (data.progress) {
        for (const [key, value] of Object.entries(data.progress)) {
          if (typeof value === "string") {
            migratedProgress[key] = value;
          } else if (value === true) {
            migratedProgress[key] = "not_vulnerable";
          }
        }
      }
      setCategories(data.categories || DEFAULT_CATEGORIES);
      setProgress(migratedProgress);
      setGuides(data.guides || {});
      setNotes(data.notes || {});
      setScope(data.scope || {});
      setTimers(data.timers || {});
      const cats = data.categories || DEFAULT_CATEGORIES;
      setActiveTab(cats[0]?.id || "");
    } else {
      setCategories(DEFAULT_CATEGORIES);
      setProgress({});
      setGuides({});
      setNotes({});
      setScope({});
      setTimers({});
      setActiveTab(DEFAULT_CATEGORIES[0]?.id || "");
    }
  }, [projectId]);

  // Ensure activeTab is valid
  useEffect(() => {
    if (categories.length > 0 && !categories.some((c) => c.id === activeTab)) {
      setActiveTab(categories[0].id);
    }
  }, [categories, activeTab]);

  // Debounced save to project storage
  useEffect(() => {
    if (!projectId) return;
    const timer = setTimeout(() => {
      saveProjectData(projectId, { categories, progress, guides, notes, scope, timers });
    }, 300);
    return () => clearTimeout(timer);
  }, [projectId, categories, progress, guides, notes, scope, timers]);

  /* ── Status Management ──────────────────────────────────── */

  const getCheckStatus = useCallback((id) => {
    return progress[id] || "not_tested";
  }, [progress]);

  const setCheckStatus = useCallback((id, status) => {
    setProgress((p) => {
      if (status === "not_tested") {
        const next = { ...p };
        delete next[id];
        return next;
      }
      return { ...p, [id]: status };
    });
  }, []);

  const cycleCheckStatus = useCallback((id) => {
    setProgress((p) => {
      const current = p[id] || "not_tested";
      const idx = STATUS_ORDER.indexOf(current);
      const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
      if (next === "not_tested") {
        const updated = { ...p };
        delete updated[id];
        return updated;
      }
      return { ...p, [id]: next };
    });
  }, []);

  const isCheckTested = useCallback((id) => {
    return TESTED_STATUSES.includes(progress[id]);
  }, [progress]);

  // Legacy toggle support
  const toggleCheck = useCallback((id) => {
    cycleCheckStatus(id);
  }, [cycleCheckStatus]);

  const resetProgress = () => {
    setProgress({});
  };

  /* ── Category CRUD ──────────────────────────────────────── */

  const addCategory = ({ label, icon, color }) => {
    const id = uid();
    setCategories((p) => [...p, { id, label, icon, color, custom: true, sections: [] }]);
    setActiveTab(id);
  };

  const editCategory = ({ id, label, icon, color }) => {
    setCategories((p) =>
      p.map((c) => (c.id === id ? { ...c, label, icon, color } : c))
    );
  };

  const deleteCategory = (id) => {
    setCategories((p) => p.filter((c) => c.id !== id));
  };

  /* ── Section CRUD ───────────────────────────────────────── */

  const addSection = ({ catId, name, severity }) => {
    const id = uid();
    setCategories((p) =>
      p.map((c) =>
        c.id === catId
          ? { ...c, sections: [...c.sections, { id, name, severity, checks: [] }] }
          : c
      )
    );
  };

  const editSection = ({ catId, sectionId, name, severity }) => {
    setCategories((p) =>
      p.map((c) =>
        c.id === catId
          ? {
              ...c,
              sections: c.sections.map((s) =>
                s.id === sectionId ? { ...s, name, severity } : s
              ),
            }
          : c
      )
    );
  };

  const deleteSection = (catId, sectionId) => {
    setCategories((p) =>
      p.map((c) =>
        c.id === catId
          ? { ...c, sections: c.sections.filter((s) => s.id !== sectionId) }
          : c
      )
    );
  };

  /* ── Check CRUD ─────────────────────────────────────────── */

  const addCheck = ({ catId, sectionId, text, severity }) => {
    const id = uid();
    setCategories((p) =>
      p.map((c) =>
        c.id === catId
          ? {
              ...c,
              sections: c.sections.map((s) =>
                s.id === sectionId
                  ? { ...s, checks: [...s.checks, { id, text, severity }] }
                  : s
              ),
            }
          : c
      )
    );
  };

  const editCheck = ({ catId, sectionId, checkId, text, severity }) => {
    setCategories((p) =>
      p.map((c) =>
        c.id === catId
          ? {
              ...c,
              sections: c.sections.map((s) =>
                s.id === sectionId
                  ? {
                      ...s,
                      checks: s.checks.map((ch) =>
                        ch.id === checkId ? { ...ch, text, severity } : ch
                      ),
                    }
                  : s
              ),
            }
          : c
      )
    );
  };

  const deleteCheck = (catId, sectionId, checkId) => {
    setCategories((p) =>
      p.map((c) =>
        c.id === catId
          ? {
              ...c,
              sections: c.sections.map((s) =>
                s.id === sectionId
                  ? { ...s, checks: s.checks.filter((ch) => ch.id !== checkId) }
                  : s
              ),
            }
          : c
      )
    );
  };

  /* ── Guides ─────────────────────────────────────────────── */

  const editGuide = (checkId, text) => {
    setGuides((p) => ({ ...p, [checkId]: text }));
  };

  /* ── Notes ──────────────────────────────────────────────── */

  const updateNote = useCallback((checkId, noteData) => {
    setNotes((p) => ({ ...p, [checkId]: { ...(p[checkId] || {}), ...noteData } }));
  }, []);

  /* ── Scope ──────────────────────────────────────────────── */

  const updateScope = useCallback((scopeData) => {
    setScope((p) => ({ ...p, ...scopeData }));
  }, []);

  /* ── Timers ─────────────────────────────────────────────── */

  const updateTimers = useCallback((timerData) => {
    setTimers(timerData);
  }, []);

  /* ── Bulk Add ───────────────────────────────────────────── */

  const bulkAddChecks = ({ catId, sectionId, lines, severity }) => {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === catId
          ? {
              ...c,
              sections: c.sections.map((s) =>
                s.id === sectionId
                  ? {
                      ...s,
                      checks: [
                        ...s.checks,
                        ...lines.map((text) => ({ id: uid(), text, severity })),
                      ],
                    }
                  : s
              ),
            }
          : c
      )
    );
  };

  /* ── Reorder (Drag & Drop) ──────────────────────────────── */

  const reorderSections = useCallback((catId, fromIndex, toIndex) => {
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== catId) return c;
        const sections = [...c.sections];
        const [moved] = sections.splice(fromIndex, 1);
        sections.splice(toIndex, 0, moved);
        return { ...c, sections };
      })
    );
  }, []);

  const reorderChecks = useCallback((catId, sectionId, fromIndex, toIndex) => {
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== catId) return c;
        return {
          ...c,
          sections: c.sections.map((s) => {
            if (s.id !== sectionId) return s;
            const checks = [...s.checks];
            const [moved] = checks.splice(fromIndex, 1);
            checks.splice(toIndex, 0, moved);
            return { ...s, checks };
          }),
        };
      })
    );
  }, []);

  /* ── Import ─────────────────────────────────────────────── */

  const importChecklistData = (dataStr) => {
    try {
      const data = JSON.parse(dataStr);
      if (data && typeof data === "object") {
        if (data.categories && Array.isArray(data.categories)) {
          setCategories(data.categories);
        }
        if (data.progress && typeof data.progress === "object") {
          setProgress(data.progress);
        }
        if (data.guides && typeof data.guides === "object") {
          setGuides(data.guides);
        }
        if (data.notes && typeof data.notes === "object") {
          setNotes(data.notes);
        }
        return { success: true };
      }
    } catch (err) {
      console.error("Failed to import checklist data:", err);
      return { success: false, error: err.message };
    }
    return { success: false, error: "Invalid format" };
  };

  /* ── Dynamic Injection ──────────────────────────────────── */

  const injectChecks = useCallback((categoryName, sectionName, newChecks) => {
    setCategories((p) => {
      const next = [...p];
      let cat = next.find(c => c.label === categoryName);
      if (!cat) {
        cat = { id: uid(), label: categoryName, icon: "🧠", color: "#3b82f6", custom: true, sections: [] };
        next.push(cat);
      }
      
      let sec = cat.sections.find(s => s.name === sectionName);
      if (!sec) {
        sec = { id: uid(), name: sectionName, severity: "High", checks: [] };
        cat.sections.push(sec);
      }
      
      sec.checks.push(...newChecks);
      return next;
    });
  }, []);

  const clearInjectedChecks = useCallback(() => {
    setCategories((p) => p.filter((c) => c.label !== "🧠 Dynamic Behavioral Tests"));
  }, []);

  return {
    categories,
    progress,
    guides,
    notes,
    scope,
    timers,
    activeTab,
    setActiveTab,
    getCheckStatus,
    setCheckStatus,
    cycleCheckStatus,
    isCheckTested,
    toggleCheck,
    resetProgress,
    addCategory,
    editCategory,
    deleteCategory,
    addSection,
    editSection,
    deleteSection,
    addCheck,
    editCheck,
    deleteCheck,
    editGuide,
    updateNote,
    updateScope,
    updateTimers,
    bulkAddChecks,
    reorderSections,
    reorderChecks,
    importChecklistData,
    injectChecks,
    clearInjectedChecks,
  };
}
