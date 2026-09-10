import { authenticated } from "@/lib/supabase/server";
import { apiError, assertOrigin, readBody, databaseError } from "@/lib/http";
import { financeQuerySchema, financeRequestSchema } from "@/domain/finances";
import { financeError } from "@/services/finances";

export async function GET(request: Request) {
  try {
    const { db } = await authenticated();
    const query = financeQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const { data, error } = await db.rpc("read_finances", {
      month_start: `${query.month}-01`,
      today: query.day,
      category_filter: query.category,
      page_number: query.page,
    });
    databaseError(error);
    return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const { db } = await authenticated();
    const { command, request_key } = financeRequestSchema.parse(await readBody(request));
    const { data, error } = await db.rpc("write_finance", { ...command, request_key });
    financeError(error);
    databaseError(error);
    return Response.json(data);
  } catch (error) {
    return apiError(error);
  }
}
