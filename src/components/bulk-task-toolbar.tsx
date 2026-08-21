"use client";

import type { BulkAction } from "@/lib/bulk-task";
export type { BulkAction } from "@/lib/bulk-task";
type Member = { user: { id: string; name: string | null; email: string } };
type Label = { id: string; name: string; color: string };

export function BulkTaskToolbar({ selectedCount, members, labels, sheetOpen, onClear, onOpenSheet, onCloseSheet, onAction }: { selectedCount: number; members: Member[]; labels: Label[]; sheetOpen: boolean; onClear: () => void; onOpenSheet: () => void; onCloseSheet: () => void; onAction: (action: BulkAction, value: string | null) => void }) {
  function apply(action: BulkAction, value: string | null) { onAction(action, value); onCloseSheet(); }
  return <>
    <section className="bulk-task-toolbar" aria-label="Bulk task actions">
      <div className="bulk-selection-summary"><strong>{selectedCount}</strong> selected <button type="button" className="toolbar-link" onClick={onClear}>Clear</button></div>
      <button type="button" className="bulk-actions-trigger" onClick={onOpenSheet}>Bulk actions <span aria-hidden="true">⌄</span></button>
    </section>
    {sheetOpen && <div className="bulk-sheet-backdrop" onClick={onCloseSheet}><section className="bulk-action-sheet" role="dialog" aria-modal="true" aria-labelledby="bulk-action-sheet-title" onClick={(event) => event.stopPropagation()}><header><div><span className="eyebrow">TASK BOARD</span><h2 id="bulk-action-sheet-title">Bulk actions</h2></div><button type="button" className="panel-close" onClick={onCloseSheet} aria-label="Close bulk actions">×</button></header><div className="bulk-sheet-body"><p>Apply an action to <strong>{selectedCount}</strong> selected task{selectedCount === 1 ? "" : "s"}.</p>
    <div className="bulk-action-controls">
      <select aria-label="Assign selected tasks" defaultValue="" onChange={(event) => { if (event.target.value) apply("ASSIGN", event.target.value === "__unassigned__" ? null : event.target.value); event.currentTarget.value = ""; }}><option value="">Assign...</option><option value="__unassigned__">Unassigned</option>{members.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.name || member.user.email}</option>)}</select>
      <select aria-label="Change status for selected tasks" defaultValue="" onChange={(event) => { if (event.target.value) apply("STATUS", event.target.value); event.currentTarget.value = ""; }}><option value="">Status...</option><option value="TODO">To do</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Completed</option><option value="NO_ACTION_NEEDED">No action needed</option></select>
      <select aria-label="Change priority for selected tasks" defaultValue="" onChange={(event) => { if (event.target.value) apply("PRIORITY", event.target.value); event.currentTarget.value = ""; }}><option value="">Priority...</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select>
      <label className="bulk-date-action">Due date<input type="date" aria-label="Change due date for selected tasks" onChange={(event) => { if (event.target.value) apply("DUE_DATE", new Date(`${event.target.value}T12:00:00`).toISOString()); event.currentTarget.value = ""; }} /></label>
      {labels.length > 0 && <><select aria-label="Select label for selected tasks" defaultValue="" onChange={(event) => { if (event.target.value) apply("ADD_LABEL", event.target.value); event.currentTarget.value = ""; }}><option value="">Add label...</option>{labels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}</select><select aria-label="Remove label from selected tasks" defaultValue="" onChange={(event) => { if (event.target.value) apply("REMOVE_LABEL", event.target.value); event.currentTarget.value = ""; }}><option value="">Remove label...</option>{labels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}</select></>}
    </div></div><footer><button type="button" className="ghost-button" onClick={onCloseSheet}>Cancel</button><span className="bulk-sheet-footer-note">Choose one action above</span></footer></section></div>}
  </>;
}
