import { z } from "zod";
import { authenticated } from "@/lib/supabase/server";
import { apiError, assertOrigin, databaseError, readBody } from "@/lib/http";
import { pushEndpointSchema } from "@/domain/notifications";
import { expiredSubscription, notificationAdmin, sendPush } from "@/services/push";

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const { db, user } = await authenticated();
    const { endpoint } = z.object({ endpoint: pushEndpointSchema }).parse(await readBody(request));
    const { data: subscription, error } = await db
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("endpoint", endpoint)
      .single();
    databaseError(error);
    const admin = notificationAdmin();
    const key = `test:${Math.floor(Date.now() / 60000)}`;
    const claim = await admin.rpc("claim_notification", {
      p_subscription: subscription.id,
      p_key: key,
    });
    databaseError(claim.error);
    if (!claim.data)
      return Response.json(
        { error: "Aguarde um minuto antes de testar novamente." },
        { status: 429 },
      );
    try {
      await sendPush(subscription, {
        key,
        title: "LifeOS conectado",
        body: "Pronto! Este aparelho pode receber seus lembretes de tarefas.",
        url: "/notifications",
      });
    } catch (error) {
      if (expiredSubscription(error)) {
        databaseError(
          (await db.from("push_subscriptions").delete().eq("id", subscription.id)).error,
        );
        throw new Error("A inscrição expirou. Desative e ative as notificações neste aparelho.");
      }
      throw new Error(
        "Não foi possível enviar a notificação de teste. Tente novamente em um minuto.",
      );
    }
    databaseError(
      (
        await admin
          .from("notification_deliveries")
          .update({ sent_at: new Date().toISOString() })
          .eq("subscription_id", subscription.id)
          .eq("message_key", key)
      ).error,
    );
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
