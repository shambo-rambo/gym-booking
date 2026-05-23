import { type Page, expect } from "@playwright/test"

/**
 * Clicks the first available (not disabled) time-slot button in the
 * BookingCalendar, then returns the dialog locator.
 *
 * The calendar renders a grid of card-style buttons. Available slots are
 * enabled buttons whose visible text includes a HH:MM time string.
 * We wait for the loading skeleton to clear first.
 */
export async function clickFirstAvailableSlot(page: Page): Promise<void> {
  // Wait for the loading skeleton to clear
  await page.waitForFunction(
    () => document.querySelectorAll(".animate-pulse").length === 0,
    { timeout: 15_000 }
  )

  // Find an enabled time-slot button. The BookingCalendar renders available
  // slots as non-disabled buttons with a time label inside (e.g. "10:00").
  const slot = page
    .locator('button:not([disabled])')
    .filter({ hasText: /\b\d{1,2}:\d{2}\b/ })
    .first()

  await expect(slot).toBeVisible({ timeout: 10_000 })
  await slot.click()
}

/**
 * Books a slot and confirms the booking dialog.
 * Assumes the page is already on /book with a mode already selected.
 */
export async function bookSlotAndConfirm(page: Page): Promise<void> {
  await clickFirstAvailableSlot(page)

  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "Confirm Booking" }).click()
  await expect(dialog.getByText(/confirmed|booked|success/i)).toBeVisible({ timeout: 10_000 })

  const closeBtn = dialog.getByRole("button", { name: /close/i })
  if (await closeBtn.isVisible()) await closeBtn.click()
}
