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

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)"],
}
