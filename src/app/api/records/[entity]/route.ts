import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated } from "@/lib/supabase/server";
import { apiError, assertOrigin, databaseError, readBody } from "@/lib/http";
import { taskSchema, projectSchema, noteSchema } from "@/domain/schemas";
import { indexNote } from "@/services/embeddings";
const entitySchema = z.enum(["tasks", "projects", "notes"]);
type Context = { params: Promise<{ entity: string }> };
export async function POST(request: Request, context: Context) {
  try {
    assertOrigin(request);
    const entity = entitySchema.parse((await context.params).entity);
    const schema =
      entity === "tasks" ? taskSchema : entity === "projects" ? projectSchema : noteSchema;
    const payload = schema.parse(await readBody(request));
    const { db } = await authenticated();
    const { data: id, error } = await db.rpc("save_record", { entity, payload });
    databaseError(error);
    const indexing = entity === "notes" ? await indexNote(id) : {};
    return NextResponse.json({ id, ...indexing });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    assertOrigin(request);
    const entity = entitySchema.parse((await context.params).entity);
    const { id } = z.object({ id: z.uuid() }).parse(await readBody(request));
    const { db, user } = await authenticated();
    const { data, error } = await db
      .from(entity)
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id");
    databaseError(error);
    if (!data?.length) throw new Error("Registro não encontrado.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
