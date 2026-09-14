import Link from "next/link";
import { QuickReconMark } from "@/components/shared/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <QuickReconMark size={44} />
      <div>
        <h1 className="text-[20px] font-bold tracking-tight">Page not found</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          The page you are looking for doesn&apos;t exist or was moved.
        </p>
      </div>
      <Link
        href="/app/dashboard"
        className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
