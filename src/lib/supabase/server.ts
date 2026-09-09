import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export function supabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
export async function createClient() {
  if (!supabaseConfigured()) throw new Error("Configure o Supabase no arquivo .env.local.");
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll(values) {
          try {
            values.forEach(({ name, value, options }) => jar.set(name, value, options));
          } catch {
            /* Server Components cannot set cookies; proxy refreshes sessions. */
          }
        },
      },
    },
  );
}
export async function authenticated() {
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new Error("Sua sessão expirou. Entre novamente.");
  return { db, user };
}
