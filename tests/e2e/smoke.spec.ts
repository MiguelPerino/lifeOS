import { test, expect } from "@playwright/test";
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
test("same-origin writes reach authentication with the wildcard dev hostname", async ({ request }) => {
  const response = await request.post("/api/records/tasks", {
    headers: { Origin: "http://localhost:3000" },
    data: { title: "Should require a session" },
  });
  expect(response.status()).toBe(401);
  expect(await response.json()).toMatchObject({ error: "Sua sessão expirou. Entre novamente." });
});
