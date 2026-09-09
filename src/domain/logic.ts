import type { Task, Project } from "./types";
import type { PlanItem } from "./schemas";
export const isOpen = (task: Pick<Task, "status">) =>
  task.status !== "done" && task.status !== "cancelled";
export function blockedBy(task: Task, tasks: Task[]) {
  return tasks.filter((t) => task.dependencies.includes(t.id) && t.status !== "done");
}
export function progress(project: Project, tasks: Task[]) {
  const related = tasks.filter((t) => t.project_id === project.id && t.status !== "cancelled");
  return related.length
    ? Math.round((related.filter((t) => t.status === "done").length / related.length) * 100)
    : 0;
}
export const priorityWeight = { low: 1, medium: 2, high: 3, urgent: 4 };
export function rankedTasks(tasks: Task[], day: string) {
  return tasks.filter(isOpen).sort((a, b) => {
    const score = (t: Task) =>
      (t.due_date && t.due_date < day ? 100 : 0) +
      (t.due_date === day ? 50 : 0) +
      priorityWeight[t.priority] * 5;
    return score(b) - score(a) || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  });
}
export function validatePlanTasks(items: PlanItem[], tasks: Task[]) {
  const scheduled = new Set<string>();
  for (const item of items) {
    const task = tasks.find((t) => t.id === item.task_id);
    if (!task || !isOpen(task))
      throw new Error("O plano contém uma tarefa indisponível. Gere ou edite o plano novamente.");
    if (blockedBy(task, tasks).some((t) => !scheduled.has(t.id)))
      throw new Error("Uma dependência precisa ser concluída ou aparecer antes no plano.");
    scheduled.add(task.id);
  }
}
