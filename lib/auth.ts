import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.password) return null

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!passwordMatch) return null
        if (user.status !== "VERIFIED") return null

        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: profile.email },
        })
        if (dbUser && dbUser.status !== "VERIFIED") {
          return "/login?error=not_verified"
        }
      }
      return true
    },
    async jwt({ token, user, account, trigger, session }) {
      // Credentials sign-in
      if (user && account?.provider === "credentials") {
        token.id = user.id
        token.role = (user as any).role
        token.needsOnboarding = false
      }

      // Google sign-in — check if user exists in our DB
      if (account?.provider === "google") {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email! },
        })
        if (dbUser) {
          token.id = dbUser.id
          token.role = dbUser.role
          token.needsOnboarding = false
        } else {
          // New Google user — needs to complete onboarding
          token.needsOnboarding = true
        }
      }

      // After onboarding completes, re-check DB
      if (trigger === "update" && (token.needsOnboarding || (session as any)?.recheck)) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email! },
        })
        if (dbUser && dbUser.status === "VERIFIED") {
          token.id = dbUser.id
          token.role = dbUser.role
          token.needsOnboarding = false
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string
        (session.user as any).role = token.role as string
        (session.user as any).needsOnboarding = token.needsOnboarding as boolean
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
})
