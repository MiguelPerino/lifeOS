import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
loadEnvConfig(process.cwd());
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Configure .env.local antes do seed.");
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
    throw new Error("O seed é exclusivo do Supabase local para evitar alterações em contas reais.");
  const email = process.env.SEED_EMAIL || "demo@lifeos.local";
  const password = process.env.SEED_PASSWORD || "LifeOS-demo-2026!";
  const db = createClient(url, key, { auth: { persistSession: false } });
  const login = await db.auth.signInWithPassword({ email, password });
  const result = login.error
    ? await db.auth.signUp({ email, password, options: { data: { display_name: "Alex" } } })
    : login;
  if (result.error || !result.data.session)
    throw new Error(
      "Não foi possível autenticar o seed. Verifique se confirmação de e-mail está desativada no Supabase local.",
    );
  const { count, error: countError } = await db
    .from("projects")
    .select("id", { count: "exact", head: true });
  if (countError) throw countError;
  if (count) {
    console.log("Conta de seed já possui projetos; nenhum dado foi alterado.");
    return;
  }
  const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  async function save(entity: string, payload: object): Promise<string> {
    const { data, error } = await db.rpc("save_record", { entity, payload });
    if (error) throw error;
    return data as string;
  }
  const dl = await save("projects", {
    title: "Aprender Deep Learning",
    description: "Construir uma base prática em redes neurais e atenção.",
    status: "active",
    due_date: day(20),
  });
  const rag = await save("projects", {
    title: "Projeto RAG",
    description: "Uma biblioteca pessoal que responde com contexto e fontes.",
    status: "active",
    due_date: day(10),
  });
  await save("tasks", {
    title: "Estudar Transformers",
    project_id: dl,
    status: "in_progress",
    priority: "high",
    due_date: day(0),
    tags: ["estudos", "deep-learning"],
    subtasks: [
      { title: "Ler sobre positional encoding", done: true },
      { title: "Revisar multi-head attention", done: false },
    ],
  });
  await save("tasks", {
    title: "Revisar Attention",
    project_id: dl,
    status: "done",
    priority: "medium",
    due_date: day(-1),
    tags: ["estudos"],
  });
  await save("tasks", {
    title: "Implementar pequeno Transformer",
    project_id: dl,
    status: "todo",
    priority: "medium",
    due_date: day(5),
  });
  const chunk = await save("tasks", {
    title: "Implementar chunking",
    project_id: rag,
    status: "in_progress",
    priority: "high",
    due_date: day(-1),
    tags: ["rag"],
    subtasks: [{ title: "Comparar tamanhos de chunks", done: false }],
  });
  const embed = await save("tasks", {
    title: "Criar embeddings",
    project_id: rag,
    status: "todo",
    priority: "high",
    due_date: day(1),
    dependencies: [chunk],
    tags: ["rag", "embeddings"],
  });
  await save("tasks", {
    title: "Criar vector search",
    project_id: rag,
    status: "todo",
    priority: "medium",
    due_date: day(3),
    dependencies: [embed],
  });
  await save("notes", {
    title: "Introdução a Transformers e Attention",
    content:
      "Self-attention permite que cada token considere os demais tokens da sequência. Queries, keys e values produzem representações contextuais. Multi-head attention combina diferentes padrões de relação.",
    project_id: dl,
    kind: "note",
    tags: ["transformers", "estudos"],
  });
  await save("notes", {
    title: "Estratégia de chunking para RAG",
    content:
      "Comparar divisão por parágrafos com janelas de tokens sobrepostas. Avaliar a recuperação com perguntas conhecidas antes de escolher tamanho e overlap. Embeddings nomic-embed-text serão armazenados em pgvector.",
    project_id: rag,
    kind: "note",
    tags: ["rag", "chunking"],
  });
  console.log(
    `Seed criado para ${email}. A senha está em SEED_PASSWORD / .env.example. Use Reindexar nas notas com Ollama disponível.`,
  );
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Falha no seed. Verifique o Supabase local.",
  );
  process.exitCode = 1;
});
