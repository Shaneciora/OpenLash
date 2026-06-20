import { test, expect } from "@playwright/test";
import {
  answerAllVisiblePrompts,
  driveRound1Voting,
  getRoomCode,
  joinPlayer,
  setBotTestLobby,
} from "../helpers/e2eFlow";

test.describe.configure({ timeout: 120_000 });

test("bot-fill solo human votes when eligible in round 1", async ({ browser }) => {
  const host = await browser.newPage();
  const player = await browser.newPage();

  await host.goto("/host?e2e=1&maxPlayers=8");
  const code = await getRoomCode(host);

  await joinPlayer(player, code, "Solo");
  await setBotTestLobby(host, "lobby_7");

  await host.waitForSelector('[data-testid="lobby-player"]', { timeout: 10_000 });
  expect(await host.locator('[data-testid="lobby-player"]').count()).toBe(7);

  await player.click('[data-testid="everybodys-in-btn"]');
  await host.waitForSelector('[data-testid="host-answer-phase"]', { timeout: 15_000 });
  await answerAllVisiblePrompts(player);
  await host.waitForSelector('[data-testid="host-battle-vote"]', { timeout: 15_000 });

  const votesSubmitted = await driveRound1Voting(host, player);
  expect(votesSubmitted).toBeGreaterThanOrEqual(1);

  await expect(host.locator('[data-testid="scoreboard"]')).toBeVisible();
});
