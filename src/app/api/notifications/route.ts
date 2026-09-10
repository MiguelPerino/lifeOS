import { authenticated } from "@/lib/supabase/server";
import { apiError, assertOrigin, databaseError, readBody } from "@/lib/http";
import {
  defaultNotificationPreferences,
  notificationPreferencesSchema,
} from "@/domain/notifications";
import { schedulerConfigured } from "@/services/push";

export async function GET() {
  try {
    const { db, user } = await authenticated();
    const { data, error } = await db
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    databaseError(error);
    return Response.json(
      { preferences: data ?? defaultNotificationPreferences, configured: schedulerConfigured() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function PUT(request: Request) {
  try {
    assertOrigin(request);
    const { db, user } = await authenticated();
    const preferences = notificationPreferencesSchema.parse(await readBody(request));
    const { error } = await db
      .from("notification_preferences")
      .upsert({ ...preferences, user_id: user.id });
    databaseError(error);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
