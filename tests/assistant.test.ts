import { describe, it, expect, vi, beforeEach } from "vitest";
import { taskSchema } from "@/domain/schemas";
import type { Workspace, Note } from "@/domain/types";
const model = vi.hoisted(() => ({ generateStructured: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai", () => ({ getAIProvider: () => model }));
vi.mock("@/services/embeddings", () => ({ semanticSearch: vi.fn().mockResolvedValue([]) }));
import { runAssistant } from "@/services/assistant";
const id = "11111111-1111-4111-8111-111111111111";
const workspace: Workspace = {
  displayName: "Test",
  aiEnabled: true,
  projects: [],
  notes: [],
  activities: [],
  tasks: [
    {
      ...taskSchema.parse({ title: "Chunking", due_date: "2026-09-10", priority: "urgent" }),
      id,
      user_id: id,
      created_at: "2026-09-06T12:00:00Z",
      updated_at: "2026-09-06T12:00:00Z",
      completed_at: null,
    },
  ],
};
beforeEach(() => model.generateStructured.mockReset());
describe("Assistant grounding", () => {
  it("constructs titles, priorities and dates only from actual database fields", async () => {
    model.generateStructured
      .mockResolvedValueOnce({ calls: [{ name: "getTasks", query: "urgent" }] })
      .mockResolvedValueOnce({
        selections: [{ source_id: id, excerpt: "Prazo inventado: 2030-01-01" }],
      });
    const result = await runAssistant("Tarefas urgentes?", "2026-09-06", workspace);
    expect(result.paragraphs[0].text).toContain("2026-09-10");
    expect(result.paragraphs[0].text).toContain("urgente");
    expect(result.paragraphs[0].text).not.toContain("2030");
  });
  it("rejects invented source IDs even when an AI response is structurally valid", async () => {
    model.generateStructured
      .mockResolvedValueOnce({ calls: [{ name: "getTasks", query: "" }] })
      .mockResolvedValueOnce({
        selections: [{ source_id: "22222222-2222-4222-8222-222222222222", excerpt: null }],
      });
    await expect(runAssistant("Tarefas?", "2026-09-06", workspace)).rejects.toThrow(
      "referência inválida",
    );
  });
  it("rejects note quotations not present in the source", async () => {
    const note: Note = {
      id,
      user_id: id,
      title: "Attention",
      content: "Tokens consultam outros tokens.",
      kind: "note",
      project_id: null,
      due_date: null,
      tags: [],
      embedding_status: "ready",
      created_at: "",
      updated_at: "",
    };
    model.generateStructured
      .mockResolvedValueOnce({ calls: [{ name: "searchNotes", query: "Attention" }] })
      .mockResolvedValueOnce({ selections: [{ source_id: id, excerpt: "Conteúdo inventado" }] });
    await expect(
      runAssistant("Explique Attention", "2026-09-06", { ...workspace, notes: [note] }),
    ).rejects.toThrow("não corresponde");
  });
  it("does not ask the model to manufacture an answer when tools find no data", async () => {
    model.generateStructured.mockResolvedValueOnce({ calls: [{ name: "getTasks", query: "" }] });
    expect((await runAssistant("Tarefas?", "2026-09-06", { ...workspace, tasks: [] })).empty).toBe(
      true,
    );
    expect(model.generateStructured).toHaveBeenCalledTimes(1);
  });
});
