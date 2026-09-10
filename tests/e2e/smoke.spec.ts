import { test, expect } from "@playwright/test";
test("PWA assets and service worker are available without a session", async ({ page, request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ display: "standalone", start_url: "/dashboard", scope: "/" });
  for (const icon of manifest.icons) {
    const asset = await request.get(icon.src);
    expect(asset.status()).toBe(200);
    expect(asset.headers()["content-type"]).toContain("image/png");
  }
  const worker = await request.get("/sw.js");
  expect(worker.status()).toBe(200);
  expect(worker.headers()["cache-control"]).toContain("no-store");
  await page.goto("/login");
  expect(
    await page.evaluate(async () => {
      await navigator.serviceWorker.register("/sw.js");
      const registration = await navigator.serviceWorker.ready;
      return registration.active?.scriptURL.endsWith("/sw.js");
    }),
  ).toBe(true);
  await page.goto("/notifications");
  await expect(page).toHaveURL(/\/login/);
});
test("notification APIs reject unauthenticated and cross-origin requests", async ({ request }) => {
  expect((await request.get("/api/notifications")).status()).toBe(401);
  expect((await request.post("/api/cron/notifications")).status()).toBe(401);
  for (const path of ["/api/notifications/subscription", "/api/notifications/test"]) {
    const response = await request.post(path, {
      headers: { Origin: "https://untrusted.example" },
      data: {},
    });
    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Origem da solicitação inválida." });
  }
  const prefs = await request.put("/api/notifications", {
    headers: { Origin: "https://untrusted.example" },
    data: {},
  });
  expect(prefs.status()).toBe(400);
});
test("private pages require authentication and render without overflow", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Bom ter você por aqui" })).toBeVisible();
  await page.screenshot({ path: "test-results/login-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Bom ter você por aqui" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/login-mobile.png", fullPage: true });
});
test("rejects cross-origin writes and unauthenticated data requests", async ({ request }) => {
  const read = await request.get("/api/workspace");
  expect(read.ok()).toBe(false);
  const write = await request.post("/api/records/tasks", {
    headers: { Origin: "https://untrusted.example" },
    data: { title: "Should never persist" },
  });
  expect(write.status()).toBe(400);
  expect(await write.json()).toMatchObject({ error: "Origem da solicitação inválida." });
  expect(JSON.stringify(await read.json())).not.toContain("stack");
});
test("same-origin writes reach authentication with the wildcard dev hostname", async ({
  request,
}) => {
  const response = await request.post("/api/records/tasks", {
    headers: { Origin: "http://localhost:3000" },
    data: { title: "Should require a session" },
  });
  expect(response.status()).toBe(401);
  expect(await response.json()).toMatchObject({ error: "Sua sessão expirou. Entre novamente." });
});
