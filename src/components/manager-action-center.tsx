"use client";

import type { ManagerActionRisk } from "@/lib/reporting";
import { useState } from "react";

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
  const [expanded, setExpanded] = useState(false);
  return <div className={`toolbar-menu manager-action-center-menu ${expanded ? "open" : ""}`}>
    <button type="button" className="toolbar-menu-trigger" aria-expanded={expanded} aria-controls="manager-action-center-breakdown" onClick={() => setExpanded((value) => !value)}><span>Manager center</span><strong>{actionCenter.total}</strong><span aria-hidden="true">⌄</span></button>
    {expanded && <section className="manager-action-center compact" aria-labelledby="manager-action-center-title">
      <div className="manager-action-center-heading"><span className="manager-action-center-label"><span className="eyebrow">MANAGER ACTION CENTER</span><strong id="manager-action-center-title">{actionCenter.total} {actionCenter.total === 1 ? "item" : "items"} need attention</strong></span>{activeRisk && <button type="button" className="toolbar-link manager-clear-focus" onClick={() => onSelectRisk(activeRisk)}>Clear focus</button>}</div>
      <div id="manager-action-center-breakdown" className="manager-action-center-grid">{categories.map(([risk, label]) => <button type="button" key={risk} className={`manager-risk ${activeRisk === risk ? "active" : ""} ${actionCenter.counts[risk] ? "has-risk" : ""}`} aria-pressed={activeRisk === risk} onClick={() => onSelectRisk(risk)}><span>{label}</span><strong>{actionCenter.counts[risk]}</strong></button>)}</div>
    </section>}
  </div>;
}
