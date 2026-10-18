import fs from "node:fs";
import path from "node:path";
import { test, expect, devices, type Page } from "@playwright/test";
import {
  getRoomCode,
  isVisible,
  joinPlayer,
  setBotTestLobby,
  setFinalRoundMode,
  submitPendingAnswers,
  submitPendingVote,
} from "../helpers/e2eFlow";

// Visual smoke test: a full 20-player game (1 human on a phone + 19 bots), screenshotting
// every distinct host/phone screen. Set SMOKE_DIR to keep the screenshots.
test.describe.configure({ timeout: 900_000 });
test.skip(!process.env.SMOKE_20, "opt-in: set SMOKE_20=1 (four full games, ~4 minutes)");

const SIZES = [
  { name: "tv", width: 1920, height: 1080 },
  { name: "laptop", width: 1280, height: 720 },
];
const MODES = ["thriplash", "last_lash"] as const;
const LONG_ANSWER = "Absolutely nothing, she has never once been on time, ever";

const HOST_MARKERS = [
  "podium",
  "scoreboard",
  "host-battle-reveal",
  "host-battle-vote",
  "host-lastlash-vote",
  "host-answer-phase",
  "lobby-player-list",
];

async function hostSignature(host: Page): Promise<{ kind: string; detail: string }> {
  for (const id of HOST_MARKERS) {
    if (await isVisible(host, `[data-testid="${id}"]`)) {
      // evaluate(), not textContent(): a locator read waits forever for a missing element.
      const [phase, progress] = await host.evaluate(() =>
        ["phase-indicator", "battle-progress"].map(
          (t) => document.querySelector(`[data-testid="${t}"]`)?.textContent?.trim() ?? ""
        )
      );
      const title = await host.evaluate(
        (t) => document.querySelector(`[data-testid="${t}"] h1`)?.textContent?.trim() ?? "",
        id
      );
      // Scoreboards share a phase label, so their title tells round scores from final results.
      return { kind: `${id}|${id === "scoreboard" ? title : phase}`, detail: progress };
    }
  }
  return { kind: "other", detail: "" };
}

async function overflowReport(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const issues: string[] = [];
    const { innerWidth: vw, innerHeight: vh } = window;
    const doc = document.documentElement;
    if (doc.scrollWidth > vw + 1) issues.push(`page scrolls horizontally (${doc.scrollWidth}px > ${vw}px)`);
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-testid]"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.opacity === "0") continue;
      if (r.right > vw + 2 || r.bottom > vh + 2 || r.left < -2) {
        issues.push(`${el.dataset.testid} off-screen (${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)})`);
      }
    }
    return issues;
  });
}

for (const size of SIZES) {
  for (const mode of MODES) {
    test(`20 players, ${size.name}, ${mode}`, async ({ browser }) => {
      const outDir = path.join(process.env.SMOKE_DIR ?? "test-results/smoke-20", `${size.name}-${mode}`);
      fs.mkdirSync(outDir, { recursive: true });

      const hostCtx = await browser.newContext({ viewport: { width: size.width, height: size.height } });
      const phoneCtx = await browser.newContext({ ...devices["iPhone 13"] });
      const host = await hostCtx.newPage();
      const phone = await phoneCtx.newPage();

      await host.goto("/host?e2e=1&maxPlayers=20");
      await setFinalRoundMode(host, mode);
      const code = await getRoomCode(host);
      await joinPlayer(phone, code, "Jennifer Lawrenc");
      await setBotTestLobby(host, "lobby_full");
      await expect(host.locator('[data-testid="lobby-player"]')).toHaveCount(20, { timeout: 15_000 });
      // setBotTestLobby scrolls the settings panel into view inside overflow:hidden containers,
      // which a real host never does; undo it so the lobby shot shows the real layout.
      await host.evaluate(() =>
        document.querySelectorAll<HTMLElement>("*").forEach((el) => {
          if (el.scrollTop) el.scrollTop = 0;
        })
      );

      const issues: string[] = [];
      const seen = new Map<string, number>();
      let shot = 0;
      // Mid-game screens are paused (host Escape) so entrance animations finish and the E2E
      // timers can't move on; the pause overlays are hidden for the shot, then resumed.
      const capture = async (label: string, pause = false) => {
        let paused = false;
        if (pause) {
          await host.keyboard.press("Escape");
          paused = await host
            .locator('[data-testid="host-pause-menu"]')
            .waitFor({ state: "visible", timeout: 2_000 })
            .then(() => true, () => false);
        }
        await host.waitForTimeout(paused ? 3_500 : 1_500);
        const hideHost = paused
          ? await host.addStyleTag({ content: '[data-testid="host-pause-menu"]{display:none!important}' })
          : null;
        const hidePhone = paused
          ? await phone.addStyleTag({ content: '[data-testid="play-paused-overlay"]{display:none!important}' })
          : null;
        const n = String(++shot).padStart(3, "0");
        const safe = label.replace(/[^a-z0-9]+/gi, "_").slice(0, 60);
        await host.screenshot({ path: path.join(outDir, `${n}-host-${safe}.png`) });
        await phone.screenshot({ path: path.join(outDir, `${n}-phone-${safe}.png`) });
        for (const i of await overflowReport(host)) issues.push(`[host ${label}] ${i}`);
        // A scrolling list legitimately has rows below the fold; check the last one is reachable.
        const lastLashList = phone.locator(".play-lastlash-list");
        if (await lastLashList.isVisible().catch(() => false)) {
          await lastLashList.evaluate((el) => el.scrollTo(0, el.scrollHeight));
          await phone.waitForTimeout(300);
          await phone.screenshot({ path: path.join(outDir, `${n}-phone-${safe}-scrolled.png`) });
          const lastVisible = await lastLashList.evaluate((el) => {
            const last = el.lastElementChild?.getBoundingClientRect();
            const box = el.getBoundingClientRect();
            return !!last && last.bottom <= box.bottom + 2 && last.top >= box.top - 2;
          });
          if (!lastVisible) issues.push(`[phone ${label}] last Last Lash answer unreachable by scrolling`);
          await lastLashList.evaluate((el) => el.scrollTo(0, 0));
        } else {
          for (const i of await overflowReport(phone)) issues.push(`[phone ${label}] ${i}`);
        }
        if (paused) {
          await hideHost?.evaluate((el) => (el as HTMLElement).remove());
          await hidePhone?.evaluate((el) => (el as HTMLElement).remove());
          await host.locator('[data-testid="pause-resume-btn"]').click();
        }
      };

      await capture("lobby");
      await phone.click('[data-testid="everybodys-in-btn"]');

      let last = "";
      const deadline = Date.now() + 840_000;
      while (Date.now() < deadline) {
        const sig = await hostSignature(host);
        const key = `${sig.kind}#${sig.detail}`;
        if (key !== last) {
          last = key;
          const count = seen.get(sig.kind) ?? 0;
          seen.set(sig.kind, count + 1);
          // Every new kind of screen, plus the first and last battle of each kind.
          if (count < 2 || /\b20 of 20\s*$/.test(sig.detail)) await capture(`${sig.kind} ${sig.detail}`, !sig.kind.startsWith("podium"));
        }
        if (sig.kind.startsWith("podium")) break;
        // Bots answer instantly, so the phone holds its answers until the host's answer
        // screen (with its who-has-answered strip) has been captured; the 5s E2E timer
        // auto-submits if the indicator never says "write".
        if (/write/i.test(sig.kind)) await submitPendingAnswers(phone, LONG_ANSWER);
        await submitPendingVote(phone);
        await host.waitForTimeout(300);
      }

      await expect(host.locator('[data-testid="podium"]')).toBeVisible();
      await host.waitForTimeout(3_000);
      await capture("podium settled");
      fs.writeFileSync(path.join(outDir, "issues.txt"), issues.join("\n") + "\n");
      await hostCtx.close();
      await phoneCtx.close();
    });
  }
}
