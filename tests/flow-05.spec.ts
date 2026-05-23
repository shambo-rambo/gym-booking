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
import { clickFirstAvailableSlot } from "./helpers/booking"
import { clearBookingsForUser, closeDb } from "./helpers/db"

test.afterAll(async () => {
  await clearBookingsForUser(USERS.userA.email)
  await clearBookingsForUser(USERS.userB.email)
  await closeDb()
})

test("FLOW-05: userB joins waitlist for slot booked by userA", async () => {
  const browser = await chromium.launch()

  // Context A: userA books a private sauna slot
  const ctxA = await browser.newContext({ baseURL: BASE_URL })
  const pageA = await ctxA.newPage()
  await loginAs(pageA, USERS.userA.email, USERS.userA.password)

  await pageA.goto("/book")
  await pageA.getByRole("button", { name: "Private Sauna" }).click()
  await clickFirstAvailableSlot(pageA)

  const dialogA = pageA.getByRole("dialog")
  await expect(dialogA).toBeVisible()

  // Capture the time so userB can find the same slot
  const slotTimeText = await dialogA.locator("span, p, h2, h3").filter({ hasText: /\d{2}:\d{2}/ }).first().textContent()

  await dialogA.getByRole("button", { name: "Confirm Booking" }).click()
  await expect(dialogA).not.toBeVisible({ timeout: 10_000 })

  // Context B: userB tries to book the same slot
  const ctxB = await browser.newContext({ baseURL: BASE_URL })
  const pageB = await ctxB.newPage()
  await loginAs(pageB, USERS.userB.email, USERS.userB.password)

  await pageB.goto("/book")
  await pageB.getByRole("button", { name: "Private Sauna" }).click()

  // Wait for the skeleton to clear, then click the same time slot
  await pageB.waitForFunction(
    () => document.querySelectorAll(".animate-pulse").length === 0,
    { timeout: 15_000 }
  )

  // Click the same time as userA booked. The slot may now show as full/unavailable.
  // It should still be clickable so the dialog offers Join Waitlist.
  const targetSlot = slotTimeText
    ? pageB.locator("button").filter({ hasText: slotTimeText.trim() }).first()
    : pageB.locator("button:not([disabled])").filter({ hasText: /\d{2}:\d{2}/ }).first()

  await expect(targetSlot).toBeVisible({ timeout: 10_000 })
  await targetSlot.click()

  const dialogB = pageB.getByRole("dialog")
  await expect(dialogB).toBeVisible()

  // Full/unavailable slot should show "Join Waitlist" or "Join Queue"
  const joinBtn = dialogB.getByRole("button", { name: /join waitlist|join queue/i })
  await expect(joinBtn).toBeVisible({ timeout: 8_000 })
  await joinBtn.click()

  await expect(dialogB.getByText(/queue|waitlist|joined/i)).toBeVisible({ timeout: 10_000 })
  const closeBtnB = dialogB.getByRole("button", { name: /close/i })
  if (await closeBtnB.isVisible()) await closeBtnB.click()

  // Waitlist entry appears on userB's home page
  await pageB.goto("/")
  await expect(pageB.getByText(/waitlist/i)).toBeVisible()

  await ctxA.close()
  await ctxB.close()
  await browser.close()
})
