import "server-only";
import { authenticated } from "@/lib/supabase/server";
import { databaseError } from "@/lib/http";
import { aiEnabled } from "@/lib/ai/config";
import type { Task, Note, Project, Activity, Workspace, DailyPlan } from "@/domain/types";
import type { PlanItem } from "@/domain/schemas";
type Link = { task_id?: string; note_id?: string; tag_id: string };
export async function getWorkspace(): Promise<Workspace> {
  const { db, user } = await authenticated();
  async function all<T>(table: string, columns = "*"): Promise<T[]> {
    const output: T[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db
        .from(table)
        .select(columns)
        .eq("user_id", user.id)
        .order(
          table.endsWith("_tags") ? "tag_id" : table === "task_dependencies" ? "task_id" : "id",
        )
        .range(offset, offset + 999);
      databaseError(error);
      output.push(...(data as unknown as T[]));
      if (!data || data.length < 1000) return output;
    }
  }
  const [
    projects,
    rawTasks,
    rawNotes,
    dependencies,
    subtasks,
    tags,
    taskTags,
    noteTags,
    activityResult,
    profile,
  ] = await Promise.all([
    all<Project>("projects"),
    all<Task>("tasks"),
    all<Note>(
      "notes",
      "id,user_id,title,content,kind,due_date,project_id,embedding_status,created_at,updated_at",
    ),
    all<{ task_id: string; depends_on_id: string }>("task_dependencies"),
    all<{ task_id: string; title: string; done: boolean; position: number }>("subtasks"),
    all<{ id: string; name: string }>("tags"),
    all<Link>("task_tags"),
    all<Link>("note_tags"),
    db
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("profiles").select("display_name").eq("id", user.id).single(),
  ]);
  databaseError(activityResult.error);
  databaseError(profile.error);
  const tagNames = (links: Link[]) =>
    links
      .map((l) => tags.find((t) => t.id === l.tag_id)?.name)
      .filter((t): t is string => Boolean(t));
  return {
    projects,
    tasks: rawTasks.map((t) => ({
      ...t,
      tags: tagNames(taskTags.filter((l) => l.task_id === t.id)),
      dependencies: dependencies.filter((d) => d.task_id === t.id).map((d) => d.depends_on_id),
      subtasks: subtasks
        .filter((s) => s.task_id === t.id)
        .sort((a, b) => a.position - b.position)
        .map((s) => ({ title: s.title, done: s.done })),
    })),
    notes: rawNotes.map((n) => ({
      ...n,
      tags: tagNames(noteTags.filter((l) => l.note_id === n.id)),
    })),
    activities: activityResult.data as Activity[],
    displayName: profile.data?.display_name || user.email?.split("@")[0] || "Você",
    aiEnabled: aiEnabled(),
  };
}
export async function getPlan(day: string): Promise<DailyPlan | null> {
  const { db, user } = await authenticated();
  const { data, error } = await db
    .from("daily_plans")
    .select("id,plan_date,daily_plan_items(task_id,start_time,duration_minutes,position)")
    .eq("user_id", user.id)
    .eq("plan_date", day)
    .maybeSingle();
  databaseError(error);
  if (!data) return null;
  const items = data.daily_plan_items as (PlanItem & { position: number })[];
  return {
    id: data.id,
    plan_date: data.plan_date,
    items: items
      .sort((a, b) => a.position - b.position)
      .map((i) => ({
        task_id: i.task_id,
        start_time: i.start_time.slice(0, 5),
        duration_minutes: i.duration_minutes,
      })),
  };
}
