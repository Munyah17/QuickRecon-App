"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm space-y-5">
        <h1 className="text-2xl font-bold">Reset your password</h1>
        <p className="text-sm text-muted-foreground">Enter your account email to request a recovery link.</p>
        <form className="space-y-4" onSubmit={async (event) => {
          event.preventDefault();
          setPending(true); setError(""); setMessage("");
          try {
            const sb = createClient();
            if (!sb) throw new Error("Password recovery is unavailable for sample accounts.");
            const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
              redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
            });
            if (error) throw error;
            setMessage("If this email has an account, a recovery link will arrive shortly. Check your inbox and spam folder.");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to request a recovery link. Please try again.");
          } finally { setPending(false); }
        }}>
          <Label htmlFor="recovery-email">Email</Label>
          <Input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <Button className="w-full" disabled={pending}>{pending ? "Requesting…" : "Send recovery link"}</Button>
        </form>
        {message && <p role="status" className="text-sm">{message}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Link href="/login" className="block text-sm text-primary underline">Back to sign in</Link>
      </div>
    </main>
  );
}
