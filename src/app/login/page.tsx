import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/login-form";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const params = await searchParams;
  const requestedCallback = params.callbackUrl || "";
  const callbackUrl = requestedCallback.startsWith("/") && !requestedCallback.startsWith("//") ? requestedCallback : "/board?workspace=taskflow-demo";
  if (await auth()) redirect(callbackUrl);
  return <main className="login-page"><section className="login-visual"><div className="brand light"><span>TF</span><strong>TaskFlow</strong></div><div><span className="eyebrow light-text">WORK WITH CLARITY</span><h1>A calmer space<br />for meaningful work.</h1><p>Organize your team&apos;s tasks, set clear permissions, and never miss an important deadline.</p></div><blockquote>“Clarity turns good teams into exceptional teams.”</blockquote></section><section className="login-card"><div><span className="mobile-brand">TaskFlow</span><h2>Welcome back</h2><p>Sign in to continue to your workspace.</p><LoginForm callbackUrl={callbackUrl} /><div className="demo-hint"><strong>Demo account</strong><span>owner@taskflow.local</span><span>Taskflow123!</span></div></div></section></main>;
}
