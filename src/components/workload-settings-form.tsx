"use client";

import { useState, type FormEvent } from "react";

export function WorkloadSettingsForm({ workspaceId, initial }: { workspaceId: string; initial: { overloadThreshold: number; dueSoonDays: number; stalledAfterDays: number } }) {
  const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(""); const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/workspaces/${workspaceId}/workload-settings`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ overloadThreshold: Number(data.get("overloadThreshold")), dueSoonDays: Number(data.get("dueSoonDays")), stalledAfterDays: Number(data.get("stalledAfterDays")) }) });
    setSaving(false); setMessage(response.ok ? "Alert thresholds saved. Refresh to recalculate this dashboard." : (await response.json()).error);
  }
  return <details className="workload-settings"><summary>Alert settings</summary><form onSubmit={save}><label>Overload at<input name="overloadThreshold" type="number" min="50" max="200" defaultValue={initial.overloadThreshold} /><span>%</span></label><label>Due soon within<input name="dueSoonDays" type="number" min="1" max="30" defaultValue={initial.dueSoonDays} /><span>days</span></label><label>Stalled after<input name="stalledAfterDays" type="number" min="1" max="90" defaultValue={initial.stalledAfterDays} /><span>days</span></label><button className="primary-button small" disabled={saving}>{saving ? "Saving..." : "Save settings"}</button><small role="status">{message}</small></form></details>;
}
