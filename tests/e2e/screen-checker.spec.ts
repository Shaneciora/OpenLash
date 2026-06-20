import { test, expect } from "@playwright/test";

test("screen checker previews in-game scale and saves setting", async ({ page }) => {
  await page.goto("/screen-checker");
  await page.waitForSelector('[data-testid="screen-checker-page"]');

  await expect(page.locator('[data-testid="host-battle-reveal"]')).toBeVisible();
  await expect(page.locator('[data-testid="quip-a"]')).toBeVisible();
  await expect(page.locator('[data-testid="quip-b"]')).toBeVisible();

  const slider = page.locator('[data-testid="scale-slider"]');
  await slider.fill("145");
  await expect(page.locator('[data-testid="scale-percent"]')).toHaveText("145%");

  await page.click('[data-testid="scale-save-btn"]');
  await expect(page.locator('[data-testid="scale-save-btn"]')).toHaveText("Saved");

  const stored = await page.evaluate(() => localStorage.getItem("openlash_host_scale"));
  expect(stored).toBe("1.45");
});
