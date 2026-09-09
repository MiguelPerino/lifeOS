"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Leaf, ArrowRight, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "./ui/button";
import { Input, Field } from "./ui/input";
import { authSchema } from "@/domain/schemas";
export function AuthForm({
  configured,
  reset = false,
  initialError = "",
}: {
  configured: boolean;
  reset?: boolean;
  initialError?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialError);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    try {
      const validation = reset
        ? authSchema.pick({ password: true }).safeParse({ password })
        : mode === "forgot"
          ? authSchema.pick({ email: true }).safeParse({ email })
          : authSchema.safeParse({ email, password });
      if (!validation.success) throw new Error(validation.error.issues[0].message);
      const db = createClient();
      if (reset) {
        const result = await db.auth.updateUser({ password });
        if (result.error)
          throw new Error("Não foi possível alterar a senha. Solicite um novo link.");
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      if (mode === "forgot") {
        const { error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
        });
        if (error)
          throw new Error("Não foi possível enviar o link. Tente novamente em alguns minutos.");
        setMessage("Se houver uma conta com esse e-mail, você receberá um link de recuperação.");
        return;
      }
      if (mode === "signup") {
        const { data, error } = await db.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: String(form.get("name")).trim() },
            emailRedirectTo: `${location.origin}/auth/callback`,
          },
        });
        if (error)
          throw new Error("Não foi possível criar a conta. Verifique os dados ou tente entrar.");
        if (!data.session) {
          setMessage("Confira seu e-mail para confirmar a conta antes de entrar.");
          return;
        }
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw new Error("E-mail ou senha inválidos, ou conta ainda não confirmada.");
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível conectar ao Supabase.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-[#253f30] p-14 text-[#edf2e9] lg:flex">
        <div className="flex items-center gap-3 text-xl font-semibold">
          <Leaf />
          LifeOS
        </div>
        <div>
          <div className="mb-6 text-xs tracking-[.2em] text-[#bbcbb2]">
            MENOS RUÍDO. MAIS CLAREZA.
          </div>
          <h1 className="max-w-lg text-6xl leading-[1.12] tracking-tight">
            Um lugar para
            <br />
            tudo que move
            <br />
            <span className="text-[#adc98f]">sua vida.</span>
          </h1>
          <p className="mt-7 max-w-sm leading-7 text-[#c1ccbf]">
            Ideias, conhecimento e próximos passos. Conectados em um espaço que pensa com você.
          </p>
        </div>
        <p className="text-sm text-[#bbcbb2]">Seu segundo cérebro. No seu ritmo.</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-12 flex items-center gap-2 text-primary lg:hidden">
            <Leaf />
            LifeOS
          </div>
          <p className="eyebrow mb-3">SEU ESPAÇO PESSOAL</p>
          <h2 className="text-3xl font-semibold tracking-tight">
            {reset
              ? "Uma nova senha"
              : mode === "signup"
                ? "Comece a ter clareza"
                : mode === "forgot"
                  ? "Recuperar acesso"
                  : "Bom ter você por aqui"}
          </h2>
          <p className="mb-8 mt-3 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Crie sua conta e dê espaço às suas ideias."
              : "Entre para continuar de onde parou."}
          </p>
          {!configured ? (
            <div className="panel p-5 text-sm leading-6">
              <strong>Conecte seu Supabase</strong>
              <p className="mt-2">
                Copie <code>.env.example</code> para <code>.env.local</code>, preencha a URL e a
                chave pública do Supabase e execute as migrations. O README tem o passo a passo.
              </p>
              <p className="mt-2 text-muted-foreground">
                Nenhum dado de demonstração é exibido como se fosse seu.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              {mode === "signup" && (
                <Field label="Como podemos chamar você?">
                  <Input name="name" autoComplete="name" required maxLength={80} />
                </Field>
              )}
              {!reset && (
                <Field label="E-mail">
                  <Input
                    name="email"
                    type="email"
                    placeholder="voce@exemplo.com"
                    autoComplete="email"
                    required
                  />
                </Field>
              )}
              {(reset || mode !== "forgot") && (
                <Field label="Senha">
                  <Input
                    name="password"
                    type="password"
                    minLength={8}
                    autoComplete={reset || mode === "signup" ? "new-password" : "current-password"}
                    required
                  />
                </Field>
              )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              {message && (
                <p role="status" className="text-sm text-primary">
                  {message}
                </p>
              )}
              <Button className="w-full" disabled={busy}>
                {busy ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
                {reset
                  ? "Salvar senha"
                  : mode === "signup"
                    ? "Criar conta"
                    : mode === "forgot"
                      ? "Enviar link"
                      : "Entrar no meu espaço"}
              </Button>
              {!reset && (
                <div className="flex flex-wrap justify-between gap-4 text-xs">
                  <button
                    type="button"
                    className="text-primary"
                    onClick={() => {
                      setMode(mode === "signup" ? "login" : "signup");
                      setError("");
                      setMessage("");
                    }}
                  >
                    {mode === "signup" ? "Já tenho uma conta" : "Criar uma conta"}
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground"
                    onClick={() => {
                      setMode(mode === "forgot" ? "login" : "forgot");
                      setError("");
                      setMessage("");
                    }}
                  >
                    {mode === "forgot" ? "Voltar para entrar" : "Esqueci minha senha"}
                  </button>
                </div>
              )}
            </form>
          )}
          <p className="mt-10 text-xs leading-5 text-muted-foreground">
            Seu conhecimento é seu. IA local, dados protegidos e espaço para pensar.
          </p>
        </div>
      </section>
    </main>
  );
}
