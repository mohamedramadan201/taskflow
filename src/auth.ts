import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";

const credentialsSchema = z.object({ email: z.string().email().transform((v) => v.trim().toLowerCase()), password: z.string().min(8).max(128) });
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [Credentials({ credentials: { email: {}, password: {} }, async authorize(raw) {
    const parsed = credentialsSchema.safeParse(raw);
    if (!parsed.success) return null;
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || user.accountStatus !== "ACTIVE" || !(await compare(parsed.data.password, user.passwordHash))) return null;
    return { id: user.id, email: user.email, name: user.name };
  } })],
  callbacks: {
    jwt({ token, user }) { if (user?.id) token.sub = user.id; return token; },
    session({ session, token }) { if (session.user && token.sub) session.user.id = token.sub; return session; },
  },
});
