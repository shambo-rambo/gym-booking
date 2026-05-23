/**
 * FLOW-03: Book a gym/sauna slot
 * - Log in as userA
 * - Navigate to /book → click "Private Sauna" (no equipment step)
 * - Click the first available time slot
 * - Confirm the booking dialog
 * - Verify the booking appears on the home page
 *
 * Cleans up all bookings for userA in afterAll.
 */
import { test, expect } from "@playwright/test"
import { USERS } from "./fixtures"
import { loginAs } from "./helpers/auth"
import { bookSlotAndConfirm } from "./helpers/booking"
import { clearBookingsForUser, closeDb } from "./helpers/db"

test.afterAll(async () => {
  await clearBookingsForUser(USERS.userA.email)
  await closeDb()
})

test("FLOW-03: book a private sauna slot", async ({ page }) => {
  await loginAs(page, USERS.userA.email, USERS.userA.password)

  await page.goto("/book")
  await page.getByRole("button", { name: "Private Sauna" }).click()

  await bookSlotAndConfirm(page)

  // Booking appears on home page
  await page.goto("/")
  await expect(page.getByText(/sauna/i)).toBeVisible()
})
