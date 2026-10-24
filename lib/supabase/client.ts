import { isPreviewMode } from "./config";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Returns null when the project is not
 * configured yet so the app can run in preview mode with local data.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (isPreviewMode()) return null;
  if (!url || !key) throw new Error("Supabase public URL and anon key are required.");
  return createBrowserClient(url, key);
}
