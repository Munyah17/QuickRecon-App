import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Middleware for session management and authentication.
 * This proxy keeps Supabase session cookies fresh and protects routes.
 * In preview mode (no env configured) requests pass straight through.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Preview mode - no Supabase configured
  if (!url || !key) {
    return NextResponse.next();
  }

  const response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    // Get the current session without forcing a refresh
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("[proxy] Session error:", sessionError.message);
      // Clear invalid session cookies
      response.cookies.delete("sb-access-token");
      response.cookies.delete("sb-refresh-token");
    }

    const session = sessionData.session;
    const isAuthRoute = request.nextUrl.pathname.startsWith("/login");
    const isAppRoute = request.nextUrl.pathname.startsWith("/app");

    // If no session and trying to access protected route, redirect to login
    if (!session && isAppRoute && !isAuthRoute) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      return NextResponse.redirect(redirectUrl);
    }

    // NOTE: routing decisions use the cookie session only. Validating the
    // token with getUser() costs a Supabase roundtrip per request and
    // duplicates the check getSession() performs in the app layout — where
    // an invalid session already bounces to /login.

    // If on login page with valid session, redirect to dashboard
    if (session && isAuthRoute) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/app/dashboard";
      return NextResponse.redirect(redirectUrl);
    }

    return response;
  } catch (error) {
    console.error("[proxy] Unexpected error:", error);
    // On error, allow request to proceed but log the issue
    return response;
  }
}

export const config = {
  matcher: ["/app/:path*", "/login"],
};
