import { NextResponse } from "next/server";
import { z } from "zod";
import { planSchema } from "@/domain/schemas";
import { apiError, assertOrigin, readBody, databaseError } from "@/lib/http";
import { authenticated } from "@/lib/supabase/server";
import { getPlan, getWorkspace } from "@/services/workspace";
import { validatePlanTasks } from "@/domain/logic";
export async function GET(request: Request) {
  try {
    const day = z.iso.date().parse(new URL(request.url).searchParams.get("day"));
    return NextResponse.json({ plan: await getPlan(day) });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const input = z.object({ day: z.iso.date(), plan: planSchema }).parse(await readBody(request));
    const workspace = await getWorkspace();
    validatePlanTasks(input.plan.items, workspace.tasks);
    const { db } = await authenticated();
    const { data, error } = await db.rpc("save_daily_plan", {
      day: input.day,
      items: input.plan.items,
    });
    databaseError(error);
    return NextResponse.json({ id: data });
  } catch (error) {
    return apiError(error);
  }
}
