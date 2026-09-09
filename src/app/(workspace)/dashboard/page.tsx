"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Sun,
  Sparkles,
  CheckCheck,
  Clock,
  FolderOpen,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageHeading, Empty } from "@/components/page-parts";
import { Button } from "@/components/ui/button";
import { TaskList } from "@/components/task-list";
import { ProgressChart } from "@/components/progress-chart";
import { ActivityList } from "@/components/activity-list";
import { AIInsights } from "@/components/ai-insights";
import { isOpen, progress, blockedBy } from "@/domain/logic";
import { localDay, dateLabel, cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
export default function Dashboard() {
  const { data } = useWorkspace();
  const router = useRouter();
  const [capture, setCapture] = useState("");
  const today = localDay();
  const open = data.tasks.filter(isOpen);
  const due = open.filter((t) => t.due_date === today);
  const overdue = open.filter((t) => t.due_date && t.due_date < today);
  const active = data.projects.filter((p) => p.status === "active");
  const upcoming = open
    .filter((t) => t.due_date && t.due_date > today)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
    .slice(0, 4);
  const recent = data.tasks
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.completed_at || "").localeCompare(a.completed_at || ""))
    .slice(0, 3);
  const blocked = open.filter((t) => blockedBy(t, data.tasks).length);
  const date = new Date();
  const greeting =
    date.getHours() < 12 ? "Bom dia" : date.getHours() < 18 ? "Boa tarde" : "Boa noite";
  return (
    <div className="page-enter">
      <PageHeading
        eyebrow={date.toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
        title={`${greeting}, ${data.displayName.split(" ")[0]}.`}
        description="Um pouco de clareza para seguir em frente."
        action={
          <Button variant="outline" asChild>
            <Link href="/today">
              <Sun />
              Planejar meu dia
              <ArrowUpRight />
            </Link>
          </Button>
        }
      />
      <form
        className="mb-8 flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (capture.trim()) router.push(`/inbox?text=${encodeURIComponent(capture)}`);
        }}
      >
        <span className="hidden rounded-lg bg-accent p-2.5 text-primary sm:block">
          <Sparkles size={18} />
        </span>
        <Input
          aria-label="Capturar um pensamento"
          placeholder="Tire da cabeça. O que você precisa fazer ou lembrar?"
          value={capture}
          onChange={(e) => setCapture(e.target.value)}
          className="border-0 bg-transparent shadow-none focus:ring-0"
        />
        <Button size="sm" disabled={!capture.trim()} aria-label="Interpretar pensamento">
          <ArrowRight />
        </Button>
      </form>
      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          {
            label: "PARA HOJE",
            value: due.length,
            icon: Sun,
            detail: "um passo de cada vez",
            href: "/today",
          },
          {
            label: "ATRASADAS",
            value: overdue.length,
            icon: Clock,
            detail: overdue.length ? "merecem sua atenção" : "tudo no seu tempo",
            href: "/tasks",
          },
          {
            label: "PROJETOS ATIVOS",
            value: active.length,
            icon: FolderOpen,
            detail: "ideias em movimento",
            href: "/projects",
          },
          {
            label: "CONCLUÍDAS",
            value: data.tasks.filter((t) => t.status === "done").length,
            icon: CheckCheck,
            detail: "progresso de verdade",
            href: "/tasks",
          },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="panel p-4 md:p-5">
            <div className="flex items-center justify-between">
              <span className="eyebrow text-[9px] md:text-[10px]">{s.label}</span>
              <s.icon size={16} className="text-muted-foreground" />
            </div>
            <div className="mt-3 text-3xl font-medium tracking-tight">{s.value}</div>
            <p className="mt-2 text-[11px] text-muted-foreground">{s.detail}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-7 xl:grid-cols-[1fr_310px]">
        <div className="min-w-0 space-y-7">
          <section className="panel">
            <div className="flex items-center justify-between border-b p-5">
              <div className="flex items-center gap-2">
                <Sun size={17} className="text-primary" />
                <h2 className="text-sm font-semibold">Seu foco de hoje</h2>
              </div>
              <Link href="/tasks" className="text-xs text-muted-foreground">
                Todas as tarefas →
              </Link>
            </div>
            {due.length || overdue.length ? (
              <TaskList tasks={[...overdue, ...due].slice(0, 7)} compact />
            ) : (
              <Empty
                title="Hoje está em aberto"
                description="Escolha seu próximo passo ou deixe a IA ajudar a organizar o dia."
                action={
                  <Button variant="outline" asChild>
                    <Link href="/today">Organizar meu dia</Link>
                  </Button>
                }
              />
            )}
          </section>
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Projetos em movimento</h2>
              <Link href="/projects" className="text-xs text-muted-foreground">
                Ver todos →
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {active.slice(0, 4).map((p) => (
                <Link className="panel p-5" key={p.id} href={`/projects?id=${p.id}`}>
                  <div className="flex justify-between">
                    <FolderOpen size={19} className="text-primary" />
                    <ArrowUpRight size={14} className="text-muted-foreground" />
                  </div>
                  <h3 className="mb-1 mt-4 text-sm font-medium">{p.title}</h3>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {p.description || "Um passo mais perto."}
                  </p>
                  <div className="mb-2 mt-5 flex justify-between text-[10px] text-muted-foreground">
                    <span>
                      {
                        data.tasks.filter((t) => t.project_id === p.id && t.status === "done")
                          .length
                      }{" "}
                      tarefas concluídas
                    </span>
                    <span>{progress(p, data.tasks)}%</span>
                  </div>
                  <div className="h-1 rounded bg-muted">
                    <div
                      className="h-1 rounded bg-primary"
                      style={{ width: `${progress(p, data.tasks)}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
            {!active.length && (
              <div className="panel p-6 text-sm text-muted-foreground">
                Seus projetos ativos aparecerão aqui.{" "}
                <Link href="/projects?new=1" className="text-primary">
                  Criar projeto →
                </Link>
              </div>
            )}
          </section>
          {recent.length > 0 && (
            <section className="panel">
              <h2 className="border-b p-5 text-sm font-semibold">Pequenas vitórias recentes</h2>
              <TaskList tasks={recent} compact />
            </section>
          )}
        </div>
        <aside className="space-y-6">
          <section className="rounded-xl border border-primary/20 bg-accent/60 p-5">
            <div className="mb-4 flex items-center gap-2 text-primary">
              <Sparkles size={17} />
              <h2 className="text-sm font-medium">Um olhar sobre seu dia</h2>
            </div>
            <p className="text-sm leading-6">
              {overdue.length
                ? `Você tem ${overdue.length} tarefa(s) atrasada(s). Pode ser um bom momento para revisar os prazos.`
                : due.length
                  ? `Você tem ${due.length} tarefa(s) com prazo hoje.`
                  : "Nenhuma tarefa atrasada. Há espaço para escolher seu próximo foco."}
            </p>
            {blocked.length > 0 && (
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                {blocked.length} tarefa(s) aguardam dependências.
              </p>
            )}
            <p className="mt-3 text-[10px] text-muted-foreground">
              Calculado com seus dados atuais.
            </p>
            <AIInsights />
            <Link
              href="/assistant?prompt=Analise%20meus%20prazos%20e%20sugira%20um%20foco"
              className="mt-4 flex items-center gap-2 text-xs font-medium text-primary"
            >
              Aprofundar com IA
              <ArrowRight size={14} />
            </Link>
          </section>
          <section className="panel p-5">
            <h2 className="mb-4 text-sm font-semibold">Próximos prazos</h2>
            <div className="space-y-4">
              {upcoming.map((t) => (
                <Link
                  key={t.id}
                  href={`/tasks?id=${t.id}`}
                  className="flex items-start justify-between gap-4 text-xs"
                >
                  <span className="leading-5">{t.title}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground",
                    )}
                  >
                    {dateLabel(t.due_date)}
                  </span>
                </Link>
              ))}
              {!upcoming.length && (
                <p className="text-xs text-muted-foreground">Sem prazos futuros definidos.</p>
              )}
            </div>
          </section>
          <section className="panel p-5">
            <h2 className="text-sm font-semibold">Seu ritmo</h2>
            <p className="mb-3 mt-1 text-[11px] text-muted-foreground">
              Conclusões nos últimos 7 dias
            </p>
            <ProgressChart tasks={data.tasks} />
          </section>
          <section className="px-1">
            <h2 className="mb-5 text-sm font-semibold">Últimos movimentos</h2>
            <ActivityList activities={data.activities.slice(0, 5)} />
          </section>
        </aside>
      </div>
    </div>
  );
}
