import "server-only";
export function aiConfig() {
  const provider = process.env.AI_PROVIDER?.trim() || "";
  return {
    provider,
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || "",
    geminiChatModel: process.env.GEMINI_CHAT_MODEL?.trim() || "gemini-3.5-flash-lite",
    geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-001",
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    chatModel: process.env.OLLAMA_CHAT_MODEL || "qwen2.5:1.5b",
    embeddingModel:
      provider === "gemini"
        ? process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-001"
        : process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text",
  };
}
export function aiEnabled() {
  const config = aiConfig();
  return (
    config.provider === "ollama" || (config.provider === "gemini" && Boolean(config.geminiApiKey))
  );
}
