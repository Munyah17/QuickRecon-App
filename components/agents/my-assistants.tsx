"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Ellipsis, Plus, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { AgentAvatar } from "@/components/shared/agent-avatar";
import type { Assistant, Booth } from "@/types";

const requestSchema = z.object({
  fullName: z.string().min(3, "Enter the assistant's full name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(9, "Enter a valid phone number"),
  boothId: z.string().min(1, "Assign a booth"),
});
type RequestValues = z.infer<typeof requestSchema>;

const PERMISSION_OPTIONS = [
  { id: "submissions", label: "Create submissions" },
  { id: "reports", label: "View booth reports" },
  { id: "transactions", label: "Record transactions" },
];

/**
 * Agent "My Assistants" — add-request dialog (goes to Super Admin approval)
 * plus the current roster with statuses.
 */
export function MyAssistants({
  assistants,
  booths,
  isAdminView = false,
}: {
  assistants: (Assistant & { parentAgentName?: string })[];
  booths: Booth[];
  isAdminView?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [perms, setPerms] = React.useState<string[]>(["submissions"]);
  const form = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { fullName: "", email: "", phone: "", boothId: "" },
  });

  function togglePerm(id: string, on: boolean) {
    setPerms((p) => (on ? [...p, id] : p.filter((x) => x !== id)));
  }

  async function onSubmit(values: RequestValues) {
    // Server action would persist + notify Super Admin; approval keeps access closed.
    console.info("assistant request", { ...values, perms });
    toast.success("Assistant request submitted", {
      description: "A Super Admin will review and approve the account before it activates.",
    });
    setOpen(false);
    form.reset();
    setPerms(["submissions"]);
  }

  return (
    <div className="space-y-4">
      {!isAdminView && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-10 w-full gap-2 text-[13.5px] lg:w-auto">
              <UserRoundPlus className="size-4" aria-hidden /> Add Assistant
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Request New Assistant</DialogTitle>
              <DialogDescription>
                The account activates only after Super Admin approval.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" placeholder="e.g. Tairo Moyo" {...form.register("fullName")} />
                {form.formState.errors.fullName && (
                  <p className="text-[12px] text-destructive">{form.formState.errors.fullName.message}</p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="name@example.com" {...form.register("email")} />
                  {form.formState.errors.email && (
                    <p className="text-[12px] text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" placeholder="+263 77 000 0000" {...form.register("phone")} />
                  {form.formState.errors.phone && (
                    <p className="text-[12px] text-destructive">{form.formState.errors.phone.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Booth assignment</Label>
                <Select onValueChange={(v) => form.setValue("boothId", v, { shouldValidate: true })}>
                  <SelectTrigger aria-label="Booth assignment">
                    <SelectValue placeholder="Select a booth" />
                  </SelectTrigger>
                  <SelectContent>
                    {booths.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} — {b.location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.boothId && (
                  <p className="text-[12px] text-destructive">{form.formState.errors.boothId.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Requested permissions</Label>
                {PERMISSION_OPTIONS.map((p) => (
                  <label key={p.id} className="flex items-center gap-2.5 text-[13px]">
                    <Checkbox
                      checked={perms.includes(p.id)}
                      onCheckedChange={(c) => togglePerm(p.id, c === true)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                Submit for approval
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <div className="space-y-3">
        {assistants.length === 0 && (
          <Card className="py-0 shadow-xs">
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Plus className="size-5" aria-hidden />
              </span>
              <p className="text-[13.5px] font-semibold">No assistants yet</p>
              <p className="text-[12px] text-muted-foreground">
                {isAdminView ? "No assistant accounts found." : "Request an assistant to delegate booth work."}
              </p>
            </CardContent>
          </Card>
        )}
        {assistants.map((a) => (
          <Card key={a.id} className="gap-0 py-0 shadow-xs">
            <CardContent className="flex items-center gap-3 p-4">
              <AgentAvatar name={a.fullName} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[13.5px] font-semibold">{a.fullName}</p>
                  <StatusBadge status={a.status} />
                </div>
                <p className="truncate text-[12px] text-muted-foreground">{a.email}</p>
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                  {a.boothName ?? "Unassigned"}
                  {isAdminView && a.parentAgentName ? ` · Agent: ${a.parentAgentName}` : ""}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Assistant actions">
                    <Ellipsis className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => toast.info(`Viewing profile for ${a.fullName}`)}>
                    View profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => toast.info(`Editing permissions for ${a.fullName}`)}>
                    Edit permissions
                  </DropdownMenuItem>
                  {isAdminView && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => toast.success(`${a.fullName} has been removed`)}
                    >
                      Remove assistant
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
