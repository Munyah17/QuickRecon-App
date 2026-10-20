"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Communication {
  id: string;
  message: string;
  channel: "sms" | "email" | "whatsapp" | "in_app";
  status: "pending" | "sent" | "failed" | "scheduled";
  recipient_count: number;
  sent_at: string | null;
  scheduled_for: string | null;
  sent_by: {
    full_name: string | null;
    email: string | null;
  } | null;
}

interface Summary {
  total: number;
  byChannel: {
    sms: number;
    email: number;
    whatsapp: number;
    in_app: number;
  };
  byStatus: {
    sent: number;
    failed: number;
    scheduled: number;
    pending: number;
  };
  totalRecipients: number;
}

export function CommunicationsHistory() {
  const [communications, setCommunications] = React.useState<Communication[]>([]);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [channelFilter, setChannelFilter] = React.useState<string>("all");

  const fetchCommunications = React.useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/communications${channelFilter !== "all" ? `?channel=${channelFilter}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setCommunications(data.communications || []);
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error("Failed to fetch communications:", error);
    } finally {
      setLoading(false);
    }
  }, [channelFilter]);

  React.useEffect(() => {
    fetchCommunications();
  }, [fetchCommunications]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getChannelLabel = (channel: string) => {
    const labels: Record<string, string> = {
      sms: "SMS",
      email: "Email",
      whatsapp: "WhatsApp",
      in_app: "In-app",
    };
    return labels[channel] || channel;
  };


  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="gap-0 py-0 shadow-xs">
            <CardContent className="p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-3 md:grid-cols-4">
          <Card className="gap-0 py-0 shadow-xs">
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Total Sent</p>
              <p className="mt-1 text-2xl font-semibold">{summary.total}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{summary.totalRecipients} recipients</p>
            </CardContent>
          </Card>
          <Card className="gap-0 py-0 shadow-xs">
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">SMS</p>
              <p className="mt-1 text-2xl font-semibold">{summary.byChannel.sms}</p>
            </CardContent>
          </Card>
          <Card className="gap-0 py-0 shadow-xs">
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Email</p>
              <p className="mt-1 text-2xl font-semibold">{summary.byChannel.email}</p>
            </CardContent>
          </Card>
          <Card className="gap-0 py-0 shadow-xs">
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">WhatsApp</p>
              <p className="mt-1 text-2xl font-semibold">{summary.byChannel.whatsapp}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-[180px] h-9 text-[13px]">
            <SelectValue placeholder="Filter by channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="in_app">In-app</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9 text-[13px]" onClick={fetchCommunications}>
          Refresh
        </Button>
      </div>

      {/* History List */}
      {communications.length === 0 ? (
        <Card className="gap-0 py-0 shadow-xs">
          <CardContent className="p-8 text-center">
            <p className="text-[13px] text-muted-foreground">No communications sent yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {communications.map((comm) => (
            <Card key={comm.id} className="gap-0 py-0 shadow-xs">
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-[200px] flex-1">
                  <p className="text-[13.5px] font-medium line-clamp-2">{comm.message}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {comm.recipient_count} recipients · {getChannelLabel(comm.channel)} · {formatDate(comm.sent_at || comm.scheduled_for)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={comm.status} />
                  {comm.sent_by && (
                    <span className="text-[11px] text-muted-foreground">
                      by {comm.sent_by.full_name || comm.sent_by.email}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
