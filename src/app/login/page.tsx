import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/login-form";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const params = await searchParams;
  const requestedCallback = params.callbackUrl || "";
  const callbackUrl = requestedCallback.startsWith("/") && !requestedCallback.startsWith("//") ? requestedCallback : "/";
  const noWorkspace = params.error === "no-workspace";
  if ((await auth()) && !noWorkspace) redirect(callbackUrl);
  return <main className="login-page"><section className="login-visual"><div className="brand light"><span>TF</span><strong>TaskFlow</strong></div><div><span className="eyebrow light-text">WORK WITH CLARITY</span><h1>A calmer space<br />for meaningful work.</h1><p>Organize your team&apos;s tasks, set clear permissions, and never miss an important deadline.</p></div><blockquote>“Clarity turns good teams into exceptional teams.”</blockquote></section><section className="login-card"><div><span className="mobile-brand">TaskFlow</span><h2>Welcome back</h2><p>Sign in to continue to your workspace.</p>{noWorkspace && <p className="form-error" role="alert">Your account is not connected to a workspace yet. Ask an owner to invite you.</p>}<LoginForm callbackUrl={callbackUrl} /></div></section></main>;
}
