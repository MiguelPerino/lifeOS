import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  embed: vi.fn(),
  enabled: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  authenticated: async () => ({ db: { from: mocks.from, rpc: mocks.rpc }, user: { id: "owner" } }),
}));
vi.mock("@/lib/ai", () => ({ getAIProvider: () => ({ embed: mocks.embed }) }));
vi.mock("@/lib/ai/config", () => ({
  aiConfig: () => ({ embeddingModel: "gemini-embedding-001" }),
  aiEnabled: mocks.enabled,
}));
import { indexNote, semanticSearch } from "@/services/embeddings";
function query(result: object) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
    update: vi.fn(),
    then: Promise.resolve(result).then.bind(Promise.resolve(result)),
  };
  for (const method of [chain.select, chain.eq, chain.or, chain.limit, chain.single, chain.update])
    method.mockReturnValue(chain);
  return chain;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.enabled.mockReturnValue(true);
});
describe("embedding provider changes", () => {
  it("records the actual Gemini model on successful indexing", async () => {
    const read = query({
      data: { id: "note", title: "Title", content: "Text", updated_at: "version" },
      error: null,
    });
    const write = query({ data: [{ id: "note" }], error: null });
    mocks.from.mockReturnValueOnce(read).mockReturnValueOnce(write);
    mocks.embed.mockResolvedValue([1, 0]);
    expect(await indexNote("note")).toEqual({ indexed: true });
    expect(write.update).toHaveBeenCalledWith(
      expect.objectContaining({
        embedding_model: "gemini-embedding-001",
        embedding_status: "ready",
      }),
    );
    expect(write.eq).toHaveBeenCalledWith("updated_at", "version");
  });
  it("keeps a saved note usable after quota exhaustion", async () => {
    mocks.from
      .mockReturnValueOnce(
        query({
          data: { id: "note", title: "Title", content: "Text", updated_at: "version" },
          error: null,
        }),
      )
      .mockReturnValueOnce(query({ error: null }));
    mocks.embed.mockRejectedValue(new Error("Cota atingida"));
    expect(await indexNote("note")).toMatchObject({
      indexed: false,
      warning: expect.stringContaining("Nota salva"),
    });
  });
  it("does not call AI when the key is missing", async () => {
    mocks.enabled.mockReturnValue(false);
    mocks.from.mockReturnValue(query({ data: { id: "note" }, error: null }));
    expect(await indexNote("note")).toMatchObject({ indexed: false });
    expect(mocks.embed).not.toHaveBeenCalled();
  });
  it("rejects old embedding spaces before generating a query vector", async () => {
    mocks.from.mockReturnValue(
      query({ data: [{ embedding_model: "nomic-embed-text" }], error: null }),
    );
    await expect(semanticSearch("texto")).rejects.toThrow("Reindexar");
    expect(mocks.embed).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("searches when indexed notes use the active model", async () => {
    mocks.from.mockReturnValue(query({ data: [], error: null }));
    mocks.embed.mockResolvedValue([1, 0]);
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    expect(await semanticSearch("texto")).toEqual([]);
    expect(mocks.embed).toHaveBeenCalledWith("texto", "query");
    expect(mocks.rpc).toHaveBeenCalledWith("match_notes", {
      query_embedding: "[1,0]",
      match_count: 8,
    });
  });
});
