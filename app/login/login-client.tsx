"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
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

/** Abstract skyline used on the brand panel (matches mockup composition). */
function Skyline() {
  return (
    <svg viewBox="0 0 480 300" className="h-full w-full" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <linearGradient id="bld" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e40af" />
          <stop offset="100%" stopColor="#172554" />
        </linearGradient>
        <linearGradient id="win" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#bfdbfe" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <g fill="url(#bld)">
        <rect x="20" y="120" width="90" height="180" rx="3" />
        <rect x="130" y="60" width="110" height="240" rx="3" />
        <rect x="255" y="140" width="80" height="160" rx="3" />
        <rect x="350" y="90" width="110" height="210" rx="3" />
      </g>
      <g fill="url(#win)" opacity="0.85">
        {Array.from({ length: 6 }).map((_, r) =>
          Array.from({ length: 4 }).map((_, c) => (
            <rect key={`a${r}${c}`} x={32 + c * 20} y={132 + r * 28} width="12" height="16" rx="1.5" />
          ))
        )}
        {Array.from({ length: 8 }).map((_, r) =>
          Array.from({ length: 5 }).map((_, c) => (
            <rect key={`b${r}${c}`} x={144 + c * 20} y={74 + r * 28} width="12" height="16" rx="1.5" />
          ))
        )}
        {Array.from({ length: 5 }).map((_, r) =>
          Array.from({ length: 3 }).map((_, c) => (
            <rect key={`c${r}${c}`} x={265 + c * 24} y={152 + r * 28} width="14" height="16" rx="1.5" />
          ))
        )}
        {Array.from({ length: 7 }).map((_, r) =>
          Array.from({ length: 4 }).map((_, c) => (
            <rect key={`d${r}${c}`} x={364 + c * 24} y={104 + r * 28} width="14" height="16" rx="1.5" />
          ))
        )}
      </g>
    </svg>
  );
}

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
          <span className="flex size-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <span className="text-[15px] font-bold text-white">QR</span>
          </span>
          <div className="leading-tight text-white">
            <p className="text-[17px] font-bold">QuickRecon App</p>
            <p className="text-[11.5px] text-brand-200">Agents. Reconciliation. Growth.</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 px-8">
          <Skyline />
        </div>
        <div className="p-8 text-white">
          <p className="text-[22px] leading-7 font-bold">
            Accurate Data
            <br />
            Empowered Agents
            <br />
            Stronger Business
          </p>
          <p className="mt-3 text-[12px] text-brand-200">
            © 2026 QuickRecon App. All rights reserved.
          </p>
        </div>
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
                  checked={form.watch("remember") ?? true}
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

          <p className="mt-8 text-center text-[11.5px] text-muted-foreground">
            Trusted by teams for secure reconciliation across Zimbabwe.
          </p>
        </div>
      </div>
    </div>
  );
}
