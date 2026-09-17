"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Segment-level error boundary so a failing page shows a retry UI with the
 * real error digest instead of the bare framework error page. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div>
        <h2 className="text-[18px] font-semibold">This page couldn&apos;t load</h2>
        <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
          {error.message || "An unexpected error occurred."}
          {error.digest ? (
            <span className="mt-1 block text-[11px] text-muted-foreground/70">
              Reference: {error.digest}
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={reset}>Reload</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/app/dashboard")}>
          Go back
        </Button>
      </div>
    </div>
  );
}
