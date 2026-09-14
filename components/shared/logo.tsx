import { cn } from "@/lib/utils";

/** QuickRecon mark — "QR" monogram tile, matching the mockup branding. */
export function QuickReconMark({
  size = 34,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[9px] bg-primary font-bold text-primary-foreground shadow-sm",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      QR
    </span>
  );
}

export function QuickReconLogo({
  variant = "full",
  tone = "light",
  className,
}: {
  variant?: "full" | "mark";
  tone?: "light" | "dark";
  className?: string;
}) {
  if (variant === "mark") return <QuickReconMark className={className} />;
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <QuickReconMark />
      <span className="leading-tight">
        <span
          className={cn(
            "block text-[15px] font-bold tracking-tight",
            tone === "dark" ? "text-white" : "text-foreground"
          )}
        >
          QuickRecon App
        </span>
        <span
          className={cn(
            "block text-[10.5px]",
            tone === "dark" ? "text-[#7f99b8]" : "text-muted-foreground"
          )}
        >
          Agents. Reconciliation. Growth.
        </span>
      </span>
    </span>
  );
}
