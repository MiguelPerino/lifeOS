import { authorizedCron } from "@/lib/cron-auth";
import { databaseError } from "@/lib/http";
import {
  localClock,
  notificationPreferencesSchema,
  notificationsDue,
  type NotificationTask,
} from "@/domain/notifications";
import {
  expiredSubscription,
  notificationAdmin,
  schedulerConfigured,
  sendPush,
} from "@/services/push";

export const runtime = "nodejs";
export const maxDuration = 60;
async function dispatch(request: Request) {
  if (!authorizedCron(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!schedulerConfigured()) return Response.json({ error: "Not configured" }, { status: 503 });
  const started = Date.now();
  const now = new Date();
  let sent = 0;
  let failed = 0;
  try {
    const db = notificationAdmin();
    databaseError(
      (
        await db
          .from("notification_deliveries")
          .delete()
          .lt("claimed_at", new Date(now.getTime() - 7 * 86400000).toISOString())
      ).error,
    );
    for (let offset = 0; ; offset += 100) {
      const subscriptions = await db
        .from("push_subscriptions")
        .select("*")
        .order("id")
        .range(offset, offset + 99);
      databaseError(subscriptions.error);
      for (const subscription of subscriptions.data ?? []) {
        if (Date.now() - started > 45000)
          return Response.json({ sent, failed, incomplete: true }, { status: 503 });
        try {
          const prefs = await db
            .from("notification_preferences")
            .select("*")
            .eq("user_id", subscription.user_id)
            .maybeSingle();
          databaseError(prefs.error);
          // No saved preferences means the user has not completed activation.
          if (!prefs.data) continue;
          const preferences = notificationPreferencesSchema.parse(prefs.data);
          const day = localClock(now, preferences.timezone).day;
          const plans = await db
            .from("daily_plans")
            .select("daily_plan_items(task_id)")
            .eq("user_id", subscription.user_id)
            .eq("plan_date", day);
          databaseError(plans.error);
          const planned = (plans.data ?? []).flatMap((p) =>
            p.daily_plan_items.map((i) => i.task_id as string),
          );
          const tasks: NotificationTask[] = [];
          for (let page = 0; ; page += 1000) {
            const batch = await db
              .from("tasks")
              .select("id,title,status,due_date")
              .eq("user_id", subscription.user_id)
              .in("status", ["todo", "in_progress"])
              .order("id")
              .range(page, page + 999);
            databaseError(batch.error);
            tasks.push(...(batch.data ?? []));
            if ((batch.data?.length ?? 0) < 1000) break;
          }
          for (const message of notificationsDue(now, preferences, tasks, planned)) {
            if (Date.now() - started > 45000)
              return Response.json({ sent, failed, incomplete: true }, { status: 503 });
            const claim = await db.rpc("claim_notification", {
              p_subscription: subscription.id,
              p_key: message.key,
            });
            databaseError(claim.error);
            if (!claim.data) continue;
            try {
              await sendPush(subscription, message);
            } catch (error) {
              if (expiredSubscription(error)) {
                databaseError(
                  (await db.from("push_subscriptions").delete().eq("id", subscription.id)).error,
                );
                break;
              }
              failed++;
              // Leave the lease for a later attempt; never loop on a failing push service.
              continue;
            }
            databaseError(
              (
                await db
                  .from("notification_deliveries")
                  .update({ sent_at: new Date().toISOString() })
                  .eq("subscription_id", subscription.id)
                  .eq("message_key", message.key)
              ).error,
            );
            sent++;
          }
        } catch {
          failed++;
        }
      }
      if ((subscriptions.data?.length ?? 0) < 100) break;
    }
    return Response.json(
      { sent, failed },
      { status: failed ? 503 : 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "Notification dispatch failed", sent, failed }, { status: 503 });
  }
}
export const GET = dispatch;
export const POST = dispatch;
