import { z } from "zod";
import { authenticated } from "@/lib/supabase/server";
import { apiError, assertOrigin, databaseError, readBody } from "@/lib/http";
import { pushSubscriptionSchema, pushEndpointSchema } from "@/domain/notifications";
import { schedulerConfigured } from "@/services/push";

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const { db, user } = await authenticated();
    if (!schedulerConfigured())
      throw new Error("As notificações ainda não foram configuradas no servidor.");
    const subscription = pushSubscriptionSchema.parse(await readBody(request));
    const { error } = await db
      .from("push_subscriptions")
      .upsert({ ...subscription, user_id: user.id }, { onConflict: "endpoint" });
    databaseError(error);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertOrigin(request);
    const { db, user } = await authenticated();
    const { endpoint } = z.object({ endpoint: pushEndpointSchema }).parse(await readBody(request));
    const { error } = await db
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);
    databaseError(error);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
