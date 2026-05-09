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
 */
export async function getProfile() {
  const supabase = await createClient();
  const user = await requireUser();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return data;
}
