import "server-only";
import { z } from "zod";
import type { AIProvider } from "./provider";
import { aiConfig } from "./config";
export class OllamaProvider implements AIProvider {
  private config = aiConfig();
  private async request(path: string, body: unknown) {
    let response: Response;
    try {
      response = await fetch(new URL(path, this.config.baseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000),
        cache: "no-store",
      });
    } catch {
      throw new Error(
        "O modelo local não está disponível ou demorou demais. Verifique se o Ollama está rodando.",
      );
    }
    if (!response.ok)
      throw new Error(
        "O Ollama não conseguiu processar o pedido. Verifique se os modelos estão instalados.",
      );
    return response.json() as Promise<unknown>;
  }
  async generate(system: string, prompt: string) {
    const result = z.object({ message: z.object({ content: z.string() }) }).parse(
      await this.request("/api/chat", {
        model: this.config.chatModel,
        stream: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        options: { temperature: 0.1, num_ctx: 16384 },
      }),
    );
    return result.message.content;
  }
  async generateStructured<T>(system: string, prompt: string, schema: z.ZodType<T>): Promise<T> {
    const result = z.object({ message: z.object({ content: z.string() }) }).parse(
      await this.request("/api/chat", {
        model: this.config.chatModel,
        stream: false,
        format: z.toJSONSchema(schema, { unrepresentable: "any" }),
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        options: { temperature: 0, num_ctx: 16384 },
      }),
    );
    try {
      return schema.parse(JSON.parse(result.message.content));
    } catch {
      throw new Error(
        "O modelo retornou uma interpretação inválida. Reformule o pedido e tente novamente.",
      );
    }
  }
  async embed(text: string, purpose: "document" | "query" = "document") {
    const result = z
      .object({ embeddings: z.array(z.array(z.number().finite()).length(768)).length(1) })
      .parse(
        await this.request("/api/embed", {
          model: this.config.embeddingModel,
          input: `search_${purpose}: ${text}`,
          truncate: false,
        }),
      );
    return result.embeddings[0];
  }
}
