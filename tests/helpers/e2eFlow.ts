import type { Page } from "@playwright/test";

export async function isVisible(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).first().isVisible().catch(() => false);
}

export async function waitForPlayTransition(page: Page) {
  await page
    .waitForFunction(
      () => {
        const root = document.querySelector('[data-testid="screen-transition"]');
        if (!root) return true;
        return root.getAttribute("data-transitioning") !== "true";
      },
      { timeout: 5_000 }
    )
    .catch(() => {});
}

async function hostPhase(
  host: Page
): Promise<"podium" | "answer" | "vote" | "scores" | "other"> {
  if (await isVisible(host, '[data-testid="podium"]')) return "podium";
  if (await isVisible(host, '[data-testid="host-battle-reveal"]')) return "other";
  if (
    (await isVisible(host, '[data-testid="host-answer-phase"]')) &&
    !(await isVisible(host, '[data-testid="host-battle-vote"]'))
  ) {
    return "answer";
  }
  if (await isVisible(host, '[data-testid="host-battle-vote"]')) return "vote";
  if (await isVisible(host, '[data-testid="scoreboard"]')) return "scores";
  return "other";
}

async function activeLayerLocator(page: Page, testIdPrefix: string) {
  const enter = page.locator(
    `[data-testid="screen-transition"] .screen-transition__layer--enter [data-testid^="${testIdPrefix}"]`
  );
  if ((await enter.count()) > 0) return enter;

  const staticLayer = page.locator(
    `[data-testid="screen-transition"] .screen-transition__layer--static [data-testid^="${testIdPrefix}"]`
  );
  if ((await staticLayer.count()) > 0) return staticLayer;

  return page.locator(`[data-testid^="${testIdPrefix}"]`);
}

export async function submitPendingAnswers(page: Page, label = "E2E answer") {
  await waitForPlayTransition(page);

  const inputs = await activeLayerLocator(page, "answer-input-");
  const inputCount = await inputs.count();
  if (inputCount === 0) return false;
  if (!(await inputs.first().isVisible().catch(() => false))) return false;

  const submit = (await activeLayerLocator(page, "submit-answers-btn")).last();
  if (!(await submit.isVisible().catch(() => false))) return false;

  // Fill first: a single-prompt Submit stays disabled until its box has text.
  for (let i = 0; i < inputCount; i++) {
    await inputs.nth(i).fill(`${label}-${i}`);
  }
  if (!(await submit.isEnabled().catch(() => false))) return false;
  await submit.click();
  await page.waitForTimeout(150);
  return true;
}

export async function submitPendingVote(page: Page) {
  await waitForPlayTransition(page);

  if (await isVisible(page, '[data-testid="play-waiting"]')) return false;
  if (await isVisible(page, '[data-testid="vote-submitted"]')) return false;
  if (await isVisible(page, '[data-testid="cannot-vote-own"]')) return false;

  const voteA = page.locator(
    '[data-testid="screen-transition"] .screen-transition__layer--static [data-testid="vote-a-btn"], [data-testid="screen-transition"] .screen-transition__layer--enter [data-testid="vote-a-btn"], [data-testid="vote-a-btn"]'
  ).last();
  if (!(await voteA.isVisible().catch(() => false))) return false;
  if (!(await voteA.isEnabled().catch(() => false))) return false;

  try {
    await voteA.click({ timeout: 2_000 });
    await page.waitForTimeout(150);
    return true;
  } catch {
    return false;
  }
}

export async function drivePlayersToPodium(
  host: Page,
  playerPages: Page[],
  timeoutMs = 180_000
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const phase = await hostPhase(host);
    if (phase === "podium") return;

    if (phase === "answer") {
      for (const page of playerPages) {
        await submitPendingAnswers(page);
      }
    }

    if (phase === "vote") {
      for (const page of playerPages) {
        await submitPendingVote(page);
      }
    }

    await host.waitForTimeout(300);
  }

  throw new Error("Timed out waiting for podium");
}

export async function enableBotFill(host: Page) {
  await setBotTestLobby(host, "max");
}

const BOT_MODE_TEST_IDS: Record<
  "max" | "lobby_3" | "lobby_7" | "lobby_full",
  string
> = {
  max: "max",
  lobby_3: "lobby-3",
  lobby_7: "lobby-7",
  lobby_full: "lobby-full",
};

export async function setBotTestLobby(
  host: Page,
  mode: "max" | "lobby_3" | "lobby_7" | "lobby_full"
) {
  const panel = host.locator('[data-testid="host-settings-panel"]');
  await panel.waitFor({ state: "visible", timeout: 15_000 });
  await panel.scrollIntoViewIfNeeded();

  const testId = BOT_MODE_TEST_IDS[mode];
  const toggle = host.locator(`[data-testid="bot-mode-${testId}-toggle"]`);
  if (!(await toggle.isChecked())) {
    await host.locator(`[data-testid="bot-mode-${testId}-setting"]`).click({ force: true });
  }
  await host.waitForTimeout(300);
}

export async function getRoomCode(host: Page): Promise<string> {
  await host.waitForSelector('[data-testid="room-code"]', { timeout: 15_000 });
  const code = (await host.locator('[data-testid="room-code"]').textContent())?.trim();
  if (!code || code.length !== 4) {
    throw new Error(`Invalid room code: ${code}`);
  }
  return code;
}

export async function joinPlayer(page: Page, code: string, name: string, password?: string) {
  await page.goto(`/play/${code}?e2e=1`);
  await page.click('[data-testid="code-next-btn"]');
  if (password) {
    await page.waitForSelector('[data-testid="join-password-step"]');
    await page.fill('[data-testid="password-input"]', password);
    await page.click('[data-testid="password-next-btn"]');
  }
  await page.waitForSelector('[data-testid="join-name-step"]');
  await page.fill('[data-testid="player-name-input"]', name);
  await page.click('[data-testid="join-btn"]');
  await page.waitForSelector('[data-testid="lobby-player-list"]', { timeout: 10_000 });
}

export async function setFinalRoundMode(host: Page, mode: "thriplash" | "last_lash") {
  await host.locator('[data-testid="final-round-select"]').waitFor({
    state: "visible",
    timeout: 15_000,
  });
  await host.selectOption('[data-testid="final-round-select"]', mode);
}

export async function answerAllVisiblePrompts(page: Page, label = "E2E answer") {
  for (let i = 0; i < 6; i++) {
    const submitted = await submitPendingAnswers(page, `${label}-${i}`);
    if (!submitted) break;
    if (await isVisible(page, '[data-testid="answer-submitted"]')) break;
    await page.waitForTimeout(200);
  }
}

export async function driveRound1Voting(
  host: Page,
  player: Page,
  timeoutMs = 90_000
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let votesSubmitted = 0;
  const handledBattles = new Set<string>();

  while (Date.now() < deadline) {
    if (await isVisible(host, '[data-testid="scoreboard"]')) {
      return votesSubmitted;
    }

    if (await isVisible(host, '[data-testid="host-answer-phase"]')) {
      await answerAllVisiblePrompts(player);
    }

    if (
      (await isVisible(host, '[data-testid="host-battle-vote"]')) &&
      !(await isVisible(host, '[data-testid="host-battle-reveal"]'))
    ) {
      const battleProgress =
        (
          await host
            .locator('[data-testid="host-battle-vote"] [data-testid="battle-progress"]')
            .textContent()
        )?.trim() ?? "";
      if (!battleProgress || handledBattles.has(battleProgress)) {
        await host.waitForTimeout(250);
        continue;
      }
      handledBattles.add(battleProgress);

      await waitForPlayTransition(player);
      await player.waitForSelector(
        '[data-testid="cannot-vote-own"], [data-testid="vote-a-btn"]',
        { timeout: 5_000 }
      );

      if (await isVisible(player, '[data-testid="cannot-vote-own"]')) {
        continue;
      }

      const voted = await submitPendingVote(player);
      if (!voted) {
        throw new Error("Expected human to submit vote when vote buttons are visible");
      }

      const voteRegistered = await Promise.race([
        player
          .waitForSelector('[data-testid="vote-submitted"]', { timeout: 3_000 })
          .then(() => true),
        host
          .waitForSelector('[data-testid="host-battle-reveal"]', { timeout: 5_000 })
          .then(() => true),
        host.waitForSelector('[data-testid="scoreboard"]', { timeout: 5_000 }).then(() => true),
        host
          .waitForFunction(
            (prev) => {
              const el = document.querySelector('[data-testid="battle-progress"]');
              return (el?.textContent?.trim() ?? "") !== prev;
            },
            battleProgress,
            { timeout: 5_000 }
          )
          .then(() => true),
      ]).catch(() => false);

      if (!voteRegistered) {
        throw new Error("Vote click did not register on host or player");
      }

      votesSubmitted++;
      continue;
    }

    await host.waitForTimeout(250);
  }

  throw new Error("Timed out waiting for round 1 scoreboard");
}
