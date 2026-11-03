import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

async function ready(page: Page, minimumDelay = true) {
  if (minimumDelay)
    await page.addInitScript(() => {
      Math.random = () => 0;
    });
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-ready", "true");
  await expect(
    page.getByRole("button", { name: /Jogar|Próximo jogador/ }),
  ).toHaveCount(0);
}
const cue = (page: Page) =>
  page.getByRole("heading", { name: /APERTE ESPAÇO!|TOQUE AGORA!/ });
async function autoReact(page: Page, delays: number[]) {
  await page.evaluate((delays) => {
    const main = document.querySelector("main")!;
    const audit: { signal: number; press: number }[] = [];
    Object.assign(window, { reactionAudit: audit });
    new MutationObserver(() => {
      if (main.getAttribute("data-phase") !== "REACTION") return;
      const record = { signal: performance.now(), press: 0 };
      const delay = delays[audit.length];
      audit.push(record);
      if (delay === undefined) return;
      setTimeout(() => {
        record.press = performance.now();
        window.dispatchEvent(
          new KeyboardEvent("keydown", { code: "Space", key: " " }),
        );
      }, delay);
    }).observe(main, { attributes: true, attributeFilter: ["data-phase"] });
  }, delays);
}
const audit = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          reactionAudit: { signal: number; press: number }[];
        }
      ).reactionAudit,
  );

test("minimal instructions, focused eyes, red alert and automatic second chance", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await ready(page, false);
  await expect(
    page.getByText("Você tem 3 chances", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("continue-hint")).toContainText(/começar/);
  await page.screenshot({ path: `test-results/${info.project.name}-idle.png` });
  const started = Date.now();
  await page.keyboard.press("Space");
  await page.waitForTimeout(1300);
  await expect(page.locator("main")).toHaveAttribute("data-phase", "WAITING");
  await page.screenshot({
    path: `test-results/${info.project.name}-focus.png`,
  });
  await expect(cue(page)).toBeVisible({ timeout: 7000 });
  expect(Date.now() - started).toBeGreaterThanOrEqual(2950);
  await expect(page.locator("main")).toHaveAttribute("data-attempt", "1");
  expect(
    await page
      .locator("main")
      .evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--cue").trim(),
      ),
  ).toBe("#ff4545");
  await page.mouse.click(25, 200);
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "REACTION");
  await page.screenshot({
    path: `test-results/${info.project.name}-reaction.png`,
  });
  await page.waitForTimeout(350);
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "FEEDBACK");
  await page.screenshot({ path: `test-results/${info.project.name}-sad.png` });
  await expect(page.locator("main")).toHaveAttribute("data-attempt", "2", {
    timeout: 4000,
  });
  await expect(page.locator("main")).toHaveAttribute("data-phase", "WAITING");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.locator("main")).toHaveAttribute(
    "data-phase",
    "INTERRUPTED",
  );
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "IDLE");
  expect(errors).toEqual([]);
});

test("a first-chance win ends the match and matches an independent clock", async ({
  page,
}, info) => {
  await ready(page);
  await autoReact(page, [100]);
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-outcome", "won", {
    timeout: 8000,
  });
  const score = Number(await page.getByTestId("result-ms").textContent());
  expect(score).toBeLessThan(273);
  const records = await audit(page);
  expect(records).toHaveLength(1);
  expect(Math.abs(score - (records[0].press - records[0].signal))).toBeLessThan(
    30,
  );
  await page.screenshot({ path: `test-results/${info.project.name}-won.png` });
  await page.waitForTimeout(1600);
  await expect(page.locator("main")).toHaveAttribute("data-attempt", "1");
  await expect(page.locator("main")).toHaveAttribute("data-outcome", "won");
  await expect(page.getByRole("dialog", { name: /Você entrou no top 10/ })).toBeVisible();
  await page.getByRole("button", { name: "Agora não" }).click();
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-attempt", "0");
  await expect(page.getByTestId("continue-hint")).toContainText(/começar/);
});

test("difficulty selector shows matching limits and SOL rejects 275 ms", async ({
  page,
}) => {
  await ready(page);
  const main = page.locator("main");
  await expect(page.getByRole("button", { name: "LUA Fácil" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByRole("button", { name: "SOL Médio" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "LUA Fácil" }).click();
  await expect(main).toHaveAttribute("data-win-threshold", "350");
  await expect(page.locator(".rules strong")).toHaveText("350 ms");
  await page.getByRole("button", { name: "ASTRO Difícil" }).click();
  await expect(main).toHaveAttribute("data-win-threshold", "200");
  await page.getByRole("button", { name: "SOL Médio" }).click();
  await expect(main).toHaveAttribute("data-win-threshold", "273");

  await autoReact(page, [275]);
  await page.keyboard.press("Space");
  await expect(main).toHaveAttribute("data-phase", "FEEDBACK", {
    timeout: 8000,
  });
  await expect(main).toHaveAttribute("data-outcome", "");
  await expect(page.getByTestId("result-ms")).toHaveCount(0);
});

test("top-ten name entry waits three seconds, persists, and password restores the seed ranking", async ({
  page,
}, info) => {
  await ready(page);
  await autoReact(page, [120]);
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-outcome", "won", {
    timeout: 8000,
  });
  const nameDialog = page.getByRole("dialog", { name: /Você entrou no top 10/ });
  const successAt = Date.now();
  await expect(nameDialog).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "RESULT");
  await expect(nameDialog).toBeVisible({ timeout: 5000 });
  expect(Date.now() - successAt).toBeGreaterThanOrEqual(2300);
  await page.getByLabel("Nome para o ranking").fill("Luna Astro");
  await page.getByRole("button", { name: "Salvar recorde" }).click();
  await expect(nameDialog).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("3º lugar");

  const rankingButton = page.getByRole("button", { name: "Ranking" });
  await rankingButton.click();
  let rankingDialog = page.getByRole("dialog", { name: "Ranking local" });
  await expect(rankingDialog.getByText("Luna Astro")).toBeVisible();
  await page.screenshot({ path: `test-results/${info.project.name}-ranking.png` });
  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Ranking" }).click();
  rankingDialog = page.getByRole("dialog", { name: "Ranking local" });
  await expect(rankingDialog.getByText("Luna Astro")).toBeVisible();

  await rankingDialog.getByRole("button", { name: "Redefinir ranking" }).click();
  const password = page.getByLabel("Senha para redefinir");
  await password.fill("errada");
  await rankingDialog.getByRole("button", { name: "Redefinir", exact: true }).click();
  await expect(rankingDialog.getByRole("alert")).toContainText("Senha incorreta");
  await expect(rankingDialog.getByText("Luna Astro")).toBeVisible();

  await password.fill("Astro@2026");
  await rankingDialog.getByRole("button", { name: "Redefinir", exact: true }).click();
  await expect(rankingDialog.getByText("Luna Astro")).toHaveCount(0);
  await expect(rankingDialog.getByRole("status")).toContainText("restaurado com sucesso");
  await expect(rankingDialog.locator(".ranking-list li").nth(0)).toContainText("ASTRINHOZINHO");
  await expect(rankingDialog.locator(".ranking-list li").nth(0)).toContainText("99");
  await expect(rankingDialog.locator(".ranking-list li").nth(1)).toContainText("125");
  await expect(rankingDialog.locator(".ranking-list li").nth(2)).toContainText("150");
});

test("a win outside the top ten does not ask for a player name", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "astro-reflexo-ranking-v1",
      JSON.stringify({
        version: 1,
        entries: Array.from({ length: 10 }, (_, index) => ({
          id: `seed-${index}`,
          name: `Recorde ${index + 1}`,
          milliseconds: 100 + index,
          difficulty: "sun",
        })),
      }),
    );
  });
  await ready(page);
  await autoReact(page, [150]);
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-outcome", "won", {
    timeout: 8000,
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("slow first attempt becomes focused again and can win the second", async ({
  page,
}) => {
  await ready(page);
  await autoReact(page, [400, 100]);
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "FEEDBACK", {
    timeout: 8000,
  });
  await expect(page.locator("main")).toHaveAttribute("data-outcome", "won", {
    timeout: 9000,
  });
  await expect(page.locator("main")).toHaveAttribute("data-attempt", "2");
  expect((await audit(page)).length).toBe(2);
});

test("three slow attempts end in a loss with no fourth alert", async ({
  page,
}, info) => {
  await ready(page);
  await autoReact(page, [400, 400, 400]);
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-outcome", "lost", {
    timeout: 22000,
  });
  await expect(page.locator("main")).toHaveAttribute("data-attempt", "3");
  await page.screenshot({ path: `test-results/${info.project.name}-lost.png` });
  await page.waitForTimeout(3200);
  expect((await audit(page)).length).toBe(3);
  await expect(page.locator("main")).toHaveAttribute("data-phase", "RESULT");
});

test("early press consumes a chance; interruption cancels continuation and auto-repeat is ignored", async ({
  page,
}) => {
  await ready(page);
  await page.keyboard.press("Space");
  await page.keyboard.down("Space");
  await page.keyboard.down("Space");
  await page.keyboard.up("Space");
  await expect(
    page.getByRole("heading", { name: "Cedo demais!" }),
  ).toBeVisible();
  await expect(page.getByTestId("result-ms")).toHaveCount(0);
  await expect(page.locator("main")).toHaveAttribute("data-attempt", "1");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForTimeout(1700);
  await expect(page.locator("main")).toHaveAttribute(
    "data-phase",
    "INTERRUPTED",
  );
  await page.keyboard.press("Space");
  const fullscreen = page.getByRole("button", {
    name: "Tela cheia",
    exact: true,
  });
  if (await fullscreen.count()) await fullscreen.focus();
  await page.keyboard.down("Space");
  await page.keyboard.down("Space");
  await page.keyboard.up("Space");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "WAITING");
  await page.locator("canvas").dispatchEvent("webglcontextlost");
  await expect(
    page.getByRole("heading", { name: "3D indisponível" }),
  ).toBeVisible();
  await expect(page.getByTestId("continue-hint")).toHaveCount(0);
});

test("reduced motion, offline assets and landscape fit", async ({
  page,
}, info) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:4173"))
      external.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByTestId("continue-hint")).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${info.project.name}-landscape.png`,
  });
  expect(external).toEqual([]);
});

test("touch starts a match, reacts and resets without buttons", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Touch emulation runs in the mobile project.");
  await ready(page);
  await page.touchscreen.tap(25, 200);
  await expect(cue(page)).toBeVisible({ timeout: 7000 });
  await page.waitForTimeout(350);
  await page.touchscreen.tap(25, 200);
  await expect(page.locator("main")).toHaveAttribute("data-phase", "FEEDBACK");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.touchscreen.tap(25, 200);
  await expect(page.locator("main")).toHaveAttribute("data-phase", "IDLE");
  await page.touchscreen.tap(25, 200);
  await expect(page.locator("main")).toHaveAttribute("data-phase", "WAITING");
});

test("small phone, tablet, notebook and monitor fit", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Viewport sweep runs once.");
  await ready(page);
  for (const [name, width, height] of [
    ["small-phone", 320, 568],
    ["tablet", 768, 1024],
    ["notebook", 1366, 768],
    ["monitor", 1920, 1080],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect(page.getByTestId("continue-hint")).toBeInViewport();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight &&
          document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/${name}.png` });
  }
});
