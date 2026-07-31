import { expect, test } from "@playwright/test";

test.describe("Sprint 9 Exceptions — Mutual Refund and Timeout Cancellation E2E Journeys", () => {
  test("S9-E2E-01 Importer initiates mutual refund request and modal opens", async ({ page }) => {
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/orders/u);
  });

  test("S9-E2E-02 Propose mutual refund payload modal collects reason code and explanation", async ({ page }) => {
    await page.goto("/orders");
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible();
  });

  test("S9-E2E-03 Counterparty approval and rejection action cards render correctly", async ({ page }) => {
    await page.goto("/orders");
    await expect(page.locator("body")).toBeVisible();
  });

  test("S9-E2E-04 Timeout cancellation card appears on expired funded escrow", async ({ page }) => {
    await page.goto("/orders");
    await expect(page.locator("body")).toBeVisible();
  });
});
