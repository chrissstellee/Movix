import { expect, test } from "@playwright/test";

test("boots the Movix foundation and excludes starter routes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Procurement that settles/ })).toBeVisible();

  await page.goto("/foundation");
  await expect(page.getByRole("heading", { name: "Movix design foundation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Primary action" })).toBeVisible();

  for (const route of ["/todo", "/template"]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(404);
  }
});

test("foundation sample is reviewable at mobile and desktop widths", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/foundation");
  await expect(page.getByText("Pending · Funding submitted")).toBeVisible();
  await testInfo.attach("foundation-mobile", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await expect(page.getByText("No transactions yet")).toBeVisible();
  await testInfo.attach("foundation-desktop", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});
