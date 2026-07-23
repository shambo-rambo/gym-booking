import { encode, decode } from "next-auth/jwt"
import type { NextRequest, NextResponse } from "next/server"

// NextAuth re-signs the session JWT (fresh iat/jti) on most authenticated requests as
// part of its rolling-session behavior, so a "verified at time T > login iat" comparison
// is unreliable — iat drifts forward on unrelated requests between login and verification.
// Instead, routes that just confirmed a real TOTP/backup code or trusted-device cookie
// write the result directly into the session cookie themselves, so no client-supplied
// value is ever trusted for security-relevant fields.
const COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token"
const MAX_AGE = 30 * 24 * 60 * 60 // matches NextAuth's default session maxAge, unchanged by this app

export async function refreshSessionToken(
  request: NextRequest,
  response: NextResponse,
  updates: Record<string, unknown>
) {
  const secret = process.env.AUTH_SECRET
  const raw = request.cookies.get(COOKIE_NAME)?.value
  if (!secret || !raw) return

  const token = await decode({ token: raw, secret, salt: COOKIE_NAME })
  if (!token) return

  const encoded = await encode({ token: { ...token, ...updates }, secret, salt: COOKIE_NAME, maxAge: MAX_AGE })
  response.cookies.set(COOKIE_NAME, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  })
}
