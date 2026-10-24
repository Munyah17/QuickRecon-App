import { isPreviewMode } from "./config";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side Supabase client (RSC / route handlers / server actions).
 * Honours RLS using the caller's session cookies. Returns null when
 * Supabase is not configured (preview mode).
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (isPreviewMode()) {
    console.warn("[createClient] Supabase not configured");
    return null;
  }

  if (!url || !key) {
    throw new Error("Both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.");
  }

  try {
    const cookieStore = await cookies();
    const client = createServerClient(url, key, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (error) {
            console.error("[createClient] Cookie set error:", error);
            // Called from a Server Component — session refresh handled by middleware.
          }
        },
      },
    });

    console.log("[createClient] Client created successfully");
    return client;
  } catch (error) {
    console.error("[createClient] Client creation error:", error);
    throw error;
  }
}

/**
 * !!! Server-only. Uses the service role key which BYPASSES RLS.
 * Only import inside route handlers / server actions that perform
 * privileged operations (imports, publishing, system jobs) after
 * explicitly verifying the caller's permissions.
 */
export async function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    if (!isPreviewMode() || serviceKey) {
      throw new Error("Supabase server configuration is incomplete: project URL and service role key are required for this operation.");
    }
    return null;
  }

  try {
    const { createClient: createSupabaseClient } = await import(
      "@supabase/supabase-js"
    );
    const client = createSupabaseClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    console.log("[createServiceClient] Service client created");
    return client;
  } catch (error) {
    console.error("[createServiceClient] Service client creation error:", error);
    throw error;
  }
}
