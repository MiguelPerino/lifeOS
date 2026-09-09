import { test, expect } from "@playwright/test";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const enabled =
  process.env.E2E_LOCAL === "1" &&
  Boolean(url && ["127.0.0.1", "localhost"].includes(new URL(url).hostname));
test("real local Supabase: account, project, tasks, note, search, plan and reload", async ({
  page,
}) => {
  test.skip(
    !enabled,
    "Requires local Supabase with migrations and E2E_LOCAL=1. No application mocks.",
  );
  const suffix = Date.now();
  await page.goto("/login");
  await page.getByRole("button", { name: "Criar uma conta", exact: true }).click();
  await page.getByLabel("Como podemos chamar você?").fill("Teste LifeOS");
  await page.getByLabel("E-mail", { exact: true }).fill(`lifeos-${suffix}@example.test`);
  await page.getByLabel("Senha", { exact: true }).fill(`LifeOS-test-${suffix}!`);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/projects?new=1");
  await page.getByLabel("Título", { exact: true }).fill(`Projeto ${suffix}`);
  await page.getByLabel("Status", { exact: true }).selectOption("active");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/tasks?new=1");
  await page.getByLabel("Título", { exact: true }).fill(`Tarefa ${suffix}`);
  await page.getByLabel("Projeto", { exact: true }).selectOption({ label: `Projeto ${suffix}` });
  await page.getByLabel("Prioridade", { exact: true }).selectOption("high");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(`Tarefa ${suffix}`, { exact: true })).toBeVisible();
  await page.goto("/notes?new=1");
  await page.getByLabel("Título", { exact: true }).fill(`Nota ${suffix}`);
  await page
    .getByLabel("Conteúdo", { exact: true })
    .fill("Attention relaciona tokens de uma sequência.");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 150000 });
  await page.goto("/search");
  await page.getByLabel("Termo de busca").fill(`Nota ${suffix}`);
  await expect(page.getByRole("heading", { name: `Nota ${suffix}` })).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/today");
  await page.getByLabel("Adicionar tarefa ao plano").selectOption({ label: `Tarefa ${suffix}` });
  await page.getByRole("button", { name: "Aceitar e salvar" }).click();
  await expect(page.getByText("Seu plano está salvo.")).toBeVisible();
  await page.reload();
  await expect(page.getByText(`Tarefa ${suffix}`, { exact: true }).first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // This test intentionally leaves only its disposable local account for investigation.
});
