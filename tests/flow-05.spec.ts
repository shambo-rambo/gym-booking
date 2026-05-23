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
  await pageA.waitForSelector("button.bg-green-50", { timeout: 15_000 })
  await pageA.locator("button.bg-green-50").first().click()

  const dialogA = pageA.getByRole("dialog")
  await expect(dialogA).toBeVisible()
  await dialogA.getByRole("button", { name: "Confirm Booking" }).click()
  await expect(dialogA.getByText(/confirmed|booked|success/i)).toBeVisible({ timeout: 10_000 })

  // Capture which slot was booked (date + time shown in the dialog header)
  const slotText = await dialogA.locator("h2, h3, [role='heading']").first().textContent()

  const closeBtnA = dialogA.getByRole("button", { name: /close/i })
  if (await closeBtnA.isVisible()) await closeBtnA.click()

  // Context B: userB tries to book the same slot
  const ctxB = await browser.newContext({ baseURL: BASE_URL })
  const pageB = await ctxB.newPage()
  await loginAs(pageB, USERS.userB.email, USERS.userB.password)

  await pageB.goto("/book")
  await pageB.getByRole("button", { name: "Private Sauna" }).click()
  await pageB.waitForSelector("button", { timeout: 15_000 })

  // Find the slot that userA just booked — it may now show as unavailable/full
  // We look for a slot button that contains a queue indicator or is styled differently
  // Click the first non-green slot (booked/full) or look for the waitlist button
  const bookedSlot = pageB.locator("button.bg-red-50, button.bg-orange-50, button.bg-amber-50, button.bg-gray-100").first()
  if (await bookedSlot.isVisible({ timeout: 5_000 })) {
    await bookedSlot.click()
  } else {
    // Slot may still show as partial — click first slot and see if waitlist option appears
    await pageB.locator("button.bg-green-50, button[class*='slot']").first().click()
  }

  const dialogB = pageB.getByRole("dialog")
  await expect(dialogB).toBeVisible()

  // Should see "Join Waitlist" or "Join Queue" button (slot is full for EXCLUSIVE)
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
