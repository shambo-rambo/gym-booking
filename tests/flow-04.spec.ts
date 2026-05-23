/**
 * FLOW-04: Cancel a booking
 * - Log in as userA
 * - Create a booking via the UI (same approach as FLOW-03)
 * - Return to home, cancel the booking using the inline confirm pattern
 * - Verify the home page no longer shows the booking
 *
 * Cleans up leftover bookings for userA in afterAll.
 */
import { test, expect } from "@playwright/test"
import { USERS } from "./fixtures"
import { loginAs } from "./helpers/auth"
import { clearBookingsForUser, closeDb } from "./helpers/db"

test.afterAll(async () => {
  await clearBookingsForUser(USERS.userA.email)
  await closeDb()
})

test("FLOW-04: cancel a booking from the home page", async ({ page }) => {
  await loginAs(page, USERS.userA.email, USERS.userA.password)

  // --- Create a booking ---
  await page.goto("/book")
  await page.getByRole("button", { name: "Private Sauna" }).click()
  await page.waitForSelector("button.bg-green-50", { timeout: 15_000 })
  await page.locator("button.bg-green-50").first().click()

  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "Confirm Booking" }).click()
  await expect(dialog.getByText(/confirmed|booked|success/i)).toBeVisible({ timeout: 10_000 })

  const closeBtn = dialog.getByRole("button", { name: /close/i })
  if (await closeBtn.isVisible()) await closeBtn.click()

  // --- Cancel from home page ---
  await page.goto("/")
  await expect(page.getByText(/sauna/i)).toBeVisible()

  // First click shows the inline confirm
  await page.getByRole("button", { name: "Cancel Booking" }).first().click()

  // Confirm
  await page.getByRole("button", { name: "Yes, cancel" }).click()

  // Booking card disappears
  await expect(page.getByRole("button", { name: "Cancel Booking" })).not.toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText(/no upcoming bookings/i)).toBeVisible()
})
