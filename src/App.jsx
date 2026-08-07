import { useState, useEffect } from "react";
import useProjects from "./hooks/useProjects";
import useChecklist from "./hooks/useChecklist";
import useTheme from "./hooks/useTheme";
import useTimer, { formatTime } from "./hooks/useTimer";
import usePayloads from "./hooks/usePayloads";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import Section from "./components/Section";
import DeleteConfirmModal from "./components/DeleteConfirmModal";
import CategoryModal from "./components/CategoryModal";
import SectionModal from "./components/SectionModal";
import CheckModal from "./components/CheckModal";
import BulkAddModal from "./components/BulkAddModal";
import Dashboard from "./components/Dashboard";
import ScopePanel from "./components/ScopePanel";
import ScopeIntel from "./components/ScopeIntel";
import ProgramIntel from "./components/ProgramIntel";
import FingerprintEngine from "./components/FingerprintEngine";
import MethodologyWorkflow from "./components/MethodologyWorkflow";
import PayloadVault from "./components/PayloadVault";
import Sandbox from "./components/Sandbox";
import TestFlowEngine from "./components/TestFlowEngine";
import ReconDiffEngine from "./components/ReconDiffEngine";
import ReconUrlParser from "./components/ReconUrlParser";
import WebFocusView from "./components/WebFocusView";

import ExportModal from "./components/ExportModal";
import ImportExportModal from "./components/ImportExportModal";
import CommandPalette from "./components/CommandPalette";
import { TESTED_STATUSES } from "./data/constants";

export default function BugBountyChecklist() {
  const { theme, toggleTheme } = useTheme();

  const {
    projects,
    activeProjectId,
    switchProject,
    createProject,
    deleteProject,
    renameProject,
    duplicateProject,
    importAsNewProject,
  } = useProjects();

  const {
    categories,
    progress,
    guides,
    notes,
    scope,
    timers: timerData,
    activeTab,
    setActiveTab,
    cycleCheckStatus,
    setCheckStatus,
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
  } = useChecklist(activeProjectId);

  const { startTimer, pauseTimer, resetTimer, getElapsed, isRunning, timers } = useTimer(timerData, updateTimers);
  const { payloads, settings, updateSettings, addPayload, deletePayload, incrementSuccess, incrementFail, syncCommunityPayloads } = usePayloads();

  const [searchQuery, setSearchQuery] = useState("");
  const [sevFilter, setSevFilter] = useState("All");
  const [expandAll, setExpandAll] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [modal, setModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [currentView, setCurrentView] = useState("checklist"); // "checklist" | "dashboard" | "scope"
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const toggleGroup = (g) => setCollapsedGroups((p) => ({ ...p, [g]: !p[g] }));
  const [reconDiffState, setReconDiffState] = useState({
    oldRawText: "",
    newRawText: "",
    diffResult: null,
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const closeModal = () => setModal(null);

  const confirmDelete = (item) => setDeleteConfirm(item);

  const executeDelete = () => {
    if (!deleteConfirm) return;
    const { type, catId, sectionId, checkId, id } = deleteConfirm;
    if (deleteConfirm.onConfirmOverride) {
      deleteConfirm.onConfirmOverride();
      return;
    }
    if (type === "check") {
      deleteCheck(catId, sectionId, checkId);
    } else if (type === "section") {
      deleteSection(catId, id);
    } else if (type === "category") {
      deleteCategory(id);
    }
    setDeleteConfirm(null);
  };

  const handleResetProgress = () => {
    setDeleteConfirm({
      type: "check",
      name: "ALL progress data",
      detail: "This will reset all check statuses to Not Tested.",
      onConfirmOverride: () => {
        resetProgress();
        setDeleteConfirm(null);
      },
    });
  };

  const activeCategory = categories.find((c) => c.id === activeTab);
  const allChecks = categories.flatMap((c) => c.sections.flatMap((s) => s.checks));
  const totalTested = allChecks.filter((c) => TESTED_STATUSES.includes(progress[c.id])).length;
  const totalAll = allChecks.length;
  const totalVulns = allChecks.filter((c) => progress[c.id] === "vulnerable").length;
  const globalPct = totalAll > 0 ? Math.round((totalTested / totalAll) * 100) : 0;
  const catChecks = activeCategory?.sections.flatMap((s) => s.checks) || [];
  const catTested = catChecks.filter((c) => TESTED_STATUSES.includes(progress[c.id])).length;
  const catPct = catChecks.length > 0 ? Math.round((catTested / catChecks.length) * 100) : 0;

  const filteredSections = (activeCategory?.sections || [])
    .map((s) => ({
      ...s,
      checks:
        sevFilter === "All"
          ? s.checks
          : s.checks.filter((c) => c.severity === sevFilter),
    }))
    .filter((s) => isEditMode || s.checks.length > 0);

  const GROUP_ORDER = [
    "🔍 Information Gathering",
    "⚙️ Config & Deploy Management",
    "🆔 Identity Management",
    "🔑 Authentication",
    "🛡️ Authorization",
    "🍪 Session Management",
    "💉 Input Validation",
    "⚠️ Error Handling & Logging",
    "🔐 Cryptography",
    "🧠 Business Logic",
    "🖥️ Client-Side",
    "🧩 Technology & Feature-Specific",
  ];
  const isGrouped = filteredSections.some((s) => s.group);

  const handleDeleteCategory = (catId, name) =>
    confirmDelete({
      type: "category",
      id: catId,
      name,
      detail: "All sections and checks inside will be deleted.",
    });

  const handleDeleteSectionReq = (sectionId, name) => {
    const sec = activeCategory?.sections.find((s) => s.id === sectionId);
    confirmDelete({
      type: "section",
      id: sectionId,
      catId: activeTab,
      name,
      detail: `Contains ${sec?.checks.length || 0} checks.`,
    });
  };

  const handleDeleteCheckReq = (catId, sectionId, checkId, text) =>
    confirmDelete({
      type: "check",
      catId,
      sectionId,
      checkId,
      name: text,
      detail: "This check will be permanently removed.",
    });

  const handleAddCheck = (catId, sectionId) =>
    setModal({ type: "addCheck", catId, sectionId });

  const handleBulkAdd = () => setModal({ type: "bulkAdd" });

  const handleEditCheck = (catId, sectionId, check) =>
    setModal({ type: "editCheck", catId, sectionId, check });

  const handleAddSection = () => setModal({ type: "addSection", catId: activeTab });

  const handleEditSection = (section) =>
    setModal({ type: "editSection", catId: activeTab, section });

  const handleSwitchProject = (id) => {
    switchProject(id);
    setCurrentView("checklist");
  };

  const handleTrackAsset = (host) => {
    const currentUrls = scope?.importantUrls || "";
    if (!currentUrls.includes(host)) {
      const prefix = host.startsWith("http") ? "" : "https://";
      updateScope({ ...scope, importantUrls: currentUrls + (currentUrls ? "\n" : "") + prefix + host });
    }
  };

  // Render a fully-wired Section (used by both the classic list and WebFocusView detail).
  const renderSection = (section, idx) => (
    <Section
      key={section.id}
      section={section}
      sectionIndex={idx}
      catId={activeTab}
      progress={progress}
      onCycleStatus={cycleCheckStatus}
      onSetStatus={setCheckStatus}
      searchQuery={searchQuery}
      expandAll={expandAll}
      isEditMode={isEditMode}
      onDeleteSection={(sid) => handleDeleteSectionReq(sid, section.name)}
      onEditSection={handleEditSection}
      onAddCheck={handleAddCheck}
      onDeleteCheck={(checkId) => {
        const ch = section.checks.find((c) => c.id === checkId);
        handleDeleteCheckReq(activeTab, section.id, checkId, ch?.text || "this check");
      }}
      onEditCheck={(check) => handleEditCheck(activeTab, section.id, check)}
      onEditGuide={editGuide}
      guides={guides}
      notes={notes}
      onUpdateNote={updateNote}
      onReorderChecks={reorderChecks}
      onReorderSections={reorderSections}
      totalSections={filteredSections.length}
      scope={scope}
    />
  );

  return (
    <div className="app-root">
      {deleteConfirm && (
        <DeleteConfirmModal
          item={deleteConfirm}
          onConfirm={executeDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* SIDEBAR */}
      <Sidebar
        categories={categories}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        progress={progress}
        globalPct={globalPct}
        totalTested={totalTested}
        totalAll={totalAll}
        totalVulns={totalVulns}
        isEditMode={isEditMode}
        onResetProgress={handleResetProgress}
        onAddCategory={() => setModal({ type: "addCategory" })}
        onDeleteCategory={handleDeleteCategory}
        projects={projects}
        activeProjectId={activeProjectId}
        onSwitchProject={handleSwitchProject}
        onCreateProject={createProject}
        onDeleteProject={deleteProject}
        onRenameProject={renameProject}
        onDuplicateProject={duplicateProject}
        currentView={currentView}
        onSetView={setCurrentView}
        timers={timers}
      />

      {/* MAIN CONTENT */}
      <main className="main-content">
        <TopBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          sevFilter={sevFilter}
          setSevFilter={setSevFilter}
          expandAll={expandAll}
          setExpandAll={setExpandAll}
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
          onBulkAdd={handleBulkAdd}
          theme={theme}
          onToggleTheme={toggleTheme}
          onExport={() => setModal({ type: "export" })}
          onImportExport={() => setModal({ type: "importExport" })}
        />

        {/* PERSISTENT VIEWS */}
        <div style={{ display: currentView === "urlparser" ? "block" : "none", width: "100%", height: "100%", overflow: "hidden" }}>
          <ReconUrlParser activeProjectId={activeProjectId} />
        </div>

        {/* CONDITIONALLY RENDERED VIEWS */}
        {currentView !== "urlparser" && (
          <>
            {currentView === "dashboard" ? (
              <Dashboard categories={categories} progress={progress} timers={timers} />
          ) : currentView === "scope" ? (
            <ScopePanel scope={scope} onUpdate={updateScope} />
          ) : currentView === "intel" ? (
            <ScopeIntel />
          ) : currentView === "payloads" ? (
            <PayloadVault 
              payloads={payloads} 
              settings={settings} 
              updateSettings={updateSettings} 
              addPayload={addPayload} 
              deletePayload={deletePayload} 
              incrementSuccess={incrementSuccess}
              incrementFail={incrementFail}
              syncCommunityPayloads={syncCommunityPayloads}
            />
          ) : currentView === "sandbox" ? (
            <Sandbox />
          ) : currentView === "programs" ? (
            <ProgramIntel />
          ) : currentView === "fingerprint" ? (
            <FingerprintEngine onInjectChecks={injectChecks} onClearChecks={clearInjectedChecks} />
          ) : currentView === "methodology" ? (
            <MethodologyWorkflow categories={categories} />
          ) : currentView === "testflows" ? (
            <TestFlowEngine />
            ) : currentView === "recondiff" ? (
              <ReconDiffEngine 
                onTrackAsset={handleTrackAsset} 
                state={reconDiffState} 
                setState={setReconDiffState} 
              />
            ) : (
              <div className="content-area">
            {/* Category Header */}
            <div className="category-header">
              <div className="category-header-top">
                <span className="category-icon" aria-hidden="true">
                  {activeCategory?.icon}
                </span>
                <div>
                  <h1 className="category-title">
                    {activeCategory?.label}
                    <span className="category-badge">
                      {catTested}/{catChecks.length} tested
                    </span>
                  </h1>
                </div>
              </div>
              <div className="category-progress">
                <div className="category-progress-bar">
                  <div
                    className="category-progress-fill"
                    style={{
                      width: `${catPct}%`,
                      background:
                        catPct === 100 ? "#059669" : activeCategory?.color || "#dc2626",
                    }}
                  />
                </div>
                <span
                  className="category-progress-pct"
                  style={{
                    color: catPct === 100 ? "#059669" : "var(--color-text-muted)",
                  }}
                >
                  {catPct}%
                </span>
              </div>

              {/* Timer */}
              {activeTab && (
                <div className="category-timer">
                  <span className="category-timer-display">
                    ⏱ {formatTime(getElapsed(activeTab))}
                  </span>
                  {isRunning(activeTab) ? (
                    <button className="category-timer-btn category-timer-btn--pause" onClick={() => pauseTimer(activeTab)}>
                      ⏸ Pause
                    </button>
                  ) : (
                    <button className="category-timer-btn category-timer-btn--play" onClick={() => startTimer(activeTab)}>
                      ▶ Start
                    </button>
                  )}
                  <button className="category-timer-btn" onClick={() => resetTimer(activeTab)}>
                    🔄 Reset
                  </button>
                </div>
              )}
            </div>

            {/* Edit Mode Active Bar */}
            {isEditMode && (
              <div className="edit-bar">
                <span className="edit-bar-label">✎ Edit Mode Active</span>
                <span className="edit-bar-hint">Add, edit, reorder, or delete items</span>
                <button
                  className="btn-edit-category"
                  onClick={() => setModal({ type: "editCategory", category: activeCategory })}
                >
                  ✎ Edit Category
                </button>
                <button className="btn-add-section" onClick={handleAddSection}>
                  + Add Section
                </button>
              </div>
            )}

            {/* Sections List */}
            {activeCategory?.id === "web" && !isEditMode ? (
              <WebFocusView
                category={activeCategory}
                progress={progress}
                searchQuery={searchQuery}
                sevFilter={sevFilter}
                renderDetail={renderSection}
              />
            ) : filteredSections.length === 0 && !isEditMode ? (
              <div className="empty-state">
                <div className="empty-state-icon" aria-hidden="true">
                  🔍
                </div>
                No checks found for selected filters.
              </div>
            ) : (
              (() => {
                if (!isGrouped) {
                  return filteredSections.map((section, idx) => renderSection(section, idx));
                }
                return GROUP_ORDER.map((g) => {
                  const secs = filteredSections.filter((s) => s.group === g);
                  if (secs.length === 0) return null;
                  const collapsed = !!collapsedGroups[g];
                  const gChecks = secs.flatMap((s) => s.checks);
                  const gTested = gChecks.filter((c) => TESTED_STATUSES.includes(progress[c.id])).length;
                  return (
                    <div key={g} className="wstg-group">
                      <button
                        className="wstg-group-header"
                        onClick={() => toggleGroup(g)}
                        aria-expanded={!collapsed}
                      >
                        <span className="wstg-group-caret">{collapsed ? "▸" : "▾"}</span>
                        <span className="wstg-group-name">{g}</span>
                        <span className="wstg-group-meta">
                          {secs.length} {secs.length === 1 ? "category" : "categories"} · {gTested}/{gChecks.length}
                        </span>
                      </button>
                      {!collapsed &&
                        secs.map((section) =>
                          renderSection(section, filteredSections.indexOf(section))
                        )}
                    </div>
                  );
                });
              })()
            )}

            <footer className="content-footer">
              All data saved locally in your browser · Use responsibly and only with explicit authorization
            </footer>
          </div>
          )}
        </>
        )}
      </main>

      {/* MODALS */}
      {modal?.type === "bulkAdd" && (
        <BulkAddModal
          categories={categories}
          onSave={(d) => { bulkAddChecks(d); closeModal(); }}
          onClose={closeModal}
        />
      )}
      {modal?.type === "addCategory" && (
        <CategoryModal title="New Category" onClose={closeModal} onSave={(d) => { addCategory(d); closeModal(); }} />
      )}
      {modal?.type === "editCategory" && (
        <CategoryModal
          title="Edit Category"
          onClose={closeModal}
          initial={modal.category}
          onSave={(d) => { editCategory({ id: modal.category.id, ...d }); closeModal(); }}
        />
      )}
      {modal?.type === "addSection" && (
        <SectionModal
          title="New Section"
          onClose={closeModal}
          onSave={(d) => { addSection({ catId: modal.catId, ...d }); closeModal(); }}
        />
      )}
      {modal?.type === "editSection" && (
        <SectionModal
          title="Edit Section"
          onClose={closeModal}
          initial={modal.section}
          onSave={(d) => { editSection({ catId: modal.catId, sectionId: modal.section.id, ...d }); closeModal(); }}
        />
      )}
      {modal?.type === "addCheck" && (
        <CheckModal
          title="Add Check"
          onClose={closeModal}
          onSave={(d) => { addCheck({ catId: modal.catId, sectionId: modal.sectionId, ...d }); closeModal(); }}
        />
      )}
      {modal?.type === "editCheck" && (
        <CheckModal
          title="Edit Check"
          onClose={closeModal}
          initial={modal.check}
          onSave={(d) => {
            editCheck({
              catId: modal.catId,
              sectionId: modal.sectionId,
              checkId: modal.check.id,
              ...d,
            });
            closeModal();
          }}
        />
      )}
      {modal?.type === "export" && (
        <ExportModal
          categories={categories}
          progress={progress}
          notes={notes}
          guides={guides}
          scope={scope}
          onClose={closeModal}
        />
      )}
      {modal?.type === "importExport" && (
        <ImportExportModal
          categories={categories}
          guides={guides}
          notes={notes}
          onImport={importChecklistData}
          onImportAsProject={importAsNewProject}
          onClose={closeModal}
        />
      )}
      
      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        projects={projects}
        switchProject={switchProject}
        setCurrentView={setCurrentView}
        setActiveTab={setActiveTab}
      />
    </div>
  );
}