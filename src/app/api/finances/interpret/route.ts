import { z } from "zod";
import { authenticated } from "@/lib/supabase/server";
import { apiError, assertOrigin, readBody } from "@/lib/http";
import { interpretExpense } from "@/services/finances";

export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await authenticated();
    const input = z
      .object({ text: z.string().trim().min(3).max(1000), day: z.iso.date() })
      .parse(await readBody(request));
    return Response.json(await interpretExpense(input.text, input.day));
  } catch (error) {
    return apiError(error);
  }
}
