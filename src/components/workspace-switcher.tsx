"use client";

import { useState, type DragEvent, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";

type WorkspaceOption = { id: string; name: string; slug: string; role?: string; sidebarOrder?: number };

function toSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export function WorkspaceSwitcher({ workspaces, currentSlug }: { workspaces: WorkspaceOption[]; currentSlug: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [orderedWorkspaces, setOrderedWorkspaces] = useState(workspaces);
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false);
  const canManageSpaces = orderedWorkspaces.some((workspace) => workspace.role === "OWNER");
  const currentWorkspace = orderedWorkspaces.find((workspace) => workspace.slug === currentSlug) || orderedWorkspaces[0];

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    const slug = toSlug(name);
    if (!slug) return setError("Enter a space name using letters or numbers.");
    const response = await fetch("/api/workspaces", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, slug }) });
    const result = await response.json();
    if (!response.ok) return setError(result.error || "Could not create space");
    setCreating(false);
    setError("");
    router.push(`/board?workspace=${result.slug}`);
    router.refresh();
  }

  function switchWorkspace(slug: string) { setSpaceMenuOpen(false); router.push(pathname === "/notifications" ? `/board?workspace=${slug}` : `${pathname}?workspace=${slug}`); }

  function beginRename(workspace: WorkspaceOption) { setEditingId(workspace.id); setDraftName(workspace.name); setError(""); }

  async function renameWorkspace(event: FormEvent<HTMLFormElement>, workspaceId: string) {
    event.preventDefault();
    const name = draftName.trim();
    if (name.length < 2) return setError("Space names need at least 2 characters.");
    setSaving(true);
    const response = await fetch(`/api/workspaces/${workspaceId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) return setError(result.error || "Could not rename space");
    setOrderedWorkspaces((items) => items.map((item) => item.id === workspaceId ? { ...item, name: result.name } : item));
    setEditingId(null);
    setError("");
    router.refresh();
  }

  async function persistOrder(next: WorkspaceOption[], previous: WorkspaceOption[]) {
    const response = await fetch("/api/workspaces/reorder", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceIds: next.map((workspace) => workspace.id) }) });
    if (response.ok) return;
    setOrderedWorkspaces(previous);
    setError((await response.json().catch(() => ({ error: "Could not save space order" }))).error || "Could not save space order");
  }

  function reorderWorkspace(workspaceId: string, targetIndex: number) {
    const currentIndex = orderedWorkspaces.findIndex((workspace) => workspace.id === workspaceId);
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedWorkspaces.length || currentIndex === targetIndex) return;
    const previous = orderedWorkspaces;
    const next = [...orderedWorkspaces];
    const [workspace] = next.splice(currentIndex, 1);
    next.splice(targetIndex, 0, workspace);
    setOrderedWorkspaces(next);
    void persistOrder(next, previous);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, targetIndex: number) {
    event.preventDefault();
    if (draggingId) reorderWorkspace(draggingId, targetIndex);
    setDraggingId(null);
  }

  return <section className="workspace-switcher" aria-label="Spaces">
    <div className="space-list-header"><span className="space-list-title">Spaces</span>{canManageSpaces && <button type="button" className="space-manage-toggle" aria-expanded={managing} onClick={() => { setManaging((value) => !value); setSpaceMenuOpen(false); setEditingId(null); setError(""); }}>{managing ? "Done" : "Manage"}</button>}</div>
    {!managing && currentWorkspace && orderedWorkspaces.length > 1 && <button type="button" className="space-current-trigger" aria-expanded={spaceMenuOpen} aria-controls="space-picker-options" onClick={() => setSpaceMenuOpen((value) => !value)}><span className="space-icon" data-tone={(orderedWorkspaces.indexOf(currentWorkspace) % 6) + 1}>{currentWorkspace.name.trim().charAt(0).toUpperCase() || "S"}</span><span className="space-name">{currentWorkspace.name}</span><span className="space-picker-chevron" aria-hidden="true">⌄</span></button>}
    {(managing || orderedWorkspaces.length <= 1 || spaceMenuOpen) && <div id="space-picker-options" className={`space-list${managing ? " managing" : " compact-open"}`} role="list">
      {orderedWorkspaces.map((workspace, index) => <div key={workspace.id} role="listitem" className={`space-row${draggingId === workspace.id ? " dragging" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, index)}>
        {managing && <span className="space-drag-handle" draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggingId(workspace.id); }} onDragEnd={() => setDraggingId(null)} aria-label={`Drag ${workspace.name} to reorder`} title="Drag to reorder">⋮⋮</span>}
        {editingId === workspace.id ? <form className="space-rename-form" onSubmit={(event) => void renameWorkspace(event, workspace.id)}><input value={draftName} onChange={(event) => setDraftName(event.target.value)} aria-label={`Rename ${workspace.name}`} minLength={2} maxLength={80} autoFocus /><button type="submit" disabled={saving}>{saving ? "Saving" : "Save"}</button><button type="button" onClick={() => setEditingId(null)}>Cancel</button></form> : <><button type="button" className={`space-item${workspace.slug === currentSlug ? " active" : ""}`} data-tone={(index % 6) + 1} aria-current={workspace.slug === currentSlug ? "page" : undefined} onClick={() => switchWorkspace(workspace.slug)}><span className="space-icon" aria-hidden="true">{workspace.name.trim().charAt(0).toUpperCase() || "S"}</span><span className="space-name">{workspace.name}</span></button>{managing && <div className="space-row-actions">{workspace.role === "OWNER" && <button type="button" onClick={() => beginRename(workspace)} aria-label={`Rename ${workspace.name}`} title="Rename">✎</button>}<button type="button" onClick={() => reorderWorkspace(workspace.id, index - 1)} disabled={index === 0} aria-label={`Move ${workspace.name} up`} title="Move up">↑</button><button type="button" onClick={() => reorderWorkspace(workspace.id, index + 1)} disabled={index === orderedWorkspaces.length - 1} aria-label={`Move ${workspace.name} down`} title="Move down">↓</button></div>}</>}
      </div>)}
    </div>}
    <button type="button" className="space-add" aria-expanded={creating} onClick={() => { setCreating((value) => !value); setError(""); }}><span aria-hidden="true">+</span> Add Space</button>
    {creating && <form onSubmit={createWorkspace} className="space-create-form"><input name="name" aria-label="New space name" placeholder="Space name" minLength={2} maxLength={80} required autoFocus /><button>Create space</button>{error && <small role="alert">{error}</small>}</form>}
    {error && !creating && <small className="space-error" role="alert">{error}</small>}
  </section>;
}
