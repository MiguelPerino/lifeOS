"use client";
export async function api<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: body === undefined ? "GET" : method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Sem conexão. Verifique sua rede e tente novamente.");
  }
  const data = await response
    .json()
    .catch(() => ({ error: "O servidor não respondeu corretamente. Tente novamente." }));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data as T;
}
