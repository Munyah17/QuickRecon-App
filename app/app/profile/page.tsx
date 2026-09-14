import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserPen } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getAgentById } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentAvatar } from "@/components/shared/agent-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, initials } from "@/lib/format";
import { isCompanyRole } from "@/lib/nav";
import { QuickReconLogo } from "@/components/shared/logo";

export const metadata: Metadata = { title: "My Profile" };

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <span className={`text-right text-[13px] font-medium ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const agent = session.user.agentId
    ? await getAgentById(session.user.agentId)
    : null;

  const isField = !isCompanyRole(session.user.role);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {/* Identity hero (agent mobile mockup #9) */}
      <Card className="gap-0 py-0 text-center shadow-xs">
        <CardContent className="flex flex-col items-center gap-2 p-5">
          <div className="relative">
            <span className="flex size-20 items-center justify-center rounded-full bg-primary text-[24px] font-bold text-primary-foreground">
              {initials(session.user.fullName)}
            </span>
            <span
              className="absolute -right-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground"
              aria-hidden
            >
              <UserPen className="size-3" />
            </span>
          </div>
          <div>
            <h1 className="text-[17px] font-bold tracking-tight">{session.user.fullName}</h1>
            <p className="font-mono text-[12px] text-muted-foreground">
              {session.user.agentId ?? session.user.email}
            </p>
          </div>
          <StatusBadge status="active" />
        </CardContent>
      </Card>

      <Tabs defaultValue="personal">
        <TabsList className="w-full grid-cols-4">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="kyc" disabled={!isField}>KYC</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-3">
          <Card className="gap-0 py-0 shadow-xs">
            <CardContent className="divide-y px-5 py-2">
              <Row label="Full Name" value={session.user.fullName} />
              <Row label={isField ? "Agent ID" : "Role"} value={session.user.agentId ?? session.user.roleLabel} mono />
              {agent?.nationalId ? <Row label="ID/Passport" value={agent.nationalId} mono /> : null}
              {agent?.iceCashId ? <Row label="IceCash ID" value={agent.iceCashId} mono /> : null}
              {agent ? <Row label="Joined Date" value={formatDate(agent.joinedAt)} /> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="mt-3">
          <Card className="gap-0 py-0 shadow-xs">
            <CardContent className="divide-y px-5 py-2">
              <Row label="Email" value={session.user.email} />
              {agent?.phone ? <Row label="Phone" value={agent.phone} mono /> : null}
              {agent ? <Row label="Location" value={`${agent.location}, ${agent.province}`} /> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kyc" className="mt-3">
          <Card className="gap-0 py-0 shadow-xs">
            <CardContent className="divide-y px-5 py-2">
              <Row label="KYC status" value={agent?.kycStatus === "verified" ? "Verified" : "Pending"} />
              {agent?.nationalId ? <Row label="ID/Passport" value={agent.nationalId} mono /> : null}
              {agent?.iceCashId ? <Row label="IceCash ID" value={agent.iceCashId} mono /> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-3">
          <Card className="gap-0 py-0 shadow-xs">
            <CardContent className="divide-y px-5 py-2">
              <Row label="Theme" value="Follows system (change via top bar)" />
              <Row label="Notifications" value="Enabled" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button className="h-10 w-full text-[13.5px]" variant="secondary">
        <UserPen className="size-4" aria-hidden /> Edit Profile
      </Button>

      {/* Mobile "More" footer identity (per mockup #10) */}
      <Card className="gap-0 bg-primary-soft/50 py-0 shadow-xs lg:hidden">
        <CardContent className="flex flex-col items-center gap-1.5 p-5 text-center">
          <QuickReconLogo />
          <p className="text-[11.5px] text-muted-foreground">Version 1.0.0</p>
        </CardContent>
      </Card>
    </div>
  );
}
