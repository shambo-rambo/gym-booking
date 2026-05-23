/**
 * FLOW-07: Manager approves a pending registration
 * - Create a PENDING user directly via DB (users with correct building code
 *   are auto-verified by the API, so we seed PENDING status manually)
 * - Log in as manager, navigate to /manager/users
 * - Find the pending user in the Pending tab and click Approve
 * - Verify the user moves out of the Pending tab
 * Cleans up the created user in afterAll.
 */
import { test, expect } from "@playwright/test"
import { USERS } from "./fixtures"
import { loginAs } from "./helpers/auth"
import { createPendingUser, clearUserByEmail, closeDb } from "./helpers/db"

const pendingEmail = `e2e-pending-${Date.now()}@test.local`
const pendingName = "E2E Pending User"

test.beforeAll(async () => {
  await createPendingUser(pendingEmail, pendingName, 502)
})

test.afterAll(async () => {
  await clearUserByEmail(pendingEmail)
  await closeDb()
})

test("FLOW-07: manager approves a pending resident", async ({ page }) => {
  await loginAs(page, USERS.manager.email, USERS.manager.password)
  await page.goto("/manager/users")

  // Click the Pending tab
  await page.getByRole("tab", { name: /pending/i }).click()

  // Scope to the Pending tabpanel to avoid strict-mode ambiguity
  const tabpanel = page.getByRole("tabpanel", { name: /pending/i })
  await expect(tabpanel).toBeVisible({ timeout: 10_000 })
  await expect(tabpanel.getByText(pendingEmail)).toBeVisible({ timeout: 5_000 })
  await tabpanel.getByRole("button", { name: /approve/i }).click()

  // User disappears from pending list
  await expect(tabpanel.getByText(pendingEmail)).not.toBeVisible({ timeout: 10_000 })
})
