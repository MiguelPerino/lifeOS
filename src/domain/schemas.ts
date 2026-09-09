import { z } from "zod";
export const authSchema = z.object({
  email: z.email("Informe um e-mail válido.").max(254),
  password: z.string().min(8, "Use uma senha de pelo menos 8 caracteres.").max(128),
});
export const dateSchema = z.iso.date().nullable();
const title = z.string().trim().min(1, "Informe um título").max(200);
const tags = z.array(z.string().trim().min(1).max(40)).max(20).default([]);
export const taskStatus = z.enum(["todo", "in_progress", "done", "cancelled"]);
export const priority = z.enum(["low", "medium", "high", "urgent"]);
export const projectStatus = z.enum(["planning", "active", "paused", "completed", "archived"]);
export const noteKind = z.enum(["note", "idea", "event", "reminder"]);
const base = z.object({ id: z.uuid().optional(), title, due_date: dateSchema.default(null) });
export const projectSchema = base.extend({
  description: z.string().max(20000).default(""),
  status: projectStatus.default("planning"),
});
export const taskSchema = base.extend({
  description: z.string().max(20000).default(""),
  status: taskStatus.default("todo"),
  priority: priority.default("medium"),
  project_id: z.uuid().nullable().default(null),
  tags,
  subtasks: z
    .array(z.object({ title, done: z.boolean().default(false) }))
    .max(50)
    .default([]),
  dependencies: z.array(z.uuid()).max(50).default([]),
});
export const noteSchema = base.extend({
  content: z.string().max(40000).default(""),
  kind: noteKind.default("note"),
  project_id: z.uuid().nullable().default(null),
  tags,
});
export const inboxItemSchema = z.object({
  type: z.enum(["task", "project", "note", "idea", "event", "reminder"]),
  title,
  description: z.string().max(20000),
  due_date: dateSchema,
  priority,
  project: z.string().max(200).nullable(),
  tags: z.array(z.string().min(1).max(40)).max(20),
  subtasks: z.array(z.object({ title, done: z.boolean() })).max(50),
  depends_on: z.array(z.number().int().min(0).max(19)).max(20),
});
export const inboxSchema = z
  .object({ items: z.array(inboxItemSchema).min(1).max(20), explanation: z.string().max(2000) })
  .superRefine(({ items }, ctx) => {
    const visiting = new Set<number>();
    const visited = new Set<number>();
    function visit(index: number): boolean {
      if (visiting.has(index)) return false;
      if (visited.has(index)) return true;
      visiting.add(index);
      for (const dep of items[index].depends_on) {
        if (
          !items[dep] ||
          items[index].type !== "task" ||
          items[dep].type !== "task" ||
          !visit(dep)
        )
          return false;
      }
      visiting.delete(index);
      visited.add(index);
      return true;
    }
    if (items.some((_, i) => !visit(i)))
      ctx.addIssue({ code: "custom", message: "Dependências inválidas ou circulares." });
  });
export const planItemSchema = z.object({
  task_id: z.uuid(),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  duration_minutes: z.number().int().min(5).max(480),
});
export const planSchema = z
  .object({ items: z.array(planItemSchema).max(30) })
  .superRefine(({ items }, ctx) => {
    if (new Set(items.map((i) => i.task_id)).size !== items.length)
      ctx.addIssue({ code: "custom", message: "Uma tarefa não pode aparecer duas vezes." });
    let end = 0;
    for (const item of items) {
      const [h, m] = item.start_time.split(":").map(Number);
      const start = h * 60 + m;
      if (start < end || start + item.duration_minutes > 1440)
        ctx.addIssue({
          code: "custom",
          message: "Horários sobrepostos ou fora do dia. Ajuste a ordem e os horários.",
        });
      end = start + item.duration_minutes;
    }
  });
export const toolsSchema = z.object({
  calls: z
    .array(
      z.object({
        name: z.enum([
          "getTasks",
          "getProjects",
          "searchNotes",
          "searchSemanticNotes",
          "getUpcomingDeadlines",
        ]),
        query: z.string().max(300),
      }),
    )
    .min(1)
    .max(5),
});
export const answerSchema = z.object({
  selections: z
    .array(z.object({ source_id: z.uuid(), excerpt: z.string().max(700).nullable() }))
    .max(8),
});
export type TaskInput = z.infer<typeof taskSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type NoteInput = z.infer<typeof noteSchema>;
export type InboxDraft = z.infer<typeof inboxSchema>;
export type PlanItem = z.infer<typeof planItemSchema>;
