/**
 * FLOW-01: New resident registration
 * - Fill registration form with a unique email + building code
 * - Submit → redirects to /login with a confirmation banner
 * - With a correct building code the user is auto-verified ("Account created")
 * - Verify the newly created user can log in immediately
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

test("FLOW-01: resident can register and sees confirmation on login page", async ({ page }) => {
  test.skip(!BUILDING_CODE, "BUILDING_CODE env var not set — skipping registration flow")

  await page.goto("/register")

  await page.fill("#name", "E2E Test User")
  await page.fill("#email", testEmail)
  await page.selectOption("#apartmentNumber", "501")
  await page.fill("#buildingCode", BUILDING_CODE)
  await page.fill("#password", "TestPass123!")

  await page.click('button[type="submit"]')

  // Register always redirects to /login — with ?registered=verified (correct code)
  // or ?registered=pending (wrong code). Either way a success banner appears.
  await page.waitForURL(/\/login/, { timeout: 10_000 })
  await expect(
    page.getByText(/account created|registration received|manager will approve/i)
  ).toBeVisible({ timeout: 10_000 })
})

test("FLOW-01b: newly registered user with correct code can log in", async ({ page }) => {
  test.skip(!BUILDING_CODE, "BUILDING_CODE env var not set")

  // User was created in the previous test and auto-verified (correct building code)
  await page.goto("/login")
  await page.fill("#email", testEmail)
  await page.fill("#password", "TestPass123!")
  await page.click('button[type="submit"]')

  // Auto-verified users can log in immediately
  await expect(page).toHaveURL("/", { timeout: 10_000 })
})
