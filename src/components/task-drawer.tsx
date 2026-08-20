"use client";

import type { FormEvent, RefObject } from "react";
import { nextRecurringDate, type Recurrence } from "@/lib/recurrence";
import { taskCountOptions, taskStatuses, priority, toggleValue, personName, type ChecklistItem, type Label, type Member, type Task, type TaskCountKey, type TaskDetail } from "@/components/board-types";

export function TaskDrawer({
  task, editable, loading, drawerRef, members, allTasks, labels, comment, onCommentChange, checklistTitle, onChecklistTitleChange, saving,
  onClose, onSave, onTaskCountChange, onSetLabels, onToggleChecklistItem, onAddChecklistItem, onAddComment,
}: {
  task: TaskDetail; editable: boolean; loading: boolean; drawerRef: RefObject<HTMLElement | null>;
  members: Member[]; allTasks: Task[]; labels: Label[];
  comment: string; onCommentChange: (value: string) => void;
  checklistTitle: string; onChecklistTitleChange: (value: string) => void;
  saving: boolean;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onTaskCountChange: (key: TaskCountKey, value: number | null) => void;
  onSetLabels: (labelIds: string[]) => void;
  onToggleChecklistItem: (item: ChecklistItem) => void;
  onAddChecklistItem: (event: FormEvent) => void;
  onAddComment: (event: FormEvent) => void;
}) {
  return <div className="drawer-backdrop" onClick={onClose}>
    <aside ref={drawerRef} className="task-drawer" role="dialog" aria-modal="true" aria-labelledby="task-drawer-title" aria-busy={loading} tabIndex={-1} onClick={(event) => event.stopPropagation()}>
      <button className="drawer-close" onClick={onClose} aria-label="Close task details">X</button>
      <span className={`priority ${task.priority.toLowerCase()}`}>{priority[task.priority]}</span>
      <h2 id="task-drawer-title">{task.title}</h2>
      {!editable && <p className="read-only-note">You have read-only access to this task.</p>}
      <form onSubmit={onSave} className="detail-form">
        <fieldset disabled={!editable}>
          <label>Title<input name="title" defaultValue={task.title} /></label>
          <label>Description<textarea name="description" defaultValue={task.description || ""} rows={4} /></label>
          <div className="detail-grid"><label>Status<select name="status" defaultValue={task.status}>{taskStatuses.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label><label>Priority<select name="priority" defaultValue={task.priority}>{Object.entries(priority).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label><label>Due date<input name="dueAt" type="datetime-local" defaultValue={task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : ""} /></label></div>
          <label>Assignee<select name="assigneeUserId" defaultValue={task.assigneeUserId || ""}><option value="">Unassigned</option>{members.map((member) => <option key={member.user.id} value={member.user.id}>{personName(member)}</option>)}</select></label>
          <label>Follow up with<input name="followUpWith" defaultValue={task.followUpWith || ""} maxLength={120} placeholder="Person to follow up with" /></label>
          <details className="work-planning-section drawer-details">
            <summary><span><strong>Work planning</strong><small>Estimate and track effort</small></span><span className="disclosure-chevron" aria-hidden="true">⌄</span></summary>
            <div className="detail-grid planning-grid"><label>Estimated hours<input name="estimatedHours" type="number" min="0" max="16666" step="0.25" defaultValue={task.estimatedMinutes == null ? "" : task.estimatedMinutes / 60} placeholder="e.g. 4" /></label><label>Remaining hours<input name="remainingHours" type="number" min="0" max="16666" step="0.25" defaultValue={task.remainingMinutes == null ? "" : task.remainingMinutes / 60} placeholder="e.g. 2.5" /></label><label>Actual hours<input name="actualHours" type="number" min="0" max="16666" step="0.25" defaultValue={task.actualMinutes == null ? "" : task.actualMinutes / 60} placeholder="Add on completion" /></label></div>
          </details>
          <details className={`blocker-section drawer-details ${task.blockedAt || task.blockerTaskId ? "is-blocked" : ""}`} open={Boolean(task.blockedAt || task.blockerTaskId)}>
            <summary><span><strong>Blockers &amp; dependencies</strong><small>{task.blockedAt || task.blockerTaskId ? "Needs attention" : "Optional"}</small></span><span className="disclosure-chevron" aria-hidden="true">⌄</span></summary>
            <label>Blocked by task<select name="blockerTaskId" defaultValue={task.blockerTaskId || ""}><option value="">No task dependency</option>{allTasks.filter((item) => item.id !== task.id && item.status !== "DONE").map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            <label>Blocking reason<textarea name="blockedReason" rows={2} maxLength={500} defaultValue={task.blockedReason || ""} placeholder="Example: Waiting for approved product data" /></label>
          </details>
          <div className="detail-grid"><label>Repeat<select name="recurrence" defaultValue={task.recurrence || "NONE"}><option value="NONE">Does not repeat</option><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option></select></label><label>Every<input name="recurrenceInterval" type="number" min="1" max="365" defaultValue={task.recurrenceInterval || 1} /></label></div>
          <small className="field-help">A new task is created automatically when this one is completed.</small>
          {task.recurrence !== "NONE" && <small className="field-help recurrence-preview">Next occurrence if completed today: {nextRecurringDate(task.dueAt ? new Date(task.dueAt) : null, task.recurrence as Recurrence, task.recurrenceInterval || 1).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</small>}
          <details className="task-count-section drawer-details">
            <summary><span><strong>Product &amp; image counts</strong><small>Optional reporting metrics</small></span><span className="disclosure-chevron" aria-hidden="true">⌄</span></summary>
            <div className="task-count-options">{taskCountOptions.map(({ key, label }) => { const enabled = task[key] !== null; return <div className={`task-count-option ${enabled ? "selected" : ""}`} key={key}><label className="task-count-toggle"><input type="checkbox" checked={enabled} onChange={(event) => onTaskCountChange(key, event.target.checked ? 0 : null)} /><span>{label}</span></label><input className="task-count-input" type="number" min="0" max="1000000000" step="1" inputMode="numeric" aria-label={`${label} value`} disabled={!enabled} value={enabled ? task[key] ?? 0 : ""} placeholder="0" onChange={(event) => { const value = Math.max(0, Math.min(1_000_000_000, Math.trunc(Number(event.target.value) || 0))); onTaskCountChange(key, value); }} /></div>; })}</div>
          </details>
          {editable && <button className="primary-button" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>}
        </fieldset>
      </form>
      {!!task.sourceEmails?.length && <details className="drawer-section drawer-details source-email-section"><summary><span><strong>Source email</strong><small>{task.sourceEmails.length} linked email{task.sourceEmails.length === 1 ? "" : "s"}</small></span><span className="disclosure-chevron" aria-hidden="true">⌄</span></summary>{task.sourceEmails.map((email) => <article key={email.id}><strong>{email.subject}</strong><span>{email.senderAddress} → {email.connector.mailboxAddress}</span><small>{new Date(email.receivedAt).toLocaleString()}</small></article>)}</details>}
      <details className="drawer-section drawer-details"><summary><span><strong>Labels</strong><small>{task.labels.length ? `${task.labels.length} applied` : "None applied"}</small></span><span className="disclosure-chevron" aria-hidden="true">⌄</span></summary>{labels.length ? <div className="drawer-labels">{labels.map((label) => <label key={label.id}><input type="checkbox" disabled={!editable} checked={task.labels.some((item) => item.id === label.id)} onChange={() => onSetLabels(toggleValue(task.labels.map((item) => item.id), label.id))} /><i className="label-dot" style={{ backgroundColor: label.color }} /> {label.name}</label>)}</div> : <p className="empty-copy">No workspace labels yet.</p>}</details>
      <details className="drawer-section drawer-details"><summary><span><strong>Checklist</strong><small>{task.checklistItems.filter((item) => item.completed).length}/{task.checklistItems.length} complete</small></span><span className="disclosure-chevron" aria-hidden="true">⌄</span></summary>{task.checklistItems.map((item) => <label className="checklist-item" key={item.id}><input type="checkbox" disabled={!editable} checked={item.completed} onChange={() => onToggleChecklistItem(item)} /><span className={item.completed ? "completed" : ""}>{item.title}</span></label>)}{editable && <form onSubmit={onAddChecklistItem} className="comment-form"><input value={checklistTitle} onChange={(event) => onChecklistTitleChange(event.target.value)} placeholder="Add checklist item..." maxLength={200} /><button className="ghost-button">Add item</button></form>}</details>
      <details className="drawer-section drawer-details"><summary><span><strong>Comments</strong><small>{task.comments.length} comment{task.comments.length === 1 ? "" : "s"}</small></span><span className="disclosure-chevron" aria-hidden="true">⌄</span></summary>{task.comments.map((item) => <div className="comment" key={item.id}><strong>{item.author.name || item.author.email}</strong><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString()}</small></div>)}{editable && <form onSubmit={onAddComment} className="comment-form"><textarea value={comment} onChange={(event) => onCommentChange(event.target.value)} placeholder="Write a comment..." rows={3} /><button className="ghost-button">Add comment</button></form>}</details>
      <details className="drawer-section drawer-details"><summary><span><strong>Activity</strong><small>{task.activities.length} event{task.activities.length === 1 ? "" : "s"}</small></span><span className="disclosure-chevron" aria-hidden="true">⌄</span></summary>{task.activities.map((item) => <p className="activity-row" key={item.id}><strong>{item.actor.name || item.actor.email}</strong> {item.type.toLowerCase().replaceAll("_", " ")} <small>{new Date(item.createdAt).toLocaleString()}</small></p>)}</details>
    </aside>
  </div>;
}
