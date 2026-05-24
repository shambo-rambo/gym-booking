import { type Page, expect } from "@playwright/test"

/**
 * Clicks tomorrow's date in the BookingCalendar mini-calendar (rounded-lg day cells).
 * Navigating to tomorrow ensures all slots are well outside the 30-min
 * cancellation window regardless of what time the test runs.
 * Also waits for the availability API to respond before returning.
 */
export async function selectTomorrow(page: Page): Promise<void> {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowDay = tomorrow.getDate()
  // Build date string from local parts — toISOString() converts to UTC and gives the
  // wrong date in Australian timezones when the local time is past UTC midnight.
  const year = tomorrow.getFullYear()
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0")
  const dayPart = String(tomorrow.getDate()).padStart(2, "0")
  const tomorrowDateStr = `${year}-${month}-${dayPart}`

  // Set up the API wait BEFORE clicking; match tomorrow's date to avoid false-resolving
  // on a concurrent mode-change availability fetch for today's date.
  const availabilityDone = page.waitForResponse(
    (resp) =>
      resp.url().includes("/api/bookings/availability") &&
      resp.url().includes(tomorrowDateStr) &&
      resp.status() === 200,
    { timeout: 20_000 }
  )

  // Mini-calendar day cells use rounded-lg. Using a Playwright locator (not evaluate)
  // so a missing button throws immediately rather than silently doing nothing.
  await page
    .locator("button.rounded-lg")
    .filter({ hasText: new RegExp(`^${tomorrowDay}$`) })
    .click()

  await availabilityDone
}

/**
 * Clicks the first available slot on tomorrow's date.
 * Slot cards uniquely have `rounded-xl text-left` (day-picker row uses rounded-xl
 * but not text-left; mini-calendar uses rounded-lg).
 */
export async function clickFirstAvailableSlot(page: Page): Promise<void> {
  await selectTomorrow(page)

  // Slot cards: rounded-xl + text-left. Only enabled (non-disabled) ones are bookable.
  await page
    .locator("button.rounded-xl.text-left:not([disabled])")
    .first()
    .click()
}

/**
 * Books a slot (tomorrow) and waits for the dialog to auto-close.
 * handleBook() calls onClose() on success with no intermediate success text.
 */
export async function bookSlotAndConfirm(page: Page): Promise<void> {
  await clickFirstAvailableSlot(page)

  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "Confirm Booking" }).click()

  // handleBook() calls onClose() immediately — no success text shown
  await expect(dialog).not.toBeVisible({ timeout: 10_000 })
}

/**
 * Extracts HH:MM from an open dialog's text content.
 * Call this BEFORE confirming the booking so the dialog is still open.
 */
export async function getDialogSlotTime(dialog: ReturnType<Page["getByRole"]>): Promise<string | null> {
  return dialog.evaluate((el) => {
    const m = (el.textContent ?? "").match(/\d{2}:\d{2}/)
    return m ? m[0] : null
  })
}
