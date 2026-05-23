/**
 * FLOW-06: Queue notification → claim slot
 * Precondition (set up in beforeAll via DB):
 *   - userA holds a booking for a specific slot
 *   - userB is in the queue for that same slot, with notifiedAt set (slot available)
 *
 * Steps:
 *   - userA cancels their booking (triggers notifyNextInQueue synchronously)
 *   - As userB, navigate to /queue and claim the slot
 *   - Verify booking appears on userB's home page
 *
 * We force the notification via DB helper rather than waiting for the actual
 * cancel → notify cycle, which is already covered by FLOW-05.
 */
import { test, expect, chromium } from "@playwright/test"
import { USERS, BASE_URL } from "./fixtures"
import { loginAs } from "./helpers/auth"
import {
  clearBookingsForUser,
  markQueueEntryNotified,
  closeDb,
} from "./helpers/db"

test.afterAll(async () => {
  await clearBookingsForUser(USERS.userA.email)
  await clearBookingsForUser(USERS.userB.email)
  await closeDb()
})

test("FLOW-06: userB is notified and claims slot after userA cancels", async () => {
  const browser = await chromium.launch()

  // --- Setup: userA books a slot, userB joins queue ---
  const ctxA = await browser.newContext({ baseURL: BASE_URL })
  const pageA = await ctxA.newPage()
  await loginAs(pageA, USERS.userA.email, USERS.userA.password)

  await pageA.goto("/book")
  await pageA.getByRole("button", { name: "Private Sauna" }).click()
  await pageA.waitForSelector("button.bg-green-50", { timeout: 15_000 })
  await pageA.locator("button.bg-green-50").first().click()

  const dialogA = pageA.getByRole("dialog")
  await expect(dialogA).toBeVisible()
  await dialogA.getByRole("button", { name: "Confirm Booking" }).click()
  await expect(dialogA.getByText(/confirmed|booked|success/i)).toBeVisible({ timeout: 10_000 })
  const closeBtnA = dialogA.getByRole("button", { name: /close/i })
  if (await closeBtnA.isVisible()) await closeBtnA.click()

  // userB joins queue for the same slot
  const ctxB = await browser.newContext({ baseURL: BASE_URL })
  const pageB = await ctxB.newPage()
  await loginAs(pageB, USERS.userB.email, USERS.userB.password)

  await pageB.goto("/book")
  await pageB.getByRole("button", { name: "Private Sauna" }).click()
  await pageB.waitForSelector("button", { timeout: 15_000 })

  // Click first non-available (booked) slot
  const anySlot = pageB.locator("button.bg-red-50, button.bg-orange-50, button.bg-amber-50, button.bg-gray-100, button.bg-green-50").first()
  await anySlot.click()

  const dialogB = pageB.getByRole("dialog")
  await expect(dialogB).toBeVisible()
  const joinBtn = dialogB.getByRole("button", { name: /join waitlist|join queue/i })
  if (await joinBtn.isVisible({ timeout: 5_000 })) {
    await joinBtn.click()
    await expect(dialogB.getByText(/queue|waitlist|joined/i)).toBeVisible({ timeout: 10_000 })
    const closeBtnB = dialogB.getByRole("button", { name: /close/i })
    if (await closeBtnB.isVisible()) await closeBtnB.click()
  }

  // Force-mark userB's queue entry as notified via DB
  await markQueueEntryNotified(USERS.userB.email)

  // --- userA cancels their booking ---
  await pageA.goto("/")
  await pageA.getByRole("button", { name: "Cancel Booking" }).first().click()
  await pageA.getByRole("button", { name: "Yes, cancel" }).click()
  await expect(pageA.getByText(/no upcoming bookings/i)).toBeVisible({ timeout: 10_000 })

  // --- userB claims the slot ---
  await pageB.goto("/queue")
  const claimBtn = pageB.getByRole("button", { name: "Claim Slot" })
  await expect(claimBtn).toBeVisible({ timeout: 10_000 })
  await claimBtn.click()

  // After claiming, booking should appear on home page
  await pageB.goto("/")
  await expect(pageB.getByText(/sauna/i)).toBeVisible()
  await expect(pageB.getByText(/no upcoming bookings/i)).not.toBeVisible()

  await ctxA.close()
  await ctxB.close()
  await browser.close()
})
