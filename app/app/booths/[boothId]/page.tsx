import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import {
  getBoothById,
  getAssistants,
  getTransactions,
} from "@/lib/data";
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

  const company = isCompanyRole(session.user.role);
  // Field users can only open their own booths.
  if (!company && booth.agentId !== session.user.agentId) {
    redirect("/app/booths");
  }

  const [assistants, transactions] = await Promise.all([
    getAssistants(booth.agentId),
    getTransactions(booth.agentId),
  ]);
  const boothAssistants = assistants.filter((a) => a.boothId === booth.id);

  return (
    <BoothDetail
      booth={booth}
      assistants={boothAssistants}
      transactions={transactions}
    />
  );
}
