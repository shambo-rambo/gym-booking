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

  // Watch for the PATCH before clicking so we don't miss a fast response
  const patchDone = page.waitForResponse(
    (resp) =>
      resp.url().includes("/api/manager/users/") &&
      resp.request().method() === "PATCH",
    { timeout: 10_000 }
  )
  await tabpanel.getByRole("button", { name: /approve/i }).click()
  const patch = await patchDone
  expect(patch.status()).toBe(200)

  // handleVerify calls fetchUsers() on success — wait for the GET to complete
  await page.waitForResponse(
    (resp) =>
      resp.url().includes("/api/manager/users") &&
      resp.request().method() === "GET" &&
      resp.status() === 200,
    { timeout: 10_000 }
  )

  // Tab trigger should now read "Pending (0)"
  await expect(page.getByRole("tab", { name: /pending/i })).toContainText("(0)", {
    timeout: 5_000,
  })
})
