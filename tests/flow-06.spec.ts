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
import { clickFirstAvailableSlot } from "./helpers/booking"
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

  // --- Setup: userA books a slot ---
  const ctxA = await browser.newContext({ baseURL: BASE_URL })
  const pageA = await ctxA.newPage()
  await loginAs(pageA, USERS.userA.email, USERS.userA.password)

  await pageA.goto("/book")
  await pageA.getByRole("button", { name: "Private Sauna" }).click()
  await clickFirstAvailableSlot(pageA)

  const dialogA = pageA.getByRole("dialog")
  await expect(dialogA).toBeVisible()

  const slotTimeText = await dialogA.locator("span, p").filter({ hasText: /\d{2}:\d{2}/ }).first().textContent()

  await dialogA.getByRole("button", { name: "Confirm Booking" }).click()
  await expect(dialogA.getByText(/confirmed|booked|success/i)).toBeVisible({ timeout: 10_000 })
  const closeBtnA = dialogA.getByRole("button", { name: /close/i })
  if (await closeBtnA.isVisible()) await closeBtnA.click()

  // --- userB joins queue for the same slot ---
  const ctxB = await browser.newContext({ baseURL: BASE_URL })
  const pageB = await ctxB.newPage()
  await loginAs(pageB, USERS.userB.email, USERS.userB.password)

  await pageB.goto("/book")
  await pageB.getByRole("button", { name: "Private Sauna" }).click()

  await pageB.waitForFunction(
    () => document.querySelectorAll(".animate-pulse").length === 0,
    { timeout: 15_000 }
  )

  const targetSlot = slotTimeText
    ? pageB.locator("button").filter({ hasText: slotTimeText.trim() }).first()
    : pageB.locator("button:not([disabled])").filter({ hasText: /\b\d{1,2}:\d{2}\b/ }).first()

  await expect(targetSlot).toBeVisible({ timeout: 10_000 })
  await targetSlot.click()

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
