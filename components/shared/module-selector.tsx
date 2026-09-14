"use client";

import { Boxes, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/components/workspace-provider";
import { moduleName } from "@/lib/format";
import type { ModuleSelection } from "@/types";

/**
 * Compact business-module switcher (Enpassent / Econet Moovah / All Modules).
 * Switching re-scopes dashboards, reconciliations, imports and reports.
 */
export function ModuleSelector({
  allowAll = true,
  compact = false,
}: {
  allowAll?: boolean;
  compact?: boolean;
}) {
  const { module, setModule, availableModules } = useWorkspace();
  const options: ModuleSelection[] = [
    ...(allowAll && availableModules.length > 1 ? (["all"] as const) : []),
    ...availableModules,
  ];

  if (options.length <= 1) {
    return (
      <span className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-[13px] font-medium">
        <Boxes className="size-4 text-primary" aria-hidden />
        {moduleName(options[0] ?? "enpassent")}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-9 gap-2 border-border bg-card px-3 text-[13px] font-medium"
          aria-label="Select business module"
        >
          <Boxes className="size-4 text-primary" aria-hidden />
          <span>{moduleName(module)}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} className="w-52">
        <DropdownMenuLabel className="text-[11px] tracking-wide text-muted-foreground">
          Active module
        </DropdownMenuLabel>
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt}
            onSelect={() => setModule(opt)}
            className="text-[13px]"
          >
            <span className="flex-1">{moduleName(opt)}</span>
            {module === opt && <Check className="size-4 text-primary" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
