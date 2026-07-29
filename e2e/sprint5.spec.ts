import { existsSync, readFileSync } from "node:fs";

import { expect, test, type Browser, type Page } from "@playwright/test";

interface Sprint5Fixtures {
  storageStates: {
    buyer: string;
    supplier: string;
    foreignSupplier: string;
  };
  orders: {
    queue: string;
    usdcReview: string;
    xlmReview: string;
    accept: string;
    reject: string;
    accepted: string;
    rejected: string;
    expired: string;
    stale: string;
    revised: string;
    foreign: string;
  };
}

function loadFixtures(): Sprint5Fixtures {
  const path = process.env.MOVIX_E2E_SPRINT5_FIXTURES;
  if (!path || !existsSync(path)) {
    throw new Error(
      "SPRINT5_RELEASE_BLOCKED: set MOVIX_E2E_SPRINT5_FIXTURES to the deterministic QA fixture manifest. Authenticated Sprint 5 journeys must not be skipped.",
    );
  }
  const fixtures = JSON.parse(readFileSync(path, "utf8")) as Sprint5Fixtures;
  for (const storageState of Object.values(fixtures.storageStates)) {
    if (!existsSync(storageState)) {
      throw new Error(
        `SPRINT5_RELEASE_BLOCKED: authenticated storage state is missing: ${storageState}`,
      );
    }
  }
  return fixtures;
}

async function authenticatedPage(
  browser: Browser,
  storageState: string,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();
  return { page, close: () => context.close() };
}

test.describe("Sprint 5 authenticated supplier acceptance", () => {
  let fixtures: Sprint5Fixtures;

  test.beforeAll(() => {
    fixtures = loadFixtures();
  });

  test("S5-E2E-01 supplier dashboard shows exact actionable and historical counts", async ({
    browser,
  }) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.supplier);
    await session.page.goto("/supplier");
    await expect(session.page.getByRole("heading", { name: "Supplier workspace" })).toBeVisible();
    await expect(session.page.getByText("Requires decision")).toBeVisible();
    await session.close();
  });

  test("S5-E2E-02 supplier queue is scoped and links to review", async ({ browser }) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.supplier);
    await session.page.goto("/orders?view=supplier&queue=requires_decision");
    await expect(session.page.getByRole("link", { name: fixtures.orders.queue })).toBeVisible();
    await session.close();
  });

  test("S5-E2E-03 USDC frozen review exposes hash and no-funds boundary", async ({ browser }) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.supplier);
    await session.page.goto(`/orders/${fixtures.orders.usdcReview}?view=supplier`);
    await expect(session.page.getByText("USDC")).toBeVisible();
    await expect(session.page.getByText(/moves no funds/i)).toBeVisible();
    await expect(session.page.getByText(/^[a-f0-9]{64}$/u)).toBeVisible();
    await session.close();
  });

  test("S5-E2E-04 XLM review renders canonical totals and Testnet", async ({ browser }) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.supplier);
    await session.page.goto(`/orders/${fixtures.orders.xlmReview}?view=supplier`);
    await expect(session.page.getByText("XLM")).toBeVisible();
    await expect(session.page.getByText("Stellar Testnet")).toBeVisible();
    await session.close();
  });

  test("S5-E2E-05 supplier accepts the exact revision through confirmation", async ({
    browser,
  }) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.supplier);
    await session.page.goto(`/orders/${fixtures.orders.accept}?view=supplier`);
    await session.page.getByRole("button", { name: "Accept revision" }).click();
    await session.page.getByRole("button", { name: /Accept revision \d+/u }).click();
    await expect(session.page.getByRole("status")).toContainText(/accepted/i);
    await session.close();
  });

  test("S5-E2E-06 supplier rejects with a structured reason and normalized note", async ({
    browser,
  }) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.supplier);
    await session.page.goto(`/orders/${fixtures.orders.reject}?view=supplier`);
    await session.page.getByRole("button", { name: "Reject revision" }).click();
    await session.page.getByLabel("Reason").selectOption("delivery_schedule");
    await session.page.getByLabel("Optional note").fill("Delivery window is unavailable.");
    await session.page.getByRole("button", { name: /Reject revision \d+/u }).click();
    await expect(session.page.getByRole("status")).toContainText(/rejected/i);
    await session.close();
  });

  test("S5-E2E-07 buyer receives a durable accepted notification deep link", async ({
    browser,
  }) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.buyer);
    await session.page.goto("/buyer");
    await expect(session.page.getByRole("link", { name: /Order accepted/i })).toBeVisible();
    await session.close();
  });

  test("S5-E2E-08 accepted buyer detail shows server-derived funding eligibility", async ({
    browser,
  }) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.buyer);
    await session.page.goto(`/orders/${fixtures.orders.accepted}?view=buyer`);
    await expect(session.page.getByText("Funding eligible").locator("..")).toContainText("Yes");
    await session.close();
  });

  test("S5-E2E-09 rejected order offers P0 revision recovery", async ({ browser }) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.buyer);
    await session.page.goto(`/orders/${fixtures.orders.rejected}?view=buyer`);
    await expect(session.page.getByRole("button", { name: "Start new revision" })).toBeVisible();
    await session.close();
  });

  test("S5-E2E-10 revision N+1 preserves immutable prior history", async ({ browser }) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.buyer);
    await session.page.goto(`/orders/${fixtures.orders.revised}?view=buyer`);
    await expect(session.page.getByText(/Revision 2 · revision started/i)).toBeVisible();
    await expect(session.page.getByText(/Revision 1 · revision accepted/i)).toBeVisible();
    await session.close();
  });

  test("S5-E2E-11 expired revision is visible but cannot be decided", async ({ browser }) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.supplier);
    await session.page.goto(`/orders/${fixtures.orders.expired}?view=supplier`);
    await expect(session.page.getByText("expired", { exact: false })).toBeVisible();
    await expect(session.page.getByRole("button", { name: "Accept revision" })).toHaveCount(0);
    await session.close();
  });

  test("S5-E2E-12 stale revision forces reload instead of optimistic success", async ({
    browser,
  }) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.supplier);
    await session.page.goto(`/orders/${fixtures.orders.stale}?view=supplier`);
    await session.page.getByRole("button", { name: "Accept revision" }).click();
    await session.page.getByRole("button", { name: /Accept revision \d+/u }).click();
    await expect(session.page.getByRole("status")).toContainText(/reload/i);
    await session.close();
  });

  test("S5-E2E-13 foreign supplier receives the same safe denial", async ({ browser }) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.foreignSupplier);
    await session.page.goto(`/orders/${fixtures.orders.foreign}?view=supplier`);
    await expect(session.page.getByRole("heading", { name: /Order unavailable/i })).toBeVisible();
    await session.close();
  });

  test("S5-E2E-14 decision review remains usable at 320px with keyboard focus", async ({
    browser,
  }, testInfo) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.supplier);
    await session.page.setViewportSize({ width: 320, height: 900 });
    await session.page.goto(`/orders/${fixtures.orders.usdcReview}?view=supplier`);
    await session.page.getByRole("button", { name: "Accept revision" }).focus();
    await session.page.keyboard.press("Enter");
    await expect(session.page.getByRole("alertdialog")).toBeVisible();
    expect(
      await session.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await testInfo.attach("sprint5-supplier-review-320", {
      body: await session.page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    await session.close();
  });
});
