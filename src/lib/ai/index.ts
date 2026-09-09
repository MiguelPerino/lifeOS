import "server-only";
import { aiConfig } from "./config";
import { OllamaProvider } from "./ollama";
import { GeminiProvider } from "./gemini";
import type { AIProvider } from "./provider";
export function getAIProvider(): AIProvider {
  const { provider } = aiConfig();
  if (!provider)
    throw new Error(
      "A IA está desativada neste ambiente. Você pode continuar organizando seus dados manualmente.",
    );
  if (provider === "ollama") return new OllamaProvider();
  if (provider === "gemini") return new GeminiProvider();
  throw new Error("O provider de IA configurado ainda não é suportado.");
}
