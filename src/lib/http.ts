import { NextResponse } from "next/server";
import { z } from "zod";
export async function readBody(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 100000)
    throw new Error("O conteúdo é muito grande.");
  const raw = await request.text();
  if (raw.length > 100000) throw new Error("O conteúdo é muito grande.");
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error("O conteúdo enviado não é válido.");
  }
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  // Next.js can use its bind address (0.0.0.0) in request.url.
  // Host identifies the address the browser actually requested, including its port.
  const host = request.headers.get("host") || url.host;
  let valid = false;
  try {
    const source = new URL(origin || "");
    valid = source.origin === origin && source.protocol === url.protocol && source.host === host;
  } catch {
    // Missing, opaque, and malformed origins must fail closed.
  }
  if (!valid) throw new Error("Origem da solicitação inválida.");
}
export function apiError(error: unknown) {
  if (error instanceof z.ZodError)
    return NextResponse.json(
      { error: error.issues[0]?.message || "Verifique os campos informados." },
      { status: 400 },
    );
  const message =
    error instanceof Error
      ? error.message
      : "Não foi possível concluir a operação. Tente novamente.";
  return NextResponse.json({ error: message }, { status: message.includes("sessão") ? 401 : 400 });
}
export function databaseError(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (error.message?.includes("dependency_cycle"))
    throw new Error("Essa dependência criaria um ciclo entre tarefas.");
  if (error.message?.includes("task_blocked"))
    throw new Error("Conclua ou remova as dependências antes de concluir esta tarefa.");
  if (error.message?.includes("invalid_plan"))
    throw new Error("Confira os horários, as tarefas e a ordem das dependências do plano.");
  if (error.message?.includes("request_already_saved"))
    throw new Error("Esta captura já foi salva. Confira seus registros antes de criar outra.");
  if (error.code === "23503" || error.code === "42501")
    throw new Error("Um registro relacionado não está disponível para sua conta.");
  throw new Error(
    "Não foi possível salvar ou consultar os dados. Verifique a conexão e as migrations do Supabase.",
  );
}
