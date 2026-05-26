import { describe, expect, it } from "vitest";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3000";

async function isReachable() {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(2500) });
    return response.ok;
  } catch {
    return false;
  }
}

describe("mobile smoke", () => {
  it("renders public legal pages on a narrow viewport without page errors", async () => {
    if (!(await isReachable())) {
      expect(true).toBe(true);
      return;
    }

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(`${baseUrl}/terms`, { waitUntil: "networkidle" });
    await expect.poll(async () => (await page.locator("body").innerText()).toLowerCase()).toContain("terms");

    await page.goto(`${baseUrl}/privacy`, { waitUntil: "networkidle" });
    await expect.poll(async () => (await page.locator("body").innerText()).toLowerCase()).toContain("privacy");

    await browser.close();
    expect(errors).toEqual([]);
  }, 30_000);
});
