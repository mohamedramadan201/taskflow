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
    if (!slug) return setError("Enter a workspace name using letters or numbers.");
    const response = await fetch("/api/workspaces", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, slug }) });
    const result = await response.json();
    if (!response.ok) return setError(result.error || "Could not create workspace");
    setCreating(false);
    setError("");
    router.push(`/board?workspace=${result.slug}`);
    router.refresh();
  }

  function switchWorkspace(slug: string) { router.push(pathname === "/notifications" ? `/board?workspace=${slug}` : `${pathname}?workspace=${slug}`); }

  return <div className="workspace-switcher"><label htmlFor="workspace-select">Workspace</label><div><select id="workspace-select" value={currentSlug} onChange={(event) => switchWorkspace(event.target.value)}>{workspaces.map((workspace) => <option key={workspace.id} value={workspace.slug}>{workspace.name}</option>)}</select><button type="button" aria-label="Create workspace" title="Create workspace" onClick={() => { setCreating((value) => !value); setError(""); }}>+</button></div>{creating && <form onSubmit={createWorkspace}><input name="name" aria-label="New workspace name" placeholder="Workspace name" minLength={2} maxLength={80} required autoFocus /><button>Create</button>{error && <small>{error}</small>}</form>}</div>;
}
