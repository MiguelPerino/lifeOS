import { describe, it, expect } from "vitest";
import { inboxSchema, planSchema, taskSchema } from "@/domain/schemas";
import { blockedBy, progress, validatePlanTasks } from "@/domain/logic";
import type { Task, Project } from "@/domain/types";
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const task = (id: string, status: Task["status"] = "todo", dependencies: string[] = []): Task => ({
  ...taskSchema.parse({ title: "Tarefa", status, dependencies }),
  id,
  user_id: a,
  created_at: "2026-09-06T12:00:00Z",
  updated_at: "2026-09-06T12:00:00Z",
  completed_at: null,
  project_id: a,
});
const item = {
  type: "task",
  title: "Chunking",
  description: "",
  due_date: null,
  priority: "high",
  project: "RAG",
  tags: [],
  subtasks: [],
  depends_on: [],
};
describe("Structured AI validation", () => {
  it("rejects impossible dates and invented priorities", () => {
    expect(
      inboxSchema.safeParse({ items: [{ ...item, due_date: "2026-02-31" }], explanation: "" })
        .success,
    ).toBe(false);
    expect(
      inboxSchema.safeParse({ items: [{ ...item, priority: "critical" }], explanation: "" })
        .success,
    ).toBe(false);
  });
  it("accepts sequential dependencies and rejects cycles or invalid indexes", () => {
    expect(
      inboxSchema.safeParse({ items: [item, { ...item, depends_on: [0] }], explanation: "" })
        .success,
    ).toBe(true);
    expect(
      inboxSchema.safeParse({
        items: [
          { ...item, depends_on: [1] },
          { ...item, depends_on: [0] },
        ],
        explanation: "",
      }).success,
    ).toBe(false);
    expect(
      inboxSchema.safeParse({ items: [{ ...item, depends_on: [8] }], explanation: "" }).success,
    ).toBe(false);
  });
  it("rejects overlapping, duplicate and overflowing plan items", () => {
    const first = { task_id: a, start_time: "09:00", duration_minutes: 60 };
    expect(
      planSchema.safeParse({ items: [first, { ...first, task_id: b, start_time: "09:30" }] })
        .success,
    ).toBe(false);
    expect(
      planSchema.safeParse({ items: [first, { ...first, start_time: "10:00" }] }).success,
    ).toBe(false);
    expect(planSchema.safeParse({ items: [{ ...first, start_time: "23:30" }] }).success).toBe(
      false,
    );
  });
});
describe("Deterministic business rules", () => {
  it("keeps cancelled dependencies blocked until explicitly resolved", () => {
    expect(blockedBy(task(b, "todo", [a]), [task(a, "cancelled")])).toHaveLength(1);
    expect(blockedBy(task(b, "todo", [a]), [task(a, "done")])).toHaveLength(0);
  });
  it("requires dependencies before dependent work in a daily plan", () => {
    const tasks = [task(a), task(b, "todo", [a])];
    const plan = [{ task_id: b, start_time: "09:00", duration_minutes: 60 }];
    expect(() => validatePlanTasks(plan, tasks)).toThrow();
    expect(() =>
      validatePlanTasks(
        [{ task_id: a, start_time: "08:00", duration_minutes: 60 }, ...plan],
        tasks,
      ),
    ).not.toThrow();
  });
  it("calculates progress without cancelled tasks", () => {
    expect(progress({ id: a } as Project, [task(a, "done"), task(b, "cancelled")])).toBe(100);
    expect(progress({ id: a } as Project, [])).toBe(0);
  });
});
