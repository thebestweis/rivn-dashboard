import { expect, test } from "@playwright/test";

const generatedEmail = `e2e-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2)}@example.com`;

const email = process.env.E2E_AUTH_EMAIL || generatedEmail;
const password = process.env.E2E_AUTH_PASSWORD || "RivnE2e234!";

async function fillAuthForm(page: import("@playwright/test").Page) {
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').first().fill(password);
}

async function expectDashboardReady(page: import("@playwright/test").Page) {
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
  await expect(page.locator("body")).toContainText(/RIVN|Дашборд|Dashboard/i);
}

test("registration, bootstrap, dashboard, logout and login work", async ({
  page,
}) => {
  await page.goto("/register");

  await fillAuthForm(page);
  await page.locator('input[type="password"]').nth(1).fill(password);

  await page.locator('button[type="submit"]').click();

  const dashboardReached = await page
    .waitForURL(/\/dashboard/, { timeout: 45_000 })
    .then(() => true)
    .catch(() => false);

  if (!dashboardReached) {
    const needsEmailConfirmation = await page
      .getByText(/проверь почту|подтверди email/i)
      .isVisible()
      .catch(() => false);

    test.skip(
      needsEmailConfirmation,
      "Supabase requires email confirmation, so the browser cannot finish bootstrap automatically."
    );

    const pageText = await page.locator("body").innerText();
    throw new Error(
      `Registration did not reach dashboard. Current page text: ${pageText.slice(
        0,
        1000
      )}`
    );
  }

  await expectDashboardReady(page);

  const logoutButton = page
    .locator("button")
    .filter({ hasText: /выйти|logout/i })
    .first();
  await expect(logoutButton).toBeVisible();
  await logoutButton.click();

  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });

  await fillAuthForm(page);
  await page.locator('button[type="submit"]').click();

  await expectDashboardReady(page);
});
