import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

const PUBLIC_PATHS = ["/login", "/register", "/onboarding"]

export default auth((req) => {
  const session = req.auth
  const { pathname } = req.nextUrl

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/api/auth/")

  if (!session && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (session && pathname.startsWith("/manager") && (session.user as any)?.role !== "MANAGER") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  if (
    session?.user &&
    (session.user as any).needsOnboarding === true &&
    pathname !== "/onboarding" &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/_next")
  ) {
    return NextResponse.redirect(new URL("/onboarding", req.url))
  }

  if (
    session?.user &&
    (session.user as any).mustChangePassword === true &&
    pathname !== "/change-password" &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/_next")
  ) {
    return NextResponse.redirect(new URL("/change-password", req.url))
  }

  // Managers must have 2FA enabled — no grace period.
  if (
    session?.user &&
    (session.user as any).twoFactorSetupRequired === true &&
    pathname !== "/setup-2fa" &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/_next")
  ) {
    return NextResponse.redirect(new URL("/setup-2fa", req.url))
  }

  // Anyone with 2FA enabled must verify it once per session before proceeding.
  if (
    session?.user &&
    (session.user as any).twoFactorEnabled === true &&
    (session.user as any).twoFactorVerified === false &&
    pathname !== "/verify-2fa" &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/_next")
  ) {
    return NextResponse.redirect(new URL("/verify-2fa", req.url))
  }

  return NextResponse.next()
})

export const config = {
  // Service worker files (sw.js, its workbox runtime, and the custom push-handling
  // worker chunk) must always be fetchable regardless of auth state — the browser
  // registers/updates them from public pages too, and a redirected response breaks
  // registration entirely.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw\\.js|sw\\.js\\.map|workbox-.*\\.js|workbox-.*\\.js\\.map|worker-.*\\.js|swe-worker-.*\\.js|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
}
