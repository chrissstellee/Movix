import { defineConfig, devices } from "@playwright/test";

const port = 3000;
const localBaseURL = `http://127.0.0.1:${port}`;
const baseURL = process.env.MOVIX_E2E_BASE_URL ?? localBaseURL;
const useExternalDeployment = Boolean(process.env.MOVIX_E2E_BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: useExternalDeployment
    ? undefined
    : {
        command: "pnpm --filter web dev",
        url: localBaseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          NEXT_PUBLIC_CONVEX_URL:
            process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://example.convex.cloud",
          MOVIX_ENABLE_FOUNDATION_SAMPLE: "1",
        },
      },
});
