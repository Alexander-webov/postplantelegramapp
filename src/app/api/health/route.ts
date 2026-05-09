import { NextResponse } from 'next/server';

/**
 * Health check endpoint for Railway/Docker.
 *
 * Returns 200 OK immediately if the Next.js process is running. We DON'T
 * check downstream services (Supabase, Telegram) here because:
 *   - Railway healthcheck failure → restart container → useless if the
 *     problem is actually external
 *   - Boot is fast; if /api/health responds at all, the server is up
 *
 * For deeper status, see /api/health?deep=1 (optional Supabase ping).
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const deep = url.searchParams.get('deep') === '1';

  const payload: Record<string, unknown> = {
    ok: true,
    service: 'postplan',
    timestamp: new Date().toISOString(),
  };

  if (deep) {
    // Optional: ping Supabase REST endpoint to verify connectivity.
    // Cheap GET without auth that returns 200 if the project is reachable.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });
        payload.supabase = res.ok ? 'ok' : `status:${res.status}`;
      } catch (e) {
        payload.supabase = 'unreachable';
        payload.ok = false;
      }
    }
  }

  return NextResponse.json(payload, {
    status: payload.ok ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

// Railway sometimes uses HEAD for healthcheck — handle it explicitly
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
