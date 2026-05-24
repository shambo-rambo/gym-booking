/**
 * FLOW-06: Queue notification → claim slot
 * Steps:
 *   - userA books a slot (tomorrow, so canCancel = true)
 *   - userB joins queue for the same slot
 *   - DB helper force-marks userB's entry as notified
 *   - userA cancels their booking
 *   - userB claims the slot from /queue
 *   - Verify booking appears on userB's home page
 */
import { test, expect, chromium } from "@playwright/test"
import { USERS, BASE_URL } from "./fixtures"
import { loginAs } from "./helpers/auth"
import {
  clickFirstAvailableSlot,
  getDialogSlotTime,
  selectTomorrow,
} from "./helpers/booking"
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
  test.setTimeout(120_000)
  const browser = await chromium.launch()

  // --- Setup: userA books a slot (tomorrow, so canCancel = true) ---
  const ctxA = await browser.newContext({ baseURL: BASE_URL })
  const pageA = await ctxA.newPage()
  await loginAs(pageA, USERS.userA.email, USERS.userA.password)

  await pageA.goto("/book")
  await pageA.getByRole("button", { name: "Private Sauna" }).click()
  await clickFirstAvailableSlot(pageA)

  const dialogA = pageA.getByRole("dialog")
  await expect(dialogA).toBeVisible()

  // Capture HH:MM from the open dialog BEFORE confirming
  const slotTime = await getDialogSlotTime(dialogA)

  await dialogA.getByRole("button", { name: "Confirm Booking" }).click()
  await expect(dialogA).not.toBeVisible({ timeout: 10_000 })

  // --- userB joins queue for the same slot ---
  const ctxB = await browser.newContext({ baseURL: BASE_URL })
  const pageB = await ctxB.newPage()
  await loginAs(pageB, USERS.userB.email, USERS.userB.password)

  await pageB.goto("/book")
  await pageB.getByRole("button", { name: "Private Sauna" }).click()

  // Navigate to tomorrow (selectTomorrow waits for availability API)
  await selectTomorrow(pageB)

  const targetSlot = slotTime
    ? pageB.locator("button.rounded-xl.text-left").filter({ hasText: new RegExp(slotTime!) }).first()
    : pageB.locator("button.rounded-xl.text-left:not([disabled])").first()

  await expect(targetSlot).toBeVisible({ timeout: 10_000 })
  await targetSlot.click()

  const dialogB = pageB.getByRole("dialog")
  await expect(dialogB).toBeVisible()
  const joinBtn = dialogB.getByRole("button", { name: /join waitlist|join queue/i })
  await expect(joinBtn).toBeVisible({ timeout: 8_000 })
  const joinResponse = pageB.waitForResponse(
    resp => resp.url().includes("/api/queue/join") && resp.status() === 200,
    { timeout: 30_000 }
  )
  await joinBtn.click()
  await joinResponse
  await expect(dialogB.getByText(/you're in the queue|you've joined the waitlist/i)).toBeVisible({ timeout: 5_000 })

  // Navigate away (dismisses dialog) and force-mark userB's entry as notified
  await pageB.goto("/book")
  await markQueueEntryNotified(USERS.userB.email)

  // --- userA cancels their booking (tomorrow slot → canCancel = true) ---
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
