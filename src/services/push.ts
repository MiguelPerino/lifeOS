import "server-only";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { pushSubscriptionSchema, type PushMessage } from "@/domain/notifications";

export function pushConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT,
  );
}
export function schedulerConfigured() {
  return (
    pushConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.CRON_SECRET)
  );
}
export function notificationAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Configure o serviço de notificações no servidor.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function sendPush(subscription: unknown, message: PushMessage) {
  if (!pushConfigured())
    throw new Error("As notificações ainda não foram configuradas no servidor.");
  const safe = pushSubscriptionSchema.parse(subscription);
  await webpush.sendNotification(safe, JSON.stringify(message), {
    vapidDetails: {
      subject: process.env.VAPID_SUBJECT!,
      publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      privateKey: process.env.VAPID_PRIVATE_KEY!,
    },
    TTL: 1800,
    urgency: "normal",
    timeout: 5000,
  });
}
export function expiredSubscription(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error.statusCode === 404 || error.statusCode === 410)
  );
}
