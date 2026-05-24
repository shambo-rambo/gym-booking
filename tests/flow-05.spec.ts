/**
 * FLOW-05: Join the waitlist for a full slot
 * - userA books a Private Sauna slot (fills it as EXCLUSIVE)
 * - userB tries to book the same slot → it is full → offered "Join Waitlist"
 * - userB joins the waitlist
 * - Queue entry appears on userB's home page
 *
 * Uses two separate browser contexts to isolate sessions.
 * Cleans up both users' bookings/queue entries in afterAll.
 */
import { test, expect, chromium } from "@playwright/test"
import { USERS, BASE_URL } from "./fixtures"
import { loginAs } from "./helpers/auth"
import {
  clickFirstAvailableSlot,
  getDialogSlotTime,
  selectTomorrow,
} from "./helpers/booking"
import { clearBookingsForUser, closeDb } from "./helpers/db"

test.afterAll(async () => {
  await clearBookingsForUser(USERS.userA.email)
  await clearBookingsForUser(USERS.userB.email)
  await closeDb()
})

test("FLOW-05: userB joins waitlist for slot booked by userA", async () => {
  test.setTimeout(120_000)
  const browser = await chromium.launch()

  // Context A: userA books a private sauna slot (tomorrow)
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

  // Context B: userB tries to book the same slot
  const ctxB = await browser.newContext({ baseURL: BASE_URL })
  const pageB = await ctxB.newPage()
  await loginAs(pageB, USERS.userB.email, USERS.userB.password)

  await pageB.goto("/book")
  await pageB.getByRole("button", { name: "Private Sauna" }).click()

  // Navigate to tomorrow (selectTomorrow waits for availability API)
  await selectTomorrow(pageB)

  // Find the slot userA just booked — full slots are still clickable (not disabled)
  const targetSlot = slotTime
    ? pageB.locator("button.rounded-xl.text-left").filter({ hasText: new RegExp(slotTime!) }).first()
    : pageB.locator("button.rounded-xl.text-left:not([disabled])").first()

  await expect(targetSlot).toBeVisible({ timeout: 10_000 })
  await targetSlot.click()

  const dialogB = pageB.getByRole("dialog")
  await expect(dialogB).toBeVisible()

  // Full/unavailable slot should show "Join Waitlist" or "Join Queue"
  const joinBtn = dialogB.getByRole("button", { name: /join waitlist|join queue/i })
  await expect(joinBtn).toBeVisible({ timeout: 8_000 })
  await joinBtn.click()

  await expect(dialogB.getByText(/you're in the queue|you've joined the waitlist/i)).toBeVisible({ timeout: 20_000 })

  // Navigate away — no need to explicitly close the dialog
  await pageB.goto("/")
  await expect(pageB.getByRole("button", { name: "Leave Waitlist" })).toBeVisible({ timeout: 10_000 })

  await ctxA.close()
  await ctxB.close()
  await browser.close()
})
