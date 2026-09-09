import "server-only";
import { authenticated } from "@/lib/supabase/server";
import { getAIProvider } from "@/lib/ai";
import { aiConfig, aiEnabled } from "@/lib/ai/config";
import { databaseError } from "@/lib/http";
export async function indexNote(id: string) {
  const { db, user } = await authenticated();
  const { data: note, error } = await db
    .from("notes")
    .select("id,title,content,updated_at")
    .eq("user_id", user.id)
    .eq("id", id)
    .single();
  databaseError(error);
  if (!note) throw new Error("Nota não encontrada.");
  if (!aiEnabled())
    return { indexed: false, warning: "Nota salva. Indexação semântica pendente: IA desativada." };
  try {
    const embedding = await getAIProvider().embed(`${note.title}\n${note.content}`);
    const result = await db
      .from("notes")
      .update({
        embedding: JSON.stringify(embedding),
        embedding_status: "ready",
        embedding_model: aiConfig().embeddingModel,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("updated_at", note.updated_at)
      .select("id");
    databaseError(result.error);
    if (!result.data?.length)
      return {
        indexed: false,
        warning: "Nota alterada durante a indexação. Indexe novamente a versão atual.",
      };
    return { indexed: true };
  } catch {
    await db
      .from("notes")
      .update({ embedding_status: "failed" })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("updated_at", note.updated_at);
    return {
      indexed: false,
      warning:
        "Nota salva. Não foi possível indexar para busca semântica. Confira a configuração e a cota da IA e use Reindexar.",
    };
  }
}
export async function semanticSearch(query: string) {
  const { db, user } = await authenticated();
  // The existing RPC compares all ready vectors. Never mix embedding spaces.
  const { data: indexed, error: modelError } = await db
    .from("notes")
    .select("embedding_model")
    .eq("user_id", user.id)
    .eq("embedding_status", "ready")
    .or(`embedding_model.is.null,embedding_model.neq.${aiConfig().embeddingModel}`)
    .limit(1);
  databaseError(modelError);
  if (indexed?.length)
    throw new Error(
      "O modelo de busca mudou. Use Reindexar nas notas antigas antes de buscar por significado.",
    );
  const embedding = await getAIProvider().embed(query, "query");
  const { data, error } = await db.rpc("match_notes", {
    query_embedding: JSON.stringify(embedding),
    match_count: 8,
  });
  databaseError(error);
  return data as { id: string; title: string; content: string; similarity: number }[];
}
