"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, LoaderCircle, CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Checkbox } from "@/components/ui/checkbox";

const PROVINCES = [
  "Harare",
  "Bulawayo",
  "Manicaland",
  "Mashonaland Central",
  "Mashonaland East",
  "Mashonaland West",
  "Masvingo",
  "Matabeleland North",
  "Matabeleland South",
  "Midlands",
];

export function AddAgentDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [province, setProvince] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [enpassent, setEnpassent] = React.useState(true);
  const [econet, setEconet] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [created, setCreated] = React.useState<{
    agentId?: string;
    tempPassword?: string;
  } | null>(null);

  const reset = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setProvince("");
    setLocation("");
    setEnpassent(true);
    setEconet(false);
    setCreated(null);
  };

  const handleCreate = async () => {
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!enpassent && !econet) {
      toast.error("Select at least one module");
      return;
    }
    const moduleAccess =
      enpassent && econet ? "both" : econet ? "econet-moovah" : "enpassent";
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          province,
          location,
          role: "agent",
          moduleAccess,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create agent");
      setCreated({ agentId: data.agentId, tempPassword: data.tempPassword });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create agent");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-9 gap-1.5 text-[13px]">
          <Plus className="size-4" aria-hidden /> Add Agent
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add New Agent</DialogTitle>
          <DialogDescription>
            Create a new agent profile. The agent will receive an email with
            login instructions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="add-fullname">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="add-fullname"
              placeholder="e.g. Tendai Moyo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="add-email"
                type="email"
                placeholder="agent@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-phone">
                Phone <span className="text-destructive">*</span>
              </Label>
              <Input
                id="add-phone"
                placeholder="+263 77 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-province">Province</Label>
              <Select value={province} onValueChange={setProvince}>
                <SelectTrigger id="add-province">
                  <SelectValue placeholder="Select province" />
                </SelectTrigger>
                <SelectContent>
                  {PROVINCES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-location">Location / Town</Label>
              <Input
                id="add-location"
                placeholder="e.g. CBD"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Module Access</Label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-[13px]">
                <Checkbox
                  checked={enpassent}
                  onCheckedChange={(v) => setEnpassent(v === true)}
                />
                Enpassent
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <Checkbox
                  checked={econet}
                  onCheckedChange={(v) => setEconet(v === true)}
                />
                Econet Moovah
              </label>
            </div>
          </div>
        </div>
        {created && (
          <div className="mx-4 mb-1 flex items-start gap-2.5 rounded-lg border border-success/30 bg-success-soft p-3 text-[12.5px]">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-success-foreground" aria-hidden />
            <div className="space-y-0.5">
              <p className="font-semibold text-success-foreground">
                Agent created{created.agentId ? ` — ${created.agentId}` : ""}
              </p>
              {created.tempPassword ? (
                <p className="text-muted-foreground">
                  Temporary password:{" "}
                  <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[11.5px] text-foreground">
                    {created.tempPassword}
                  </code>{" "}
                  — share it with the agent; they can reset it after first login.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Share the login credentials with the agent.
                </p>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {created ? "Done" : "Cancel"}
          </Button>
          {!created && (
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden /> Creating…
                </>
              ) : (
                "Create Agent"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
