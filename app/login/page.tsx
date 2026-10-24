import { isPreviewMode } from "@/lib/supabase/config";
import type { Metadata } from "next";
import { LoginClient } from "./login-client";

export const metadata: Metadata = {
  title: "Sign In",
};

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ authError?: string; passwordReset?: string }>;
}) {
  const params = await searchParams;
  const notice = params.authError ? "That sign-in link is invalid or expired. Request a new recovery link." :
    params.passwordReset === "success" ? "Password updated. Sign in with your new password." : undefined;
  const supabaseConfigured = !isPreviewMode();
  return <LoginClient supabaseConfigured={supabaseConfigured} notice={notice} />;
}
