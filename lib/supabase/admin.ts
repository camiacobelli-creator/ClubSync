import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — server-only. Never import this from client components.
// Bypasses RLS, so it's used only for the commissioner approval email flow,
// where the person clicking the link isn't authenticated in the app.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
