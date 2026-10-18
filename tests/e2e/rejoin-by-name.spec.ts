import { test, expect, type Page } from "@playwright/test";
import {
  getRoomCode,
  isVisible,
  joinPlayer,
  setFinalRoundMode,
  submitPendingAnswers,
  submitPendingVote,
} from "../helpers/e2eFlow";

test.describe.configure({ timeout: 240_000 });

async function hostPhaseText(host: Page): Promise<string> {
  return host.evaluate(
    () => document.querySelector('[data-testid="phase-indicator"]')?.textContent?.trim() ?? ""
  );
}

test("a player who drops mid-game and rejoins by name keeps playing every later round", async ({
  browser,
}) => {
  const host = await browser.newPage();
  await host.goto("/host?e2e=1");
  await setFinalRoundMode(host, "last_lash");
  const code = await getRoomCode(host);

  const aliceCtx = await browser.newContext();
  const alice = await aliceCtx.newPage();
  const bob = await browser.newPage();
  const carol = await browser.newPage();
  await joinPlayer(alice, code, "Alice");
  await joinPlayer(bob, code, "Bob");
  await joinPlayer(carol, code, "Carol");
  await expect(host.locator('[data-testid="lobby-player"]')).toHaveCount(3);

  await alice.click('[data-testid="everybodys-in-btn"]');
  await host.waitForSelector('[data-testid="host-answer-phase"]', { timeout: 15_000 });

  // Alice's phone dies before she answers anything.
  await aliceCtx.close();

  // She comes back on a fresh phone: no saved token, same name (different case).
  const newCtx = await browser.newContext();
  const alice2 = await newCtx.newPage();
  await alice2.goto(`/play/${code}?e2e=1`);
  await alice2.click('[data-testid="code-next-btn"]');
  await alice2.waitForSelector('[data-testid="join-name-step"]');
  await alice2.fill('[data-testid="player-name-input"]', "alice");
  await alice2.click('[data-testid="join-btn"]');

  // Still round 1: her original prompts are waiting for her.
  await expect(alice2.locator('[data-testid^="answer-input-"]').first()).toBeVisible({
    timeout: 5_000,
  });

  const answeredInRound = new Set<string>();
  let votedAfterRejoin = 0;
  let sawRejoinedAnswerOnTv = false;
  let scoreboardChecks = 0;
  const deadline = Date.now() + 200_000;

  while (Date.now() < deadline) {
    if (await isVisible(host, '[data-testid="podium"]')) break;
    const phase = await hostPhaseText(host);
    const round = /Round 1/.test(phase) ? "1" : /Round 2/.test(phase) ? "2" : /Final/.test(phase) ? "final" : "";

    if (await isVisible(host, '[data-testid="host-answer-phase"]')) {
      if (await submitPendingAnswers(alice2, "Rejoined Alice answer")) answeredInRound.add(round);
      await submitPendingAnswers(bob);
      await submitPendingAnswers(carol);
    }
    if (await isVisible(host, '[data-testid="host-battle-vote"]')) {
      if (await submitPendingVote(alice2)) votedAfterRejoin++;
      await submitPendingVote(bob);
      await submitPendingVote(carol);
    }
    if (await isVisible(alice2, '[data-testid="submit-vote-btn"]')) {
      // Last Lash: pick the first answer that isn't hers, then submit.
      const pick = alice2.locator('[data-testid^="lastlash-vote-"]').first();
      if (await pick.isVisible().catch(() => false)) {
        await pick.click().catch(() => {});
        await alice2.click('[data-testid="submit-vote-btn"]').catch(() => {});
        votedAfterRejoin++;
      }
    }
    if (await isVisible(host, '[data-testid="host-battle-reveal"]')) {
      const text = (await host.locator('[data-testid="host-battle-reveal"]').textContent()) ?? "";
      if (text.includes("Rejoined Alice answer")) sawRejoinedAnswerOnTv = true;
    }
    if (await isVisible(host, '[data-testid="scoreboard"]')) {
      const rows = await host.locator('[data-testid="score-row"]').allTextContents();
      scoreboardChecks++;
      expect(rows).toHaveLength(3);
      expect(rows.filter((r) => /alice/i.test(r))).toHaveLength(1);
    }
    await host.waitForTimeout(250);
  }

  await expect(host.locator('[data-testid="podium"]')).toBeVisible();

  // She wrote answers in round 1 (after rejoining), round 2 and the final.
  expect([...answeredInRound].sort()).toEqual(["1", "2", "final"]);
  expect(sawRejoinedAnswerOnTv).toBe(true);
  expect(votedAfterRejoin).toBeGreaterThan(0);

  // Every scoreboard had exactly one Alice among three players, and her phone reached the end.
  expect(scoreboardChecks).toBeGreaterThan(0);
  await expect(alice2.locator('[data-testid="play-game-over"]')).toBeVisible();

  await newCtx.close();
});
