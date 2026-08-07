import { useState, useEffect } from "react";
import { DEFAULT_CATEGORIES } from "../data/defaultCategories";
import { loadData, saveData, uid } from "../utils/storage";

export default function useChecklist() {
  const [categories, setCategories] = useState(() => {
    const saved = loadData();
    return saved?.categories || DEFAULT_CATEGORIES;
  });

  const [progress, setProgress] = useState(() => {
    const saved = loadData();
    return saved?.progress || {};
  });

  const [guides, setGuides] = useState(() => {
    const saved = loadData();
    return saved?.guides || {};
  });

  const [activeTab, setActiveTab] = useState(() => {
    const saved = loadData();
    if (saved?.categories && saved.categories.length > 0) {
      return saved.categories[0].id;
    }
    return DEFAULT_CATEGORIES[0]?.id || "web";
  });

  // Ensure activeTab is valid if categories are deleted/modified
  useEffect(() => {
    if (categories.length > 0 && !categories.some((c) => c.id === activeTab)) {
      setActiveTab(categories[0].id);
    }
  }, [categories, activeTab]);

  // Debounced save to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      saveData(categories, progress, guides);
    }, 300);
    return () => clearTimeout(timer);
  }, [categories, progress, guides]);

  const toggleCheck = (id) => {
    setProgress((p) => ({ ...p, [id]: !p[id] }));
  };

  const resetProgress = () => {
    setProgress({});
  };

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

  const editGuide = (checkId, text) => {
    setGuides((p) => ({ ...p, [checkId]: text }));
  };

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

  // Import / Export backup functionality
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
        return { success: true };
      }
    } catch (err) {
      console.error("Failed to import checklist data:", err);
      return { success: false, error: err.message };
    }
    return { success: false, error: "Invalid format" };
  };

  return {
    categories,
    progress,
    guides,
    activeTab,
    setActiveTab,
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
    bulkAddChecks,
    importChecklistData,
  };
}
