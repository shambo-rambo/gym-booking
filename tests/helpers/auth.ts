import { type Page } from "@playwright/test"

export async function loginAs(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/login")
  await page.fill("#email", email)
  await page.fill("#password", password)
  await page.click('button[type="submit"]')
  await page.waitForURL("/", { timeout: 15_000 })
}

export async function logout(page: Page): Promise<void> {
  await page.goto("/api/auth/signout")
  const signOutButton = page.getByRole("button", { name: /sign out/i })
  if (await signOutButton.isVisible()) {
    await signOutButton.click()
    await page.waitForURL("/login", { timeout: 10_000 })
  }
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies()
  return cookies.some((c) => c.name === "authjs.session-token")
}
