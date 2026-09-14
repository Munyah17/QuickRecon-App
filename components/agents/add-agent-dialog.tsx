"use client";

import * as React from "react";
import { Plus } from "lucide-react";
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
  const [open, setOpen] = React.useState(false);
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [province, setProvince] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [enpassent, setEnpassent] = React.useState(true);
  const [econet, setEconet] = React.useState(false);

  const handleCreate = () => {
    if (!fullName || !email || !phone) {
      toast.error("Please fill in all required fields");
      return;
    }
    toast.success(`Agent ${fullName} created successfully`);
    setFullName("");
    setEmail("");
    setPhone("");
    setProvince("");
    setLocation("");
    setEnpassent(true);
    setEconet(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>Create Agent</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
