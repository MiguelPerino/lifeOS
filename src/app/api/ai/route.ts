import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, assertOrigin, readBody } from "@/lib/http";
import { getWorkspace } from "@/services/workspace";
import { getAIProvider } from "@/lib/ai";
import { inboxSchema, planSchema } from "@/domain/schemas";
import { runAssistant } from "@/services/assistant";
import { semanticSearch, indexNote } from "@/services/embeddings";
import { rankedTasks, validatePlanTasks } from "@/domain/logic";
const inputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("inbox"),
    text: z.string().trim().min(3).max(8000),
    day: z.iso.date(),
  }),
  z.object({
    action: z.literal("chat"),
    text: z.string().trim().min(2).max(2000),
    day: z.iso.date(),
  }),
  z.object({ action: z.literal("plan"), day: z.iso.date() }),
  z.object({ action: z.literal("search"), text: z.string().trim().min(2).max(500) }),
  z.object({ action: z.literal("index"), id: z.uuid() }),
]);
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const input = inputSchema.parse(await readBody(request));
    const workspace = await getWorkspace();
    if (input.action === "index") return NextResponse.json(await indexNote(input.id));
    if (input.action === "search")
      return NextResponse.json({ results: await semanticSearch(input.text) });
    if (input.action === "chat")
      return NextResponse.json(await runAssistant(input.text, input.day, workspace));
    if (input.action === "inbox") {
      const result = await getAIProvider().generateStructured(
        `Você organiza o LifeOS. Extraia itens sem executar ações. Hoje é ${input.day}, data local do usuário. Resolva datas relativas em YYYY-MM-DD; datas ambíguas ficam null com aviso em explanation. Use project com o nome exato de um projeto existente quando aplicável; novos nomes criam projetos após confirmação. depends_on contém índices base zero dos itens deste lote, apenas tarefas. Separe tarefas sequenciais e conecte as dependências. subtasks têm title e done=false. Prioridade é uma sugestão. Não invente prazos ou detalhes não informados. Responda em português. Projetos existentes: ${JSON.stringify(workspace.projects.map((p) => p.title))}`,
        input.text,
        inboxSchema,
      );
      return NextResponse.json(result);
    }
    const tasks = rankedTasks(workspace.tasks, input.day).slice(0, 60);
    if (!tasks.length) return NextResponse.json({ items: [] });
    const plan = await getAIProvider().generateStructured(
      `Sugira um plano realista para ${input.day}. Use apenas task_id fornecidos. Horários HH:MM, sem sobreposição, durações em minutos, no máximo 8 horas de trabalho e 10 tarefas. Inclua dependências abertas antes das dependentes ou não inclua a dependente. Considere prioridade, atraso, prazo e projeto. Nunca mude tarefas.`,
      JSON.stringify({
        tasks,
        projects: workspace.projects.map((p) => ({ id: p.id, title: p.title, status: p.status })),
      }),
      planSchema,
    );
    validatePlanTasks(plan.items, workspace.tasks);
    return NextResponse.json(plan);
  } catch (error) {
    return apiError(error);
  }
}
