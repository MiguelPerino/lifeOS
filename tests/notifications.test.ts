import { describe, expect, it, vi, afterEach } from "vitest";
import {
  defaultNotificationPreferences as defaults,
  notificationsDue,
  isQuiet,
  localClock,
  notificationPreferencesSchema,
  pushEndpointSchema,
} from "@/domain/notifications";
vi.mock("server-only", () => ({}));
import { authorizedCron } from "@/lib/cron-auth";

afterEach(() => vi.unstubAllEnvs());
const tasks = [
  { id: "today", title: "Entregar projeto", status: "todo", due_date: "2026-09-09" },
  { id: "done", title: "Já terminei", status: "done", due_date: "2026-09-09" },
  { id: "cancelled", title: "Cancelada", status: "cancelled", due_date: "2026-09-10" },
  { id: "tomorrow", title: "Revisão", status: "in_progress", due_date: "2026-09-10" },
  { id: "late", title: "Atrasada", status: "todo", due_date: "2026-09-08" },
  { id: "planned", title: "Estudar", status: "todo", due_date: null },
];
describe("task notifications", () => {
  it("uses local dates and includes planned tasks without duplicating tasks", () => {
    const result = notificationsDue(new Date("2026-09-09T11:05:00Z"), defaults, tasks, [
      "today",
      "planned",
      "done",
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ key: "daily:2026-09-09", url: "/today" });
    expect(result[0].body).toContain("2 tarefas pendentes");
    expect(result[0].body).not.toContain("Já terminei");
    expect(localClock(new Date("2026-09-10T01:00:00Z"), defaults.timezone).day).toBe("2026-09-09");
  });
  it("reminds only about open tasks tomorrow and links to a single task", () => {
    const result = notificationsDue(new Date("2026-09-09T22:00:00Z"), defaults, tasks);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ key: "deadline:2026-09-09", url: "/tasks?id=tomorrow" });
  });
  it("rechecks pending work for the afternoon", () => {
    expect(notificationsDue(new Date("2026-09-09T20:00:00Z"), defaults, tasks)[0].key).toBe(
      "pending:2026-09-09",
    );
    expect(
      notificationsDue(
        new Date("2026-09-09T20:00:00Z"),
        defaults,
        tasks.map((t) => ({ ...t, status: "done" })),
      ),
    ).toEqual([]);
  });
  it("only sends overdue digests when opted in", () => {
    const now = new Date("2026-09-09T12:00:00Z");
    expect(notificationsDue(now, defaults, tasks)).toEqual([]);
    expect(notificationsDue(now, { ...defaults, overdue_enabled: true }, tasks)[0].url).toBe(
      "/tasks?id=late",
    );
  });
  it("allows a 30 minute catch-up window, with no early or stale notification", () => {
    expect(notificationsDue(new Date("2026-09-09T10:59:00Z"), defaults, tasks)).toEqual([]);
    expect(notificationsDue(new Date("2026-09-09T11:29:59Z"), defaults, tasks)).toHaveLength(1);
    expect(notificationsDue(new Date("2026-09-09T11:30:00Z"), defaults, tasks)).toEqual([]);
  });
  it("respects quiet hours including intervals across midnight", () => {
    expect(isQuiet("23:00", "22:00", "07:00")).toBe(true);
    expect(isQuiet("06:59", "22:00", "07:00")).toBe(true);
    expect(isQuiet("07:00", "22:00", "07:00")).toBe(false);
    expect(isQuiet("12:00", "11:00", "14:00")).toBe(true);
    expect(isQuiet("12:00", "12:00", "12:00")).toBe(false);
    expect(
      notificationsDue(
        new Date("2026-09-09T11:00:00Z"),
        { ...defaults, quiet_end: "09:00" },
        tasks,
      ),
    ).toEqual([]);
  });
  it("handles year rollover and daylight-saving time", () => {
    const end = [{ id: "next", title: "Ano novo", status: "todo", due_date: "2027-01-01" }];
    expect(notificationsDue(new Date("2026-12-31T22:00:00Z"), defaults, end)).toHaveLength(1);
    const prefs = { ...defaults, timezone: "America/New_York" };
    const work = [{ ...tasks[0], due_date: "2026-03-08" }];
    expect(notificationsDue(new Date("2026-03-08T12:00:00Z"), prefs, work)).toHaveLength(1);
  });
  it("does not postpone a silenced digest until the quiet period ends", () => {
    expect(
      notificationsDue(
        new Date("2026-09-09T11:10:00Z"),
        { ...defaults, quiet_end: "08:05" },
        tasks,
      ),
    ).toEqual([]);
  });
  it("rejects invalid preferences and untrusted push endpoints", () => {
    expect(
      notificationPreferencesSchema.safeParse({ ...defaults, daily_time: "25:00" }).success,
    ).toBe(false);
    expect(
      notificationPreferencesSchema.safeParse({ ...defaults, timezone: "invalid" }).success,
    ).toBe(false);
    for (const endpoint of [
      "http://fcm.googleapis.com/x",
      "https://127.0.0.1/x",
      "https://fcm.googleapis.com.evil.test/x",
      "https://user:pass@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
    ])
      expect(pushEndpointSchema.safeParse(endpoint).success).toBe(false);
    expect(pushEndpointSchema.safeParse("https://fcm.googleapis.com/fcm/send/token").success).toBe(
      true,
    );
  });
  it("fails closed for missing or incorrect scheduler secrets", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(authorizedCron(new Request("https://lifeos.test/api/cron/notifications"))).toBe(false);
    vi.stubEnv("CRON_SECRET", "private-secret");
    for (const authorization of ["", "Bearer wrong", "private-secret"])
      expect(
        authorizedCron(new Request("https://lifeos.test", { headers: { authorization } })),
      ).toBe(false);
    expect(
      authorizedCron(
        new Request("https://lifeos.test", { headers: { authorization: "Bearer private-secret" } }),
      ),
    ).toBe(true);
  });
});
