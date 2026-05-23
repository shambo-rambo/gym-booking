/**
 * FLOW-08: Auth guard — unauthenticated access redirects to /login
 * No login needed. Tests that middleware correctly blocks protected routes.
 */
import { test, expect } from "@playwright/test"

const PROTECTED_ROUTES = ["/", "/book", "/queue", "/settings", "/manager"]

for (const route of PROTECTED_ROUTES) {
  test(`FLOW-08: unauthenticated visit to ${route} redirects to /login`, async ({ page }) => {
    // Fresh context (no cookies) — each test iteration uses the default context
    // which has no session, so this is inherently unauthenticated.
    await page.goto(route)
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })
}

test("FLOW-08: /login is publicly accessible", async ({ page }) => {
  await page.goto("/login")
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible()
})

test("FLOW-08: /register is publicly accessible", async ({ page }) => {
  await page.goto("/register")
  await expect(page).toHaveURL(/\/register/)
  await expect(page.getByRole("button", { name: /create account/i })).toBeVisible()
})
