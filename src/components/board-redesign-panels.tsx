"use client";

import type { FormEvent, ReactNode } from "react";
import type { ManagerActionRisk } from "@/lib/reporting";

export type BoardFilterState = {
  query: string;
  statuses: string[];
  priorities: string[];
  assignees: string[];
  creator: string;
  due: string;
  dueFrom: string;
  dueTo: string;
  completed: string;
  recurrence: string;
  followUpWith: string;
  teamGroupId: string;
  labels: string[];
  attention: boolean;
  mineOnly: boolean;
};

type Member = { user: { id: string; name: string | null; email: string } };
type Label = { id: string; name: string; color: string };
type TeamGroup = { id: string; name: string };
type ActionCenter = { total: number; counts: Record<ManagerActionRisk, number> };
type Insights = { total: number; visible: number; dueSoon: number; completedThisWeek: number };
type FilterKey = keyof BoardFilterState;
type FilterValue = string | boolean | string[];

const statuses = [["TODO", "To do"], ["IN_PROGRESS", "In progress"], ["DONE", "Completed"], ["NO_ACTION_NEEDED", "No action needed"]] as const;
const priorities = [["LOW", "Low"], ["MEDIUM", "Medium"], ["HIGH", "High"], ["URGENT", "Urgent"]] as const;
const risks: Array<[ManagerActionRisk, string]> = [["overdue", "Overdue"], ["blocked", "Blocked"], ["unassigned", "Unassigned"], ["urgent", "Urgent"], ["unestimated", "Unestimated"], ["overloaded", "Overloaded"]];

function personName(member: Member) { return member.user.name || member.user.email; }
function toggleValue(items: string[], value: string) { return items.includes(value) ? items.filter((item) => item !== value) : [...items, value]; }

function PanelShell({ title, label, onClose, children, className = "" }: { title: string; label?: string; onClose: () => void; children: ReactNode; className?: string }) {
  return <div className="board-panel-backdrop" onClick={onClose}>
    <aside className={`board-side-panel ${className}`} onClick={(event) => event.stopPropagation()}>
      <header className="board-side-panel-header"><div>{label && <span className="eyebrow">{label}</span>}<h2>{title}</h2></div><button type="button" className="panel-close" onClick={onClose} aria-label={`Close ${title}`}>×</button></header>
      {children}
    </aside>
  </div>;
}

export function BoardManagePanel({ actionCenter, insights, activeRisk, onSelectRisk, onClearFocus, visibleCount, onSelectAll, onClose }: { actionCenter: ActionCenter; insights: Insights; activeRisk: ManagerActionRisk | null; onSelectRisk: (risk: ManagerActionRisk) => void; onClearFocus: () => void; visibleCount: number; onSelectAll: () => void; onClose: () => void }) {
  return <PanelShell title="Manage" label="BOARD COMMANDS" onClose={onClose} className="manage-side-panel">
    <div className="board-panel-scroll">
      <section className="manage-section"><span className="panel-section-label">Insights</span><div className="insights-grid"><div><span>Total tasks</span><strong>{insights.total}</strong></div><div><span>Visible tasks</span><strong>{insights.visible}</strong></div><div><span>Due in 7 days</span><strong>{insights.dueSoon}</strong></div><div><span>Completed this week</span><strong>{insights.completedThisWeek}</strong></div></div></section>
      <section className="manage-section"><div className="manage-section-heading"><span className="panel-section-label">Manager action center</span>{activeRisk && <button type="button" className="text-button" onClick={onClearFocus}>Clear focus</button>}</div><p className="panel-summary">· {actionCenter.total} {actionCenter.total === 1 ? "item needs" : "items need"} attention</p><div className="manage-risk-grid">{risks.map(([risk, label]) => <button type="button" key={risk} className={`manage-risk-button ${activeRisk === risk ? "active" : ""} ${actionCenter.counts[risk] ? "has-risk" : ""}`} aria-pressed={activeRisk === risk} onClick={() => onSelectRisk(risk)}><span>{label}</span><strong>{actionCenter.counts[risk]}</strong></button>)}</div></section>
      <section className="manage-section manage-select-section"><button type="button" className="select-all-visible-button" onClick={onSelectAll}>Select all visible tasks <strong>({visibleCount})</strong></button></section>
    </div>
  </PanelShell>;
}

function NativeFilter({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return <label className="panel-filter-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, optionLabel]) => <option value={optionValue} key={optionValue}>{optionLabel}</option>)}</select></label>;
}

export function BoardFiltersPanel({ filters, members, labels, teamGroups, followUpOptions, canManageWorkspace, showLabelManager, onShowLabelManager, onCreateLabel, onChange, onClear, onClose }: { filters: BoardFilterState; members: Member[]; labels: Label[]; teamGroups: TeamGroup[]; followUpOptions: string[]; canManageWorkspace: boolean; showLabelManager: boolean; onShowLabelManager: () => void; onCreateLabel: (event: FormEvent<HTMLFormElement>) => void; onChange: (key: FilterKey, value: FilterValue) => void; onClear: () => void; onClose: () => void }) {
  const assigneeNames = filters.assignees.map((id) => id === "__unassigned__" ? "Unassigned" : personName(members.find((member) => member.user.id === id) || { user: { id, name: null, email: id } })).join(", ");
  const changeMulti = (key: "statuses" | "priorities", value: string) => onChange(key, toggleValue(filters[key], value));
  return <PanelShell title="Filters" label="TASK BOARD" onClose={onClose} className="filters-side-panel">
    <div className="board-panel-scroll filters-panel-scroll">
      <section className="filter-panel-section"><span className="panel-section-label">Quick</span><div className="quick-filter-row"><button type="button" className={`panel-pill quick ${filters.attention ? "active" : ""}`} aria-pressed={filters.attention} onClick={() => onChange("attention", !filters.attention)}>Needs attention</button><button type="button" className={`panel-pill quick ${filters.mineOnly ? "active" : ""}`} aria-pressed={filters.mineOnly} onClick={() => onChange("mineOnly", !filters.mineOnly)}>My tasks</button></div></section>
      <section className="filter-panel-section"><span className="panel-section-label">Status</span><div className="panel-pill-grid status-pills">{statuses.map(([value, label]) => <button type="button" key={value} className={`panel-pill status-${value.toLowerCase()} ${filters.statuses.includes(value) ? "active" : ""}`} aria-pressed={filters.statuses.includes(value)} onClick={() => changeMulti("statuses", value)}>{label}</button>)}</div></section>
      <section className="filter-panel-section"><span className="panel-section-label">Priority</span><div className="panel-pill-grid priority-pills">{priorities.map(([value, label]) => <button type="button" key={value} className={`panel-pill priority-${value.toLowerCase()} ${filters.priorities.includes(value) ? "active" : ""}`} aria-pressed={filters.priorities.includes(value)} onClick={() => changeMulti("priorities", value)}>{label}</button>)}</div></section>
      <section className="filter-panel-section"><span className="panel-section-label">Assignee</span><details className="assignee-filter-dropdown"><summary>{assigneeNames || "Any assignee"}<span aria-hidden="true">⌄</span></summary><div className="assignee-options"><label><input type="checkbox" checked={filters.assignees.includes("__unassigned__")} onChange={() => onChange("assignees", toggleValue(filters.assignees, "__unassigned__"))} /> Unassigned</label>{members.map((member) => <label key={member.user.id}><input type="checkbox" checked={filters.assignees.includes(member.user.id)} onChange={() => onChange("assignees", toggleValue(filters.assignees, member.user.id))} /> {personName(member)}</label>)}</div></details></section>
      <section className="filter-panel-grid"><NativeFilter label="Due date" value={filters.due} options={[["all", "Any due date"], ["overdue", "Overdue"], ["today", "Due today"], ["tomorrow", "Due tomorrow"], ["this-week", "Due this week"], ["next-week", "Due next week"], ["no-date", "No date"], ["custom", "Custom range"]]} onChange={(value) => onChange("due", value)} /><NativeFilter label="Recurrence" value={filters.recurrence} options={[["all", "Any recurrence"], ["recurring", "Recurring"], ["not-recurring", "Not recurring"]]} onChange={(value) => onChange("recurrence", value)} /><NativeFilter label="Team group" value={filters.teamGroupId} options={[["", "Any team group"], ["__none__", "No team group"], ...teamGroups.map((group) => [group.id, group.name] as [string, string])]} onChange={(value) => onChange("teamGroupId", value)} /><NativeFilter label="Created by" value={filters.creator} options={[["all", "All creators"], ...members.map((member) => [member.user.id, personName(member)] as [string, string])]} onChange={(value) => onChange("creator", value)} /><NativeFilter label="Completed" value={filters.completed} options={[["all", "Any time"], ["today", "Today"], ["this-week", "This week"], ["this-month", "This month"]]} onChange={(value) => onChange("completed", value)} /><NativeFilter label="Follow up with" value={filters.followUpWith} options={[["", "Any person"], ["__none__", "No person set"], ...followUpOptions.map((value) => [value, value] as [string, string])]} onChange={(value) => onChange("followUpWith", value)} /></section>
      {filters.due === "custom" && <div className="panel-date-range"><label><span>Due from</span><input type="date" value={filters.dueFrom} onChange={(event) => onChange("dueFrom", event.target.value)} /></label><label><span>Due through</span><input type="date" value={filters.dueTo} onChange={(event) => onChange("dueTo", event.target.value)} /></label></div>}
      {labels.length > 0 && <section className="filter-panel-section"><span className="panel-section-label">Labels</span><div className="panel-label-list">{labels.map((label) => <label key={label.id}><input type="checkbox" checked={filters.labels.includes(label.id)} onChange={() => onChange("labels", toggleValue(filters.labels, label.id))} /><i className="label-dot" style={{ backgroundColor: label.color }} /> {label.name}</label>)}</div></section>}
      {canManageWorkspace && <section className="filter-panel-section filter-label-manager"><button type="button" className="text-button" onClick={onShowLabelManager}>{showLabelManager ? "Close label manager" : "+ Create workspace label"}</button>{showLabelManager && <form onSubmit={onCreateLabel}><input name="name" placeholder="Label name" maxLength={40} required /><input name="color" type="color" defaultValue="#176b50" aria-label="Label color" /><button className="primary-button small">Add label</button></form>}</section>}
    </div>
    <footer className="board-panel-footer"><button type="button" className="text-button" onClick={onClear}>Clear all</button><button type="button" className="primary-button" onClick={onClose}>Show results</button></footer>
  </PanelShell>;
}
