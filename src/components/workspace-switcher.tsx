"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";

type WorkspaceOption = { id: string; name: string; slug: string };

function toSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export function WorkspaceSwitcher({ workspaces, currentSlug }: { workspaces: WorkspaceOption[]; currentSlug: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

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

  function switchWorkspace(slug: string) { router.push(pathname === "/notifications" ? `/board?workspace=${slug}` : `${pathname}?workspace=${slug}`); }

  return <section className="workspace-switcher" aria-label="Spaces">
    <span className="space-list-title">Spaces</span>
    <div className="space-list" role="list">
      {workspaces.map((workspace, index) => <div key={workspace.id} role="listitem"><button type="button" className={`space-item${workspace.slug === currentSlug ? " active" : ""}`} data-tone={(index % 6) + 1} aria-current={workspace.slug === currentSlug ? "page" : undefined} onClick={() => switchWorkspace(workspace.slug)}>
        <span className="space-icon" aria-hidden="true">{workspace.name.trim().charAt(0).toUpperCase() || "S"}</span>
        <span className="space-name">{workspace.name}</span>
      </button></div>)}
    </div>
    <button type="button" className="space-add" aria-expanded={creating} onClick={() => { setCreating((value) => !value); setError(""); }}><span aria-hidden="true">+</span> Add Space</button>
    {creating && <form onSubmit={createWorkspace} className="space-create-form"><input name="name" aria-label="New space name" placeholder="Space name" minLength={2} maxLength={80} required autoFocus /><button>Create space</button>{error && <small role="alert">{error}</small>}</form>}
  </section>;
}
