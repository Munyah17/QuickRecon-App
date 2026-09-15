"use client";

import * as React from "react";
import Link from "next/link";
import { MapPin, Plus, Users, Ellipsis, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { moduleName } from "@/lib/format";
import type { Booth } from "@/types";

function ModuleChips({ modules }: { modules: Booth["modules"] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {modules.map((m) => (
        <span
          key={m}
          className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-primary"
        >
          {m === "econet-moovah" ? "Moovah" : moduleName(m)}
        </span>
      ))}
    </span>
  );
}

/**
 * Agent "My Booths" — mobile cards per mockup, filterable table on desktop.
 */
export function MyBooths({ booths }: { booths: Booth[] }) {
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [moduleFilter, setModuleFilter] = React.useState("all");

  const filtered = booths.filter((b) => {
    const q = query.toLowerCase();
    return (
      (!q || b.name.toLowerCase().includes(q) || b.location.toLowerCase().includes(q)) &&
      (statusFilter === "all" || b.status === statusFilter) &&
      (moduleFilter === "all" || b.modules.includes(moduleFilter as Booth["modules"][number]))
    );
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-32 bg-card text-[12.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="h-9 w-36 bg-card text-[12.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            <SelectItem value="enpassent">Enpassent</SelectItem>
            <SelectItem value="econet-moovah">Econet Moovah</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search booths…"
            className="h-9 bg-card pl-9 text-[13px]"
            aria-label="Search booths"
          />
        </div>
      </div>

      {/* Mobile: card stack */}
      <div className="space-y-3 lg:hidden">
        {filtered.map((b) => (
          <Link key={b.id} href={`/app/booths/${b.id}`}>
            <Card className="gap-0 py-0 shadow-xs transition-colors hover:bg-surface-hover">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <MapPin className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{b.name}</p>
                    <p className="text-[12px] text-muted-foreground">{b.location}</p>
                    <div className="mt-1.5">
                      <StatusBadge status={b.status} />
                    </div>
                  </div>
                  <Ellipsis className="size-4 text-muted-foreground" aria-hidden />
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3 text-[12px] text-muted-foreground">
                  <ModuleChips modules={b.modules} />
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-3.5" aria-hidden />
                    {b.assistantsCount} Assistant{b.assistantsCount === 1 ? "" : "s"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              <th className="w-10 px-4 py-2.5">#</th>
              <th className="px-4 py-2.5">Booth Name</th>
              <th className="px-4 py-2.5">Location</th>
              <th className="px-4 py-2.5">Modules</th>
              <th className="px-4 py-2.5">Assistants</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((b, i) => (
              <tr key={b.id} className="hover:bg-surface-hover">
                <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3 font-medium">
                  <Link href={`/app/booths/${b.id}`} className="hover:text-primary hover:underline">
                    {b.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{b.location}</td>
                <td className="px-4 py-3"><ModuleChips modules={b.modules} /></td>
                <td className="tnum px-4 py-3">{b.assistantsCount}</td>
                <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Booth actions">
                        <Ellipsis className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/app/booths/${b.id}`}>View details</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>Edit booth</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t px-4 py-2.5 text-[12px] text-muted-foreground">
          <span>Showing 1–{filtered.length} of {filtered.length} booths</span>
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[11.5px] font-semibold text-primary-foreground">1</span>
        </div>
      </div>

      <Button className="h-10 w-full gap-2 text-[13.5px] lg:hidden">
        <Plus className="size-4" aria-hidden /> Request New Booth
      </Button>
    </div>
  );
}
