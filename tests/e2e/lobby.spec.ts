import { test, expect } from "@playwright/test";
import { joinPlayer } from "../helpers/e2eFlow";

test("host lobby defaults to Party Pack collection", async ({ browser }) => {
  const host = await browser.newPage();
  await host.goto("/host?e2e=1");
  await host.waitForSelector('[data-testid="collection-select"]', { timeout: 15000 });
  const selected = await host
    .locator('[data-testid="collection-select"] option:checked')
    .textContent();
  expect(selected).toContain("Party Pack");
  expect(selected).toMatch(/[0-9]+ prompts/);
});

test("lobby join flow", async ({ browser }) => {
  const host = await browser.newPage();
  const player = await browser.newPage();

  await host.goto("/host?e2e=1");
  await host.waitForSelector('[data-testid="room-code"]', { timeout: 15000 });
  const code = await host.locator('[data-testid="room-code"]').textContent();
  expect(code?.trim()).toHaveLength(4);

  await player.goto(`/play/${code?.trim()}?e2e=1`);
  await player.click('[data-testid="code-next-btn"]');
  await player.waitForSelector('[data-testid="join-name-step"]');
  await player.fill('[data-testid="player-name-input"]', "TestPlayer");
  await player.click('[data-testid="join-btn"]');

  await host.waitForSelector('[data-testid="lobby-player"]', { timeout: 10000 });
  const players = await host.locator('[data-testid="lobby-player"]').count();
  expect(players).toBeGreaterThanOrEqual(1);
});

test("three players start game", async ({ browser }) => {
  const host = await browser.newPage();
  const p1 = await browser.newPage();
  const p2 = await browser.newPage();
  const p3 = await browser.newPage();

  await host.goto("/host?e2e=1");
  await host.waitForSelector('[data-testid="room-code"]', { timeout: 15000 });
  const code = (await host.locator('[data-testid="room-code"]').textContent())?.trim()!;

  for (const [page, name] of [[p1, "Alice"], [p2, "Bob"], [p3, "Carol"]] as const) {
    await page.goto(`/play/${code}?e2e=1`);
    await page.click('[data-testid="code-next-btn"]');
    await page.waitForSelector('[data-testid="join-name-step"]');
    await page.fill('[data-testid="player-name-input"]', name);
    await page.click('[data-testid="join-btn"]');
    await page.waitForSelector('[data-testid="lobby-player-list"]');
  }

  await host.waitForSelector('[data-testid="lobby-player"]', { timeout: 10000 });
  expect(await host.locator('[data-testid="lobby-player"]').count()).toBe(3);

  await p1.click('[data-testid="everybodys-in-btn"]');
  await p1.waitForSelector('[data-testid="answer-input-0"], [data-testid^="answer-input-"]', {
    timeout: 15000,
  }).catch(() => p1.waitForSelector('[data-testid="answer-submitted"]', { timeout: 15000 }));
});

test("lobby leave removes player and promotes next VIP", async ({ browser }) => {
  const host = await browser.newPage();
  const vip = await browser.newPage();
  const player = await browser.newPage();

  await host.goto("/host?e2e=1");
  await host.waitForSelector('[data-testid="room-code"]', { timeout: 15000 });
  const code = (await host.locator('[data-testid="room-code"]').textContent())?.trim()!;

  await joinPlayer(vip, code, "VIP");
  await joinPlayer(player, code, "NextUp");

  await expect(vip.locator('[data-testid="everybodys-in-btn"]')).toBeVisible();
  await expect(player.locator('[data-testid="everybodys-in-btn"]')).not.toBeVisible();

  await vip.click('[data-testid="leave-btn"]');
  await expect(vip.locator('[data-testid="join-code-step"]')).toBeVisible();

  await expect(host.locator('[data-testid="lobby-player"]')).toHaveCount(1);
  await expect(host.locator('[data-testid="lobby-player"]')).toHaveText(/NextUp/);
  await expect(player.locator('[data-testid="everybodys-in-btn"]')).toBeVisible();
});

test("host kick removes player and promotes next VIP", async ({ browser }) => {
  const host = await browser.newPage();
  const vip = await browser.newPage();
  const player = await browser.newPage();

  await host.goto("/host?e2e=1");
  await host.waitForSelector('[data-testid="room-code"]', { timeout: 15000 });
  const code = (await host.locator('[data-testid="room-code"]').textContent())?.trim()!;

  await joinPlayer(vip, code, "VIP");
  await joinPlayer(player, code, "NextUp");

  await expect(host.locator('[data-testid="lobby-player"]')).toHaveCount(2);
  await expect(vip.locator('[data-testid="everybodys-in-btn"]')).toBeVisible();
  await expect(player.locator('[data-testid="everybodys-in-btn"]')).not.toBeVisible();

  await host.locator('[data-testid="lobby-player"]:has-text("VIP") [data-testid="kick-player-btn"]').click();

  await expect(vip.locator('[data-testid="join-code-step"]')).toBeVisible();
  await expect(host.locator('[data-testid="lobby-player"]')).toHaveCount(1);
  await expect(host.locator('[data-testid="lobby-player"]')).toHaveText(/NextUp/);
  await expect(player.locator('[data-testid="everybodys-in-btn"]')).toBeVisible();
});

test("host refresh sends players back to join screen", async ({ browser }) => {
  const host = await browser.newPage();
  const player = await browser.newPage();

  await host.goto("/host?e2e=1");
  await host.waitForSelector('[data-testid="room-code"]', { timeout: 15000 });
  const oldCode = (await host.locator('[data-testid="room-code"]').textContent())?.trim()!;

  await joinPlayer(player, oldCode, "Shane");
  await expect(player.locator('[data-testid="lobby-player-list"]')).toBeVisible();
  await expect(player.locator(".play-lobby-meta")).toContainText(oldCode);

  await host.click('[data-testid="host-back-link"]');
  await host.waitForURL("/");

  await host.click('[data-testid="play-game-btn"]');
  await host.waitForSelector('[data-testid="room-code"]', { timeout: 15000 });
  const newCode = (await host.locator('[data-testid="room-code"]').textContent())?.trim()!;
  expect(newCode).not.toBe(oldCode);

  await expect(player.locator('[data-testid="join-code-step"]')).toBeVisible({ timeout: 10000 });
  await expect(player.locator('[data-testid="join-error"]')).toContainText("no longer active");
});
