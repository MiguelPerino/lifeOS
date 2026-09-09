"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Workspace } from "@/domain/types";
import { api } from "@/lib/client-api";
import { Button } from "./ui/button";
const Context = createContext<{ data: Workspace; refresh: () => Promise<void> } | null>(null);
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      setData(await api<Workspace>("/api/workspace"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados.");
      throw e;
    }
  }, []);
  useEffect(() => {
    let active = true;
    api<Workspace>("/api/workspace")
      .then((workspace) => {
        if (active) setData(workspace);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Erro ao carregar dados.");
      });
    return () => {
      active = false;
    };
  }, []);
  if (error && !data)
    return (
      <div className="p-8" role="alert">
        <h2 className="text-xl font-medium">Não conseguimos carregar seu espaço</h2>
        <p className="my-4 text-muted-foreground">{error}</p>
        <Button onClick={() => void refresh().catch(() => {})}>Tentar novamente</Button>
        <a href="/login" className="ml-4 text-sm underline">
          Entrar novamente
        </a>
      </div>
    );
  if (!data)
    return (
      <div className="animate-pulse space-y-6 p-8" aria-label="Carregando seu espaço">
        <div className="h-8 w-64 rounded bg-muted" />
        <div className="h-4 w-96 max-w-full rounded bg-muted" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-muted" />
      </div>
    );
  return (
    <Context.Provider value={{ data, refresh }}>
      {error && (
        <p role="alert" className="bg-destructive/10 px-6 py-3 text-sm">
          {error}
        </p>
      )}
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("WorkspaceProvider ausente");
  return value;
}
