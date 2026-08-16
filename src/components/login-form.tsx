"use client";
import { useActionState } from "react";
import { login } from "@/app/actions";
export function LoginForm() {
  const [state, action, pending] = useActionState(login, {});
  return <form action={action} className="login-form">
    <label>Email<input name="email" type="email" autoComplete="email" placeholder="owner@taskflow.local" required /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" placeholder="••••••••••••" minLength={8} required /></label>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    <button className="primary-button" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
  </form>;
}
