import { test, expect } from "@playwright/test";
import {
  drivePlayersToPodium,
  getRoomCode,
  joinPlayer,
  setFinalRoundMode,
} from "../helpers/e2eFlow";

test.describe.configure({ timeout: 180_000 });

test("three players complete full game to podium", async ({ browser }) => {
  const host = await browser.newPage();
  const p1 = await browser.newPage();
  const p2 = await browser.newPage();
  const p3 = await browser.newPage();

  await host.goto("/host?e2e=1");
  await setFinalRoundMode(host, "last_lash");
  const code = await getRoomCode(host);

  await joinPlayer(p1, code, "Alice");
  await joinPlayer(p2, code, "Bob");
  await joinPlayer(p3, code, "Carol");

  await host.waitForSelector('[data-testid="lobby-player"]', { timeout: 10_000 });
  expect(await host.locator('[data-testid="lobby-player"]').count()).toBe(3);

  await p1.click('[data-testid="everybodys-in-btn"]');
  await host.waitForSelector('[data-testid="host-answer-phase"]', { timeout: 15_000 });

  await drivePlayersToPodium(host, [p1, p2, p3]);

  await expect(host.locator('[data-testid="podium"]')).toBeVisible();
  await expect(host.locator('[data-testid="winner-name"]')).not.toBeEmpty();
  await expect(host.locator('[data-testid="play-again-btn"]')).toBeVisible();

  await expect(p1.locator('[data-testid="play-game-over"]')).toBeVisible();
  await expect(p1.locator('[data-testid="play-winner-name"]')).not.toBeEmpty();
  await expect(p1.locator('[data-testid="play-again-btn"]')).toBeVisible();
  await expect(p2.locator('[data-testid="play-game-over"]')).toBeVisible();
  await expect(p2.locator('[data-testid="play-again-btn"]')).toHaveCount(0);
  await expect(p2.locator('[data-testid="play-again-waiting"]')).toBeVisible();
  await expect(p2.locator('[data-testid="leave-btn"]')).toBeVisible();

  await p2.click('[data-testid="leave-btn"]');
  await expect(p2.locator('[data-testid="join-code-step"]')).toBeVisible();
  await expect(p2.locator('[data-testid="room-code-input"]')).toHaveValue("");
});
