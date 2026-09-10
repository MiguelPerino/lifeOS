import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido.");
export const notificationPreferencesSchema = z.object({
  timezone: z
    .string()
    .max(80)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Fuso horário inválido."),
  daily_enabled: z.boolean(),
  daily_time: time,
  pending_enabled: z.boolean(),
  pending_time: time,
  deadline_enabled: z.boolean(),
  deadline_time: time,
  overdue_enabled: z.boolean(),
  overdue_time: time,
  quiet_start: time,
  quiet_end: time,
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export const defaultNotificationPreferences: NotificationPreferences = {
  timezone: "America/Sao_Paulo",
  daily_enabled: true,
  daily_time: "08:00",
  pending_enabled: true,
  pending_time: "17:00",
  deadline_enabled: true,
  deadline_time: "19:00",
  overdue_enabled: false,
  overdue_time: "09:00",
  quiet_start: "22:00",
  quiet_end: "07:00",
};
export type NotificationTask = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
};
export type PushMessage = { key: string; title: string; body: string; url: string };
export function localClock(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
export function isQuiet(time: string, start: string, end: string) {
  if (start === end) return false;
  return start < end ? time >= start && time < end : time >= start || time < end;
}
export function notificationsDue(
  now: Date,
  preferences: NotificationPreferences,
  tasks: NotificationTask[],
  plannedIds: string[] = [],
): PushMessage[] {
  const { day, time } = localClock(now, preferences.timezone);
  if (isQuiet(time, preferences.quiet_start, preferences.quiet_end)) return [];
  const tomorrow = new Date(`${day}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const nextDay = tomorrow.toISOString().slice(0, 10);
  const open = tasks.filter((t) => t.status === "todo" || t.status === "in_progress");
  const today = open.filter((t) => t.due_date === day || plannedIds.includes(t.id));
  const messages: PushMessage[] = [];
  const add = (
    kind: "daily" | "pending" | "deadline" | "overdue",
    title: string,
    items: NotificationTask[],
    fallback: string,
  ) => {
    const elapsed = minutes(time) - minutes(preferences[`${kind}_time`]);
    // A short catch-up window tolerates scheduler delays without delivering stale digests.
    if (
      !preferences[`${kind}_enabled`] ||
      elapsed < 0 ||
      elapsed >= 30 ||
      !items.length ||
      isQuiet(preferences[`${kind}_time`], preferences.quiet_start, preferences.quiet_end)
    )
      return;
    const titles = items
      .slice(0, 2)
      .map((t) => t.title.slice(0, 65))
      .join(" · ");
    messages.push({
      key: `${kind}:${day}`,
      title,
      body: `${items.length} ${items.length === 1 ? "tarefa pendente" : "tarefas pendentes"}: ${titles}${items.length > 2 ? "…" : ""}`,
      url: items.length === 1 ? `/tasks?id=${items[0].id}` : fallback,
    });
  };
  add("daily", "Seu dia no LifeOS", today, "/today");
  add("pending", "Ainda dá tempo hoje", today, "/today");
  add(
    "deadline",
    "Prazos chegando: amanhã",
    open.filter((t) => t.due_date === nextDay),
    "/tasks",
  );
  add(
    "overdue",
    "Vamos revisar os atrasos?",
    open.filter((t) => t.due_date && t.due_date < day),
    "/tasks",
  );
  return messages;
}

// Never send server requests to an arbitrary URL supplied by a browser.
export const pushEndpointSchema = z
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      (url.hostname === "fcm.googleapis.com" ||
        url.hostname === "updates.push.services.mozilla.com" ||
        url.hostname === "web.push.apple.com" ||
        url.hostname.endsWith(".notify.windows.com"))
    );
  }, "Serviço de notificações não suportado neste navegador.");
export const pushSubscriptionSchema = z.object({
  endpoint: pushEndpointSchema,
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}=?$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22}={0,2}$/),
  }),
});
