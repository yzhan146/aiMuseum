const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3013";
const output = path.resolve(process.cwd(), "docs", "design", "review-assets");
fs.mkdirSync(output, { recursive: true });

function check(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const consoleErrors = [];
  const imageFailures = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("response", (response) => { if (response.request().resourceType() === "image" && response.status() >= 400) imageFailures.push(`${response.status()} ${response.url()}`); });

  await page.goto(`${baseURL}/museum`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.getByRole("heading", { name: "选择你喜欢的博物馆样子" }).waitFor();
  check((await page.locator(".museum-mode-preview img").first().getAttribute("src"))?.includes("child-mode-preview-v1.webp"), "Light mode does not use the new preview art");
  await page.screenshot({ path: path.join(output, "immersive-mode-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: /轻快版/ }).first().click();
  await page.getByRole("button", { name: "使用轻快版进入主页" }).click();
  await page.getByRole("button", { name: "探索历史", exact: true }).click();
  const periods = page.locator(".period-card");
  check(await periods.count() === 3, "Expected three historical periods");
  await periods.nth(2).click();
  await page.getByRole("heading", { name: "三个历史展厅" }).waitFor();
  check(await page.locator(".hall-preview-card img").count() === 3, "Period page does not show three hall images");
  await page.locator(".hall-preview-card .primary").first().click();
  await page.locator(".immersive-hall").waitFor();
  check(await page.locator(".hall-route button").count() === 4, "Hall route is not four stations");
  check((await page.locator(".hall-scene-art").getAttribute("src"))?.endsWith("scene.webp"), "Hall scene does not use optimized WebP art");
  await page.screenshot({ path: path.join(output, "immersive-hall-desktop.png"), fullPage: true });

  await page.locator(".hall-route button").nth(1).click();
  await page.getByRole("button", { name: "打开完整展签" }).click();
  await page.locator(".hall-object-drawer[role='dialog']").waitFor();
  check(await page.getByText("艺术重建 · 不冒充真实文物").isVisible(), "Representation label is missing");
  await page.getByRole("button", { name: "认识与它相连的人物" }).click();
  check(await page.locator(".hall-character-wall button").count() >= 3, "Character relation wall is incomplete");
  await page.getByRole("button", { name: "在关系图中理解他们" }).click();
  await page.getByRole("heading", { name: "把人物放回同一个历史问题里" }).waitFor();
  await page.screenshot({ path: path.join(output, "immersive-map-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "返回当前展厅" }).click();
  await page.locator(".hall-route button").nth(2).click();
  await page.locator(".hall-character-wall button").first().click();
  await page.locator(".encounter-shell").waitFor();
  await page.getByRole("button", { name: "返回展厅" }).click();
  await page.locator(".hall-route button").nth(3).click();
  await page.getByText("把问题带出展厅").waitFor();

  const apiAudit = await page.evaluate(async () => {
    const explore = await fetch("/api/explore").then((response) => response.json());
    const halls = explore.periods.flatMap((period) => period.halls);
    const results = [];
    for (const hall of halls) {
      const response = await fetch(`/api/halls/${hall.id}`);
      const body = await response.json();
      const asset = body.pack?.assets?.[0];
      const assetResponse = asset ? await fetch(asset.path, { method: "HEAD" }) : null;
      results.push({ id: hall.id, status: response.status, stations: body.pack?.hall?.stations?.length, assetStatus: assetResponse?.status, sceneRef: hall.sceneRef?.version });
    }
    return results;
  });
  check(apiAudit.length === 9, "Expected nine hall APIs");
  check(apiAudit.every((item) => item.status === 200 && item.stations === 4 && item.assetStatus === 200 && item.sceneRef === "1.0.0"), `Hall API audit failed: ${JSON.stringify(apiAudit)}`);

  const degraded = await browser.newPage({ viewport: { width: 1024, height: 800 } });
  await degraded.addInitScript(() => localStorage.setItem("ai-museum-visitor", JSON.stringify({ mode: "adult", periodId: "physics-revolution", selectedId: "albert-einstein", hallId: "physics-solvay", portraitStyles: {}, chatFontSize: "medium" })));
  await degraded.route("**/exhibits/**", (route) => route.abort());
  await degraded.goto(`${baseURL}/museum#hall`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await degraded.getByRole("heading", { name: "索尔维会议：自然是概率的吗" }).waitFor();
  check(await degraded.locator(".hall-route button").count() === 4, "Hall content disappears when scene art fails");
  await degraded.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, reducedMotion: "reduce" });
  await mobile.addInitScript(() => localStorage.setItem("ai-museum-visitor", JSON.stringify({ mode: "child", periodId: "physics-revolution", selectedId: "albert-einstein", hallId: "physics-solvay", portraitStyles: {}, chatFontSize: "medium" })));
  mobile.setDefaultTimeout(60000);
  await mobile.goto(`${baseURL}/museum#hall`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await mobile.locator(".immersive-hall").waitFor();
  check(await mobile.locator(".hall-route button").count() === 4, "Mobile hall route is incomplete");
  check(await mobile.locator(".visitor-bottom-nav").count() === 0, "Mobile global nav still covers the hall route");
  const settingsBox = await mobile.getByRole("button", { name: "打开显示设置" }).boundingBox();
  check(Boolean(settingsBox && settingsBox.x + settingsBox.width <= 390), "Mobile display control is clipped");
  await mobile.screenshot({ path: path.join(output, "immersive-hall-mobile.png"), fullPage: true });
  await mobile.close();

  check(imageFailures.length === 0, `Broken images: ${imageFailures.join(", ")}`);
  check(consoleErrors.length === 0, `Console errors: ${consoleErrors.join(" | ")}`);
  console.log(JSON.stringify({ ok: true, apiAudit, screenshots: ["immersive-mode-desktop.png", "immersive-hall-desktop.png", "immersive-map-desktop.png", "immersive-hall-mobile.png"] }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
