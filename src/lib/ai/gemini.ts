import "server-only";
import { z } from "zod";
import type { AIProvider } from "./provider";
import { aiConfig } from "./config";

// Keep the response grammar compact: nested array bounds can exceed Gemini complexity limits.
// Types and structure guide generation; Zod still enforces lengths, formats, bounds and refinements.
function geminiSchema(schema: unknown): unknown {
  if (typeof schema !== "object" || schema === null || Array.isArray(schema)) return schema;
  const supported = new Set([
    "$id",
    "$defs",
    "$ref",
    "$anchor",
    "type",
    "title",
    "description",
    "enum",
    "items",
    "prefixItems",
    "anyOf",
    "oneOf",
    "properties",
    "additionalProperties",
    "required",
  ]);
  return Object.fromEntries(
    Object.entries(schema)
      .filter(([key]) => supported.has(key))
      .map(([key, value]) => {
        if (key === "properties" || key === "$defs")
          return [
            key,
            Object.fromEntries(
              Object.entries(value).map(([name, child]) => [name, geminiSchema(child)]),
            ),
          ];
        if (key === "anyOf" || key === "oneOf" || key === "prefixItems")
          return [key, (value as unknown[]).map(geminiSchema)];
        if (key === "items" || key === "additionalProperties") return [key, geminiSchema(value)];
        return [key, value];
      }),
  );
}

const generationSchema = z.object({
  candidates: z
    .array(
      z.object({
        finishReason: z.string(),
        content: z.object({
          parts: z.array(
            z.object({ text: z.string().optional(), thought: z.boolean().optional() }),
          ),
        }),
      }),
    )
    .min(1),
});

export class GeminiProvider implements AIProvider {
  private config = aiConfig();

  private async request(model: string, action: string, body: unknown): Promise<unknown> {
    if (!this.config.geminiApiKey)
      throw new Error("Configure GEMINI_API_KEY no servidor para ativar o Gemini.");
    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${action}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.config.geminiApiKey,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60000),
          cache: "no-store",
        },
      );
    } catch {
      throw new Error("O Gemini não respondeu a tempo. Verifique sua conexão e tente novamente.");
    }
    if (response.status === 429)
      throw new Error(
        "O limite de uso do Gemini foi atingido. Aguarde a renovação da cota e tente novamente.",
      );
    if (response.status === 401 || response.status === 403)
      throw new Error(
        "O Gemini recusou o acesso. Confira GEMINI_API_KEY e as permissões do projeto.",
      );
    if (response.status === 404)
      throw new Error("Modelo Gemini indisponível. Confira os modelos configurados no servidor.");
    if (!response.ok)
      throw new Error(
        "O Gemini não conseguiu processar o pedido. Confira a chave, o modelo e o tamanho do texto.",
      );
    try {
      return await response.json();
    } catch {
      throw new Error("O Gemini retornou uma resposta inválida. Tente novamente.");
    }
  }

  private async chat(system: string, prompt: string, generationConfig: object) {
    const result = generationSchema.safeParse(
      await this.request(this.config.geminiChatModel, "generateContent", {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192, ...generationConfig },
      }),
    );
    if (!result.success || result.data.candidates[0].finishReason !== "STOP")
      throw new Error(
        "O Gemini não concluiu a resposta. Reduza ou reformule o pedido e tente novamente.",
      );
    const text = result.data.candidates[0].content.parts
      .filter((part) => !part.thought)
      .map((part) => part.text || "")
      .join("");
    if (!text.trim()) throw new Error("O Gemini retornou uma resposta vazia. Reformule o pedido.");
    return text;
  }

  generate(system: string, prompt: string) {
    return this.chat(system, prompt, {});
  }

  async generateStructured<T>(system: string, prompt: string, schema: z.ZodType<T>): Promise<T> {
    const text = await this.chat(system, prompt, {
      temperature: 0,
      responseMimeType: "application/json",
      responseJsonSchema: geminiSchema(z.toJSONSchema(schema, { unrepresentable: "any" })),
    });
    try {
      return schema.parse(JSON.parse(text));
    } catch {
      throw new Error(
        "O modelo retornou uma interpretação inválida. Reformule o pedido e tente novamente.",
      );
    }
  }

  async embed(text: string, purpose: "document" | "query" = "document") {
    const result = z
      .object({ embedding: z.object({ values: z.array(z.number().finite()).length(768) }) })
      .safeParse(
        await this.request(this.config.geminiEmbeddingModel, "embedContent", {
          content: { parts: [{ text }] },
          taskType: purpose === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
          outputDimensionality: 768,
        }),
      );
    if (!result.success)
      throw new Error("O Gemini retornou um vetor inválido para a busca semântica.");
    const values = result.data.embedding.values;
    const norm = Math.hypot(...values);
    if (!Number.isFinite(norm) || norm === 0)
      throw new Error("O Gemini retornou um vetor inválido para a busca semântica.");
    return values.map((value) => value / norm);
  }
}
