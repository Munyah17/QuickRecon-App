/** Sample sessions must be an explicit opt-in in a production deployment. */
export function isPreviewMode(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ENABLE_PREVIEW === "true");
}
