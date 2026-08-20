"use client";

import type { ManagerActionRisk } from "@/lib/reporting";

type ActionCenter = {
  total: number;
  counts: Record<ManagerActionRisk, number>;
};

const categories: Array<[ManagerActionRisk, string]> = [
  ["overdue", "Overdue"],
  ["blocked", "Blocked"],
  ["unassigned", "Unassigned"],
  ["urgent", "Urgent"],
  ["unestimated", "Unestimated"],
  ["overloaded", "Overloaded"],
];

export function ManagerActionCenter({ actionCenter, activeRisk, onSelectRisk }: { actionCenter: ActionCenter; activeRisk: ManagerActionRisk | null; onSelectRisk: (risk: ManagerActionRisk) => void }) {
  return <section className="manager-action-center" aria-labelledby="manager-action-center-title">
    <div className="manager-action-center-heading"><div><span className="eyebrow">MANAGER ACTION CENTER</span><h2 id="manager-action-center-title">{actionCenter.total} {actionCenter.total === 1 ? "item" : "items"} need attention</h2></div>{activeRisk && <button type="button" className="toolbar-link" onClick={() => onSelectRisk(activeRisk)}>Clear focus</button>}</div>
    <div className="manager-action-center-grid">{categories.map(([risk, label]) => <button type="button" key={risk} className={`manager-risk ${activeRisk === risk ? "active" : ""} ${actionCenter.counts[risk] ? "has-risk" : ""}`} aria-pressed={activeRisk === risk} onClick={() => onSelectRisk(risk)}><span>{label}</span><strong>{actionCenter.counts[risk]}</strong></button>)}</div>
  </section>;
}
