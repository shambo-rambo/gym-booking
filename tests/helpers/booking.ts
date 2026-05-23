import { type Page, expect } from "@playwright/test"

/**
 * Clicks the first available (not disabled) time-slot button in the
 * BookingCalendar, then returns.
 *
 * The calendar fetches availability from /api/bookings/availability.
 * Until that response arrives, all slot buttons render as disabled
 * (slot=undefined → disabled={!slot}=true) even though they show
 * "Available" text. We wait for the API response first, then look for
 * the first enabled button.
 */
export async function clickFirstAvailableSlot(page: Page): Promise<void> {
  // Wait for the availability API to respond — this populates slot data
  // and turns the relevant buttons from disabled → enabled.
  await page.waitForResponse(
    (resp) =>
      resp.url().includes("/api/bookings/availability") && resp.status() === 200,
    { timeout: 20_000 }
  )

  // Brief tick to let React re-render with the new data
  await page.waitForTimeout(300)

  // Find the first enabled time-slot button. Available slots are non-disabled
  // buttons whose text content includes a HH:MM time string.
  const slot = page
    .locator("button:not([disabled])")
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
