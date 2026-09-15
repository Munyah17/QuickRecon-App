"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { QuickReconMark } from "@/components/shared/logo";
import { loginAsPreviewRole, loginWithPassword } from "./actions";
import type { RoleCode } from "@/types";

const loginSchema = z.object({
  email: z.string().min(1, "Enter your email or username"),
  password: z.string().min(1, "Enter your password"),
  remember: z.boolean().optional(),
});
type LoginValues = z.infer<typeof loginSchema>;

const PREVIEW_ROLES: { role: RoleCode; label: string }[] = [
  { role: "super_admin", label: "Super Admin" },
  { role: "agent", label: "Agent" },
  { role: "assistant", label: "Assistant" },
  { role: "tech_support", label: "Tech Support" },
];

export function LoginClient({ supabaseConfigured }: { supabaseConfigured: boolean }) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  });
  const remember = useWatch({ control: form.control, name: "remember" });

  async function onSubmit(values: LoginValues) {
    setPending(true);
    const result = await loginWithPassword(values.email, values.password);
    setPending(false);
    if (result?.error) toast.error(result.error);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-b from-brand-700 via-brand-800 to-brand-950 lg:flex lg:flex-col">
        <div className="flex items-center gap-3 p-8">
          <span className="flex size-11 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-white/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/quickrecon-logo.png" alt="QuickRecon App" className="size-full object-contain p-1" />
          </span>
          <div className="leading-tight text-white">
            <p className="text-[17px] font-bold">QuickRecon App</p>
            <p className="text-[11.5px] text-brand-200">Agents. Reconciliation. Growth.</p>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center px-8">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl shadow-brand-950/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/quickrecon-logo.png"
              alt="QuickRecon App — circular reconciliation logo"
              className="h-auto w-full"
            />
          </div>
        </div>
        <div className="p-8" />
      </div>

      {/* Sign-in panel */}
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary-soft via-background to-background px-5 py-10 lg:bg-none">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
            <QuickReconMark size={52} className="shadow-md" />
            <div>
              <p className="text-[20px] font-bold tracking-tight">QuickRecon App</p>
              <p className="text-[12px] text-muted-foreground">Agents. Reconciliation. Growth.</p>
            </div>
          </div>

          <h1 className="text-[22px] font-bold tracking-tight lg:text-[24px]">
            Welcome Back
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Sign in to your account
          </p>

          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-7 space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px]">Email or Username</Label>
              <Input
                id="email"
                type="text"
                autoComplete="username"
                placeholder="Enter your email or username"
                className="h-11 bg-card text-[14px]"
                aria-invalid={!!form.formState.errors.email}
                {...form.register("email")}
              />
              {form.formState.errors.email ? (
                <p className="text-[12px] text-destructive">{form.formState.errors.email.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[13px]">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="h-11 bg-card pr-11 text-[14px]"
                  aria-invalid={!!form.formState.errors.password}
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
                </button>
              </div>
              {form.formState.errors.password ? (
                <p className="text-[12px] text-destructive">{form.formState.errors.password.message}</p>
              ) : null}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Checkbox
                  checked={remember ?? true}
                  onCheckedChange={(c) => form.setValue("remember", c === true)}
                />
                Remember me
              </label>
              <span className="cursor-pointer text-[13px] font-medium text-primary hover:underline">
                Forgot password?
              </span>
            </div>

            <Button type="submit" className="h-11 w-full text-[14px] font-semibold" disabled={pending}>
              {pending ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden /> Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {!supabaseConfigured ? (
            <div className="mt-8 rounded-xl border bg-card p-4">
              <p className="text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                Preview accounts
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Supabase is not configured yet — review the portals with a sample session.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {PREVIEW_ROLES.map((r) => (
                  <Button
                    key={r.role}
                    variant="outline"
                    className="h-9 text-[12.5px]"
                    onClick={async () => {
                      setPending(true);
                      await loginAsPreviewRole(r.role);
                    }}
                  >
                    {r.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
