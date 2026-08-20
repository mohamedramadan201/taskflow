"use client";

import { useState } from "react";
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
  const [expanded, setExpanded] = useState(false);
  const activeSummary = categories.filter(([risk]) => actionCenter.counts[risk] > 0).map(([risk, label]) => `${actionCenter.counts[risk]} ${label.toLowerCase()}`).join(" · ");
  return <section className={`manager-action-center ${expanded ? "expanded" : "collapsed"}`} aria-labelledby="manager-action-center-title">
    <div className="manager-action-center-heading"><button type="button" className="manager-action-center-toggle" aria-expanded={expanded} aria-controls="manager-action-center-breakdown" onClick={() => setExpanded((value) => !value)}><span className="manager-action-center-label"><span className="eyebrow">MANAGER ACTION CENTER</span><strong id="manager-action-center-title">{actionCenter.total} {actionCenter.total === 1 ? "item" : "items"} need attention</strong></span>{activeSummary && <span className="manager-action-center-summary">{activeSummary}</span>}<span className="manager-action-center-toggle-label">{expanded ? "Hide breakdown" : "Review risks"}<span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span></span></button>{activeRisk && <button type="button" className="toolbar-link" onClick={() => onSelectRisk(activeRisk)}>Clear focus</button>}</div>
    {expanded && <div id="manager-action-center-breakdown" className="manager-action-center-grid">{categories.map(([risk, label]) => <button type="button" key={risk} className={`manager-risk ${activeRisk === risk ? "active" : ""} ${actionCenter.counts[risk] ? "has-risk" : ""}`} aria-pressed={activeRisk === risk} onClick={() => onSelectRisk(risk)}><span>{label}</span><strong>{actionCenter.counts[risk]}</strong></button>)}</div>}
  </section>;
}
