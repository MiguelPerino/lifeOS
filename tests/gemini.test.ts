import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
vi.mock("server-only", () => ({}));
import { GeminiProvider } from "@/lib/ai/gemini";
import { aiConfig, aiEnabled } from "@/lib/ai/config";
import { getAIProvider } from "@/lib/ai";
import { inboxSchema, planSchema } from "@/domain/schemas";

const fetchMock = vi.fn();
function generation(text: string, finishReason = "STOP") {
  return Response.json({ candidates: [{ finishReason, content: { parts: [{ text }] } }] });
}
beforeEach(() => {
  vi.stubEnv("AI_PROVIDER", "gemini");
  vi.stubEnv("GEMINI_API_KEY", "test-secret");
  vi.stubEnv("GEMINI_CHAT_MODEL", "gemini-3.5-flash-lite");
  vi.stubEnv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Gemini configuration", () => {
  it("selects Gemini and its embedding model", () => {
    expect(getAIProvider()).toBeInstanceOf(GeminiProvider);
    expect(aiEnabled()).toBe(true);
    expect(aiConfig().embeddingModel).toBe("gemini-embedding-001");
  });
  it("keeps AI disabled without a key and makes no request", async () => {
    vi.stubEnv("GEMINI_API_KEY", " ");
    expect(aiEnabled()).toBe(false);
    await expect(getAIProvider().generate("system", "prompt")).rejects.toThrow("GEMINI_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("preserves explicit Ollama and disables an unset provider", () => {
    vi.stubEnv("AI_PROVIDER", "ollama");
    expect(aiEnabled()).toBe(true);
    expect(aiConfig().embeddingModel).toBe("nomic-embed-text");
    vi.stubEnv("AI_PROVIDER", undefined);
    expect(aiEnabled()).toBe(false);
  });
});

describe("Gemini generation", () => {
  it("sends a compact schema without losing properties named like schema keywords", async () => {
    fetchMock.mockResolvedValue(generation('{"pattern":"abc","values":[1]}'));
    const schema = z.object({
      pattern: z.string().min(2).max(4).regex(/^abc$/),
      values: z.array(z.number().min(0).max(5)).max(50),
    });
    await getAIProvider().generateStructured("", "", schema);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body).generationConfig.responseJsonSchema;
    expect(sent).toEqual({
      type: "object",
      properties: {
        pattern: { type: "string" },
        values: { type: "array", items: { type: "number" } },
      },
      required: ["pattern", "values"],
      additionalProperties: false,
    });
    fetchMock.mockResolvedValue(generation('{"pattern":"wrong","values":[99]}'));
    await expect(getAIProvider().generateStructured("", "", schema)).rejects.toThrow(
      "interpretação inválida",
    );
  });
  it("sends the key only in a header and keeps system instructions separate", async () => {
    fetchMock.mockResolvedValue(generation("Olá"));
    expect(await getAIProvider().generate("Regras", "Pedido")).toBe("Olá");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).not.toContain("test-secret");
    expect(options.headers["x-goog-api-key"]).toBe("test-secret");
    expect(JSON.parse(options.body)).toMatchObject({
      systemInstruction: { parts: [{ text: "Regras" }] },
      contents: [{ role: "user", parts: [{ text: "Pedido" }] }],
    });
    expect(options.cache).toBe("no-store");
  });
  it("requests JSON schema and validates output", async () => {
    fetchMock.mockResolvedValue(generation('{"count":2}'));
    expect(
      await getAIProvider().generateStructured("", "", z.object({ count: z.number() })),
    ).toEqual({ count: 2 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).generationConfig).toMatchObject({
      responseMimeType: "application/json",
      responseJsonSchema: { type: "object" },
    });
  });
  it.each(["not json", '{"count":"wrong"}'])(
    "rejects malformed structured output %s",
    async (text) => {
      fetchMock.mockResolvedValue(generation(text));
      await expect(
        getAIProvider().generateStructured("", "", z.object({ count: z.number() })),
      ).rejects.toThrow("interpretação inválida");
    },
  );
  it("uses domain schemas and retains refinement validation", async () => {
    fetchMock.mockResolvedValue(generation('{"items":[],"explanation":""}'));
    await expect(getAIProvider().generateStructured("", "", inboxSchema)).rejects.toThrow(
      "interpretação inválida",
    );
    const item = {
      task_id: "11111111-1111-4111-8111-111111111111",
      start_time: "09:00",
      duration_minutes: 60,
    };
    fetchMock.mockResolvedValue(generation(JSON.stringify({ items: [item, item] })));
    await expect(getAIProvider().generateStructured("", "", planSchema)).rejects.toThrow(
      "interpretação inválida",
    );
  });
  it.each(["MAX_TOKENS", "SAFETY"])("rejects unfinished responses: %s", async (reason) => {
    fetchMock.mockResolvedValue(generation("partial", reason));
    await expect(getAIProvider().generate("", "")).rejects.toThrow("não concluiu");
  });
  it("rejects blocked responses and skips thought parts", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ promptFeedback: { blockReason: "SAFETY" } }));
    await expect(getAIProvider().generate("", "")).rejects.toThrow("não concluiu");
    fetchMock.mockResolvedValueOnce(
      Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: "hidden", thought: true }, { text: "answer" }] },
          },
        ],
      }),
    );
    expect(await getAIProvider().generate("", "")).toBe("answer");
  });
  it.each([
    [429, "limite"],
    [403, "recusou"],
    [401, "recusou"],
    [404, "Modelo"],
    [500, "não conseguiu"],
    [400, "não conseguiu"],
  ])("handles HTTP %s without leaking upstream errors", async (status, message) => {
    fetchMock.mockResolvedValue(
      Response.json({ error: "test-secret" }, { status: Number(status) }),
    );
    await expect(getAIProvider().generate("", "")).rejects.toThrow(String(message));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("sanitizes connection errors", async () => {
    fetchMock.mockRejectedValue(new Error("test-secret"));
    await expect(getAIProvider().generate("", "")).rejects.toThrow("não respondeu a tempo");
  });
});

describe("Gemini embeddings", () => {
  it.each(["document", "query"] as const)("normalizes 768 dimensions for %s", async (purpose) => {
    fetchMock.mockResolvedValue(Response.json({ embedding: { values: Array(768).fill(2) } }));
    const vector = await getAIProvider().embed("Minha nota", purpose);
    expect(vector).toHaveLength(768);
    expect(Math.hypot(...vector)).toBeCloseTo(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      taskType: purpose === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
      outputDimensionality: 768,
    });
  });
  it.each([Array(3).fill(1), Array(768).fill(0)])("rejects unusable vectors", async (values) => {
    fetchMock.mockResolvedValue(Response.json({ embedding: { values } }));
    await expect(getAIProvider().embed("nota")).rejects.toThrow("vetor inválido");
  });
});
