import { AuthForm } from "@/components/auth-form";
import { supabaseConfigured } from "@/lib/supabase/server";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthForm
      configured={supabaseConfigured()}
      initialError={
        params.error === "confirmation"
          ? "O link expirou ou não pôde ser confirmado. Tente entrar ou solicite um novo link."
          : ""
      }
    />
  );
}
