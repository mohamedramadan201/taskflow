"use client";

import type { BulkAction } from "@/lib/bulk-task";
export type { BulkAction } from "@/lib/bulk-task";
type Member = { user: { id: string; name: string | null; email: string } };
type Label = { id: string; name: string; color: string };

export function BulkTaskToolbar({ selectedCount, visibleCount, allVisibleSelected, members, labels, onToggleAll, onClear, onAction }: { selectedCount: number; visibleCount: number; allVisibleSelected: boolean; members: Member[]; labels: Label[]; onToggleAll: () => void; onClear: () => void; onAction: (action: BulkAction, value: string | null) => void }) {
  return <section className="bulk-task-toolbar" aria-label="Bulk task actions">
    <div className="bulk-selection-summary"><strong>{selectedCount}</strong> selected <button type="button" className="toolbar-link" onClick={onToggleAll}>{allVisibleSelected ? "Clear visible" : `Select all visible${visibleCount ? ` (${visibleCount})` : ""}`}</button><button type="button" className="toolbar-link danger" onClick={onClear}>Clear</button></div>
    <div className="bulk-action-controls">
      <select aria-label="Assign selected tasks" defaultValue="" onChange={(event) => { if (event.target.value) onAction("ASSIGN", event.target.value === "__unassigned__" ? null : event.target.value); event.currentTarget.value = ""; }}><option value="">Assign...</option><option value="__unassigned__">Unassigned</option>{members.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.name || member.user.email}</option>)}</select>
      <select aria-label="Change status for selected tasks" defaultValue="" onChange={(event) => { if (event.target.value) onAction("STATUS", event.target.value); event.currentTarget.value = ""; }}><option value="">Status...</option><option value="TODO">To do</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Completed</option><option value="NO_ACTION_NEEDED">No action needed</option></select>
      <select aria-label="Change priority for selected tasks" defaultValue="" onChange={(event) => { if (event.target.value) onAction("PRIORITY", event.target.value); event.currentTarget.value = ""; }}><option value="">Priority...</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select>
      <label className="bulk-date-action">Due date<input type="date" aria-label="Change due date for selected tasks" onChange={(event) => { if (event.target.value) onAction("DUE_DATE", new Date(`${event.target.value}T12:00:00`).toISOString()); event.currentTarget.value = ""; }} /></label>
      {labels.length > 0 && <><select aria-label="Select label for selected tasks" defaultValue="" onChange={(event) => { if (event.target.value) onAction("ADD_LABEL", event.target.value); event.currentTarget.value = ""; }}><option value="">Add label...</option>{labels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}</select><select aria-label="Remove label from selected tasks" defaultValue="" onChange={(event) => { if (event.target.value) onAction("REMOVE_LABEL", event.target.value); event.currentTarget.value = ""; }}><option value="">Remove label...</option>{labels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}</select></>}
    </div>
  </section>;
}
