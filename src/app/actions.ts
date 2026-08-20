"use server";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
export async function login(_: { error?: string }, formData: FormData) { try { const callbackUrl = String(formData.get("callbackUrl") || ""); const redirectTo = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/board?workspace=taskflow-demo"; await signIn("credentials", { email: formData.get("email"), password: formData.get("password"), redirectTo }); return {}; } catch (error) { if (error instanceof AuthError) return { error: "The email or password is incorrect" }; throw error; } }
export async function logout() { await signOut({ redirectTo: "/login" }); }
