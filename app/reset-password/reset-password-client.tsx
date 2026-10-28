"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordClient() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm space-y-5">
        <h1 className="text-2xl font-bold">Choose a new password</h1>
        {/* method="post": a pre-hydration native submit must not GET
            ?password=&confirm= into the URL/history/server logs. */}
        <form className="space-y-4" method="post" onSubmit={async (event) => {
          event.preventDefault(); setError("");
          if (password !== confirm) { setError("Passwords do not match."); return; }
          setPending(true);
          try {
            const sb = createClient();
            if (!sb) throw new Error("Your recovery session has expired. Request a new link.");
            const { error } = await sb.auth.updateUser({ password });
            if (error) throw error;
            const result = await sb.auth.signOut({ scope: "local" });
            if (result.error) throw new Error("Password updated. Please sign out before signing in with your new password.");
            window.location.replace("/login?passwordReset=success");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to update your password. Please try again.");
          } finally { setPending(false); }
        }}>
          <Label htmlFor="reset-password">New password</Label>
          <Input id="reset-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
          <Label htmlFor="reset-confirm">Confirm password</Label>
          <Input id="reset-confirm" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
          <Button className="w-full" disabled={pending}>{pending ? "Updating…" : "Update password"}</Button>
        </form>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    </main>
  );
}
