import { useState } from "react";
import useChecklist from "./hooks/useChecklist";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import Section from "./components/Section";
import DeleteConfirmModal from "./components/DeleteConfirmModal";
import CategoryModal from "./components/CategoryModal";
import SectionModal from "./components/SectionModal";
import CheckModal from "./components/CheckModal";
import BulkAddModal from "./components/BulkAddModal";

export default function BugBountyChecklist() {
  const {
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
  } = useChecklist();

  const [searchQuery, setSearchQuery] = useState("");
  const [sevFilter, setSevFilter] = useState("All");
  const [expandAll, setExpandAll] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [modal, setModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

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
      detail: "This will uncheck all completed items.",
      onConfirmOverride: () => {
        resetProgress();
        setDeleteConfirm(null);
      },
    });
  };

  const activeCategory = categories.find((c) => c.id === activeTab);
  const allChecks = categories.flatMap((c) => c.sections.flatMap((s) => s.checks));
  const totalDone = allChecks.filter((c) => progress[c.id]).length;
  const totalAll = allChecks.length;
  const globalPct = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;
  const catChecks = activeCategory?.sections.flatMap((s) => s.checks) || [];
  const catDone = catChecks.filter((c) => progress[c.id]).length;
  const catPct = catChecks.length > 0 ? Math.round((catDone / catChecks.length) * 100) : 0;

  const filteredSections = (activeCategory?.sections || [])
    .map((s) => ({
      ...s,
      checks:
        sevFilter === "All"
          ? s.checks
          : s.checks.filter((c) => c.severity === sevFilter),
    }))
    .filter((s) => isEditMode || s.checks.length > 0);

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
        totalDone={totalDone}
        totalAll={totalAll}
        isEditMode={isEditMode}
        onResetProgress={handleResetProgress}
        onAddCategory={() => setModal({ type: "addCategory" })}
        onDeleteCategory={handleDeleteCategory}
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
        />

        {/* CONTENT AREA */}
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
                    {catDone}/{catChecks.length} checks
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
                  color: catPct === 100 ? "#059669" : "#6b7280",
                }}
              >
                {catPct}%
              </span>
            </div>
          </div>

          {/* Edit Mode Active Bar */}
          {isEditMode && (
            <div className="edit-bar">
              <span className="edit-bar-label">✎ Edit Mode Active</span>
              <span className="edit-bar-hint">Add, edit, or delete items</span>
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
          {filteredSections.length === 0 && !isEditMode ? (
            <div className="empty-state">
              <div className="empty-state-icon" aria-hidden="true">
                🔍
              </div>
              No checks found for selected filters.
            </div>
          ) : (
            filteredSections.map((section) => (
              <Section
                key={section.id}
                section={section}
                catId={activeTab}
                progress={progress}
                onToggle={toggleCheck}
                searchQuery={searchQuery}
                expandAll={expandAll}
                isEditMode={isEditMode}
                onDeleteSection={(sid) => handleDeleteSectionReq(sid, section.name)}
                onEditSection={handleEditSection}
                onAddCheck={handleAddCheck}
                onDeleteCheck={(checkId) => {
                  const ch = section.checks.find((c) => c.id === checkId);
                  handleDeleteCheckReq(
                    activeTab,
                    section.id,
                    checkId,
                    ch?.text || "this check"
                  );
                }}
                onEditCheck={(check) => handleEditCheck(activeTab, section.id, check)}
                onEditGuide={editGuide}
                guides={guides}
              />
            ))
          )}

          <footer className="content-footer">
            All data saved locally in your browser · Use responsibly and only with explicit authorization
          </footer>
        </div>
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
    </div>
  );
}