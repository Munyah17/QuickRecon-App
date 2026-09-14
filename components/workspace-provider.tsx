"use client";

import * as React from "react";
import type { ModuleCode, ModuleSelection } from "@/types";

interface WorkspaceState {
  module: ModuleSelection;
  setModule: (m: ModuleSelection) => void;
  period: string; // "2026-08"
  setPeriod: (p: string) => void;
  availableModules: ModuleCode[];
}

const WorkspaceContext = React.createContext<WorkspaceState | null>(null);

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Holds the operator's active business module + reporting period.
 * Persists to localStorage; module options reflect what the user may access.
 */
export function WorkspaceProvider({
  availableModules,
  children,
}: {
  availableModules: ModuleCode[];
  children: React.ReactNode;
}) {
  const [module, setModuleState] = React.useState<ModuleSelection>(
    availableModules[0] ?? "enpassent"
  );
  const [period, setPeriodState] = React.useState<string>(currentPeriod());

  React.useEffect(() => {
    const savedModule = localStorage.getItem("qr_module");
    const savedPeriod = localStorage.getItem("qr_period");
    if (
      savedModule &&
      (savedModule === "all" ||
        availableModules.includes(savedModule as ModuleCode))
    ) {
      setModuleState(savedModule as ModuleSelection);
    }
    if (savedPeriod) setPeriodState(savedPeriod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setModule = React.useCallback((m: ModuleSelection) => {
    setModuleState(m);
    localStorage.setItem("qr_module", m);
  }, []);

  const setPeriod = React.useCallback((p: string) => {
    setPeriodState(p);
    localStorage.setItem("qr_period", p);
  }, []);

  const value = React.useMemo(
    () => ({ module, setModule, period, setPeriod, availableModules }),
    [module, setModule, period, setPeriod, availableModules]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceState {
  const ctx = React.useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
