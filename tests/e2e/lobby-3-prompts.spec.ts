import { test, expect } from "@playwright/test";
import {
  getRoomCode,
  joinPlayer,
  setBotTestLobby,
} from "../helpers/e2eFlow";

test("lobby_3 human sees prompts and thinking status at round 1 start", async ({
  browser,
}) => {
  const host = await browser.newPage();
  const player = await browser.newPage();

  await host.goto("/host?e2e=1");
  const code = await getRoomCode(host);

  await joinPlayer(player, code, "Shane");
  await setBotTestLobby(host, "lobby_3");

  await host.waitForSelector('[data-testid="lobby-player"]');
  expect(await host.locator('[data-testid="lobby-player"]').count()).toBe(3);

  await player.click('[data-testid="everybodys-in-btn"]');
  await host.waitForSelector('[data-testid="host-answer-phase"]', { timeout: 15_000 });

  await expect(player.locator('[data-testid="answer-submitted"]')).not.toBeVisible();
  await expect(player.locator('[data-testid^="answer-input-"]').first()).toBeVisible();

  const shaneThinking = host
    .locator('[data-testid="host-answer-player"]')
    .filter({ hasText: "Shane" })
    .locator('[data-testid="host-answer-thinking"]');
  await expect(shaneThinking).toBeVisible();
  const label = shaneThinking.locator(".host-answer-status-label--thinking");
  await expect(label).toBeVisible();
  await expect(label).not.toHaveText("");
  const textWidth = await label.evaluate((el) => el.getBoundingClientRect().width);
  expect(textWidth).toBeGreaterThan(10);
});
