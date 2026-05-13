import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Get the currently authenticated user from a Server Component or Server Action.
 * Returns null if not authenticated. Use requireUser() if auth is mandatory.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Throw a redirect to /login if the user is not authenticated.
 * Use this at the top of every protected Server Component / action.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Fetch the user's profile row (with subscription_tier etc.).
 *
 * Self-healing: if a profile row is missing — usually because the
 * handle_new_user trigger didn't fire (it can fail silently on legacy users
 * created before the trigger existed, or if there were column constraints) —
 * we create it on the fly here instead of crashing the whole dashboard with
 * PGRST116 "0 rows".
 */
export async function getProfile() {
  const supabase = await createClient();
  const user = await requireUser();

  // maybeSingle() returns null instead of throwing PGRST116 when 0 rows match
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  // No profile row — backfill it from auth.users data we already have
  const fallback = {
    id: user.id,
    email: user.email ?? '',
    full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
  };

  const { data: created, error: insertErr } = await supabase
    .from('profiles')
    .insert(fallback)
    .select('*')
    .single();

  if (insertErr) throw insertErr;
  return created;
}
