/**
 * FLOW-02: Login and logout
 * - Valid credentials → lands on home page
 * - Sign out → redirected to /login
 * - Wrong password → stays on /login with error
 */
import { test, expect } from "@playwright/test"
import { USERS } from "./fixtures"
import { loginAs, logout } from "./helpers/auth"

test("FLOW-02a: valid credentials log in and show home page", async ({ page }) => {
  await loginAs(page, USERS.userA.email, USERS.userA.password)
  await expect(page).toHaveURL("/")
  await expect(page.getByRole("button", { name: /make a booking/i })).toBeVisible()
})

test("FLOW-02b: sign out redirects to /login", async ({ page }) => {
  await loginAs(page, USERS.userA.email, USERS.userA.password)
  await logout(page)
  await expect(page).toHaveURL(/\/login/)
})

test("FLOW-02c: wrong password stays on /login with error", async ({ page }) => {
  await page.goto("/login")
  await page.fill("#email", USERS.userA.email)
  await page.fill("#password", "wrongpassword")
  await page.click('button[type="submit"]')

  await expect(page).not.toHaveURL("/", { timeout: 8_000 })
  await expect(page.getByText(/invalid|incorrect|wrong|credentials/i)).toBeVisible({
    timeout: 8_000,
  })
})
