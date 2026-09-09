import { AuthForm } from "@/components/auth-form";
import { supabaseConfigured } from "@/lib/supabase/server";
export default function ResetPassword() {
  return <AuthForm configured={supabaseConfigured()} reset />;
}
