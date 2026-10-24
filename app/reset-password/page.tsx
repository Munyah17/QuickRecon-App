import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordClient } from "./reset-password-client";

export default async function ResetPasswordPage() {
  const sb = await createClient();
  if (!sb) redirect("/forgot-password");
  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) redirect("/forgot-password");
  return <ResetPasswordClient />;
}
