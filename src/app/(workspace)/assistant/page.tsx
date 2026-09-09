"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sparkles, ArrowUp, LoaderCircle, FileText } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageHeading } from "@/components/page-parts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { localDay } from "@/lib/utils";
import type { Source } from "@/domain/types";
type Answer = {
  paragraphs: { text: string; source_ids: string[] }[];
  sources: Source[];
  usedTools: string[];
  warnings: string[];
  empty: boolean;
};
type Message = { question: string; answer?: Answer; error?: string };
export default function AssistantPage() {
  const { data } = useWorkspace();
  const params = useSearchParams();
  const [text, setText] = useState(params.get("prompt") || "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    const question = text;
    setText("");
    setBusy(true);
    setMessages((m) => [...m, { question }]);
    try {
      const answer = await api<Answer>("/api/ai", {
        action: "chat",
        text: question,
        day: localDay(),
      });
      setMessages((m) => m.map((v, i) => (i === m.length - 1 ? { ...v, answer } : v)));
    } catch (e) {
      setMessages((m) =>
        m.map((v, i) =>
          i === m.length - 1
            ? { ...v, error: e instanceof Error ? e.message : "Não foi possível consultar." }
            : v,
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-enter mx-auto max-w-3xl">
      <PageHeading
        eyebrow="UMA PERSPECTIVA A MAIS"
        title="Pense com seu assistente"
        description="Respostas sobre seu espaço, com referências para conferir."
      />
      {!messages.length && (
        <div className="py-10 text-center">
          <span className="mb-6 inline-flex rounded-2xl bg-accent p-4 text-primary">
            <Sparkles size={28} />
          </span>
          <h2 className="text-xl font-medium">O que vamos esclarecer?</h2>
          <p className="mx-auto mb-8 mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Consulte tarefas, encontre uma nota ou entenda onde concentrar sua atenção.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "O que tenho para fazer esta semana?",
              "Tenho alguma tarefa urgente?",
              "Encontre minhas anotações sobre RAG.",
              "Quais projetos precisam de atenção?",
            ].map((q) => (
              <button
                key={q}
                className="panel p-4 text-left text-xs transition hover:border-primary/50"
                onClick={() => setText(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-8 pb-6" aria-live="polite">
        {messages.map((message, i) => (
          <div key={i}>
            <div className="mb-5 ml-10 rounded-xl bg-muted px-5 py-4 text-sm">
              {message.question}
            </div>
            <div className="flex gap-3">
              <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                <Sparkles size={16} />
              </span>
              <div className="min-w-0 flex-1 space-y-4 text-sm leading-7">
                {message.error ? (
                  <p role="alert" className="text-destructive">
                    {message.error}
                  </p>
                ) : !message.answer ? (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" />
                    Consultando seus dados…
                  </p>
                ) : (
                  <>
                    {message.answer.empty && (
                      <p>
                        Não encontrei registros suficientes nas ferramentas consultadas. Tente uma
                        pergunta mais específica ou indexe suas notas.
                      </p>
                    )}
                    {message.answer.paragraphs.map((p, j) => (
                      <div key={j}>
                        <p className="whitespace-pre-wrap">{p.text}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {p.source_ids.map((id) => {
                            const source = message.answer!.sources.find((s) => s.id === id);
                            return source ? (
                              <Link
                                key={id}
                                href={`/${source.type}?id=${id}`}
                                className="flex items-center gap-1 rounded border px-2 py-1 text-[10px] leading-4 text-primary"
                              >
                                <FileText size={11} />
                                {source.title}
                              </Link>
                            ) : null;
                          })}
                        </div>
                      </div>
                    ))}
                    {message.answer.warnings.map((w) => (
                      <p key={w} className="text-xs text-amber-600">
                        {w}
                      </p>
                    ))}
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">
                        Fontes consultadas · {message.answer.sources.length} registros
                      </summary>
                      <p className="mt-2">Ferramentas: {message.answer.usedTools.join(", ")}</p>
                      <p className="mt-1">
                        A resposta é gerada por IA. Confira as referências para validar a
                        interpretação.
                      </p>
                    </details>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <form
        onSubmit={send}
        className="sticky bottom-4 rounded-xl border bg-background p-3 shadow-lg"
      >
        <Textarea
          aria-label="Pergunta ao assistente"
          placeholder={
            data.aiEnabled ? "Pergunte sobre seu espaço…" : "A IA está desativada neste ambiente."
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          disabled={!data.aiEnabled}
          className="min-h-20 resize-none border-0 bg-transparent focus:ring-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className="flex items-center justify-between">
          <span className="px-3 text-[10px] text-muted-foreground">
            Consultas somente leitura · Ctrl / Cmd + Enter envia
          </span>
          <Button
            size="icon"
            aria-label="Enviar pergunta"
            disabled={busy || !data.aiEnabled || text.trim().length < 2}
          >
            {busy ? <LoaderCircle className="animate-spin" /> : <ArrowUp />}
          </Button>
        </div>
      </form>
    </div>
  );
}
