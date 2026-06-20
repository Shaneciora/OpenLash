import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface Collection {
  id: number;
  name: string;
  prompt_count: number;
}

interface Prompt {
  id: number;
  text: string;
  type: string;
}

export function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [newName, setNewName] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [newPrompt, setNewPrompt] = useState("");
  const [newPromptType, setNewPromptType] = useState<"regular" | "thriplash">("regular");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editType, setEditType] = useState<"regular" | "thriplash">("regular");

  const refreshCollections = () =>
    fetch("/api/collections")
      .then((r) => r.json())
      .then(setCollections);

  useEffect(() => {
    void refreshCollections();
  }, []);

  const createCollection = async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const col = await res.json();
    setCollections((c) => [...c, { ...col, prompt_count: 0 }]);
    setNewName("");
  };

  const loadCollection = async (id: number) => {
    const res = await fetch(`/api/collections/${id}`);
    const data = await res.json();
    setPrompts(data.prompts);
  };

  const toggleCollection = (id: number) => {
    if (selected === id) {
      setSelected(null);
      setPrompts([]);
      setEditingId(null);
      return;
    }
    setSelected(id);
    setEditingId(null);
    void loadCollection(id);
  };

  const addPrompt = async () => {
    if (!selected || !newPrompt.trim()) return;
    await fetch(`/api/collections/${selected}/prompts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newPrompt.trim(), type: newPromptType }),
    });
    setNewPrompt("");
    await loadCollection(selected);
    void refreshCollections();
  };

  const startEdit = (prompt: Prompt) => {
    setEditingId(prompt.id);
    setEditDraft(prompt.text);
    setEditType(prompt.type === "thriplash" ? "thriplash" : "regular");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const savePrompt = async (promptId: number) => {
    if (!editDraft.trim() || !selected) return;
    await fetch(`/api/prompts/${promptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: editDraft.trim(), type: editType }),
    });
    setEditingId(null);
    await loadCollection(selected);
  };

  const deletePrompt = async (promptId: number) => {
    if (!selected) return;
    await fetch(`/api/prompts/${promptId}`, { method: "DELETE" });
    if (editingId === promptId) cancelEdit();
    await loadCollection(selected);
    void refreshCollections();
  };

  return (
    <div className="play-screen collections-page has-back-link">
      <Link to="/" className="back-link" data-testid="back-link">
        Back
      </Link>
      <h1>Collections</h1>

      <div className="card collections-create">
        <input
          placeholder="New collection name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={20}
        />
        <button onClick={createCollection} data-testid="create-collection-btn">
          Create Collection
        </button>
      </div>

      <ul className="collections-list">
        {collections.map((c) => {
          const isOpen = selected === c.id;
          return (
            <li key={c.id} className="collections-list-item">
              <button
                type="button"
                className={isOpen ? "primary collections-toggle" : "collections-toggle"}
                data-testid={`collection-toggle-${c.id}`}
                aria-expanded={isOpen}
                onClick={() => toggleCollection(c.id)}
              >
                {c.name} ({c.prompt_count})
              </button>

              {isOpen && (
                <div className="card collection-editor" data-testid="collection-editor">
                  <h2>Prompts</h2>

                  <div className="collection-add-prompt">
                    <textarea
                      data-testid="prompt-input"
                      placeholder="New prompt text"
                      value={newPrompt}
                      onChange={(e) => setNewPrompt(e.target.value)}
                      maxLength={120}
                      rows={2}
                    />
                    <div className="collection-add-row">
                      <select
                        value={newPromptType}
                        onChange={(e) =>
                          setNewPromptType(e.target.value as "regular" | "thriplash")
                        }
                        aria-label="Prompt type"
                      >
                        <option value="regular">Regular</option>
                        <option value="thriplash">Thriplash</option>
                      </select>
                      <button data-testid="add-prompt-btn" onClick={addPrompt}>
                        Add Prompt
                      </button>
                    </div>
                  </div>

                  <ul className="prompt-list" data-testid="prompt-list">
                    {prompts.map((p) => (
                      <li key={p.id} className="prompt-list-item" data-testid={`prompt-${p.id}`}>
                        {editingId === p.id ? (
                          <div className="prompt-edit">
                            <textarea
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              maxLength={120}
                              rows={2}
                              data-testid={`prompt-edit-input-${p.id}`}
                            />
                            <select
                              value={editType}
                              onChange={(e) =>
                                setEditType(e.target.value as "regular" | "thriplash")
                              }
                              aria-label="Prompt type"
                            >
                              <option value="regular">Regular</option>
                              <option value="thriplash">Thriplash</option>
                            </select>
                            <div className="prompt-edit-actions">
                              <button
                                type="button"
                                className="primary"
                                data-testid={`prompt-save-${p.id}`}
                                onClick={() => void savePrompt(p.id)}
                              >
                                Save
                              </button>
                              <button type="button" onClick={cancelEdit}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="prompt-row">
                            <div className="prompt-row-text">
                              <span className="prompt-type-badge">
                                {p.type === "thriplash" ? "Thriplash" : "Regular"}
                              </span>
                              <span>{p.text}</span>
                            </div>
                            <div className="prompt-row-actions">
                              <button
                                type="button"
                                data-testid={`prompt-edit-${p.id}`}
                                onClick={() => startEdit(p)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                data-testid={`prompt-delete-${p.id}`}
                                onClick={() => void deletePrompt(p.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>

                  {prompts.length === 0 && (
                    <p className="collection-empty">No prompts yet. Add one above.</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
