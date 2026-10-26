import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import {
  getActivities,
  getAgentById,
  getAgentRiskScores,
  getBooths,
  getReconciliations,
} from "@/lib/data";
import { AgentProfile } from "@/components/agents/agent-profile";
import { isCompanyRole } from "@/lib/nav";

export const metadata: Metadata = { title: "Agent Profile" };

const RISK_LEVEL_STYLE: Record<string, string> = {
  low: "bg-success-soft text-success-foreground",
  medium: "bg-warning-soft text-warning-foreground",
  high: "bg-destructive-soft/70 text-destructive",
  critical: "bg-destructive-soft text-destructive",
};

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { agentId } = await params;
  if (!isCompanyRole(session.user.role)) redirect("/app/dashboard");

  const agent = await getAgentById(agentId);
  if (!agent) notFound();

  const [booths, reconciliations, activities, riskScores] = await Promise.all([
    getBooths(agent.id),
    getReconciliations({ agentId: agent.id }),
    getActivities(),
    getAgentRiskScores(agent.id),
  ]);

  return (
    <div className="space-y-4">
      {riskScores.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {riskScores.map((r) => (
            <div key={r.module} className="rounded-xl border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Engine risk — {r.module} · {r.period}
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${RISK_LEVEL_STYLE[r.level]}`}
                >
                  {r.score} · {r.level.toUpperCase()}
                </span>
              </div>
              {r.factors.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {r.factors.slice(0, 4).map((f) => (
                    <li key={f.factor} className="text-[11.5px] text-muted-foreground">
                      <span className="tnum font-medium text-foreground">
                        +{Math.round(f.weight)}
                      </span>{" "}
                      {f.detail}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      <AgentProfile
        agent={agent}
        booths={booths}
        reconciliations={reconciliations}
        activities={activities}
        viewer={session.user}
      />
    </div>
  );
}