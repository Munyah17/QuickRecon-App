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

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Forward the refreshed cookies to Server Components as well as the browser.
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    // Validate/refresh authentication. A cookie alone is not proof that the
    // user still exists or that their profile permits portal access.
    const { data: { user } } = await supabase.auth.getUser();

    if (!user && request.nextUrl.pathname.startsWith("/app")) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      const redirectResponse = NextResponse.redirect(redirectUrl);
      response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
      return redirectResponse;
    }

    // Keep /login reachable for expired sessions and unusable profiles.
    // The dashboard performs the profile/status authorization check.
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
