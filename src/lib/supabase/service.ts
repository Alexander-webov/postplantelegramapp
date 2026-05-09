import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client. BYPASSES RLS — only use in server code where we
 * authenticate via a different mechanism (e.g. unguessable URL slug for
 * public reports).
 *
 * NEVER expose to the client. NEVER use in user-facing flows where RLS
 * would protect against malicious queries.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing env: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
