"use client";

import { useState } from "react";
import { weeklySummaryToText, type buildWeeklyManagementSummary } from "@/lib/reporting";

type WeeklySummary = ReturnType<typeof buildWeeklyManagementSummary>;

export function WeeklyManagementSummary({ summary }: { summary: WeeklySummary }) {
  const [copied, setCopied] = useState(false);
  async function copySummary() {
    await navigator.clipboard.writeText(weeklySummaryToText(summary));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  const metrics = [["Completed this week", summary.completedThisWeek], ["Created this week", summary.createdThisWeek], ["Open tasks", summary.openTasks], ["Overdue tasks", summary.overdue], ["Blocked tasks", summary.blocked], ["Urgent open tasks", summary.urgentOpen], ["Unassigned tasks", summary.unassigned], ["Overloaded members", summary.overloaded]] as const;
  return <section className="weekly-summary" aria-labelledby="weekly-summary-title">
    <header><div><span className="eyebrow">WEEKLY MANAGEMENT SUMMARY</span><h2 id="weekly-summary-title">This week at a glance</h2><p>Key delivery and workload signals for the current week.</p></div><button type="button" className="ghost-button" onClick={copySummary}>{copied ? "Copied" : "Copy summary"}</button></header>
    <div className="weekly-summary-metrics">{metrics.map(([label, value]) => <article key={label}><small>{label}</small><strong>{value}</strong></article>)}{summary.averageCycleDays !== null && <article><small>Average cycle time</small><strong>{summary.averageCycleDays}d</strong></article>}</div>
    <div className="weekly-summary-grid"><article><h3>Key risks</h3>{summary.keyRisks.length ? <ul>{summary.keyRisks.map((risk) => <li key={risk}>{risk}</li>)}</ul> : <p className="empty-copy">No current management risks.</p>}</article><article><h3>Management actions</h3>{summary.managementActions.length ? <ol>{summary.managementActions.map((action) => <li key={action}>{action}</li>)}</ol> : <p className="empty-copy">No immediate action required.</p>}</article></div>
    <div className="weekly-summary-workload"><h3>Team workload</h3><div className="report-table-wrap"><table><thead><tr><th>Member</th><th>Utilization</th><th>Open</th><th>Overdue</th></tr></thead><tbody>{summary.workload.map((item) => <tr key={item.user.id}><td>{item.user.name || item.user.email}</td><td><span className={`utilization-pill ${item.utilization > summary.overloadThreshold ? "over" : item.utilization >= 80 ? "high" : "ok"}`}>{item.utilization >= 999 ? "200%+" : `${item.utilization}%`}</span></td><td>{item.open}</td><td className={item.overdue ? "risk" : ""}>{item.overdue}</td></tr>)}</tbody></table></div></div>
  </section>;
}
