import { test, expect } from "@playwright/test";

async function createHostLobby(browser: import("@playwright/test").Browser) {
  const host = await browser.newPage();
  await host.goto("/host?e2e=1");
  await host.waitForSelector('[data-testid="room-code"]', { timeout: 15000 });
  const code = (await host.locator('[data-testid="room-code"]').textContent())?.trim()!;
  expect(code).toHaveLength(4);
  return { host, code };
}

async function advanceToNameStep(player: import("@playwright/test").Page) {
  await player.click('[data-testid="code-next-btn"]');
  await player.waitForSelector('[data-testid="join-name-step"]');
}

test("next button opens avatar step", async ({ browser }) => {
  const { code } = await createHostLobby(browser);
  const player = await browser.newPage();

  await player.goto(`/play/${code}`);
  await advanceToNameStep(player);
  await player.fill('[data-testid="player-name-input"]', "Drawer");
  await player.click('[data-testid="join-next-btn"]');

  await expect(player.locator('[data-testid="avatar-step"]')).toBeVisible();
  await expect(player.locator('[data-testid="avatar-draw"]')).toBeVisible();
  await expect(player.locator('[data-testid="avatar-thickness-slider"]')).toBeVisible();
  await expect(player.locator('[data-testid="avatar-photo-bg-btn"]')).toBeVisible();
  await expect(player.locator('[data-testid="join-next-btn"]')).not.toBeVisible();
});

test("photo background capture sets avatar background", async ({ browser }) => {
  const { host, code } = await createHostLobby(browser);
  const player = await browser.newPage();

  await player.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (constraints && "video" in constraints) {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 320;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#2244aa";
          ctx.fillRect(0, 0, 320, 320);
        }
        return canvas.captureStream();
      }
      return original(constraints);
    };
  });

  await player.goto(`/play/${code}`);
  await advanceToNameStep(player);
  await player.fill('[data-testid="player-name-input"]', "Selfie");
  await player.click('[data-testid="join-next-btn"]');
  await expect(player.locator('[data-testid="avatar-step"]')).toBeVisible();

  await player.click('[data-testid="avatar-photo-bg-btn"]');
  await expect(player.locator('[data-testid="avatar-photo-overlay"]')).toBeVisible();
  await player.waitForSelector('[data-testid="avatar-photo-capture-btn"]:not([disabled])', {
    timeout: 10000,
  });
  await player.click('[data-testid="avatar-photo-capture-btn"]');
  await expect(player.locator('[data-testid="avatar-photo-overlay"]')).not.toBeVisible();

  await player.click('[data-testid="save-avatar-btn"]');
  await player.waitForSelector('[data-testid="lobby-player-list"]', { timeout: 10000 });
  await host.waitForSelector('[data-testid="lobby-player"]:has-text("Selfie")', {
    timeout: 10000,
  });
});

test("avatar save joins lobby and appears on host", async ({ browser }) => {
  const { host, code } = await createHostLobby(browser);
  const player = await browser.newPage();

  await player.goto(`/play/${code}`);
  await advanceToNameStep(player);
  await player.fill('[data-testid="player-name-input"]', "Skipper");
  await player.click('[data-testid="join-next-btn"]');
  await expect(player.locator('[data-testid="avatar-step"]')).toBeVisible();

  await player.click('[data-testid="save-avatar-btn"]');
  await player.waitForSelector('[data-testid="lobby-player-list"]', { timeout: 10000 });
  await host.waitForSelector('[data-testid="lobby-player"]:has-text("Skipper")', {
    timeout: 10000,
  });
});

test("join without avatar still works", async ({ browser }) => {
  const { host, code } = await createHostLobby(browser);
  const player = await browser.newPage();

  await player.goto(`/play/${code}`);
  await advanceToNameStep(player);
  await player.fill('[data-testid="player-name-input"]', "QuickJoin");
  await player.click('[data-testid="join-btn"]');

  await player.waitForSelector('[data-testid="lobby-player-list"]', { timeout: 10000 });
  await host.waitForSelector('[data-testid="lobby-player"]:has-text("QuickJoin")', {
    timeout: 10000,
  });
});

test("next without name shows error", async ({ browser }) => {
  const { code } = await createHostLobby(browser);
  const player = await browser.newPage();

  await player.goto(`/play/${code}`);
  await advanceToNameStep(player);
  await player.click('[data-testid="join-next-btn"]');

  await expect(player.locator('[data-testid="join-error"]')).toHaveText("Enter your name");
  await expect(player.locator('[data-testid="avatar-step"]')).not.toBeVisible();
});

test("code step shows only room code input", async ({ browser }) => {
  const player = await browser.newPage();
  await player.goto("/play");

  await expect(player.locator('[data-testid="join-code-step"]')).toBeVisible();
  await expect(player.locator('[data-testid="room-code-input"]')).toBeVisible();
  await expect(player.locator('[data-testid="player-name-input"]')).not.toBeVisible();
  await expect(player.locator('[data-testid="password-input"]')).not.toBeVisible();
});

test("room not found on avatar save returns to join screen", async ({ browser }) => {
  const { host, code } = await createHostLobby(browser);
  const player = await browser.newPage();

  await player.goto(`/play/${code}`);
  await advanceToNameStep(player);
  await player.fill('[data-testid="player-name-input"]', "LateJoiner");
  await player.click('[data-testid="join-next-btn"]');
  await expect(player.locator('[data-testid="avatar-step"]')).toBeVisible();

  await host.close();
  await player.waitForTimeout(500);

  await player.click('[data-testid="save-avatar-btn"]');
  await expect(player.locator('[data-testid="join-code-step"]')).toBeVisible({ timeout: 10000 });
  await expect(player.locator('[data-testid="join-error"]')).toHaveText("Room not found");
  await expect(player.locator('[data-testid="avatar-step"]')).not.toBeVisible();
});

test("password step appears for protected room", async ({ browser }) => {
  const { host, code } = await createHostLobby(browser);
  const player = await browser.newPage();

  await host.waitForSelector('[data-testid="lobby-password-input"]', { timeout: 15000 });
  await host.fill('[data-testid="lobby-password-input"]', "secret");
  await host.locator('[data-testid="lobby-password-input"]').blur();
  await host.waitForTimeout(300);

  await player.goto(`/play/${code}`);
  await player.click('[data-testid="code-next-btn"]');
  await expect(player.locator('[data-testid="join-password-step"]')).toBeVisible();
  await expect(player.locator('[data-testid="password-input"]')).toBeVisible();
  await expect(player.locator('[data-testid="player-name-input"]')).not.toBeVisible();
});
