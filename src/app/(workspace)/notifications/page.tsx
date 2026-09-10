"use client";
import { useEffect, useState } from "react";
import { Bell, BellOff, Send, Smartphone } from "lucide-react";
import { PageHeading } from "@/components/page-parts";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { currentPushSubscription, disableDevicePush, enableDevicePush } from "@/lib/push-client";
import {
  defaultNotificationPreferences,
  notificationPreferencesSchema,
  type NotificationPreferences,
} from "@/domain/notifications";

const options = [
  {
    key: "daily",
    title: "Seu dia pela manhã",
    description: "Tarefas com prazo hoje e tarefas do seu planejamento diário.",
  },
  {
    key: "pending",
    title: "Pendências do dia",
    description: "Um lembrete para o que ainda falta finalizar hoje.",
  },
  {
    key: "deadline",
    title: "Prazos chegando",
    description: "Avise na véspera sobre tarefas que vencem amanhã.",
  },
  {
    key: "overdue",
    title: "Revisar atrasos",
    description: "Resumo diário de tarefas que passaram do prazo. Opcional.",
  },
] as const;

export default function NotificationsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    defaultNotificationPreferences,
  );
  const [loaded, setLoaded] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [supported, setSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const settings = await api<{ preferences: NotificationPreferences; configured: boolean }>(
          "/api/notifications",
        );
        const sub = await currentPushSubscription();
        if (!active) return;
        setPreferences(settings.preferences);
        setConfigured(settings.configured);
        setSubscription(sub);
        setSupported(
          window.isSecureContext &&
            "serviceWorker" in navigator &&
            "PushManager" in window &&
            "Notification" in window,
        );
        setLoaded(true);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Não foi possível carregar.");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    const validated = notificationPreferencesSchema.parse(preferences);
    await api("/api/notifications", validated, "PUT");
  }
  return (
    <div className="page-enter max-w-3xl">
      <PageHeading
        eyebrow="No seu ritmo"
        title="Notificações"
        description="Lembretes úteis para acompanhar seus prazos, mesmo com o LifeOS fechado."
      />
      <section className="mb-6 rounded-xl border bg-card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <Smartphone size={20} /> LifeOS no celular
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          No Android, abra este endereço no Chrome, toque no menu ⋮ e escolha “Instalar aplicativo”
          ou “Adicionar à tela inicial”. Depois, ative as notificações abaixo.
        </p>
        {loaded && (
          <p className="mt-3 text-sm">
            {subscription
              ? "Este aparelho tem uma inscrição de notificações. Use o teste para conferir a entrega."
              : "As notificações estão desativadas neste aparelho."}
          </p>
        )}
        {loaded && !configured && (
          <p className="mt-3 text-sm text-muted-foreground">
            O envio ainda está aguardando configuração. Você já pode salvar suas preferências.
          </p>
        )}
        {loaded && !supported && (
          <p className="mt-3 text-sm text-muted-foreground">
            Este navegador não oferece notificações aqui. Use o Chrome atualizado com o endereço
            HTTPS do LifeOS.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            disabled={!loaded || !configured || !supported || busy}
            onClick={() =>
              void run(async () => {
                // Permission must be requested directly from the user's click.
                const sub = await enableDevicePush();
                setSubscription(sub);
                await save();
                setStatus("Notificações ativadas neste aparelho. Envie um teste para conferir.");
              })
            }
          >
            <Bell />
            {subscription ? "Reativar neste aparelho" : "Ativar notificações"}
          </Button>
          {subscription && (
            <>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await api("/api/notifications/test", { endpoint: subscription.endpoint });
                    setStatus(
                      "Teste enviado. Confira a área de notificações do Android. A entrega depende da conexão e das permissões do aparelho.",
                    );
                  })
                }
              >
                <Send />
                Enviar teste
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await disableDevicePush();
                    setSubscription(null);
                    setStatus("Notificações desativadas neste aparelho.");
                  })
                }
              >
                <BellOff />
                Desativar neste aparelho
              </Button>
            </>
          )}
        </div>
      </section>
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-destructive/30 p-4 text-sm text-destructive"
        >
          {error}
          {!loaded && (
            <button className="ml-3 underline" onClick={() => window.location.reload()}>
              Tentar novamente
            </button>
          )}
        </p>
      )}
      {status && (
        <p role="status" className="mb-5 rounded-lg bg-accent p-4 text-sm">
          {status}
        </p>
      )}
      {!loaded && !error && <p role="status">Carregando preferências…</p>}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await save();
            setStatus("Preferências salvas para todos os seus aparelhos ativados.");
          });
        }}
      >
        <fieldset disabled={!loaded || busy} className="space-y-6 disabled:opacity-50">
          <legend className="mb-4 text-lg font-semibold">Quais avisos você quer receber?</legend>
          <div className="divide-y rounded-xl border bg-card px-5">
            {options.map(({ key, title, description }) => (
              <div key={key} className="flex flex-wrap items-center justify-between gap-4 py-5">
                <label className="flex flex-1 cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-primary"
                    checked={preferences[`${key}_enabled`]}
                    onChange={(e) =>
                      setPreferences({ ...preferences, [`${key}_enabled`]: e.target.checked })
                    }
                  />
                  <span>
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                      {description}
                    </span>
                  </span>
                </label>
                <Input
                  type="time"
                  aria-label={`Horário: ${title}`}
                  className="w-32"
                  required
                  disabled={!preferences[`${key}_enabled`]}
                  value={preferences[`${key}_time`]}
                  onChange={(e) =>
                    setPreferences({ ...preferences, [`${key}_time`]: e.target.value })
                  }
                />
              </div>
            ))}
          </div>
          <div className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 font-semibold">Horários e descanso</h2>
            <Field label="Fuso horário">
              <Input
                required
                value={preferences.timezone}
                onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
              />
            </Field>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="my-2"
              onClick={() =>
                setPreferences({
                  ...preferences,
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                })
              }
            >
              Usar fuso deste aparelho
            </Button>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Silêncio a partir de">
                <Input
                  type="time"
                  required
                  value={preferences.quiet_start}
                  onChange={(e) => setPreferences({ ...preferences, quiet_start: e.target.value })}
                />
              </Field>
              <Field label="Até">
                <Input
                  type="time"
                  required
                  value={preferences.quiet_end}
                  onChange={(e) => setPreferences({ ...preferences, quiet_end: e.target.value })}
                />
              </Field>
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Avisos no período de silêncio são suprimidos. Horários de início e fim iguais
              desativam o silêncio. Configure também o “Não perturbe” do Android para silenciar
              entregas atrasadas pela conexão.
            </p>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Cada tipo envia no máximo um resumo por dia por aparelho, somente quando houver tarefas
            pendentes. Os prazos usam a data da tarefa. A verificação ocorre a cada cinco minutos
            quando o serviço estiver configurado.
          </p>
          <Button type="submit" disabled={!loaded || busy}>
            {busy ? "Aguarde…" : "Salvar preferências"}
          </Button>
        </fieldset>
      </form>
    </div>
  );
}
