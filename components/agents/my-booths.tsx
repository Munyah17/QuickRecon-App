"use client";

import { MapPin, Plus, Users, Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { moduleName } from "@/lib/format";
import type { Booth } from "@/types";

/**
 * Agent "My Booths" — mobile cards per mockup screen 4,
 * a tidy table on larger screens.
 */
export function MyBooths({ booths }: { booths: Booth[] }) {
  return (
    <div className="space-y-4">
      {/* Mobile: card stack */}
      <div className="space-y-3 lg:hidden">
        {booths.map((b) => (
          <Card key={b.id} className="gap-0 py-0 shadow-xs">
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Booth actions">
                      <Ellipsis className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View details</DropdownMenuItem>
                    <DropdownMenuItem>Edit booth</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-3 text-[12px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <StoreIconText modules={b.modules} />
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-3.5" aria-hidden />
                  {b.assistantsCount} Assistant{b.assistantsCount === 1 ? "" : "s"}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              <th className="px-4 py-2.5">Booth</th>
              <th className="px-4 py-2.5">Location</th>
              <th className="px-4 py-2.5">Modules</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Assistants</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {booths.map((b) => (
              <tr key={b.id} className="hover:bg-surface-hover">
                <td className="px-4 py-3 font-medium">{b.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{b.location}, {b.province}</td>
                <td className="px-4 py-3">
                  <StoreIconText modules={b.modules} />
                </td>
                <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                <td className="tnum px-4 py-3">{b.assistantsCount}</td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Booth actions">
                        <Ellipsis className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View details</DropdownMenuItem>
                      <DropdownMenuItem>Edit booth</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button className="h-10 w-full gap-2 text-[13.5px] lg:w-auto">
        <Plus className="size-4" aria-hidden /> Request New Booth
      </Button>
    </div>
  );
}

function StoreIconText({ modules }: { modules: Booth["modules"] }) {
  const label =
    modules.length > 1
      ? modules.map(moduleName).join(" + ")
      : `${moduleName(modules[0] ?? "enpassent")} Only`;
  return <span className="text-[12px] text-muted-foreground">{label}</span>;
}
