import type { Activity } from "@/domain/types";
import { Check, Plus, CalendarDays, Pencil } from "lucide-react";
const actions: Record<string, string> = {
  created: "Criou",
  done: "Concluiu",
  completed: "Concluiu",
  todo: "Reabriu",
  in_progress: "Iniciou",
  updated: "Atualizou",
  planned: "Salvou",
  active: "Ativou",
  paused: "Pausou",
  archived: "Arquivou",
  cancelled: "Cancelou",
  planning: "Planejou",
};
export function ActivityList({ activities }: { activities: Activity[] }) {
  return (
    <div className="space-y-5">
      {activities.map((a) => {
        const Icon = ["done", "completed"].includes(a.action)
          ? Check
          : a.action === "created"
            ? Plus
            : a.action === "planned"
              ? CalendarDays
              : Pencil;
        return (
          <div key={a.id} className="flex gap-3">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
              <Icon size={12} />
            </span>
            <div>
              <p className="text-xs leading-5">
                <span className="text-muted-foreground">{actions[a.action] || "Atualizou"} </span>
                {a.title}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {new Date(a.created_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        );
      })}
      {!activities.length && (
        <p className="py-6 text-sm text-muted-foreground">
          Seus movimentos importantes aparecerão aqui.
        </p>
      )}
    </div>
  );
}
