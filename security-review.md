# The Residences: Security Review (gym codebase)

Full-codebase pass, July 2026. Scope: authentication and session handling, role gating, all API routes, input validation, secrets, and personal-data exposure. Context: this review was requested alongside the Strata Roll PRD, which adds residents' names, service addresses, postal addresses and tenancy details, so the app's handling of personal data matters more after that feature than before it.

Bottom line: the codebase is soundly built on the fundamentals. The gaps are not broken access control or injection; they are the perimeter hardening you would want before the app holds a statutory register of residents' personal data. Three items are worth fixing before the roll ships.

## What is already done well (verified, not assumed)

- **Passwords** are hashed with bcrypt. Login rejects any account not `VERIFIED`.
- **Password reset** is textbook: a 32-byte random token, only its SHA-256 hash stored, single-use, one-hour expiry, and `forgot-password` always returns success so it does not reveal whether an email is registered.
- **Manager API routes enforce the role themselves.** Every `/api/manager/*` route re-fetches the user from the database and checks `role === "MANAGER"`, rather than trusting the middleware or the JWT claim. This is real defence in depth, and it matters because the middleware role-gate only covers `/manager` page routes, not `/api/manager`.
- **No IDOR on the routes checked.** Booking, notice and settings routes scope every read and write to the session user's own id (for example `booking.userId !== userId` returns 403).
- **Input validation** uses Zod across the routes. **No SQL injection surface:** all data access is through Prisma, and there is no raw SQL anywhere in the codebase.
- **Onboarding cannot self-provision access.** A Google sign-in for an unknown email is gated by a shared building code, created as `PENDING`, capped at six per unit, and still requires manager verification before it can log in.
- **Cron endpoints** require a `CRON_SECRET` bearer token and fail closed if the secret is unset.
- **Operational hygiene:** manager-notification emails HTML-escape user input, all secrets live in environment variables with `.env` gitignored, and the AI assistant has a 40-message daily per-user cap.

## Findings

### High

**1. No rate limiting on any authentication endpoint.** There is no rate limiting anywhere in the codebase. Login, `forgot-password`, and the onboarding building-code check can all be called without limit. This allows password brute-forcing, building-code guessing, and using `forgot-password` to send repeated emails to a resident. This is the most material gap, and it grows once the app holds the roll's personal data and, later, AGM votes. Fix by adding per-IP and per-account rate limiting on `authorize`, `forgot-password`, `register` and `complete-onboarding` (Upstash rate limit, or a small database-backed counter if you would rather not add a dependency).

### Medium

**2. No HTTP security headers.** `next.config.mjs` sets no security headers. Missing: `Strict-Transport-Security`, a Content-Security-Policy, `X-Frame-Options` or a `frame-ancestors` CSP directive (clickjacking), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`. Add a `headers()` function to the Next config. `frame-ancestors 'none'` and HSTS are the two highest-value additions.

**3. Deactivation and role changes do not take effect until the JWT expires.** Sessions use the JWT strategy and the resident API routes check only that a session exists, not the account's current status. So a resident set to `DEACTIVATED`, or a manager demoted, keeps their access until their token expires (NextAuth defaults to 30 days, and no `maxAge` is set). For a building app this means removing a resident does not actually cut off their access promptly. Fix by re-checking `status` (and role for managers) against the database on sensitive requests, or shortening the session and adding a lightweight status check. The manager routes should also assert `status === "VERIFIED"`, not just the role.

### Low / hardening

**4. Long-lived sessions.** No `session.maxAge` is set, so tokens last the 30-day default. Shorten it, especially given managers can see the whole roll. This pairs naturally with the 2FA-for-managers item flagged in the roll PRD.

**5. The building code is a single static shared secret** with no rotation or expiry. Combined with finding 1 it is guessable, and once shared it cannot be revoked per person. Consider per-registration invite tokens, or at least rotation plus rate limiting.

**6. Pervasive `(session.user as any)` casts** in the auth path. Not a vulnerability, but it removes the type safety that would otherwise catch a future mistake in role or id handling. Worth a typed session augmentation.

## Recommended order before the roll ships

Finding 1 (rate limiting), finding 2 (headers) and finding 3 (session invalidation) are the ones to close before the roll goes live, because the roll is what turns this from a booking app into a store of residents' personal and tenancy data. Findings 4 to 6 are hardening and can follow. None of this blocks building the roll; it should be done alongside it.
