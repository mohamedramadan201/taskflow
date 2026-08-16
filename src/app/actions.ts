"use server";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
export async function login(_: { error?: string }, formData: FormData) { try { await signIn("credentials", { email: formData.get("email"), password: formData.get("password"), redirectTo: "/board?workspace=taskflow-demo" }); return {}; } catch (error) { if (error instanceof AuthError) return { error: "The email or password is incorrect" }; throw error; } }
export async function logout() { await signOut({ redirectTo: "/login" }); }
