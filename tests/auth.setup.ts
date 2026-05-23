/**
 * Global setup: verifies that seed users exist and the app is reachable.
 * Does NOT save browser state — each spec logs in directly because flows
 * test the login page itself (FLOW-01, FLOW-08) or need isolated contexts.
 */
import { test, expect } from "@playwright/test"
import { USERS } from "./fixtures"
import { loginAs } from "./helpers/auth"

test("seed users can log in", async ({ page }) => {
  await loginAs(page, USERS.userA.email, USERS.userA.password)
  await expect(page).toHaveURL("/")
})
