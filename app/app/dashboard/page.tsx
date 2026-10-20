import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  console.log("[DashboardPage] Starting dashboard page load");
  const session = await getSession();
  console.log("[DashboardPage] Session:", session?.user.email, "role:", session?.user.role);
  
  if (!session) {
    console.log("[DashboardPage] No session, redirecting to login");
    redirect("/login");
  }

  console.log("[DashboardPage] Rendering simple dashboard");
  
  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Dashboard</h1>
      <div style={{ marginBottom: "1rem" }}>
        <strong>Welcome, {session.user.fullName}</strong>
      </div>
      <div style={{ marginBottom: "0.5rem" }}>
        Email: {session.user.email}
      </div>
      <div style={{ marginBottom: "0.5rem" }}>
        Role: {session.user.role}
      </div>
      <div style={{ marginBottom: "0.5rem" }}>
        Status: {session.user.status}
      </div>
      <div style={{ marginTop: "2rem", padding: "1rem", backgroundColor: "#f0f0f0", borderRadius: "8px" }}>
        <p>If you can see this, the dashboard is loading successfully!</p>
      </div>
    </div>
  );
}
