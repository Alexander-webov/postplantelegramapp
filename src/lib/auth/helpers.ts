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
 * handle_new_user trigger didn't fire — we create it on the fly via the
 * service-role client instead of crashing the whole dashboard with
 * PGRST116 "0 rows". The profiles table has no INSERT RLS policy, so a
 * regular user-scoped client can't backfill itself. Service-role bypasses
 * RLS; safe here because we only insert a row whose id equals the
 * already-authenticated user's id.
 */
export async function getProfile() {
  const supabase = await createClient();
  const user = await requireUser();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const { createServiceClient } = await import('@/lib/supabase/server');
  const service = createServiceClient();

  const { data: created, error: insertErr } = await service
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email ?? '',
      full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
    })
    .select('*')
    .single();

  if (insertErr) throw insertErr;
  return created;
}

/**
 * Throw a redirect to /dashboard if the user is not an admin.
 * Use at the top of every /admin Server Component and admin Server Action.
 * Authentication is checked first via requireUser inside getProfile.
 */
export async function requireAdmin() {
  const profile = await getProfile();
  if (!profile.is_admin) {
    redirect('/dashboard');
  }
  return profile;
}
