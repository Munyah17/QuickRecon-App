import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserPen } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getAgentById } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { formatDate, initials, moduleName } from "@/lib/format";
import { isCompanyRole } from "@/lib/nav";
import { QuickReconLogo } from "@/components/shared/logo";
import { ChangePasswordButton } from "@/components/profile/change-password";

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

  /* Desktop field layout — PC mockup screen 2: single card with sections. */
  if (isField && agent) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="My Profile"
          description="Manage your account details and preferences."
          actions={
            <Button className="h-9 gap-1.5 text-[13px]">
              <UserPen className="size-4" aria-hidden /> Edit Profile
            </Button>
          }
        />

        {/* Mobile keeps the hero + tabs treatment (mockup 4 #9) */}
        <div className="mx-auto max-w-xl space-y-4 lg:hidden">
          <MobileProfile agent={agent} fullName={session.user.fullName} agentId={session.user.agentId} email={session.user.email} />
        </div>

        <div className="hidden space-y-4 lg:block">
          <Card className="gap-0 py-0 shadow-xs">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">Personal Information</p>
                  <div className="mt-4 grid gap-x-10 gap-y-4 sm:grid-cols-2">
                    <Field label="Full Name" value={session.user.fullName} />
                    <Field label="Agent ID" value={agent.id} mono />
                    <Field label="Email Address" value={agent.email} />
                    <Field label="Phone Number" value={agent.phone} mono />
                    {agent.iceCashId ? <Field label="IceCash ID" value={agent.iceCashId} mono /> : null}
                    <Field label="Location" value={`${agent.location}, ${agent.province}`} />
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <span className="flex size-20 items-center justify-center rounded-full bg-primary text-[24px] font-bold text-primary-foreground">
                    {initials(session.user.fullName)}
                  </span>
                  <button className="text-[12px] font-semibold text-primary hover:underline">
                    Change Photo
                  </button>
                  <p className="text-[10.5px] text-muted-foreground">JPG, PNG up to 2MB</p>
                </div>
              </div>

              <div className="mt-6 border-t pt-5">
                <p className="text-[15px] font-semibold">KYC Information</p>
                <div className="mt-4 grid gap-x-10 gap-y-4 sm:grid-cols-3">
                  <Field label="ID Type" value="National ID" />
                  {agent.nationalId ? <Field label="ID Number" value={agent.nationalId} mono /> : null}
                  <Field label="Date of Birth" value="—" />
                </div>
                <div className="mt-4 flex items-center gap-6">
                  <span className="flex items-center gap-2 text-[12.5px]">
                    <span className="text-muted-foreground">KYC Status</span>
                    <StatusBadge status={agent.kycStatus === "verified" ? "verified" : "pending"} />
                  </span>
                  <Field label="Verified On" value={formatDate(agent.joinedAt)} />
                </div>
              </div>

              <div className="mt-6 border-t pt-5">
                <p className="text-[15px] font-semibold">Account Details</p>
                <div className="mt-4 grid gap-x-10 gap-y-4 sm:grid-cols-2">
                  <Field label="Account Type" value="Agent" />
                  <Field label="Date Joined" value={formatDate(agent.joinedAt)} />
                </div>
                <div className="mt-4 flex items-center gap-2 text-[12.5px]">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={agent.status} />
                </div>
              </div>

              <div className="mt-6 border-t pt-5">
                <p className="text-[15px] font-semibold">Module Access</p>
                <div className="mt-3 space-y-2.5">
                  {agent.modules.map((m) => (
                    <div key={m.module} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[13px] font-medium">
                        <span className="size-4.5 rounded-full bg-primary-soft text-primary" aria-hidden />
                        {moduleName(m.module)}
                      </span>
                      <StatusBadge status={m.enabled ? "enabled" : "disabled"} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t pt-5">
                <div>
                  <p className="text-[15px] font-semibold">Security</p>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">Password</p>
                </div>
                <ChangePasswordButton />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Company users get the compact profile (no field-agent record needed).
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <MobileProfile
        agent={agent}
        fullName={session.user.fullName}
        agentId={session.user.agentId}
        email={session.user.email}
      />
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11.5px] text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-[13px] font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

/** Mobile hero + tabs treatment (agent mobile mockup #9). */
function MobileProfile({
  agent,
  fullName,
  agentId,
  email,
}: {
  agent: Awaited<ReturnType<typeof getAgentById>>;
  fullName: string;
  agentId?: string;
  email: string;
}) {
  return (
    <>
      {/* Identity hero */}
      <Card className="gap-0 py-0 text-center shadow-xs">
        <CardContent className="flex flex-col items-center gap-2 p-5">
          <div className="relative">
            <span className="flex size-20 items-center justify-center rounded-full bg-primary text-[24px] font-bold text-primary-foreground">
              {initials(fullName)}
            </span>
            <span
              className="absolute -right-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground"
              aria-hidden
            >
              <UserPen className="size-3" />
            </span>
          </div>
          <div>
            <h1 className="text-[17px] font-bold tracking-tight">{fullName}</h1>
            <p className="font-mono text-[12px] text-muted-foreground">
              {agentId ?? email}
            </p>
          </div>
          <StatusBadge status="active" />
        </CardContent>
      </Card>

      <Tabs defaultValue="personal">
        <TabsList className="w-full grid-cols-4">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="kyc" disabled={!agent}>KYC</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-3">
          <Card className="gap-0 py-0 shadow-xs">
            <CardContent className="divide-y px-5 py-2">
              <Row label="Full Name" value={fullName} />
              <Row label={agent ? "Agent ID" : "Email"} value={agentId ?? email} mono />
              {agent?.nationalId ? <Row label="ID/Passport" value={agent.nationalId} mono /> : null}
              {agent?.iceCashId ? <Row label="IceCash ID" value={agent.iceCashId} mono /> : null}
              {agent ? <Row label="Joined Date" value={formatDate(agent.joinedAt)} /> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="mt-3">
          <Card className="gap-0 py-0 shadow-xs">
            <CardContent className="divide-y px-5 py-2">
              <Row label="Email" value={email} />
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
          <div className="mt-3">
            <ChangePasswordButton className="h-10 w-full text-[13.5px]" />
          </div>
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
    </>
  );
}
