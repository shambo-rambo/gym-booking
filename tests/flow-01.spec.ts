/**
 * FLOW-01: New resident registration
 * - Fill registration form with a unique email + building code
 * - Submit → lands on confirmation / pending page
 * - Attempt login → blocked (status PENDING)
 * NOTE: Requires BUILDING_CODE env var. Cleans up the created user in afterAll.
 */
import { test, expect } from "@playwright/test"
import { BUILDING_CODE } from "./fixtures"
import { clearUserByEmail, closeDb } from "./helpers/db"

const testEmail = `e2e-reg-${Date.now()}@test.local`

test.afterAll(async () => {
  await clearUserByEmail(testEmail)
  await closeDb()
})

test("FLOW-01: resident can register and is left in PENDING state", async ({ page }) => {
  test.skip(!BUILDING_CODE, "BUILDING_CODE env var not set — skipping registration flow")

  await page.goto("/register")

  await page.fill("#name", "E2E Test User")
  await page.fill("#email", testEmail)

  // apartmentNumber is a native <select>
  await page.selectOption("#apartmentNumber", "501")

  await page.fill("#buildingCode", BUILDING_CODE)
  await page.fill("#password", "TestPass123!")

  await page.click('button[type="submit"]')

  // Register redirects to /login?registered=pending
  await page.waitForURL(/\/login/, { timeout: 10_000 })
  await expect(
    page.getByText(/registration received|manager will approve|pending/i)
  ).toBeVisible({ timeout: 10_000 })
})

test("FLOW-01b: PENDING user cannot log in", async ({ page }) => {
  test.skip(!BUILDING_CODE, "BUILDING_CODE env var not set")

  await page.goto("/login")
  await page.fill("#email", testEmail)
  await page.fill("#password", "TestPass123!")
  await page.click('button[type="submit"]')

  // Should stay on /login or show an error — must NOT land on /
  await expect(page).not.toHaveURL("/", { timeout: 8_000 })
})
