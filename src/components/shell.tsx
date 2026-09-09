"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Command } from "cmdk";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  LayoutDashboard,
  Sun,
  Inbox,
  CheckCheck,
  FolderOpen,
  FileText,
  Search,
  Sparkles,
  Leaf,
  Menu,
  Plus,
  Command as CommandIcon,
  LogOut,
  Moon,
  ChevronDown,
  WifiOff,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { useWorkspace, WorkspaceProvider } from "./workspace-provider";
import { cn } from "@/lib/utils";
const nav = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/today", label: "Meu dia", icon: Sun },
  { href: "/inbox", label: "Smart Inbox", icon: Inbox },
  { href: "/tasks", label: "Tarefas", icon: CheckCheck },
  { href: "/projects", label: "Projetos", icon: FolderOpen },
  { href: "/notes", label: "Notas & ideias", icon: FileText },
  { href: "/search", label: "Buscar", icon: Search },
  { href: "/assistant", label: "Assistente", icon: Sparkles },
];
function Palette({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const { data } = useWorkspace();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const go = (url: string) => {
    setOpen(false);
    setQuery("");
    router.push(url);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-2">
        <DialogTitle className="sr-only">Comandos do LifeOS</DialogTitle>
        <DialogDescription className="sr-only">
          Navegue, crie registros ou interprete um comando natural.
        </DialogDescription>
        <Command>
          <div className="flex items-center gap-3 border-b px-3">
            <Search size={18} />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="O que você quer fazer?"
              className="h-14 w-full bg-transparent pr-8 text-sm outline-none"
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-1">
            <Command.Empty className="p-4 text-sm text-muted-foreground">
              Nenhuma ação encontrada. Envie sua frase para o Smart Inbox abaixo.
            </Command.Empty>
            <Command.Group heading="Criar">
              <Command.Item onSelect={() => go("/tasks?new=1")}>
                <Plus />
                Criar tarefa
              </Command.Item>
              <Command.Item onSelect={() => go("/notes?new=1")}>
                <Plus />
                Criar nota
              </Command.Item>
              <Command.Item onSelect={() => go("/projects?new=1")}>
                <Plus />
                Criar projeto
              </Command.Item>
            </Command.Group>
            <Command.Group heading="Navegar">
              {nav.map((n) => (
                <Command.Item key={n.href} onSelect={() => go(n.href)}>
                  <n.icon size={16} />
                  {n.label}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Projetos">
              {data.projects.map((p) => (
                <Command.Item key={p.id} onSelect={() => go(`/projects?id=${p.id}`)}>
                  {p.title}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
        {query.trim() && (
          <Button
            variant="ghost"
            className="h-auto w-full justify-start whitespace-normal py-3 text-left"
            onClick={() => go(`/inbox?text=${encodeURIComponent(query)}`)}
          >
            <Sparkles />
            Interpretar “{query}” no Smart Inbox
            <ArrowUpRight className="shrink-0" />
          </Button>
        )}
        <p className="border-t px-3 py-3 text-xs text-muted-foreground">
          ↑ ↓ navegar · Enter abrir · Esc fechar
        </p>
      </DialogContent>
    </Dialog>
  );
}
function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useWorkspace();
  const { setTheme, resolvedTheme } = useTheme();
  const [palette, setPalette] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("keydown", key);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  async function signOut() {
    const { error } = await createClient().auth.signOut();
    if (error) {
      toast.error("Não foi possível sair. Tente novamente.");
      return;
    }
    router.replace("/login");
    router.refresh();
  }
  const sidebar = (
    <>
      <Link
        href="/dashboard"
        className="mb-9 flex items-center gap-3 px-2 text-xl font-semibold tracking-tight"
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Leaf size={20} />
        </span>
        LifeOS
        <span className="ml-auto text-[10px] font-normal tracking-widest text-muted-foreground">
          PERSONAL
        </span>
      </Link>
      <Button
        variant="outline"
        className="mb-7 w-full justify-start bg-card text-muted-foreground"
        onClick={() => {
          setMobile(false);
          setPalette(true);
        }}
      >
        <Search />
        Buscar ou executar<span className="ml-auto rounded border px-1 text-[10px]">⌘ K</span>
      </Button>
      <p className="eyebrow mb-3 px-3">Seu espaço</p>
      <nav className="space-y-1">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setMobile(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              pathname === n.href
                ? "bg-accent font-medium text-primary"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <n.icon size={18} />
            {n.label}
            {n.href === "/tasks" && data.tasks.filter((t) => t.status === "todo").length > 0 && (
              <span className="ml-auto text-xs">
                {data.tasks.filter((t) => t.status === "todo").length}
              </span>
            )}
          </Link>
        ))}
      </nav>
      <div className="mt-9 border-t pt-5">
        <div className="eyebrow mb-3 flex items-center justify-between px-3">
          Projetos ativos
          <Link href="/projects?new=1" aria-label="Novo projeto">
            <Plus size={14} />
          </Link>
        </div>
        {data.projects
          .filter((p) => p.status === "active")
          .slice(0, 4)
          .map((p) => (
            <Link
              href={`/projects?id=${p.id}`}
              onClick={() => setMobile(false)}
              key={p.id}
              className="flex items-center gap-3 truncate px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <span className="size-1.5 shrink-0 rounded-full bg-primary" />
              {p.title}
            </Link>
          ))}
        {!data.projects.some((p) => p.status === "active") && (
          <p className="px-3 text-xs leading-5 text-muted-foreground">
            Seus próximos grandes passos começam com um projeto.
          </p>
        )}
      </div>
      <div className="mt-auto pt-10">
        <div className="mb-5 flex items-center gap-2 px-3 text-xs text-muted-foreground">
          <span
            className={cn(
              "size-1.5 rounded-full",
              data.aiEnabled ? "bg-primary" : "bg-muted-foreground",
            )}
          />
          {data.aiEnabled ? "IA configurada" : "IA desativada"}
        </div>
        <Dropdown.Root>
          <Dropdown.Trigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left text-sm">
              <span className="flex size-8 items-center justify-center rounded-full bg-accent text-primary">
                {data.displayName.slice(0, 1).toUpperCase()}
              </span>
              <span className="truncate">{data.displayName}</span>
              <ChevronDown size={14} className="ml-auto" />
            </button>
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content
              side="top"
              align="start"
              className="z-50 min-w-52 rounded-xl border bg-card p-1.5 shadow-lg"
            >
              <Dropdown.Item
                className="flex cursor-pointer items-center gap-2 rounded p-3 text-sm outline-none focus:bg-accent"
                onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              >
                <Moon size={16} />
                Alternar tema
              </Dropdown.Item>
              <Dropdown.Item
                className="flex cursor-pointer items-center gap-2 rounded p-3 text-sm outline-none focus:bg-accent"
                onSelect={() => void signOut()}
              >
                <LogOut size={16} />
                Sair da conta
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
      </div>
    </>
  );
  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-background focus:p-4"
      >
        Pular para conteúdo
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-muted/40 px-4 py-6 lg:flex">
        {sidebar}
      </aside>
      <Dialog open={mobile} onOpenChange={setMobile}>
        <DialogContent className="left-0 top-0 h-dvh max-h-dvh w-72 translate-x-0 translate-y-0 rounded-none">
          <DialogTitle className="sr-only">Navegação</DialogTitle>
          <DialogDescription className="sr-only">Áreas do LifeOS</DialogDescription>
          <div className="flex h-full flex-col pt-6">{sidebar}</div>
        </DialogContent>
      </Dialog>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-5 backdrop-blur lg:px-10">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobile(true)}
              aria-label="Abrir menu"
            >
              <Menu />
            </Button>
            <span className="text-sm text-muted-foreground">
              Meu espaço<span className="mx-3 text-border">/</span>
              <span className="text-foreground">
                {nav.find((n) => n.href === pathname)?.label || "LifeOS"}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Abrir comandos"
                  onClick={() => setPalette(true)}
                >
                  <CommandIcon />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="z-50 rounded bg-foreground px-3 py-2 text-xs text-background">
                  Ctrl / Cmd + K
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
            <Button size="sm" onClick={() => router.push("/inbox")}>
              <Plus />
              Capturar
            </Button>
          </div>
        </header>
        {offline && (
          <p role="status" className="flex items-center gap-2 bg-amber-500/10 px-6 py-3 text-sm">
            <WifiOff size={16} />
            Você está offline. Reconecte para salvar alterações.
          </p>
        )}
        <main id="main-content" className="mx-auto max-w-[1440px] px-5 py-8 md:px-10 lg:py-10">
          {children}
        </main>
      </div>
      <Palette open={palette} setOpen={setPalette} />
    </div>
  );
}
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <ShellContent>{children}</ShellContent>
    </WorkspaceProvider>
  );
}
