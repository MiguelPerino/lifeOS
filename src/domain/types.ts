import type { NoteInput, ProjectInput, TaskInput, PlanItem } from "./schemas";
type Persisted = { id: string; user_id: string; created_at: string; updated_at: string };
export type Task = TaskInput & Persisted & { completed_at: string | null };
export type Project = ProjectInput & Persisted;
export type Note = NoteInput & Persisted & { embedding_status: "pending" | "ready" | "failed" };
export type Activity = {
  id: string;
  entity_type: string;
  entity_id: string;
  project_id: string | null;
  action: string;
  title: string;
  created_at: string;
};
export type Workspace = {
  tasks: Task[];
  projects: Project[];
  notes: Note[];
  activities: Activity[];
  displayName: string;
  aiEnabled: boolean;
};
export type DailyPlan = { id: string; plan_date: string; items: PlanItem[] };
export type Entity = "tasks" | "projects" | "notes";
export type Source = { id: string; title: string; type: Entity; detail: string };
export const statusLabels: Record<string, string> = {
  todo: "A fazer",
  in_progress: "Em andamento",
  done: "Concluída",
  cancelled: "Cancelada",
  planning: "Planejando",
  active: "Em andamento",
  paused: "Pausado",
  completed: "Concluído",
  archived: "Arquivado",
};
export const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};
export const kindLabels: Record<string, string> = {
  task: "Tarefa",
  project: "Projeto",
  note: "Nota",
  idea: "Ideia",
  event: "Evento",
  reminder: "Lembrete",
};
