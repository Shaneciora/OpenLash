import { test, expect } from "@playwright/test";
import { enableBotFill, getRoomCode, joinPlayer } from "../helpers/e2eFlow";

test.describe.configure({ timeout: 60_000 });

test("auto-submits in-progress answer when prompt timer expires", async ({ browser }) => {
  const host = await browser.newPage();
  const player = await browser.newPage();

  await host.goto("/host?e2e=1&maxPlayers=3");
  await enableBotFill(host);
  const code = await getRoomCode(host);

  await joinPlayer(player, code, "Typer");

  await host.waitForSelector('[data-testid="lobby-player"]', { timeout: 10_000 });
  await player.click('[data-testid="everybodys-in-btn"]');

  const answerInput = player.locator('[data-testid^="answer-input-"]').first();
  await answerInput.waitFor({ state: "visible", timeout: 15_000 });

  const partialAnswer = "Still typing when time";
  await answerInput.fill(partialAnswer);

  await host.waitForSelector('[data-testid="host-battle-vote"]', { timeout: 15_000 });

  const quips = host.locator('[data-testid^="quip-"]');
  await expect(quips.filter({ hasText: partialAnswer })).toHaveCount(1);
});
