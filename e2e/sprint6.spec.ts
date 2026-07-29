import { existsSync, readFileSync } from "node:fs";

import { expect, test, type Browser, type Page } from "@playwright/test";

interface Sprint6Fixtures {
  storageStates: {
    importer: string;
    exporter: string;
    foreignOrganization: string;
  };
  invitations: {
    issuedToken: string;
  };
  tradeOrders: {
    v2Review: string;
    revisedAwaitingAcceptance: string;
    documentPendingScan: string;
    foreign: string;
  };
}

function loadFixtures(): Sprint6Fixtures {
  const path = process.env.MOVIX_E2E_SPRINT6_FIXTURES;
  if (!path || !existsSync(path)) {
    throw new Error(
      "SPRINT6_RELEASE_BLOCKED: set MOVIX_E2E_SPRINT6_FIXTURES to the deterministic two-organization QA fixture manifest. Authenticated Sprint 6 journeys must not be skipped.",
    );
  }
  const fixtures = JSON.parse(readFileSync(path, "utf8")) as Sprint6Fixtures;
  for (const storageState of Object.values(fixtures.storageStates)) {
    if (!existsSync(storageState)) {
      throw new Error(
        `SPRINT6_RELEASE_BLOCKED: authenticated storage state is missing: ${storageState}`,
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
  return { page: await context.newPage(), close: () => context.close() };
}

test.describe("Sprint 6 ASEAN agricultural trade pivot", () => {
  let fixtures: Sprint6Fixtures;

  test.beforeAll(() => {
    fixtures = loadFixtures();
  });

  test("S6-E2E-01 canonical role and Trade Order aliases preserve deep links", async ({
    browser,
  }) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.importer);
    await session.page.goto("/importer");
    await expect(session.page).toHaveURL(/\/buyer$/u);
    await session.page.goto("/trade-orders");
    await expect(session.page).toHaveURL(/\/orders$/u);
    await session.close();
  });

  test("S6-E2E-02 both authenticated organizations expose verified status", async ({ browser }) => {
    for (const storageState of [fixtures.storageStates.importer, fixtures.storageStates.exporter]) {
      const session = await authenticatedPage(browser, storageState);
      await session.page.goto("/settings/business");
      await session.page.getByRole("tab", { name: "Verification" }).click();
      await expect(session.page.getByText("Verified", { exact: true })).toBeVisible();
      await session.close();
    }
  });

  test("S6-E2E-03 intended Exporter can accept one single-use invitation", async ({ browser }) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.exporter);
    await session.page.goto(
      `/invitations/exporter?token=${encodeURIComponent(fixtures.invitations.issuedToken)}`,
    );
    await session.page.getByRole("button", { name: "Accept as this verified Exporter" }).click();
    await expect(session.page.getByRole("status")).toContainText(/authorized counterparty/i);
    await session.close();
  });

  test("S6-E2E-04 exact v2 agricultural terms are visible before acceptance", async ({
    browser,
  }) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.exporter);
    await session.page.goto(`/orders/${fixtures.tradeOrders.v2Review}?view=supplier`);
    await expect(session.page.getByText("order-terms-v2")).toBeVisible();
    await expect(session.page.getByText("Destination country").locator("..")).not.toContainText(
      "Not set",
    );
    await expect(session.page.getByText("Incoterm").locator("..")).not.toContainText("Not set");
    await expect(session.page.getByRole("button", { name: "Accept revision" })).toBeVisible();
    await session.close();
  });

  test("S6-E2E-05 material revision requires exact Exporter re-acceptance", async ({ browser }) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.exporter);
    await session.page.goto(
      `/orders/${fixtures.tradeOrders.revisedAwaitingAcceptance}?view=supplier`,
    );
    await expect(session.page.getByText(/Revision 1 · revision accepted/i)).toBeVisible();
    await expect(session.page.getByText(/Revision 2 · revision started/i)).toBeVisible();
    await expect(session.page.getByText("Funding eligible").locator("..")).toContainText("No");
    await expect(session.page.getByRole("button", { name: "Accept revision" })).toBeVisible();
    await session.close();
  });

  test("S6-E2E-06 agreement, escrow, shipment, and documents stay independent", async ({
    browser,
  }) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.importer);
    await session.page.goto(`/orders/${fixtures.tradeOrders.v2Review}?view=buyer`);
    await expect(session.page.getByLabel("Independent trade states")).toContainText(
      "Trade Agreement",
    );
    await expect(session.page.getByLabel("Independent trade states")).toContainText("Escrow");
    await expect(session.page.getByLabel("Independent trade states")).toContainText(
      "Shipment Status",
    );
    await expect(session.page.getByLabel("Independent trade states")).toContainText(
      "Trade Documents",
    );
    await session.close();
  });

  test("S6-E2E-07 pending-scan Trade Document remains unavailable", async ({ browser }) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.importer);
    await session.page.goto(`/orders/${fixtures.tradeOrders.documentPendingScan}?view=buyer`);
    await expect(session.page.getByLabel("Trade documents")).toContainText("pending");
    await expect(session.page.getByRole("link", { name: /download/i })).toHaveCount(0);
    await session.close();
  });

  test("S6-E2E-08 foreign organization receives the same safe denial", async ({ browser }) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.foreignOrganization);
    await session.page.goto(`/orders/${fixtures.tradeOrders.foreign}`);
    await expect(session.page.getByRole("heading", { name: /Order unavailable/i })).toBeVisible();
    await session.close();
  });

  test("S6-E2E-09 review remains keyboard-usable at 320px", async ({ browser }, testInfo) => {
    const session = await authenticatedPage(browser, fixtures.storageStates.exporter);
    await session.page.setViewportSize({ width: 320, height: 900 });
    await session.page.goto(`/orders/${fixtures.tradeOrders.v2Review}?view=supplier`);
    await session.page.getByRole("button", { name: "Accept revision" }).focus();
    await session.page.keyboard.press("Enter");
    await expect(session.page.getByRole("alertdialog")).toBeVisible();
    expect(
      await session.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await testInfo.attach("sprint6-exporter-review-320", {
      body: await session.page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    await session.close();
  });
});
