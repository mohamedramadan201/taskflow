"use client";

import { useState, type FormEvent } from "react";

type Member = { role: string; suspendedAt: string | Date | null; customRoleId: string | null; weeklyCapacityMinutes: number; availability: { id: string; date: string | Date; availableMinutes: number; note: string | null }[]; customRole: { name: string } | null; user: { id: string; name: string | null; email: string } };
type Invitation = { id: string; email: string; role: string; expiresAt: string | Date };
type AuditEvent = { id: string; type: string; detailsJson: unknown; createdAt: string | Date; actor: { name: string | null; email: string }; task: { title: string } | null };
type CustomRole = { id: string; name: string; description: string | null; permissions: unknown; _count?: { members: number } };

export function TeamClient({ initialMembers, initialInvitations, initialAuditEvents, initialCustomRoles, availablePermissions, role, currentUserId, workspaceId }: {
  initialMembers: Member[];
  initialInvitations: Invitation[];
  initialAuditEvents: AuditEvent[];
  initialCustomRoles: CustomRole[];
  availablePermissions: readonly string[];
  role: string;
  currentUserId: string;
  workspaceId: string;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [auditEvents, setAuditEvents] = useState(initialAuditEvents);
  const [customRoles, setCustomRoles] = useState(initialCustomRoles);
  const [customRoleName, setCustomRoleName] = useState("");
  const [customRolePermissions, setCustomRolePermissions] = useState<string[]>(["WORKSPACE_VIEW", "MEMBER_VIEW"]);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const canManage = role === "OWNER" || role === "ADMIN";

  async function refreshAudit() {
    if (!auditEvents.length && role !== "OWNER" && role !== "ADMIN") return;
    const response = await fetch(`/api/workspaces/${workspaceId}/audit?limit=30`);
    if (response.ok) setAuditEvents(await response.json());
  }

  async function updateMember(userId: string, body: { role?: string; suspended?: boolean; weeklyCapacityMinutes?: number }) {
    setMessage("");
    const response = await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) return setMessage((await response.json()).error);
    const updated = await response.json();
    setMembers((items) => items.map((member) => member.user.id === userId ? { ...member, role: updated.role, suspendedAt: updated.suspendedAt, customRoleId: updated.customRoleId, weeklyCapacityMinutes: updated.weeklyCapacityMinutes, customRole: body.role ? null : member.customRole } : member));
    setMessage(body.weeklyCapacityMinutes !== undefined ? "Weekly capacity updated." : body.role ? "Member role updated." : body.suspended ? "Member access suspended." : "Member access restored.");
    await refreshAudit();
  }

  async function removeMember(userId: string) {
    if (!window.confirm("Remove this member from the workspace? They will lose access immediately.")) return;
    setMessage("");
    const response = await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, { method: "DELETE" });
    if (!response.ok) return setMessage((await response.json()).error);
    setMembers((items) => items.filter((member) => member.user.id !== userId));
    setMessage("Member removed from the workspace.");
    await refreshAudit();
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/workspaces/${workspaceId}/invitations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, role: inviteRole }) });
    if (!response.ok) return setMessage((await response.json()).error);
    const created = await response.json();
    setInvitations((items) => [created, ...items.filter((item) => item.email !== created.email)]);
    setMessage(`Invitation created for ${email}`);
    setEmail("");
    await refreshAudit();
  }

  async function revokeInvitation(invitationId: string) {
    if (!window.confirm("Revoke this pending invitation?")) return;
    const response = await fetch(`/api/workspaces/${workspaceId}/invitations/${invitationId}`, { method: "DELETE" });
    if (!response.ok) return setMessage((await response.json()).error);
    setInvitations((items) => items.filter((item) => item.id !== invitationId));
    setMessage("Invitation revoked.");
    await refreshAudit();
  }

  async function createCustomRole(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/workspaces/${workspaceId}/roles`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: customRoleName, permissions: customRolePermissions }) });
    if (!response.ok) return setMessage((await response.json()).error);
    const created = await response.json();
    setCustomRoles((items) => [...items, { ...created, _count: { members: 0 } }].sort((a, b) => a.name.localeCompare(b.name)));
    setCustomRoleName("");
    setMessage("Custom role created.");
    await refreshAudit();
  }

  async function deleteCustomRole(roleId: string) {
    if (!window.confirm("Delete this custom role? Assigned members will return to their base roles.")) return;
    const response = await fetch(`/api/workspaces/${workspaceId}/roles/${roleId}`, { method: "DELETE" });
    if (!response.ok) return setMessage((await response.json()).error);
    setCustomRoles((items) => items.filter((item) => item.id !== roleId));
    setMembers((items) => items.map((member) => member.customRoleId === roleId ? { ...member, customRoleId: null, customRole: null } : member));
    setMessage("Custom role deleted; assigned members returned to their base roles.");
    await refreshAudit();
  }

  async function assignCustomRole(userId: string, customRoleId: string | null) {
    const response = await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ customRoleId }) });
    if (!response.ok) return setMessage((await response.json()).error);
    const customRole = customRoles.find((item) => item.id === customRoleId) || null;
    setMembers((items) => items.map((member) => member.user.id === userId ? { ...member, customRoleId, customRole: customRole ? { name: customRole.name } : null } : member));
    setMessage(customRole ? `${customRole.name} assigned.` : "Custom role removed.");
    await refreshAudit();
  }

  async function setAvailability(event: FormEvent<HTMLFormElement>, userId: string) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const response = await fetch(`/api/workspaces/${workspaceId}/members/${userId}/availability`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date: data.get("date"), availableMinutes: Math.round(Number(data.get("hours")) * 60), note: data.get("note") || null }) });
    if (!response.ok) return setMessage((await response.json()).error);
    const saved = await response.json(); setMembers((items) => items.map((member) => member.user.id === userId ? { ...member, availability: [...member.availability.filter((item) => new Date(item.date).toISOString().slice(0, 10) !== new Date(saved.date).toISOString().slice(0, 10)), saved].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) } : member));
    setMessage("Availability exception saved."); form.reset();
  }

  return <>
    <header className="page-header"><div><span className="eyebrow">PEOPLE & ACCESS</span><h1>Team</h1><p>Clear roles, controlled access, and a traceable security history.</p></div></header>
    {message && <div className="notice" role="status">{message}</div>}
    {canManage && <section className="invite-panel"><h2>Invite a teammate</h2><form onSubmit={invite}><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@company.com" required /><select aria-label="Invitation role" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}><option value="MEMBER">Member</option><option value="VIEWER">Viewer</option>{role === "OWNER" && <><option value="ADMIN">Admin</option><option value="OWNER">Owner</option></>}</select><button className="primary-button small">Create invitation</button></form></section>}
    {invitations.length > 0 && <section className="team-list"><h2>Pending invitations</h2>{invitations.map((item) => <article key={item.id}><span className="avatar">@</span><div><strong>{item.email}</strong><small>{item.role} · expires {new Date(item.expiresAt).toLocaleDateString()}</small></div><div className="member-actions"><span className="role-badge">Pending</span>{canManage && <button className="ghost-button danger" onClick={() => revokeInvitation(item.id)}>Revoke</button>}</div></article>)}</section>}
    {role === "OWNER" && <section className="custom-role-panel"><div><span className="eyebrow">FINE-GRAINED ACCESS</span><h2>Custom roles</h2><p>Create a workspace-scoped permission set. Owner-only permissions cannot be delegated.</p></div><form onSubmit={createCustomRole}><input value={customRoleName} onChange={(event) => setCustomRoleName(event.target.value)} placeholder="Role name, e.g. Project coordinator" minLength={2} maxLength={50} required /><div className="permission-grid">{availablePermissions.map((permission) => <label key={permission}><input type="checkbox" checked={customRolePermissions.includes(permission)} onChange={(event) => setCustomRolePermissions((items) => event.target.checked ? [...items, permission] : items.filter((item) => item !== permission))} />{permission.toLowerCase().replaceAll("_", " ")}</label>)}</div><button className="primary-button small">Create custom role</button></form>{customRoles.length > 0 && <div className="custom-role-list">{customRoles.map((item) => <article key={item.id}><div><strong>{item.name}</strong><small>{Array.isArray(item.permissions) ? item.permissions.length : 0} permissions · {item._count?.members || 0} members</small></div><button className="ghost-button danger" onClick={() => deleteCustomRole(item.id)}>Delete</button></article>)}</div>}</section>}
    <section className="team-list"><h2>Members</h2>{members.map((member) => {
      const targetProtected = role === "ADMIN" && ["OWNER", "ADMIN"].includes(member.role);
      const editable = canManage && member.user.id !== currentUserId && !targetProtected;
      const options = role === "OWNER" ? ["OWNER", "ADMIN", "MEMBER", "VIEWER"] : ["MEMBER", "VIEWER"];
      return <article className={member.suspendedAt ? "member-suspended" : ""} key={member.user.id}><span className="avatar">{member.user.name?.[0] || member.user.email[0]}</span><div className="member-identity"><strong>{member.user.name || "No name"}</strong><small>{member.user.email}{member.customRole ? ` · ${member.customRole.name}` : ""}{member.suspendedAt ? " · Access suspended" : ""}</small>{canManage && <><label className="capacity-control"><span>Weekly capacity</span><input aria-label={`Weekly capacity hours for ${member.user.email}`} type="number" min="0" max="168" step="0.5" defaultValue={member.weeklyCapacityMinutes / 60} onBlur={(event) => { const minutes = Math.round(Number(event.target.value) * 60); if (Number.isFinite(minutes) && minutes !== member.weeklyCapacityMinutes) updateMember(member.user.id, { weeklyCapacityMinutes: minutes }); }} /><em>hours</em></label><form className="availability-control" onSubmit={(event) => setAvailability(event, member.user.id)}><strong>Availability exception</strong><input name="date" type="date" min={new Date().toISOString().slice(0, 10)} aria-label={`Availability date for ${member.user.email}`} required /><input name="hours" type="number" min="0" max="24" step="0.5" placeholder="Hours" aria-label="Available hours" required /><input name="note" maxLength={120} placeholder="Reason (optional)" aria-label="Availability note" /><button className="ghost-button">Save</button></form>{member.availability.length > 0 && <div className="availability-chips">{member.availability.map((item) => <span key={item.id}>{new Date(item.date).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}: {item.availableMinutes / 60}h{item.note ? ` · ${item.note}` : ""}</span>)}</div>}</>}</div><div className="member-actions">{editable ? <><select aria-label={`Role for ${member.user.email}`} value={member.role} onChange={(event) => updateMember(member.user.id, { role: event.target.value })}>{options.map((value) => <option key={value}>{value}</option>)}</select>{role === "OWNER" && member.role !== "OWNER" && <select aria-label={`Custom role for ${member.user.email}`} value={member.customRoleId || ""} onChange={(event) => assignCustomRole(member.user.id, event.target.value || null)}><option value="">Base role permissions</option>{customRoles.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>}<button className="ghost-button" onClick={() => updateMember(member.user.id, { suspended: !member.suspendedAt })}>{member.suspendedAt ? "Restore" : "Suspend"}</button><button className="ghost-button danger" onClick={() => removeMember(member.user.id)}>Remove</button></> : <span className="role-badge">{member.customRole?.name || member.role}</span>}</div></article>;
    })}</section>
    {auditEvents.length > 0 && <section className="audit-panel"><div className="audit-heading"><div><span className="eyebrow">SECURITY HISTORY</span><h2>Audit log</h2></div><button className="ghost-button" onClick={refreshAudit}>Refresh</button></div><div className="audit-list">{auditEvents.map((event) => <article key={event.id}><span className="audit-dot" /><div><strong>{event.type.toLowerCase().replaceAll("_", " ")}</strong><p>{event.actor.name || event.actor.email}{event.task ? ` · ${event.task.title}` : ""}</p></div><time>{new Date(event.createdAt).toLocaleString()}</time></article>)}</div></section>}
  </>;
}
