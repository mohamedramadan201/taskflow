"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/actions";

type Invitation = { token: string; email: string; role: string; workspace: { name: string; slug: string }; sessionEmail?: string | null };

export function InviteClient({ invitation }: { invitation: Invitation | null }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const sessionEmail = invitation?.sessionEmail?.toLowerCase() || "";
  const matchesSession = Boolean(sessionEmail && sessionEmail === invitation?.email.toLowerCase());

  async function accept() {
    if (!invitation) return;
    setPending(true); setMessage("");
    const response = await fetch(`/api/invitations/${invitation.token}/accept`, { method: "POST" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(result.error || "Could not accept this invitation."); setPending(false); return; }
    router.push(`/board?workspace=${encodeURIComponent(invitation.workspace.slug)}`);
  }

  async function register(event: FormEvent) {
    event.preventDefault();
    if (!invitation) return;
    setPending(true); setMessage("");
    const response = await fetch(`/api/invitations/${invitation.token}/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, password }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(result.error || "Could not create your account."); setPending(false); return; }
    router.push(`/login?callbackUrl=${encodeURIComponent(`/invite/${invitation.token}`)}`);
  }

  if (!invitation) return <section className="invite-card"><span className="eyebrow">INVITATION</span><h1>Invitation unavailable</h1><p>This invitation is invalid, expired, or has already been accepted.</p><a className="ghost-button" href="/login">Go to sign in</a></section>;
  if (sessionEmail && !matchesSession) return <section className="invite-card"><span className="eyebrow">INVITATION</span><h1>Use the invited email</h1><p>This invitation was sent to <strong>{invitation.email}</strong>, but you are signed in as <strong>{invitation.sessionEmail}</strong>.</p><p>Sign out, then open the invitation again with the invited account.</p><form action={logout}><button className="ghost-button">Sign out</button></form></section>;
  return <section className="invite-card"><span className="eyebrow">YOU&apos;RE INVITED</span><h1>Join {invitation.workspace.name}</h1><p>You&apos;ve been invited as a <strong>{invitation.role.toLowerCase()}</strong> on TaskFlow.</p><p className="invite-email">{invitation.email}</p>{message && <p className="form-error" role="alert">{message}</p>}{matchesSession ? <button className="primary-button" onClick={accept} disabled={pending}>{pending ? "Joining…" : "Accept invitation"}</button> : <><form className="login-form" onSubmit={register}><label>Your name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={80} required /></label><label>Create a password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" minLength={8} required /></label><button className="primary-button" disabled={pending}>{pending ? "Creating account…" : "Create account and join"}</button></form><p className="invite-signin">Already have an account? <a href={`/login?callbackUrl=${encodeURIComponent(`/invite/${invitation.token}`)}`}>Sign in</a></p></>}</section>;
}
