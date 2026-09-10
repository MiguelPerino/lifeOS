import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFile, readdir } from "node:fs/promises";
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
let project: string;
let task: string;
let dependent: string;
async function as(user: string) {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`,
  );
}
async function save(entity: string, payload: object) {
  const r = await db.query<{ id: string }>("select public.save_record($1,$2::jsonb) as id", [
    entity,
    JSON.stringify(payload),
  ]);
  return r.rows[0].id;
}
beforeAll(async () => {
  db = new PGlite({ extensions: { vector, pg_trgm } });
  // Minimal auth contract for a real PostgreSQL engine. Does not emulate Supabase HTTP/Auth.
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  for (const name of (await readdir("supabase/migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
  await db.exec(`insert into auth.users(id) values('${alice}'),('${bob}');`);
  await as(alice);
  project = await save("projects", { title: "RAG", status: "active" });
  task = await save("tasks", {
    title: "Chunking",
    project_id: project,
    tags: ["rag"],
    subtasks: [{ title: "Avaliar overlap", done: false }],
  });
  dependent = await save("tasks", {
    title: "Embeddings",
    project_id: project,
    dependencies: [task],
  });
});
afterAll(async () => {
  await db?.close();
});
describe("Real PostgreSQL migrations and RLS", () => {
  it("isolates notification settings and subscriptions and restricts delivery claims", async () => {
    await as(alice);
    await db.exec("insert into public.notification_preferences(user_id) values(auth.uid());");
    const inserted = await db.query<{ id: string }>(
      "insert into public.push_subscriptions(endpoint,keys) values('https://fcm.googleapis.com/test', '{}') returning id",
    );
    const id = inserted.rows[0].id;
    await as(bob);
    expect((await db.query("select * from public.notification_preferences")).rows).toHaveLength(0);
    expect((await db.query("select * from public.push_subscriptions")).rows).toHaveLength(0);
    await expect(
      db.query("select public.claim_notification($1,'daily:2026-09-09')", [id]),
    ).rejects.toThrow(/permission denied/);
    await expect(db.query("select * from public.notification_deliveries")).rejects.toThrow(
      /permission denied/,
    );
    await db.exec("reset role; set role service_role;");
    const claim = () =>
      db.query<{ claimed: boolean }>(
        "select public.claim_notification($1,'daily:2026-09-09') as claimed",
        [id],
      );
    expect((await claim()).rows[0].claimed).toBe(true);
    expect((await claim()).rows[0].claimed).toBe(false);
    await db.query(
      "update public.notification_deliveries set claimed_at=now()-interval '6 minutes' where subscription_id=$1",
      [id],
    );
    expect((await claim()).rows[0].claimed).toBe(true);
    await db.query(
      "update public.notification_deliveries set sent_at=now(), claimed_at=now()-interval '6 minutes' where subscription_id=$1",
      [id],
    );
    expect((await claim()).rows[0].claimed).toBe(false);
    await as(alice);
    await db.query("delete from public.push_subscriptions where id=$1", [id]);
    await db.exec("reset role;");
    expect((await db.query("select * from public.notification_deliveries")).rows).toHaveLength(0);
    await as(alice);
  });
  it("creates profiles and transactional task relationships", async () => {
    await as(alice);
    expect((await db.query("select * from public.profiles")).rows).toHaveLength(1);
    expect((await db.query("select * from public.task_dependencies")).rows).toHaveLength(1);
    expect((await db.query("select * from public.subtasks")).rows).toHaveLength(1);
    expect((await db.query("select * from public.task_tags")).rows).toHaveLength(1);
  });
  it("isolates every owner table between users", async () => {
    await as(bob);
    for (const table of [
      "projects",
      "tasks",
      "notes",
      "task_dependencies",
      "subtasks",
      "tags",
      "task_tags",
      "note_tags",
      "activities",
      "daily_plans",
      "daily_plan_items",
    ])
      expect((await db.query(`select * from public.${table}`)).rows).toHaveLength(0);
    const update = await db.query("update public.tasks set title=$1 where id=$2 returning id", [
      "stolen",
      task,
    ]);
    expect(update.rows).toHaveLength(0);
    await expect(save("tasks", { id: task, title: "Attempted overwrite" })).rejects.toThrow();
    await expect(
      save("tasks", { title: "Cross-account link", project_id: project }),
    ).rejects.toThrow();
    await expect(
      db.query("insert into public.tasks(user_id,title) values($1,$2)", [alice, "spoof"]),
    ).rejects.toThrow();
  });
  it("rejects cross-account dependencies and plans", async () => {
    await as(bob);
    const own = await save("tasks", { title: "Bob task" });
    await expect(
      save("tasks", { id: own, title: "Bob task", dependencies: [task] }),
    ).rejects.toThrow();
    await expect(
      db.query("select public.save_daily_plan($1,$2::jsonb)", [
        "2026-09-06",
        JSON.stringify([{ task_id: task, start_time: "09:00", duration_minutes: 60 }]),
      ]),
    ).rejects.toThrow();
  });
  it("rejects cycles and rolls back the entire update", async () => {
    await as(alice);
    await expect(
      save("tasks", { id: task, title: "Should roll back", dependencies: [dependent] }),
    ).rejects.toThrow("dependency_cycle");
    expect(
      (await db.query<{ title: string }>("select title from public.tasks where id=$1", [task]))
        .rows[0].title,
    ).toBe("Chunking");
  });
  it("maintains completion timestamps and activities", async () => {
    await as(alice);
    await save("tasks", { id: task, title: "Chunking", status: "done", project_id: project });
    expect(
      (
        await db.query<{ completed_at: string }>(
          "select completed_at from public.tasks where id=$1",
          [task],
        )
      ).rows[0].completed_at,
    ).toBeTruthy();
    await save("tasks", { id: task, title: "Chunking", status: "todo", project_id: project });
    expect(
      (
        await db.query<{ completed_at: string | null }>(
          "select completed_at from public.tasks where id=$1",
          [task],
        )
      ).rows[0].completed_at,
    ).toBeNull();
    expect(
      (await db.query("select * from public.activities where action='done'")).rows,
    ).toHaveLength(1);
  });
  it("persists pgvector notes, invalidates changed embeddings, isolates semantic search", async () => {
    await as(alice);
    const id = await save("notes", {
      title: "Attention",
      content: "Modelos de linguagem",
      project_id: project,
      tags: ["estudos"],
    });
    const embedding = JSON.stringify(Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0)));
    await db.query(
      "update public.notes set embedding=$1::extensions.vector,embedding_status='ready' where id=$2",
      [embedding, id],
    );
    expect(
      (await db.query("select * from public.match_notes($1::extensions.vector,8)", [embedding]))
        .rows,
    ).toHaveLength(1);
    await as(bob);
    expect(
      (await db.query("select * from public.match_notes($1::extensions.vector,8)", [embedding]))
        .rows,
    ).toHaveLength(0);
    await as(alice);
    await save("notes", { id, title: "Attention revisada", content: "Novo conteúdo" });
    expect(
      (
        await db.query<{ embedding: unknown; embedding_status: string }>(
          "select embedding,embedding_status from public.notes where id=$1",
          [id],
        )
      ).rows[0],
    ).toEqual({ embedding: null, embedding_status: "pending" });
  });
  it("commits a whole inbox with ordered dependencies, and rolls back invalid batches", async () => {
    await as(alice);
    const items = [
      {
        type: "task",
        title: "First",
        project: "New Project",
        description: "",
        depends_on: [],
        subtasks: [],
        tags: [],
      },
      {
        type: "task",
        title: "Second",
        project: "New Project",
        description: "",
        depends_on: [0],
        subtasks: [],
        tags: [],
      },
    ];
    const r = await db.query<{ result: { id: string }[] }>(
      "select public.commit_inbox($1::jsonb) as result",
      [JSON.stringify(items)],
    );
    expect(r.rows[0].result).toHaveLength(2);
    const before = (await db.query("select id from public.tasks")).rows.length;
    await expect(
      db.query("select public.commit_inbox($1::jsonb)", [
        JSON.stringify([{ ...items[0], depends_on: [9] }]),
      ]),
    ).rejects.toThrow();
    expect((await db.query("select id from public.tasks")).rows).toHaveLength(before);
  });
  it("retries inbox confirmations without duplicates and resolves explicit projects first", async () => {
    await as(alice);
    const key = "33333333-3333-4333-8333-333333333333";
    const items = [
      { type: "task", title: "Linked task", project: "Explicit project", depends_on: [] },
      { type: "project", title: "Explicit project", description: "A real project", depends_on: [] },
    ];
    const first = await db.query("select public.commit_inbox($1::jsonb,$2::uuid) as result", [
      JSON.stringify(items),
      key,
    ]);
    const second = await db.query("select public.commit_inbox($1::jsonb,$2::uuid) as result", [
      JSON.stringify(items),
      key,
    ]);
    expect(second.rows).toEqual(first.rows);
    expect(
      (await db.query("select id from public.projects where title='Explicit project'")).rows,
    ).toHaveLength(1);
    expect(
      (await db.query("select id from public.tasks where title='Linked task'")).rows,
    ).toHaveLength(1);
  });
  it("rejects completing blocked work and invalid plan order inside SQL", async () => {
    await as(alice);
    await expect(
      save("tasks", { id: dependent, title: "Embeddings", status: "done", dependencies: [task] }),
    ).rejects.toThrow("task_blocked");
    await expect(
      db.query("select public.save_daily_plan($1,$2::jsonb)", [
        "2026-09-07",
        JSON.stringify([{ task_id: dependent, start_time: "09:00", duration_minutes: 60 }]),
      ]),
    ).rejects.toThrow("invalid_plan_dependency");
    await expect(
      db.query("select public.save_daily_plan($1,$2::jsonb)", [
        "2026-09-07",
        JSON.stringify([{ task_id: task, start_time: "23:00", duration_minutes: 120 }]),
      ]),
    ).rejects.toThrow("invalid_plan_time");
  });
  it("saves and replaces plan items without changing task status", async () => {
    await as(alice);
    const items = [{ task_id: task, start_time: "09:00", duration_minutes: 60 }];
    await db.query("select public.save_daily_plan($1,$2::jsonb)", [
      "2026-09-06",
      JSON.stringify(items),
    ]);
    expect((await db.query("select * from public.daily_plan_items")).rows).toHaveLength(1);
    await db.query("select public.save_daily_plan($1,$2::jsonb)", ["2026-09-06", "[]"]);
    expect((await db.query("select * from public.daily_plan_items")).rows).toHaveLength(0);
    expect(
      (await db.query<{ status: string }>("select status from public.tasks where id=$1", [task]))
        .rows[0].status,
    ).toBe("todo");
  });
  it("project deletion preserves tasks and notes and clears their project link", async () => {
    await as(alice);
    await db.query("delete from public.projects where id=$1", [project]);
    expect(
      (
        await db.query<{ project_id: string | null }>(
          "select project_id from public.tasks where id=$1",
          [task],
        )
      ).rows[0].project_id,
    ).toBeNull();
  });
});
