/**
 * FLOW-07: Manager approves a pending registration
 * - Register a new user (PENDING state)
 * - Log in as manager, navigate to /manager/users
 * - Find the pending user in the Pending tab and click Approve
 * - Verify the user moves out of the Pending tab
 * NOTE: Requires BUILDING_CODE env var to register the test user.
 * Cleans up the created user in afterAll.
 */
import { test, expect } from "@playwright/test"
import { USERS, BUILDING_CODE } from "./fixtures"
import { loginAs, logout } from "./helpers/auth"
import { clearUserByEmail, closeDb } from "./helpers/db"

const pendingEmail = `e2e-pending-${Date.now()}@test.local`
const pendingName = "E2E Pending User"

test.afterAll(async () => {
  await clearUserByEmail(pendingEmail)
  await closeDb()
})

test("FLOW-07: manager approves a pending resident", async ({ page }) => {
  test.skip(!BUILDING_CODE, "BUILDING_CODE env var not set — skipping manager approval flow")

  // --- Register a new pending user ---
  await page.goto("/register")
  await page.fill("#name", pendingName)
  await page.fill("#email", pendingEmail)
  await page.selectOption("#apartmentNumber", "502")
  await page.fill("#buildingCode", BUILDING_CODE)
  await page.fill("#password", "TestPass123!")
  await page.click('button[type="submit"]')

  // Wait for registration confirmation (stay on register page or show success)
  await expect(
    page.getByText(/pending|submitted|verification|check your email/i)
  ).toBeVisible({ timeout: 10_000 })

  // --- Log in as manager and approve ---
  await loginAs(page, USERS.manager.email, USERS.manager.password)
  await page.goto("/manager/users")

  // Click the Pending tab
  await page.getByRole("tab", { name: /pending/i }).click()

  // Find the pending user row and click Approve
  const userRow = page.locator(`tr, [role="row"], li, div`).filter({ hasText: pendingEmail })
  await expect(userRow).toBeVisible({ timeout: 10_000 })
  await userRow.getByRole("button", { name: /approve/i }).click()

  // User should disappear from pending list
  await expect(page.locator(`text=${pendingEmail}`)).not.toBeVisible({ timeout: 10_000 })
})
