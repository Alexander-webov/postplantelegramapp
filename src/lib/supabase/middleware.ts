import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the user's session and protects dashboard routes.
 * Called from src/middleware.ts on every request.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fail-open: if Supabase env isn't configured (misconfigured deploy), we
  // don't want every request to throw. Skip session refresh and let the
  // request through. Server components that need auth will surface their
  // own errors with proper context.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      '[middleware] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing — skipping session refresh',
    );
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Important: refreshes the auth session on each request.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Route protection: dashboard requires auth; auth routes redirect away if logged in.
  const url = request.nextUrl;
  const isDashboard = url.pathname.startsWith('/dashboard');
  const isAuthRoute = url.pathname.startsWith('/login') || url.pathname.startsWith('/signup');

  if (!user && isDashboard) {
    const loginUrl = url.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', url.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthRoute) {
    const dashboardUrl = url.clone();
    dashboardUrl.pathname = '/dashboard';
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}
