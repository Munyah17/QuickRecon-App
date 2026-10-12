import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getBoothById, getTransactions } from "@/lib/data";
import { isCompanyRole } from "@/lib/nav";
import { BoothDetail } from "@/components/agents/booth-detail";

export const metadata: Metadata = { title: "Booth Detail" };

export default async function BoothDetailPage({
  params,
}: {
  params: Promise<{ boothId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { boothId } = await params;
  const booth = await getBoothById(boothId);
  if (!booth) notFound();

  if (!isCompanyRole(session.user.role)) redirect("/app/agents");

  const transactions = await getTransactions(booth.agentId);

  return (
    <BoothDetail
      booth={booth}
      transactions={transactions}
    />
  );
}
