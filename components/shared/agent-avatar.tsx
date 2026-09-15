import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
];

function paletteFor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 997;
  return PALETTE[h % PALETTE.length];
}

export function AgentAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass = {
    xs: "size-7 text-[11px]",
    sm: "size-9 text-xs",
    md: "size-10 text-[13px]",
    lg: "size-14 text-base",
  }[size];
  return (
    <Avatar className={cn("aspect-square shrink-0 rounded-full", sizeClass, className)}>
      <AvatarFallback className={cn("flex items-center justify-center rounded-full font-semibold", paletteFor(name))}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
