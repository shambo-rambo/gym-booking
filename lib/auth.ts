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

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          twoFactorEnabled: user.twoFactorEnabled,
        }
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
        token.mustChangePassword = (user as any).mustChangePassword
        token.twoFactorEnabled = (user as any).twoFactorEnabled
        // Nothing to verify if 2FA isn't on; otherwise the /verify-2fa gate takes over.
        token.twoFactorVerified = !(user as any).twoFactorEnabled
        token.twoFactorSetupRequired = (user as any).role === "MANAGER" && !(user as any).twoFactorEnabled
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
          token.mustChangePassword = dbUser.mustChangePassword
          token.twoFactorEnabled = dbUser.twoFactorEnabled
          token.twoFactorVerified = !dbUser.twoFactorEnabled
          token.twoFactorSetupRequired = dbUser.role === "MANAGER" && !dbUser.twoFactorEnabled
        } else {
          // New Google user — needs to complete onboarding first; 2FA kicks in after that.
          token.needsOnboarding = true
          token.twoFactorEnabled = false
          token.twoFactorVerified = true
          token.twoFactorSetupRequired = false
        }
      }

      // After onboarding or a forced password change completes, re-check DB. The client
      // only ever asks for a recheck — it never supplies the verified/setup-required
      // values directly, so a forged client update can't bypass anything on its own.
      //
      // twoFactorVerified is deliberately NOT recomputed here. NextAuth re-signs this JWT
      // (fresh iat/jti) on most authenticated requests as part of its rolling-session
      // behavior, so there's no reliable "issued at login" timestamp to compare a DB
      // verification stamp against. Instead, the routes that actually validate a TOTP/
      // backup code or a trusted-device cookie (verify-login, check-trusted-device,
      // enable, disable — see lib/sessionToken.ts) write twoFactorVerified into the
      // session cookie themselves. This recheck only ever preserves that value, or
      // clears the requirement entirely if 2FA is now off — it can never flip it true.
      if (trigger === "update" && (token.needsOnboarding || (session as any)?.recheck)) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email! },
        })
        if (dbUser && dbUser.status === "VERIFIED") {
          token.id = dbUser.id
          token.role = dbUser.role
          token.needsOnboarding = false
          token.mustChangePassword = dbUser.mustChangePassword
          token.twoFactorEnabled = dbUser.twoFactorEnabled
          token.twoFactorSetupRequired = dbUser.role === "MANAGER" && !dbUser.twoFactorEnabled
          token.twoFactorVerified = !dbUser.twoFactorEnabled || token.twoFactorVerified === true
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string
        (session.user as any).role = token.role as string
        (session.user as any).needsOnboarding = token.needsOnboarding as boolean
        ;(session.user as any).mustChangePassword = token.mustChangePassword as boolean
        ;(session.user as any).twoFactorEnabled = token.twoFactorEnabled as boolean
        ;(session.user as any).twoFactorVerified = token.twoFactorVerified as boolean
        ;(session.user as any).twoFactorSetupRequired = token.twoFactorSetupRequired as boolean
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
