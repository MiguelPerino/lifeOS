import { NextResponse } from "next/server";
import { z } from "zod";
import { inboxSchema } from "@/domain/schemas";
import { apiError, assertOrigin, readBody, databaseError } from "@/lib/http";
import { authenticated } from "@/lib/supabase/server";
import { indexNote } from "@/services/embeddings";
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const input = z
      .object({ draft: inboxSchema, request_key: z.uuid() })
      .parse(await readBody(request));
    const { db } = await authenticated();
    const { data, error } = await db.rpc("commit_inbox", {
      items: input.draft.items,
      request_key: input.request_key,
    });
    databaseError(error);
    const records = data as { id: string; type: string }[];
    let pending = 0;
    for (const record of records.filter((r) => !["task", "project"].includes(r.type))) {
      try {
        if (!(await indexNote(record.id)).indexed) pending++;
      } catch {
        pending++;
      }
    }
    return NextResponse.json({
      records,
      warning: pending ? `${pending} nota(s) salva(s) com indexação pendente.` : undefined,
    });
  } catch (error) {
    return apiError(error);
  }
}
